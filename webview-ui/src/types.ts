// ── Cat entity types (webview-side) ─────────────────────────

export type CatState =
  | 'idle' | 'walk' | 'type' | 'read' | 'wait'        // core
  | 'sleep' | 'groom' | 'stretch'                       // idle behaviors
  | 'wander' | 'zoomies'                                 // movement behaviors
  | 'nap_pile' | 'play' | 'headbonk';                   // social behaviors (Phase 9)

export type CatBreed = 'tabby' | 'tuxedo' | 'calico' | 'siamese' | 'void' | 'orange';

// 4 explicit directions; Phase 7 sprite renderer flips 'right' sprites for 'left'
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface TileCoord {
  col: number;
  row: number;
}

export interface Cat {
  id: string;

  // Agent binding (Phase 5)
  agentId: string | null;
  seatCol: number;
  seatRow: number;
  activeTool: string | null;
  targetWorkState: 'type' | 'read' | 'wait' | null;
  isSubagent: boolean;
  parentAgentId: string | null;

  // Appearance
  breed: CatBreed;
  hueShift: number; // degrees; used for >6 agents (Phase 10)

  // Position — world pixels (tile center), updated each frame during movement
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;

  // State machine
  state: CatState;
  stateTimer: number;    // seconds elapsed in current state
  stateDuration: number; // transition trigger (for timed states)

  // Movement
  path: TileCoord[];   // BFS waypoints (Phase 6); Phase 3 uses direct single-tile path
  moveProgress: number; // 0–1 lerp between current tile and path[0]
  speed: number;        // tiles per second

  // Animation (drives sprite frame selection in Phase 7)
  direction: Direction;
  frame: number;
  frameTimer: number;   // seconds since last frame advance

  // Social (Phase 9)
  socialCooldown: number;

  // UI (Phase 14)
  bubbleType: 'permission' | 'waiting' | null;
  bubbleTimer: number;

  // Spawn / despawn effects (Phase 11)
  spawnEffect: boolean;
  despawnEffect: boolean;
  effectTimer: number;
}
