import { TILE_SIZE } from '../constants.ts';
import type { Cat, Direction } from '../types.ts';

/**
 * Advance a cat along its path by `dt` seconds.
 *
 * Updates: x, y, tileCol, tileRow, moveProgress, direction.
 * Returns `true` when the path is complete (or was already empty).
 */
export function advanceAlongPath(cat: Cat, dt: number): boolean {
  if (cat.path.length === 0) return true;

  const next = cat.path[0];

  // Face toward next tile
  cat.direction = tileDirection(cat.tileCol, cat.tileRow, next.col, next.row);

  // Advance progress (clamped — no multi-tile skip at these speeds)
  cat.moveProgress = Math.min(cat.moveProgress + cat.speed * dt, 1);

  // Interpolate world position
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

    return cat.path.length === 0;
  }

  return false;
}

function tileCenter(idx: number): number {
  return idx * TILE_SIZE + TILE_SIZE / 2;
}

function tileDirection(fc: number, fr: number, tc: number, tr: number): Direction {
  const dc = tc - fc;
  const dr = tr - fr;
  if (Math.abs(dc) >= Math.abs(dr)) return dc > 0 ? 'right' : 'left';
  return dr > 0 ? 'down' : 'up';
}
