import { describe, it, expect } from 'vitest';
import { updateCat, getEffectiveState } from '../stateMachine.ts';
import { makeCat } from '../catStore.ts';
import type { TileMap } from '../../environment/tileMap.ts';
import { TileType } from '../../environment/types.ts';
import type { Cat } from '../../types.ts';

// Helper: 5×5 open room (walls on border, floor inside)
function makeRoom(): TileMap {
  const cols = 5, rows = 5;
  const tiles: TileType[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const border = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
      tiles.push(border ? TileType.WALL : TileType.FLOOR);
    }
  }
  return { cols, rows, tiles };
}

function allCatsMap(...cats: Cat[]): ReadonlyMap<string, Cat> {
  const map = new Map<string, Cat>();
  for (const c of cats) map.set(c.id, c);
  return map;
}

describe('updateCat', () => {
  it('increments stateTimer by dt', () => {
    const cat = makeCat('test', 2, 2);
    const map = makeRoom();
    const before = cat.stateTimer;
    updateCat(cat, 0.5, map, allCatsMap(cat));
    expect(cat.stateTimer).toBeCloseTo(before + 0.5);
  });

  it('decrements socialCooldown', () => {
    const cat = makeCat('test', 2, 2);
    cat.socialCooldown = 10;
    updateCat(cat, 1, makeRoom(), allCatsMap(cat));
    expect(cat.socialCooldown).toBeCloseTo(9);
  });

  it('does not go below 0 for socialCooldown in one step', () => {
    const cat = makeCat('test', 2, 2);
    cat.socialCooldown = 0.5;
    updateCat(cat, 1, makeRoom(), allCatsMap(cat));
    expect(cat.socialCooldown).toBeLessThanOrEqual(0);
  });

  it('transitions from idle to another state after stateDuration', () => {
    const cat = makeCat('test', 2, 2);
    cat.state = 'idle';
    cat.stateTimer = 0;
    cat.stateDuration = 0.1; // very short duration
    const map = makeRoom();
    // Run enough updates to trigger the idle picker
    updateCat(cat, 0.2, map, allCatsMap(cat));
    // Cat should have picked a new behavior
    expect(cat.state !== 'idle' || cat.stateTimer < 0.1).toBe(true);
  });

  it('does not change type/read/wait states (agent-driven)', () => {
    for (const state of ['type', 'read', 'wait'] as const) {
      const cat = makeCat('test', 2, 2);
      cat.state = state;
      cat.stateTimer = 0;
      updateCat(cat, 1, makeRoom(), allCatsMap(cat));
      expect(cat.state).toBe(state);
    }
  });

  it('moves cat along path during walk state', () => {
    const cat = makeCat('test', 2, 2);
    cat.state = 'walk';
    cat.path = [{ col: 3, row: 2 }];
    cat.moveProgress = 0;
    cat.speed = 3;
    const startX = cat.x;
    updateCat(cat, 0.1, makeRoom(), allCatsMap(cat));
    // Cat should have moved toward the next tile
    expect(cat.x).toBeGreaterThan(startX);
  });

  it('transitions timed behaviors back to idle after duration', () => {
    for (const state of ['sleep', 'groom', 'stretch'] as const) {
      const cat = makeCat('test', 2, 2);
      cat.state = state;
      cat.stateTimer = 0;
      cat.stateDuration = 0.5;
      // Run past the duration
      updateCat(cat, 0.6, makeRoom(), allCatsMap(cat));
      expect(cat.state).toBe('idle');
    }
  });

  it('updates blink timer', () => {
    const cat = makeCat('test', 2, 2);
    const before = cat.blinkTimer;
    updateCat(cat, 0.1, makeRoom(), allCatsMap(cat));
    expect(cat.blinkTimer).toBeLessThan(before);
  });
});

describe('getEffectiveState', () => {
  it('returns walk for nap_pile with path', () => {
    const cat = makeCat('test', 2, 2);
    cat.state = 'nap_pile';
    cat.path = [{ col: 3, row: 2 }];
    expect(getEffectiveState(cat)).toBe('walk');
  });

  it('returns nap_pile for nap_pile without path', () => {
    const cat = makeCat('test', 2, 2);
    cat.state = 'nap_pile';
    cat.path = [];
    expect(getEffectiveState(cat)).toBe('nap_pile');
  });

  it('returns walk for headbonk with path', () => {
    const cat = makeCat('test', 2, 2);
    cat.state = 'headbonk';
    cat.path = [{ col: 3, row: 2 }];
    expect(getEffectiveState(cat)).toBe('walk');
  });

  it('returns the state itself for normal states', () => {
    const cat = makeCat('test', 2, 2);
    for (const state of ['idle', 'walk', 'type', 'read', 'sleep'] as const) {
      cat.state = state;
      expect(getEffectiveState(cat)).toBe(state);
    }
  });
});
