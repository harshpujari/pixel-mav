import {
  GROOM_FRAME_SEC,
  GROOM_MAX_SEC,
  GROOM_MIN_SEC,
  IDLE_MAX_SEC,
  IDLE_MIN_SEC,
  READ_FRAME_SEC,
  SLEEP_FRAME_SEC,
  SLEEP_MAX_SEC,
  SLEEP_MIN_SEC,
  STRETCH_FRAME_SEC,
  STRETCH_MAX_SEC,
  STRETCH_MIN_SEC,
  TILE_SIZE,
  TYPE_FRAME_SEC,
  WALK_FRAME_SEC,
  WALK_SPEED,
  ZOOMIES_MAX_SEC,
  ZOOMIES_MIN_SEC,
  ZOOMIES_SPEED,
} from '../constants.ts';
import type { Cat, CatState, Direction, TileCoord } from '../types.ts';

// ── Public entry point ────────────────────────────────────────

/**
 * Advance a single cat by `dt` seconds.
 * Pure function: reads/writes only the passed `cat` object.
 * No store or renderer imports — keeps this testable in isolation.
 */
export function updateCat(cat: Cat, dt: number, gridCols: number, gridRows: number): void {
  cat.stateTimer += dt;
  advanceAnimation(cat, dt);

  switch (cat.state) {
    case 'idle':    updateIdle(cat, gridCols, gridRows); break;
    case 'walk':
    case 'wander':
    case 'zoomies': updateMovement(cat, dt, gridCols, gridRows); break;
    case 'sleep':
    case 'groom':
    case 'stretch': updateTimedBehavior(cat); break;
    // 'type' | 'read' | 'wait' — driven by agent IPC (Phase 5)
    // 'nap_pile' | 'play' | 'headbonk' — social behaviors (Phase 9)
    default: break;
  }
}

// ── State updates ─────────────────────────────────────────────

function updateIdle(cat: Cat, gridCols: number, gridRows: number): void {
  if (cat.stateTimer >= cat.stateDuration) {
    pickIdleBehavior(cat, gridCols, gridRows);
  }
}

function updateTimedBehavior(cat: Cat): void {
  if (cat.stateTimer >= cat.stateDuration) {
    toIdle(cat);
  }
}

function updateMovement(cat: Cat, dt: number, gridCols: number, gridRows: number): void {
  if (cat.path.length === 0) {
    onArrival(cat, gridCols, gridRows);
    return;
  }

  const next = cat.path[0];

  // Direction toward next tile
  cat.direction = tileDirection(cat.tileCol, cat.tileRow, next.col, next.row);

  // Advance progress (clamped to 1 — no multi-tile skip needed at these speeds)
  cat.moveProgress = Math.min(cat.moveProgress + cat.speed * dt, 1);

  // Interpolate world position between current tile center and next tile center
  const fromX = tileCenter(cat.tileCol);
  const fromY = tileCenter(cat.tileRow);
  cat.x = fromX + (tileCenter(next.col) - fromX) * cat.moveProgress;
  cat.y = fromY + (tileCenter(next.row) - fromY) * cat.moveProgress;

  if (cat.moveProgress >= 1) {
    // Snap to arrived tile
    cat.tileCol = next.col;
    cat.tileRow = next.row;
    cat.x = tileCenter(cat.tileCol);
    cat.y = tileCenter(cat.tileRow);
    cat.path.shift();
    cat.moveProgress = 0;

    if (cat.path.length === 0) {
      onArrival(cat, gridCols, gridRows);
    }
  }
}

// ── Arrival logic ─────────────────────────────────────────────

function onArrival(cat: Cat, gridCols: number, gridRows: number): void {
  switch (cat.state) {
    case 'walk':
      // Agent-driven: if cat arrived at its seat with a pending work state, start working
      if (
        cat.targetWorkState !== null &&
        cat.tileCol === cat.seatCol &&
        cat.tileRow === cat.seatRow
      ) {
        cat.state = cat.targetWorkState;
        cat.stateTimer = 0;
        cat.frame = 0;
        cat.frameTimer = 0;
      } else {
        toIdle(cat);
      }
      break;
    case 'wander':
      toIdle(cat);
      break;
    case 'zoomies':
      // Keep zooming if duration hasn't elapsed; otherwise idle.
      if (cat.stateTimer < cat.stateDuration) {
        startWalk(cat, randomTile(gridCols, gridRows), ZOOMIES_SPEED);
      } else {
        toIdle(cat);
      }
      break;
    default:
      toIdle(cat);
  }
}

