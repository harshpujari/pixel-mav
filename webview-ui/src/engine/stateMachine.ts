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
  TYPE_FRAME_SEC,
  WALK_FRAME_SEC,
  WALK_SPEED,
  ZOOMIES_MAX_SEC,
  ZOOMIES_MIN_SEC,
  ZOOMIES_SPEED,
} from '../constants.ts';
import type { TileMap } from '../environment/tileMap.ts';
import { randomWalkableTile } from '../environment/tileMap.ts';
import type { Cat, CatState } from '../types.ts';
import { advanceAlongPath } from './movement.ts';
import { findPath } from './pathfinding.ts';

// ── Public entry point ────────────────────────────────────────

/**
 * Advance a single cat by `dt` seconds.
 * Pure function: reads/writes only the passed `cat` object + reads the tileMap.
 * No store or renderer imports — keeps this testable in isolation.
 */
export function updateCat(cat: Cat, dt: number, map: TileMap): void {
  cat.stateTimer += dt;
  advanceAnimation(cat, dt);
  updateBlink(cat, dt);

  switch (cat.state) {
    case 'idle':    updateIdle(cat, map); break;
    case 'walk':
    case 'wander':
    case 'zoomies': updateMovement(cat, dt, map); break;
    case 'sleep':
    case 'groom':
    case 'stretch': updateTimedBehavior(cat); break;
    // 'type' | 'read' | 'wait' — driven by agent IPC (Phase 5)
    // 'nap_pile' | 'play' | 'headbonk' — social behaviors (Phase 9)
    default: break;
  }
}

// ── State updates ─────────────────────────────────────────────

function updateIdle(cat: Cat, map: TileMap): void {
  if (cat.stateTimer >= cat.stateDuration) {
    pickIdleBehavior(cat, map);
  }
}

function updateTimedBehavior(cat: Cat): void {
  if (cat.stateTimer >= cat.stateDuration) {
    toIdle(cat);
  }
}

function updateMovement(cat: Cat, dt: number, map: TileMap): void {
  const arrived = advanceAlongPath(cat, dt);
  if (arrived) onArrival(cat, map);
}

// ── Arrival logic ─────────────────────────────────────────────

function onArrival(cat: Cat, map: TileMap): void {
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
      if (cat.stateTimer < cat.stateDuration) {
        startBfsWalk(cat, map, ZOOMIES_SPEED);
      } else {
        toIdle(cat);
      }
      break;
    default:
      toIdle(cat);
  }
}

// ── Idle behavior picker (weighted random) ────────────────────

function pickIdleBehavior(cat: Cat, map: TileMap): void {
  const r = Math.random();
  if (r < 0.40) {
    toTimed(cat, 'sleep', SLEEP_MIN_SEC, SLEEP_MAX_SEC);
  } else if (r < 0.60) {
    toTimed(cat, 'groom', GROOM_MIN_SEC, GROOM_MAX_SEC);
  } else if (r < 0.70) {
    toTimed(cat, 'stretch', STRETCH_MIN_SEC, STRETCH_MAX_SEC);
  } else if (r < 0.90) {
    // wander (20%): BFS walk to a random walkable tile
    if (startBfsWalk(cat, map, WALK_SPEED)) {
      cat.state = 'wander';
      cat.stateTimer = 0;
    } else {
      toIdle(cat); // fallback if no path found
    }
  } else {
    // zoomies (10%): fast multi-destination sprint with a time budget
    if (startBfsWalk(cat, map, ZOOMIES_SPEED)) {
      cat.state = 'zoomies';
      cat.stateTimer = 0;
      cat.stateDuration = randRange(ZOOMIES_MIN_SEC, ZOOMIES_MAX_SEC);
    } else {
      toIdle(cat);
    }
  }
}

// ── Blink ────────────────────────────────────────────────────
// Timer counts down → goes negative for 0.12s (blinking) → resets.
// Renderer checks `cat.blinkTimer <= 0` to show the blink overlay.

const BLINK_DURATION = 0.12;

function updateBlink(cat: Cat, dt: number): void {
  cat.blinkTimer -= dt;
  if (cat.blinkTimer <= -BLINK_DURATION) {
    cat.blinkTimer = randRange(2.5, 5);
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

/**
 * Pick a random walkable destination and BFS to it.
 * Returns true if a path was found and walking started.
 */
function startBfsWalk(cat: Cat, map: TileMap, speed: number): boolean {
  const dest = randomWalkableTile(map);
  if (!dest) return false;

  const path = findPath(cat.tileCol, cat.tileRow, dest.col, dest.row, map);
  if (path.length === 0 && (cat.tileCol !== dest.col || cat.tileRow !== dest.row)) {
    return false; // destination is unreachable
  }

  cat.path = path;
  cat.speed = speed;
  cat.moveProgress = 0;
  return true;
}

export function randRange(min: number, max: number): number {
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
