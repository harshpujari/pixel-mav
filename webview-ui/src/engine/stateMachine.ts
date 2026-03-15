import {
  GROOM_FRAME_SEC,
  GROOM_MAX_SEC,
  GROOM_MIN_SEC,
  HEADBONK_SEC,
  IDLE_MAX_SEC,
  IDLE_MIN_SEC,
  PLAY_MAX_SEC,
  PLAY_MIN_SEC,
  READ_FRAME_SEC,
  SLEEP_FRAME_SEC,
  SLEEP_MAX_SEC,
  SLEEP_MIN_SEC,
  SOCIAL_COOLDOWN_SEC,
  SOCIAL_RANGE_TILES,
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
import { isWalkable, randomWalkableTile } from '../environment/tileMap.ts';
import type { Cat, CatState } from '../types.ts';
import { advanceAlongPath } from './movement.ts';
import { findPath } from './pathfinding.ts';

// ── Public entry point ────────────────────────────────────────

/**
 * Advance a single cat by `dt` seconds.
 * Pure function: reads/writes only the passed `cat` object + reads the tileMap/allCats.
 * No store or renderer imports — keeps this testable in isolation.
 */
export function updateCat(
  cat: Cat,
  dt: number,
  map: TileMap,
  allCats: ReadonlyMap<string, Cat>,
): void {
  cat.stateTimer += dt;
  if (cat.socialCooldown > 0) cat.socialCooldown -= dt;
  advanceAnimation(cat, dt);
  updateBlink(cat, dt);

  switch (cat.state) {
    case 'idle':    updateIdle(cat, map, allCats); break;
    case 'walk':
    case 'wander':
    case 'zoomies':
    case 'play':    updateMovement(cat, dt, map); break;
    case 'nap_pile':
    case 'headbonk':
      if (cat.path.length > 0) updateMovement(cat, dt, map);
      else updateTimedBehavior(cat);
      break;
    case 'sleep':
    case 'groom':
    case 'stretch': updateTimedBehavior(cat); break;
    // 'type' | 'read' | 'wait' — driven by agent IPC (Phase 5)
    default: break;
  }
}

/**
 * Resolve the effective state for animation purposes.
 * nap_pile/headbonk show walk animation while path is non-empty.
 */
export function getEffectiveState(cat: Cat): CatState {
  if ((cat.state === 'nap_pile' || cat.state === 'headbonk') && cat.path.length > 0) {
    return 'walk';
  }
  return cat.state;
}

// ── State updates ─────────────────────────────────────────────

function updateIdle(cat: Cat, map: TileMap, allCats: ReadonlyMap<string, Cat>): void {
  if (cat.stateTimer >= cat.stateDuration) {
    pickIdleBehavior(cat, map, allCats);
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
    case 'play':
      if (cat.stateTimer < cat.stateDuration) {
        if (!startBfsWalk(cat, map, WALK_SPEED)) toIdle(cat);
      } else {
        toIdle(cat);
      }
      break;
    case 'nap_pile':
    case 'headbonk':
      // Arrived at social target — reset timer to start the timed phase
      cat.stateTimer = 0;
      cat.frame = 0;
      cat.frameTimer = 0;
      break;
    default:
      toIdle(cat);
  }
}

// ── Idle behavior picker (weighted random) ────────────────────

function pickIdleBehavior(cat: Cat, map: TileMap, allCats: ReadonlyMap<string, Cat>): void {
  // Try social behavior first (Phase 9)
  if (cat.socialCooldown <= 0 && allCats.size > 1) {
    const nearby = findNearbyCat(cat, allCats);
    if (nearby && trySocialBehavior(cat, nearby, map)) {
      cat.socialCooldown = SOCIAL_COOLDOWN_SEC;
      return;
    }
    // Failed attempts get a shorter cooldown
    if (nearby) cat.socialCooldown = SOCIAL_COOLDOWN_SEC / 3;
  }

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

// ── Social behaviors (Phase 9) ────────────────────────────────

/** Find the nearest eligible cat within SOCIAL_RANGE_TILES (Manhattan distance). */
function findNearbyCat(cat: Cat, allCats: ReadonlyMap<string, Cat>): Cat | null {
  let nearest: Cat | null = null;
  let nearestDist = SOCIAL_RANGE_TILES + 1;

  for (const other of allCats.values()) {
    if (other.id === cat.id) continue;
    // Skip working or actively-social cats (nap_pile is targetable as "sleeping")
    if (
      other.state === 'type' || other.state === 'read' || other.state === 'wait' ||
      other.state === 'walk' || other.state === 'play' || other.state === 'headbonk'
    ) continue;

    const dist = Math.abs(cat.tileCol - other.tileCol) + Math.abs(cat.tileRow - other.tileRow);
    if (dist <= SOCIAL_RANGE_TILES && dist < nearestDist) {
      nearest = other;
      nearestDist = dist;
    }
  }

  return nearest;
}

/** Roll for a social behavior based on the target's state. */
function trySocialBehavior(cat: Cat, target: Cat, map: TileMap): boolean {
  if (target.state === 'sleep' || target.state === 'nap_pile') {
    if (Math.random() < 0.30) return startNapPile(cat, target, map);
  } else if (target.state === 'idle' || target.state === 'wander') {
    const r = Math.random();
    if (r < 0.20) return startPlay(cat, target, map);
    if (target.state === 'idle' && r < 0.40) return startHeadbonk(cat, target, map);
  }
  return false;
}

/** Walk to an adjacent tile of a sleeping cat, then sleep together. */
function startNapPile(cat: Cat, target: Cat, map: TileMap): boolean {
  const adj = findAdjacentWalkable(target.tileCol, target.tileRow, map);
  if (!adj) return false;

  cat.state = 'nap_pile';
  cat.stateTimer = 0;
  cat.stateDuration = randRange(SLEEP_MIN_SEC, SLEEP_MAX_SEC);
  cat.frame = 0;
  cat.frameTimer = 0;

  // Already adjacent? Start sleeping immediately
  if (cat.tileCol === adj.col && cat.tileRow === adj.row) {
    cat.path = [];
    return true;
  }

  const path = findPath(cat.tileCol, cat.tileRow, adj.col, adj.row, map);
  if (path.length === 0) return false;

  cat.path = path;
  cat.speed = WALK_SPEED;
  cat.moveProgress = 0;
  return true;
}

/** Both cats enter play state with independent random walks. */
function startPlay(cat: Cat, target: Cat, map: TileMap): boolean {
  if (!startBfsWalk(cat, map, WALK_SPEED)) return false;

  cat.state = 'play';
  cat.stateTimer = 0;
  cat.stateDuration = randRange(PLAY_MIN_SEC, PLAY_MAX_SEC);

  // Target also enters play
  if (startBfsWalk(target, map, WALK_SPEED)) {
    target.state = 'play';
    target.stateTimer = 0;
    target.stateDuration = randRange(PLAY_MIN_SEC, PLAY_MAX_SEC);
    target.socialCooldown = SOCIAL_COOLDOWN_SEC;
  }

  return true;
}

/** Walk to target cat's tile, then bump for HEADBONK_SEC. */
function startHeadbonk(cat: Cat, target: Cat, map: TileMap): boolean {
  cat.state = 'headbonk';
  cat.stateTimer = 0;
  cat.stateDuration = HEADBONK_SEC;
  cat.frame = 0;
  cat.frameTimer = 0;

  // Already at target? Start bonking immediately
  if (cat.tileCol === target.tileCol && cat.tileRow === target.tileRow) {
    cat.path = [];
    return true;
  }

  const path = findPath(cat.tileCol, cat.tileRow, target.tileCol, target.tileRow, map);
  if (path.length === 0) return false;

  cat.path = path;
  cat.speed = WALK_SPEED;
  cat.moveProgress = 0;
  return true;
}

/** Find a random walkable tile adjacent to (col, row). */
function findAdjacentWalkable(
  col: number,
  row: number,
  map: TileMap,
): { col: number; row: number } | null {
  const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // Shuffle for variety
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  for (const [dc, dr] of dirs) {
    if (isWalkable(map, col + dc, row + dr)) {
      return { col: col + dc, row: row + dr };
    }
  }
  return null;
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
  walk:     WALK_FRAME_SEC,
  wander:   WALK_FRAME_SEC,
  zoomies:  WALK_FRAME_SEC / 2,
  type:     TYPE_FRAME_SEC,
  read:     READ_FRAME_SEC,
  sleep:    SLEEP_FRAME_SEC,
  groom:    GROOM_FRAME_SEC,
  stretch:  STRETCH_FRAME_SEC,
  nap_pile: SLEEP_FRAME_SEC,
  play:     WALK_FRAME_SEC,
};

const FRAME_COUNT: Partial<Record<CatState, number>> = {
  walk:     4,
  wander:   4,
  zoomies:  4,
  type:     2,
  read:     2,
  sleep:    2,
  groom:    2,
  stretch:  2,
  nap_pile: 2,
  play:     4,
};

function advanceAnimation(cat: Cat, dt: number): void {
  const state = getEffectiveState(cat);
  const speed = FRAME_SPEED[state];
  const count = FRAME_COUNT[state];
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
