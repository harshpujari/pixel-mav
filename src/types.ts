import type * as vscode from 'vscode';

export type CatBreed = 'tabby' | 'tuxedo' | 'calico' | 'siamese' | 'void' | 'orange';

export type AgentStatus = 'active' | 'idle' | 'waiting';

export interface AgentState {
  id: number;
  sessionId: string;
  terminalRef: vscode.Terminal;
  status: AgentStatus;
  activeTool: string | null;
  breed: CatBreed;
  hueShift: number;
  seatId: string | null;
  jsonlPath: string | null;
  parentId: number | null;
}

export interface PersistedAgent {
  id: number;
  sessionId: string;
  breed: CatBreed;
  hueShift: number;
  seatId: string | null;
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
