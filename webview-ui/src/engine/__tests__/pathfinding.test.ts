import { describe, it, expect } from 'vitest';
import { findPath } from '../pathfinding.ts';
import type { TileMap } from '../../environment/tileMap.ts';
import { TileType } from '../../environment/types.ts';

// Helper: create a small tile map from a string grid
// F = floor, W = wall, V = void, S = sunny
function makeMap(grid: string[]): TileMap {
  const rows = grid.length;
  const cols = grid[0].length;
  const tiles: TileType[] = [];
  for (const row of grid) {
    for (const ch of row) {
      switch (ch) {
        case 'F': tiles.push(TileType.FLOOR); break;
        case 'S': tiles.push(TileType.SUNNY); break;
        case 'W': tiles.push(TileType.WALL); break;
        default:  tiles.push(TileType.VOID); break;
      }
    }
  }
  return { cols, rows, tiles };
}

describe('findPath (BFS)', () => {
  it('returns [] when start === end', () => {
    const map = makeMap(['FFF', 'FFF', 'FFF']);
    expect(findPath(1, 1, 1, 1, map)).toEqual([]);
  });

  it('finds a straight horizontal path', () => {
    const map = makeMap(['FFFFF']);
    const path = findPath(0, 0, 4, 0, map);
    expect(path).toEqual([
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 4, row: 0 },
    ]);
  });

  it('finds a straight vertical path', () => {
    const map = makeMap(['F', 'F', 'F', 'F']);
    const path = findPath(0, 0, 0, 3, map);
    expect(path).toEqual([
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 3 },
    ]);
  });

  it('navigates around a wall', () => {
    const map = makeMap([
      'FFF',
      'FWF',
      'FFF',
    ]);
    const path = findPath(0, 0, 2, 0, map);
    // BFS finds shortest path — should be length 2 (go around)
    expect(path.length).toBe(2);
    expect(path[path.length - 1]).toEqual({ col: 2, row: 0 });
  });

  it('returns [] when destination is a wall', () => {
    const map = makeMap(['FWF']);
    expect(findPath(0, 0, 1, 0, map)).toEqual([]);
  });

  it('returns [] when destination is void', () => {
    const map = makeMap(['FVF']);
    expect(findPath(0, 0, 1, 0, map)).toEqual([]);
  });

  it('returns [] when no path exists (walled off)', () => {
    const map = makeMap([
      'FWF',
      'WWW',
      'FFF',
    ]);
    expect(findPath(0, 0, 2, 0, map)).toEqual([]);
  });

  it('respects blocked tiles', () => {
    const map = makeMap([
      'FFF',
      'FFF',
      'FFF',
    ]);
    const blocked = new Set(['1,0']); // block the direct path
    const path = findPath(0, 0, 2, 0, map, blocked);
    // Must go around: path shouldn't include (1,0)
    expect(path.every(p => !(p.col === 1 && p.row === 0))).toBe(true);
    expect(path[path.length - 1]).toEqual({ col: 2, row: 0 });
  });

  it('treats SUNNY tiles as walkable', () => {
    const map = makeMap(['FSF']);
    const path = findPath(0, 0, 2, 0, map);
    expect(path).toEqual([
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ]);
  });

  it('finds shortest path (BFS guarantees shortest)', () => {
    // L-shaped room — two possible routes
    const map = makeMap([
      'FFFFF',
      'FWWWF',
      'FFFFF',
    ]);
    const path = findPath(0, 0, 4, 0, map);
    // Shortest path is along the top or bottom: 4 steps
    expect(path.length).toBe(4);
  });

  it('handles adjacent tiles', () => {
    const map = makeMap(['FF']);
    const path = findPath(0, 0, 1, 0, map);
    expect(path).toEqual([{ col: 1, row: 0 }]);
  });
});
