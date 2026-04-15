import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { parseLine } from './transcriptParser.js';
import { StateReconciler, toolToCatState } from './stateReconciler.js';
import { TranscriptWatcher, claudeProjectDir } from './transcriptWatcher.js';
import type {
  AgentState,
  CatBreed,
  ExtensionToWebviewMessage,
  ReconciledState,
  TranscriptEvent,
} from './types.js';

// ── Configuration ────────────────────────────────────────────

const BREEDS: CatBreed[] = ['tabby', 'tuxedo', 'calico', 'siamese', 'void', 'orange'];

/** Terminal name pattern for Claude Code terminals. */
const CLAUDE_TERMINAL_RE = /claude/i;

/** How long to wait for a JSONL file to appear after terminal opens. */
const JSONL_DISCOVERY_MS = 10_000;
const JSONL_SCAN_INTERVAL_MS = 1_000;

/** How often to scan the project directory for new JSONL files (file-based detection). */
const DIR_SCAN_INTERVAL_MS = 3_000;

/** A file-based agent is considered stale if its JSONL hasn't been written to in this long. */
const FILE_AGENT_STALE_MS = 60_000;

/** Only consider JSONL files modified within this window as "active" for file-based detection. */
const FILE_AGENT_RECENT_MS = 30_000;

/** Predefined seat positions on the grid (Phase 6 replaces with desk-derived seats). */
const DEFAULT_SEATS: Array<{ col: number; row: number }> = [
  { col: 3, row: 3 },  { col: 7, row: 3 },
  { col: 11, row: 3 }, { col: 15, row: 3 },
  { col: 3, row: 7 },  { col: 7, row: 7 },
  { col: 11, row: 7 }, { col: 15, row: 7 },
];

// ── AgentManager ─────────────────────────────────────────────

export class AgentManager {
  private agents = new Map<number, AgentState>();
  private watchers = new Map<number, TranscriptWatcher>();
  private reconcilers = new Map<number, StateReconciler>();

  /** Terminal → agent ID mapping. */
  private terminalToAgent = new Map<vscode.Terminal, number>();

  /** Track which JSONL paths are already claimed by an agent. */
  private claimedJsonls = new Set<string>();

  /** Sub-agent tracking: toolId → child agent ID. */
  private subAgentTools = new Map<string, number>();

  /** Agents spawned via file-based detection (no terminal). Keyed by JSONL path. */
  private fileAgents = new Map<string, number>();

  private nextId = 1;
  private breedIndex = 0;
  private disposables: vscode.Disposable[] = [];
  private dirScanInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly postToWebview: (msg: ExtensionToWebviewMessage) => void,
    private readonly workspacePath: string,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────

  start(): void {
    // Scan existing terminals
    for (const terminal of vscode.window.terminals) {
      if (this.isClaudeTerminal(terminal)) {
        this.spawnAgent(terminal);
      }
    }

    // Watch for new and closed terminals
    this.disposables.push(
      vscode.window.onDidOpenTerminal((t) => {
        if (this.isClaudeTerminal(t)) this.spawnAgent(t);
      }),
    );
    this.disposables.push(
      vscode.window.onDidCloseTerminal((t) => {
        const agentId = this.terminalToAgent.get(t);
        if (agentId !== undefined) this.despawnAgent(agentId);
      }),
    );

    // File-based detection: scan project dir for active JSONL files
    // This catches Claude sessions that don't have a matching terminal name
    this.scanDirectoryForAgents();
    this.dirScanInterval = setInterval(
      () => this.scanDirectoryForAgents(),
      DIR_SCAN_INTERVAL_MS,
    );
  }

  dispose(): void {
    if (this.dirScanInterval) {
      clearInterval(this.dirScanInterval);
      this.dirScanInterval = null;
    }
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    for (const w of this.watchers.values()) w.stop();
    this.watchers.clear();
    for (const r of this.reconcilers.values()) r.dispose();
    this.reconcilers.clear();
    this.agents.clear();
    this.terminalToAgent.clear();
    this.claimedJsonls.clear();
    this.subAgentTools.clear();
    this.fileAgents.clear();
  }