// ── Idle behavior picker (weighted random) ────────────────────

function pickIdleBehavior(cat: Cat, gridCols: number, gridRows: number): void {
  const r = Math.random();
  if (r < 0.40) {
    toTimed(cat, 'sleep', SLEEP_MIN_SEC, SLEEP_MAX_SEC);
  } else if (r < 0.60) {
    toTimed(cat, 'groom', GROOM_MIN_SEC, GROOM_MAX_SEC);
  } else if (r < 0.70) {
    toTimed(cat, 'stretch', STRETCH_MIN_SEC, STRETCH_MAX_SEC);
  } else if (r < 0.90) {
    // wander (20%): walk to a random tile
    startWalk(cat, randomTile(gridCols, gridRows), WALK_SPEED);
    cat.state = 'wander';
    cat.stateTimer = 0;
  } else {
    // zoomies (10%): fast multi-destination sprint with a time budget
    startWalk(cat, randomTile(gridCols, gridRows), ZOOMIES_SPEED);
    cat.state = 'zoomies';
    cat.stateTimer = 0;
    cat.stateDuration = randRange(ZOOMIES_MIN_SEC, ZOOMIES_MAX_SEC);
  }
}

// ── Helpers ───────────────────────────────────────────────────

function toIdle(cat: Cat): void {
  cat.state = 'idle';
  cat.stateTimer = 0;
  cat.stateDuration = randRange(IDLE_MIN_SEC, IDLE_MAX_SEC);
  cat.speed = WALK_SPEED;
  cat.path = [];
  cat.moveProgress = 0;
}

function toTimed(cat: Cat, state: CatState, minSec: number, maxSec: number): void {
  cat.state = state;
  cat.stateTimer = 0;
  cat.stateDuration = randRange(minSec, maxSec);
  cat.frame = 0;
  cat.frameTimer = 0;
}

function startWalk(cat: Cat, dest: TileCoord, speed: number): void {
  cat.path = [dest];
  cat.speed = speed;
  cat.moveProgress = 0;
}

function randomTile(gridCols: number, gridRows: number): TileCoord {
  return {
    col: Math.floor(Math.random() * gridCols),
    row: Math.floor(Math.random() * gridRows),
  };
}

function tileCenter(tileIndex: number): number {
  return tileIndex * TILE_SIZE + TILE_SIZE / 2;
}

function tileDirection(
  fromCol: number, fromRow: number,
  toCol: number, toRow: number,
): Direction {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;
  // Horizontal movement takes priority when both axes differ
  if (Math.abs(dc) >= Math.abs(dr)) {
    return dc > 0 ? 'right' : 'left';
  }
  return dr > 0 ? 'down' : 'up';
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ── Animation frame advancement ───────────────────────────────

const FRAME_SPEED: Partial<Record<CatState, number>> = {
  walk:    WALK_FRAME_SEC,
  wander:  WALK_FRAME_SEC,
  zoomies: WALK_FRAME_SEC / 2,
  type:    TYPE_FRAME_SEC,
  read:    READ_FRAME_SEC,
  sleep:   SLEEP_FRAME_SEC,
  groom:   GROOM_FRAME_SEC,
  stretch: STRETCH_FRAME_SEC,
};

// Number of distinct frames in each animation cycle
const FRAME_COUNT: Partial<Record<CatState, number>> = {
  walk:    4,
  wander:  4,
  zoomies: 4,
  type:    2,
  read:    2,
  sleep:   2,
  groom:   2,
  stretch: 2,
};

function advanceAnimation(cat: Cat, dt: number): void {
  const speed = FRAME_SPEED[cat.state];
  const count = FRAME_COUNT[cat.state];
  if (speed === undefined || count === undefined) {
    cat.frame = 0;
    return;
  }
  cat.frameTimer += dt;
  if (cat.frameTimer >= speed) {
    cat.frameTimer -= speed;
    cat.frame = (cat.frame + 1) % count;
  }
}
