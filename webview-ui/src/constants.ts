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

// ── Cat movement ─────────────────────────────────────────────
export const WALK_SPEED = 3;    // tiles/sec (normal walk, wander)
export const ZOOMIES_SPEED = 6; // tiles/sec (zoomies state)

// ── Cat behavior durations (seconds) ─────────────────────────
export const IDLE_MIN_SEC = 1;
export const IDLE_MAX_SEC = 3;
export const SLEEP_MIN_SEC = 8;
export const SLEEP_MAX_SEC = 15;
export const GROOM_MIN_SEC = 3;
export const GROOM_MAX_SEC = 5;
export const STRETCH_MIN_SEC = 2;
export const STRETCH_MAX_SEC = 3;
export const ZOOMIES_MIN_SEC = 3;
export const ZOOMIES_MAX_SEC = 5;

// ── Cat animation frame speeds (seconds per frame) ───────────
export const WALK_FRAME_SEC = 0.15;
export const TYPE_FRAME_SEC = 0.25;
export const READ_FRAME_SEC = 0.4;
export const SLEEP_FRAME_SEC = 0.8;
export const GROOM_FRAME_SEC = 0.5;
export const STRETCH_FRAME_SEC = 0.6;

// ── Social behavior (Phase 9) ────────────────────────────────
export const SOCIAL_COOLDOWN_SEC = 15;  // cooldown after any social attempt
export const SOCIAL_RANGE_TILES = 3;    // proximity detection range (Manhattan distance)
export const HEADBONK_SEC = 2;          // headbonk duration
export const PLAY_MIN_SEC = 3;
export const PLAY_MAX_SEC = 5;

// ── Spawn / despawn effects (Phase 11) ──────────────────────
export const SPAWN_DURATION = 0.4;   // seconds — cat fade-in
export const DESPAWN_DURATION = 0.5; // seconds — yawn → curl → fade-out

// ── Agent behavior ──────────────────────────────────────────
export const AGENT_IDLE_COOLDOWN_SEC = 2; // delay before first idle behavior after agent goes idle