  /** Build the existingCats message for webview reload recovery. */
  getExistingCatsMessage(): ExtensionToWebviewMessage {
    return {
      type: 'existingCats',
      cats: [...this.agents.values()].map((a) => ({
        agentId: String(a.id),
        breed: a.breed,
        hueShift: a.hueShift,
        seatCol: a.seatCol,
        seatRow: a.seatRow,
        isSubagent: a.parentId !== null,
        parentAgentId: a.parentId !== null ? String(a.parentId) : null,
        status: a.status,
        activeTool: a.activeTool,
      })),
    };
  }

  getAgent(agentIdStr: string): AgentState | undefined {
    const id = Number(agentIdStr);
    return this.agents.get(id);
  }

  // ── Terminal detection ───────────────────────────────────

  private isClaudeTerminal(terminal: vscode.Terminal): boolean {
    return CLAUDE_TERMINAL_RE.test(terminal.name);
  }

  // ── Agent spawn / despawn ────────────────────────────────

  private spawnAgent(terminal: vscode.Terminal): void {
    // Don't double-spawn
    if (this.terminalToAgent.has(terminal)) return;

    const id = this.nextId++;
    const { breed, hueShift } = this.pickBreed();
    const seat = this.pickSeat();

    const agent: AgentState = {
      id,
      sessionId: '',
      terminalRef: terminal,
      status: 'idle',
      activeTool: null,
      breed,
      hueShift,
      seatCol: seat.col,
      seatRow: seat.row,
      jsonlPath: null,
      parentId: null,
    };

    this.agents.set(id, agent);
    this.terminalToAgent.set(terminal, id);

    this.postToWebview({
      type: 'catSpawned',
      agentId: String(id),
      breed,
      hueShift,
      seatCol: seat.col,
      seatRow: seat.row,
      isSubagent: false,
      parentAgentId: null,
    });

    // Start scanning for this agent's JSONL file
    this.discoverJsonl(id);
  }

  private despawnAgent(id: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    // Despawn any sub-agents first
    for (const [toolId, childId] of this.subAgentTools) {
      const child = this.agents.get(childId);
      if (child?.parentId === id) {
        this.despawnSubAgent(toolId, childId);
      }
    }

    // Tear down watcher + reconciler
    this.watchers.get(id)?.stop();
    this.watchers.delete(id);
    this.reconcilers.get(id)?.dispose();
    this.reconcilers.delete(id);

    if (agent.jsonlPath) {
      this.claimedJsonls.delete(agent.jsonlPath);
      this.fileAgents.delete(agent.jsonlPath);
    }
    if (agent.terminalRef) this.terminalToAgent.delete(agent.terminalRef);

    this.agents.delete(id);
    this.postToWebview({ type: 'catDespawned', agentId: String(id) });
  }

  // ── JSONL discovery ──────────────────────────────────────

  /**
   * Scan the Claude project directory for unclaimed JSONL files.
   * Try every second for up to JSONL_DISCOVERY_MS.
   */
  private discoverJsonl(agentId: number): void {
    const projectDir = claudeProjectDir(this.workspacePath);
    let elapsed = 0;

    const scan = () => {
      try {
        const files = fs.readdirSync(projectDir)
          .filter((f) => f.endsWith('.jsonl'))
          .map((f) => ({
            name: f,
            full: path.join(projectDir, f),
            mtime: fs.statSync(path.join(projectDir, f)).mtimeMs,
          }))
          .filter((f) => !this.claimedJsonls.has(f.full))
          .sort((a, b) => b.mtime - a.mtime); // newest first

        if (files.length > 0) {
          const chosen = files[0];
          this.claimedJsonls.add(chosen.full);
          const agent = this.agents.get(agentId);
          if (agent) {
            agent.jsonlPath = chosen.full;
            agent.sessionId = chosen.name.replace('.jsonl', '');
            this.wireWatcher(agent);
          }
          return; // done
        }
      } catch {
        // Directory doesn't exist yet — keep trying
      }

      elapsed += JSONL_SCAN_INTERVAL_MS;
      if (elapsed < JSONL_DISCOVERY_MS) {
        setTimeout(scan, JSONL_SCAN_INTERVAL_MS);
      }
      // If we never find a JSONL, the cat just stays idle. That's fine.
    };

    scan();
  }

