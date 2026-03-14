import { TILE_SIZE } from '../../constants.ts';
import type { TileMap } from '../../environment/tileMap.ts';
import { getTile, wallBitmask } from '../../environment/tileMap.ts';
import { TileType } from '../../environment/types.ts';

// ── Colour palette ───────────────────────────────────────────

const FLOOR_A   = '#3a3530';
const FLOOR_B   = '#342f2b';
const SUNNY_A   = '#4a4030';
const SUNNY_B   = '#443a28';
const WALL_BASE = '#28282e';
const WALL_TOP  = '#38383e';
const WALL_EDGE = '#484850';

// ── Public draw call ─────────────────────────────────────────

export function drawTiles(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom; // tile size in device pixels

  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const tile = getTile(map, col, row);
      if (tile === TileType.VOID) continue;

      const x = Math.round(offsetX + col * s);
      const y = Math.round(offsetY + row * s);
      const w = Math.round(offsetX + (col + 1) * s) - x;
      const h = Math.round(offsetY + (row + 1) * s) - y;

      switch (tile) {
        case TileType.FLOOR:
          drawFloor(ctx, x, y, w, h, col, row, FLOOR_A, FLOOR_B);
          break;
        case TileType.SUNNY:
          drawFloor(ctx, x, y, w, h, col, row, SUNNY_A, SUNNY_B);
          drawSunOverlay(ctx, x, y, w, h);
          break;
        case TileType.WALL:
          drawWall(ctx, x, y, w, h, wallBitmask(map, col, row));
          break;
      }
    }
  }

  // Grid lines on walkable tiles — subtle, for spatial awareness
  drawGridLines(ctx, map, offsetX, offsetY, zoom);
}

// ── Floor ────────────────────────────────────────────────────

function drawFloor(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  col: number, row: number,
  colorA: string, colorB: string,
): void {
  ctx.fillStyle = (col + row) % 2 === 0 ? colorA : colorB;
  ctx.fillRect(x, y, w, h);
}

function drawSunOverlay(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.fillStyle = 'rgba(255, 220, 120, 0.06)';
  ctx.fillRect(x, y, w, h);
}

// ── Wall ─────────────────────────────────────────────────────

function drawWall(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  bitmask: number,
): void {
  // Base
  ctx.fillStyle = WALL_BASE;
  ctx.fillRect(x, y, w, h);

  // Top face highlight when north side is exposed (no wall above)
  if (!(bitmask & 1)) {
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(x, y, w, Math.round(h * 0.35));
  }

  // Edge highlights on exposed sides
  const edge = Math.max(1, Math.round(w * 0.08));
  ctx.fillStyle = WALL_EDGE;
  if (!(bitmask & 1)) ctx.fillRect(x, y, w, edge);          // north
  if (!(bitmask & 2)) ctx.fillRect(x + w - edge, y, edge, h); // east
  if (!(bitmask & 4)) ctx.fillRect(x, y + h - edge, w, edge); // south
  if (!(bitmask & 8)) ctx.fillRect(x, y, edge, h);            // west
}

// ── Grid lines ───────────────────────────────────────────────

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  // Vertical lines (skip edges that border walls on both sides)
  for (let col = 1; col < map.cols; col++) {
    const x = Math.round(offsetX + col * s) + 0.5;
    for (let row = 0; row < map.rows; row++) {
      const left = getTile(map, col - 1, row);
      const right = getTile(map, col, row);
      if (isFloorLike(left) || isFloorLike(right)) {
        const y1 = Math.round(offsetY + row * s);
        const y2 = Math.round(offsetY + (row + 1) * s);
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
    }
  }

  // Horizontal lines
  for (let row = 1; row < map.rows; row++) {
    const y = Math.round(offsetY + row * s) + 0.5;
    for (let col = 0; col < map.cols; col++) {
      const above = getTile(map, col, row - 1);
      const below = getTile(map, col, row);
      if (isFloorLike(above) || isFloorLike(below)) {
        const x1 = Math.round(offsetX + col * s);
        const x2 = Math.round(offsetX + (col + 1) * s);
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
      }
    }
  }

  ctx.stroke();
}

function isFloorLike(t: TileType): boolean {
  return t === TileType.FLOOR || t === TileType.SUNNY;
}
