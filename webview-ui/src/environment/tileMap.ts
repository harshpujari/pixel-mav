import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS } from '../constants.ts';
import { TileType } from './types.ts';

// ── TileMap data structure ───────────────────────────────────

export interface TileMap {
  cols: number;
  rows: number;
  tiles: TileType[]; // flat array — index = row * cols + col
}

// ── Accessors ────────────────────────────────────────────────

export function getTile(map: TileMap, col: number, row: number): TileType {
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return TileType.VOID;
  return map.tiles[row * map.cols + col];
}

export function setTile(map: TileMap, col: number, row: number, type: TileType): void {
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return;
  map.tiles[row * map.cols + col] = type;
}

// ── Walkability ──────────────────────────────────────────────

export function isWalkable(
  map: TileMap,
  col: number,
  row: number,
  blocked?: Set<string>,
): boolean {
  const t = getTile(map, col, row);
  if (t === TileType.VOID || t === TileType.WALL) return false;
  if (blocked?.has(`${col},${row}`)) return false;
  return true;
}

/**
 * Pick a random walkable tile. For wander, prefers SUNNY tiles (30% chance).
 * Returns null if no walkable tiles exist (shouldn't happen with a valid map).
 */
export function randomWalkableTile(map: TileMap): { col: number; row: number } | null {
  const walkable: { col: number; row: number }[] = [];
  const sunny: { col: number; row: number }[] = [];

  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const t = map.tiles[r * map.cols + c];
      if (t === TileType.FLOOR || t === TileType.SUNNY) {
        walkable.push({ col: c, row: r });
        if (t === TileType.SUNNY) sunny.push({ col: c, row: r });
      }
    }
  }

  if (walkable.length === 0) return null;
  if (sunny.length > 0 && Math.random() < 0.3) {
    return sunny[Math.floor(Math.random() * sunny.length)];
  }
  return walkable[Math.floor(Math.random() * walkable.length)];
}

/**
 * 4-bit wall bitmask for auto-tiling.
 * Bit 0 (1) = wall north, bit 1 (2) = wall east,
 * bit 2 (4) = wall south, bit 3 (8) = wall west.
 */
export function wallBitmask(map: TileMap, col: number, row: number): number {
  let mask = 0;
  if (getTile(map, col, row - 1) === TileType.WALL) mask |= 1;
  if (getTile(map, col + 1, row) === TileType.WALL) mask |= 2;
  if (getTile(map, col, row + 1) === TileType.WALL) mask |= 4;
  if (getTile(map, col - 1, row) === TileType.WALL) mask |= 8;
  return mask;
}

// ── Default layout ───────────────────────────────────────────

/**
 * Create a cozy room: walls around the border, floor inside,
 * sunny patches near the top wall (window spots).
 */
export function createDefaultLayout(): TileMap {
  const cols = DEFAULT_GRID_COLS;
  const rows = DEFAULT_GRID_ROWS;
  const tiles = new Array<TileType>(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBorder = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
      tiles[r * cols + c] = isBorder ? TileType.WALL : TileType.FLOOR;
    }
  }

  // Sunny patches on the row just inside the top wall (like light through windows)
  for (const c of [3, 4, 8, 9, 14, 15]) {
    if (c > 0 && c < cols - 1) {
      tiles[1 * cols + c] = TileType.SUNNY;
      tiles[2 * cols + c] = TileType.SUNNY; // light spills one row further
    }
  }

  return { cols, rows, tiles };
}

// ── Module-level singleton ───────────────────────────────────

export const tileMap = createDefaultLayout();