  // ── File-based agent detection ────────────────────────────

  /**
   * Scan the Claude project directory for active JSONL files not claimed
   * by any terminal-based agent. This catches Claude sessions launched
   * from terminals whose name doesn't match /claude/i (e.g. user typed
   * `claude` in a plain "zsh" terminal).
   *
   * Also checks for stale file-based agents and despawns them.
   */
  private scanDirectoryForAgents(): void {
    const projectDir = claudeProjectDir(this.workspacePath);
    const now = Date.now();

    let files: Array<{ name: string; full: string; mtime: number }>;
    try {
      files = fs.readdirSync(projectDir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => {
          const full = path.join(projectDir, f);
          return { name: f, full, mtime: fs.statSync(full).mtimeMs };
        });
    } catch {
      return; // Directory doesn't exist yet
    }

    // Spawn agents for unclaimed, recently-modified JSONL files
    for (const file of files) {
      if (this.claimedJsonls.has(file.full)) continue;
      if (now - file.mtime > FILE_AGENT_RECENT_MS) continue;

      this.spawnFileAgent(file.full, file.name);
    }

    // Despawn stale file-based agents
    for (const [jsonlPath, agentId] of this.fileAgents) {
      try {
        const mtime = fs.statSync(jsonlPath).mtimeMs;
        if (now - mtime > FILE_AGENT_STALE_MS) {
          this.despawnAgent(agentId);
          this.fileAgents.delete(jsonlPath);
        }
      } catch {
        // File gone — despawn
        this.despawnAgent(agentId);
        this.fileAgents.delete(jsonlPath);
      }
    }
  }

  /**
   * Spawn an agent from a JSONL file (no terminal reference).
   */
  private spawnFileAgent(jsonlFullPath: string, fileName: string): void {
    const id = this.nextId++;
    const { breed, hueShift } = this.pickBreed();
    const seat = this.pickSeat();

    const agent: AgentState = {
      id,
      sessionId: fileName.replace('.jsonl', ''),
      terminalRef: null,
      status: 'idle',
      activeTool: null,
      breed,
      hueShift,
      seatCol: seat.col,
      seatRow: seat.row,
      jsonlPath: jsonlFullPath,
      parentId: null,
    };

    this.agents.set(id, agent);
    this.claimedJsonls.add(jsonlFullPath);
    this.fileAgents.set(jsonlFullPath, id);

    this.postToWebview({
      type: 'catSpawned',
      agentId: String(id),
      breed,
      hueShift,
      seatCol: seat.col,
      seatRow: seat.row,
      isSubagent: false,
      parentAgentId: null,
    });

    // Wire up transcript watching immediately since we already have the JSONL
    this.wireWatcher(agent);
  }

  // ── Watcher + Reconciler wiring ──────────────────────────

  private wireWatcher(agent: AgentState): void {
    if (!agent.jsonlPath) return;

    const reconciler = new StateReconciler(
      (state) => this.onAgentStateChange(agent.id, state),
      (event) => this.onAgentEvent(agent.id, event),
    );

    const watcher = new TranscriptWatcher(agent.jsonlPath, (line) => {
      const events = parseLine(line);
      if (events.length > 0) reconciler.push(events);
    });

    this.reconcilers.set(agent.id, reconciler);
    this.watchers.set(agent.id, watcher);
    watcher.start();
  }

  // ── State change → IPC ───────────────────────────────────

  private onAgentStateChange(agentId: number, state: ReconciledState): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = state.status;
    agent.activeTool = state.activeTool;

