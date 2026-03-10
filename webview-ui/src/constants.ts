// ── Tile & Grid ──────────────────────────────────────────────
export const TILE_SIZE = 16; // px per tile (native resolution)
export const DEFAULT_GRID_COLS = 20;
export const DEFAULT_GRID_ROWS = 11;
export const MAX_GRID_SIZE = 64;

// ── Game Loop ────────────────────────────────────────────────
export const MAX_DELTA_SEC = 0.1; // 100ms cap in seconds — prevents spiral of death

// ── Camera ───────────────────────────────────────────────────
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 10;
export const ZOOM_DEFAULT = 3;
export const ZOOM_SCROLL_THRESHOLD = 50; // accumulator threshold for trackpad pinch
export const CAMERA_FOLLOW_LERP = 0.1; // per-frame smoothing factor
export const CAMERA_FOLLOW_SNAP_THRESHOLD = 0.5; // snap when within this many device pixels
export const PAN_MARGIN_FRACTION = 0.25; // map must stay at least 25% visible

// ── Rendering ────────────────────────────────────────────────
export const CHUNK_SIZE = 8; // tiles per dirty-region chunk
