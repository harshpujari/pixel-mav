import type { AgentStatus, ReconciledState, TranscriptEvent } from './types.js';

// ── Configuration ─────────────────────────────────────────────

const RECONCILE_MS = 200;   // event coalescing window
const SILENCE_MS = 5000;    // no data + no active tools → idle
const PERMISSION_MS = 7000; // non-exempt tool active + no data → waiting

/** Tools that can run for a long time without indicating a permission prompt. */
const PERMISSION_EXEMPT = new Set(['Task', 'Agent', 'AskUserQuestion']);

/** Tools that immediately signal a waiting state (user must respond). */
const IMMEDIATE_WAIT = new Set(['AskUserQuestion']);

/**
 * Transforms a stream of TranscriptEvents into clean AgentState transitions.
 *
 * - Buffers events for 200ms to coalesce rapid tool start/stop.
 * - Tracks active tool IDs (started but not yet completed).
 * - Uses turn_duration as the authoritative "turn ended" signal → IDLE.
 * - 5s silence fallback → IDLE when no data arrives and no tools are active.
 * - 7s silence with active non-exempt tool → WAITING (permission prompt assumed).
 * - AskUserQuestion immediately signals WAITING.
 */
export class StateReconciler {
  private activeTools = new Map<string, string>(); // toolId → toolName

  private pendingEvents: TranscriptEvent[] = [];
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  private current: ReconciledState = { status: 'idle', activeTool: null };
  private readonly onChange: (state: ReconciledState) => void;
  private readonly onEvent?: (event: TranscriptEvent) => void;

  constructor(
    onChange: (state: ReconciledState) => void,
    onEvent?: (event: TranscriptEvent) => void,
  ) {
    this.onChange = onChange;
    this.onEvent = onEvent;
  }

  /**
   * Feed parsed events from one JSONL line.
   * Any new data resets the inactivity timer (agent is still producing output).
   */
  push(events: TranscriptEvent[]): void {
    this.clearInactivity();

    if (events.length > 0) {
      for (const e of events) {
        this.onEvent?.(e);
      }
      this.pendingEvents.push(...events);
      if (!this.reconcileTimer) {
        this.reconcileTimer = setTimeout(() => this.reconcile(), RECONCILE_MS);
      }
    }

    this.startInactivity();
  }

  dispose(): void {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.clearInactivity();
  }

  // ── Internals ───────────────────────────────────────────────

  private reconcile(): void {
    this.reconcileTimer = null;
    let turnEnded = false;

    for (const e of this.pendingEvents) {
      switch (e.kind) {
        case 'tool_start':
          this.activeTools.set(e.toolId, e.toolName);
          break;
        case 'tool_result':
          this.activeTools.delete(e.toolId);
          break;
        case 'turn_end':
          this.activeTools.clear();
          turnEnded = true;
          break;
      }
    }
    this.pendingEvents = [];

    if (turnEnded) {
      this.emit({ status: 'idle', activeTool: null });
    } else if (this.activeTools.size > 0) {
      const toolName = lastValue(this.activeTools);
      const status: AgentStatus = IMMEDIATE_WAIT.has(toolName) ? 'waiting' : 'active';
      this.emit({ status, activeTool: toolName });
    }
    // If no active tools and no turn_end → inactivity timer handles it

    // Refresh inactivity timer with the reconciled active-tool set
    this.clearInactivity();
    this.startInactivity();
  }

  private startInactivity(): void {
    const hasNonExempt = [...this.activeTools.values()].some(
      n => !PERMISSION_EXEMPT.has(n),
    );

    if (hasNonExempt) {
      // Non-exempt tool running: if 7s passes with no data → permission prompt
      this.inactivityTimer = setTimeout(() => {
        this.inactivityTimer = null;
        this.emit({ status: 'waiting', activeTool: lastValue(this.activeTools) });
      }, PERMISSION_MS);
    } else if (this.activeTools.size === 0) {
      // No active tools: if 5s passes with no data → idle
      this.inactivityTimer = setTimeout(() => {
        this.inactivityTimer = null;
        this.emit({ status: 'idle', activeTool: null });
      }, SILENCE_MS);
    }
    // Only exempt tools active (Task, Agent) → no timer; they can run for minutes
  }

  private clearInactivity(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private emit(state: ReconciledState): void {
    if (
      state.status === this.current.status &&
      state.activeTool === this.current.activeTool
    ) return;
    this.current = state;
    this.onChange(state);
  }
}

// ── Tool → Cat state mapping ──────────────────────────────────

const TYPING_TOOLS = new Set([
  'Write', 'Edit', 'Bash', 'Task', 'NotebookEdit', 'Agent',
]);
const READING_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
]);

/**
 * Map a Claude Code tool name to the corresponding cat activity state.
 * Used by Phase 5 to drive cat animations from agent tool use.
 */
export function toolToCatState(toolName: string): 'type' | 'read' | 'wait' {
  if (READING_TOOLS.has(toolName)) return 'read';
  if (TYPING_TOOLS.has(toolName)) return 'type';
  if (IMMEDIATE_WAIT.has(toolName)) return 'wait';
  return 'type'; // default: unknown tools → typing animation
}

// ── Helpers ───────────────────────────────────────────────────

/** Get the last value from a Map (most recently inserted). */
function lastValue<V>(map: Map<string, V>): V {
  let last!: V;
  for (const v of map.values()) last = v;
  return last;
}