    switch (state.status) {
      case 'active':
        this.postToWebview({
          type: 'agentActive',
          agentId: String(agentId),
          tool: state.activeTool ?? 'unknown',
          catState: toolToCatState(state.activeTool ?? 'unknown'),
        });
        break;

      case 'idle':
        this.postToWebview({
          type: 'agentIdle',
          agentId: String(agentId),
        });
        break;

      case 'waiting':
        this.postToWebview({
          type: 'agentPermission',
          agentId: String(agentId),
          tool: state.activeTool ?? 'unknown',
        });
        break;
    }
  }

  // ── Raw event hook (sub-agent detection) ─────────────────

  private onAgentEvent(parentId: number, event: TranscriptEvent): void {
    if (event.kind === 'tool_start' && event.toolName === 'Task') {
      this.spawnSubAgent(parentId, event.toolId);
    }
    if (event.kind === 'tool_result') {
      const childId = this.subAgentTools.get(event.toolId);
      if (childId !== undefined) {
        this.despawnSubAgent(event.toolId, childId);
      }
    }
  }

  // ── Sub-agent lifecycle ──────────────────────────────────

  private spawnSubAgent(parentId: number, toolId: string): void {
    const parent = this.agents.get(parentId);
    if (!parent) return;

    const childId = -(parentId * 100 + this.subAgentTools.size + 1);
    const seat = this.pickSeat(parentId);

    const child: AgentState = {
      id: childId,
      sessionId: '',
      terminalRef: null,
      status: 'active',
      activeTool: 'Task',
      breed: parent.breed,
      hueShift: parent.hueShift,
      seatCol: seat.col,
      seatRow: seat.row,
      jsonlPath: null,
      parentId,
    };

    this.agents.set(childId, child);
    this.subAgentTools.set(toolId, childId);

    this.postToWebview({
      type: 'catSpawned',
      agentId: String(childId),
      breed: child.breed,
      hueShift: child.hueShift,
      seatCol: seat.col,
      seatRow: seat.row,
      isSubagent: true,
      parentAgentId: String(parentId),
    });

    // Sub-agent immediately appears active (typing)
    this.postToWebview({
      type: 'agentActive',
      agentId: String(childId),
      tool: 'Task',
      catState: 'type',
    });
  }

  private despawnSubAgent(toolId: string, childId: number): void {
    this.subAgentTools.delete(toolId);
    this.agents.delete(childId);
    this.postToWebview({ type: 'catDespawned', agentId: String(childId) });
  }

  // ── Breed + seat assignment ──────────────────────────────

  /**
   * Pick the least-used breed among active agents.
   * Ties broken by round-robin (breedIndex). Beyond 6 agents,
   * breeds repeat with a hue shift of 45° per duplicate.
   */
  private pickBreed(): { breed: CatBreed; hueShift: number } {
    // Count active non-sub-agent cats per breed
    const counts = new Map<CatBreed, number>();
    for (const b of BREEDS) counts.set(b, 0);
    for (const agent of this.agents.values()) {
      if (agent.parentId !== null) continue;
      counts.set(agent.breed, (counts.get(agent.breed) ?? 0) + 1);
    }

    // Find the minimum usage count
    let minCount = Infinity;
    for (const c of counts.values()) {
      if (c < minCount) minCount = c;
    }

    // Among breeds at minimum count, rotate via breedIndex
    const candidates = BREEDS.filter(b => (counts.get(b) ?? 0) === minCount);
    const breed = candidates[this.breedIndex % candidates.length];
    this.breedIndex++;

    // Hue shift: 45° per existing agent with the same breed
    const hueShift = minCount > 0 ? minCount * 45 : 0;
    return { breed, hueShift };
  }

  /**
   * Pick the next available seat. If parentId is given, prefer a seat
   * adjacent to the parent's seat.
   */
  private pickSeat(parentId?: number): { col: number; row: number } {
    const taken = new Set(
      [...this.agents.values()].map((a) => `${a.seatCol},${a.seatRow}`),
    );

    const available = DEFAULT_SEATS.filter(
      (s) => !taken.has(`${s.col},${s.row}`),
    );

    if (available.length === 0) {
      // All seats taken — stack on the last default seat
      const last = DEFAULT_SEATS[DEFAULT_SEATS.length - 1];
      return { col: last.col, row: last.row };
    }

    if (parentId !== undefined) {
      const parent = this.agents.get(parentId);
      if (parent) {
        // Sort by distance to parent seat
        available.sort((a, b) => {
          const da = Math.abs(a.col - parent.seatCol) + Math.abs(a.row - parent.seatRow);
          const db = Math.abs(b.col - parent.seatCol) + Math.abs(b.row - parent.seatRow);
          return da - db;
        });
      }
    }

    return available[0];
  }
}
