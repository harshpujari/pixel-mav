import type * as vscode from 'vscode';

export type CatBreed = 'tabby' | 'tuxedo' | 'calico' | 'siamese' | 'void' | 'orange';

export type AgentStatus = 'active' | 'idle' | 'waiting';

export interface AgentState {
  id: number;
  sessionId: string;
  terminalRef: vscode.Terminal | null;
  status: AgentStatus;
  activeTool: string | null;
  breed: CatBreed;
  hueShift: number;
  seatCol: number;
  seatRow: number;
  jsonlPath: string | null;
  parentId: number | null;
}

export interface PersistedAgent {
  id: number;
  sessionId: string;
  breed: CatBreed;
  hueShift: number;
  seatCol: number;
  seatRow: number;
}

// ── Transcript parsing (Phase 4) ────────────────────────────

export type TranscriptEvent =
  | { kind: 'tool_start'; toolId: string; toolName: string }
  | { kind: 'tool_result'; toolId: string }
  | { kind: 'turn_end'; durationMs: number };

/** Reconciled agent state emitted by StateReconciler. */
export interface ReconciledState {
  status: AgentStatus;
  activeTool: string | null;
}

// ── IPC: Extension → Webview (Phase 5) ──────────────────────

export interface CatSpawnedMessage {
  type: 'catSpawned';
  agentId: string;
  breed: CatBreed;
  hueShift: number;
  seatCol: number;
  seatRow: number;
  isSubagent: boolean;
  parentAgentId: string | null;
}

export interface CatDespawnedMessage {
  type: 'catDespawned';
  agentId: string;
}

export interface AgentActiveMessage {
  type: 'agentActive';
  agentId: string;
  tool: string;
  catState: 'type' | 'read' | 'wait';
}

export interface AgentIdleMessage {
  type: 'agentIdle';
  agentId: string;
}

export interface AgentPermissionMessage {
  type: 'agentPermission';
  agentId: string;
  tool: string;
}

export interface ExistingCatsMessage {
  type: 'existingCats';
  cats: Array<{
    agentId: string;
    breed: CatBreed;
    hueShift: number;
    seatCol: number;
    seatRow: number;
    isSubagent: boolean;
    parentAgentId: string | null;
    status: AgentStatus;
    activeTool: string | null;
  }>;
}

export type ExtensionToWebviewMessage =
  | CatSpawnedMessage
  | CatDespawnedMessage
  | AgentActiveMessage
  | AgentIdleMessage
  | AgentPermissionMessage
  | ExistingCatsMessage
  | { type: 'settingsLoaded'; soundEnabled: boolean };
