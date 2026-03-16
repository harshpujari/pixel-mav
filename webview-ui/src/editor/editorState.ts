// ── Editor tool types ────────────────────────────────────────

export type EditorTool =
  | 'select'
  | 'floor'
  | 'wall'
  | 'sunny'
  | 'erase'
  | 'furniture'
  | 'eyedropper';

// ── Layout snapshot for undo/redo ────────────────────────────

export interface LayoutSnapshot {
  tiles: number[];
  cols: number;
  rows: number;
  furniture: Array<{
    id: string;
    type: string;
    col: number;
    row: number;
    rotation: 0 | 1 | 2 | 3;
    active: boolean;
  }>;
}

// ── Editor state singleton ───────────────────────────────────

export const editor = {
  active: false,
  tool: 'select' as EditorTool,
  furnitureType: 'desk',
  ghostRotation: 0 as 0 | 1 | 2 | 3,
  cursorCol: -1,
  cursorRow: -1,
  selectedFurnitureId: null as string | null,
  isDragging: false,
};

export const undoStack: LayoutSnapshot[] = [];
export const redoStack: LayoutSnapshot[] = [];

// ── Subscription (for React toolbar) ────────────────────────

type Listener = () => void;
const listeners: Listener[] = [];
let version = 0;

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function getVersion(): number {
  return version;
}

export function notify(): void {
  version++;
  for (const fn of listeners) fn();
}
