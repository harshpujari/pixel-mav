import {
  DESPAWN_DURATION,
  IDLE_MIN_SEC,
  IDLE_MAX_SEC,
  SPAWN_DURATION,
  WALK_SPEED,
} from '../constants.ts';
import { tileMap } from '../environment/tileMap.ts';
import type { Cat, CatBreed } from '../types.ts';
import { tileCenter } from './movement.ts';
import { updateParticles } from './renderer/effectRenderer.ts';
import { randRange, updateCat } from './stateMachine.ts';

// ── Flat entity store ─────────────────────────────────────────
// Module-level singleton Map — never triggers React re-renders.
// The game loop reads and writes this directly each frame.
export const cats = new Map<string, Cat>();

export function addCat(cat: Cat): void {
  cats.set(cat.id, cat);
}

export function removeCat(id: string): void {
  cats.delete(id);
}

export function getCat(id: string): Cat | undefined {
  return cats.get(id);
}

/** Advance all cats by `dt` seconds. Called once per game loop frame. */
export function updateAllCats(dt: number): void {
  updateParticles(dt);

  const toRemove: string[] = [];
  for (const cat of cats.values()) {
    // Spawn fade-in
    if (cat.spawnEffect) {
      cat.effectTimer += dt;
      if (cat.effectTimer >= SPAWN_DURATION) {
        cat.spawnEffect = false;
      }
    }

    // Despawn fade-out: yawn → curl → remove
    if (cat.despawnEffect) {
      cat.effectTimer += dt;
      if (cat.effectTimer >= DESPAWN_DURATION / 2 && cat.state !== 'sleep') {
        cat.state = 'sleep';
        cat.frame = 0;
        cat.frameTimer = 0;
      }
      if (cat.effectTimer >= DESPAWN_DURATION) {
        toRemove.push(cat.id);
      }
      continue; // skip state machine during despawn
    }

    updateCat(cat, dt, tileMap, cats);
  }

  for (const id of toRemove) removeCat(id);
}

// ── Factory ───────────────────────────────────────────────────

/** Create a Cat with all fields initialised to sensible defaults. */
export function makeCat(
  id: string,
  tileCol: number,
  tileRow: number,
  breed: CatBreed = 'tabby',
): Cat {
  return {
    id,

    agentId: null,
    seatCol: tileCol,
    seatRow: tileRow,
    activeTool: null,
    targetWorkState: null,
    isSubagent: false,
    parentAgentId: null,

    breed,
    hueShift: 0,

    x: tileCenter(tileCol),
    y: tileCenter(tileRow),
    tileCol,
    tileRow,

    state: 'idle',
    stateTimer: 0,
    stateDuration: randRange(IDLE_MIN_SEC, IDLE_MAX_SEC),

    path: [],
    moveProgress: 0,
    speed: WALK_SPEED,

    direction: 'down',
    frame: 0,
    frameTimer: 0,
    blinkTimer: randRange(2, 5),

    socialCooldown: 0,

    bubbleType: null,
    bubbleTimer: 0,

    spawnEffect: false,
    despawnEffect: false,
    effectTimer: 0,
  };
}

