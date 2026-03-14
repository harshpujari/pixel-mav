import type { TileCoord } from '../types.ts';
import type { TileMap } from '../environment/tileMap.ts';
import { isWalkable } from '../environment/tileMap.ts';

/** 4-connected directions: up, right, down, left. */
const DIRS: readonly TileCoord[] = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

/**
 * BFS pathfinding on a 4-connected tile grid.
 *
 * Returns the path from start to end (excluding start, including end).
 * Returns [] if start === end or no path exists.
 *
 * At max grid size 64×64 = 4096 tiles, BFS solves in <1ms.
 */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  map: TileMap,
  blocked?: Set<string>,
): TileCoord[] {
  if (startCol === endCol && startRow === endRow) return [];
  if (!isWalkable(map, endCol, endRow, blocked)) return [];

  const key = (c: number, r: number) => (r << 8) | c; // fast key for grids ≤ 256 wide
  const startKey = key(startCol, startRow);
  const endKey = key(endCol, endRow);

  const visited = new Set<number>([startKey]);
  const parent = new Map<number, number>();
  const queue: number[] = [startKey];

  let head = 0; // array-based queue avoids shift() O(n) cost

  while (head < queue.length) {
    const cur = queue[head++];
    if (cur === endKey) break;

    const cc = cur & 0xff;
    const cr = cur >> 8;

    for (const d of DIRS) {
      const nc = cc + d.col;
      const nr = cr + d.row;
      const nk = key(nc, nr);

      if (!visited.has(nk) && isWalkable(map, nc, nr, blocked)) {
        visited.add(nk);
        parent.set(nk, cur);
        queue.push(nk);
      }
    }
  }

  if (!parent.has(endKey)) return []; // no path

  // Reconstruct path from end to start
  const path: TileCoord[] = [];
  let k = endKey;
  while (k !== startKey) {
    path.push({ col: k & 0xff, row: k >> 8 });
    k = parent.get(k)!;
  }
  path.reverse();
  return path;
}
