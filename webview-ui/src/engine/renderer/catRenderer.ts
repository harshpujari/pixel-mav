import { CAT_HEIGHT_PX, CAT_WIDTH_PX } from '../../constants.ts';
import type { Cat, CatBreed, CatState, Direction } from '../../types.ts';
import { cats } from '../catStore.ts';

// ── Breed colours for the Phase 3 placeholder rectangle ──────
const BREED_COLOR: Record<CatBreed, string> = {
  tabby:   '#cc8844',
  tuxedo:  '#3a3a3a',
  calico:  '#dd9966',
  siamese: '#d4b896',
  void:    '#1a1a2e',
  orange:  '#ff8c00',
};

// ── State indicator colours (top-right corner dot) ───────────
const STATE_COLOR: Partial<Record<CatState, string>> = {
  type:    '#00ff88',
  read:    '#00aaff',
  wait:    '#ffcc00',
  sleep:   '#8888ff',
  groom:   '#ff88cc',
  stretch: '#ffaa44',
  walk:    '#ffffff',
  wander:  '#ffffff',
  zoomies: '#ff4444',
};

// ── Public draw call ─────────────────────────────────────────

/**
 * Draw all cats as coloured placeholder rectangles.
 * Z-sorted by bottom edge (ascending Y) so cats further down the screen
 * appear in front — matches the future sprite Z-sort order.
 */
export function drawCats(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const sorted = [...cats.values()].sort((a, b) => a.y - b.y);
  for (const cat of sorted) {
    drawCat(ctx, cat, offsetX, offsetY, zoom);
  }
}

// ── Per-cat drawing ───────────────────────────────────────────

function drawCat(
  ctx: CanvasRenderingContext2D,
  cat: Cat,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const w = Math.round(CAT_WIDTH_PX * zoom);
  const h = Math.round(CAT_HEIGHT_PX * zoom);

  // Top-left of the cat rectangle, centred on cat.x / cat.y (world pixels)
  const dx = Math.round(offsetX + cat.x * zoom - w / 2);
  const dy = Math.round(offsetY + cat.y * zoom - h / 2);

  // Body
  ctx.fillStyle = BREED_COLOR[cat.breed];
  ctx.fillRect(dx, dy, w, h);

  // State dot — top-right corner
  const dotSize = Math.max(2, Math.round(3 * zoom));
  ctx.fillStyle = STATE_COLOR[cat.state] ?? 'rgba(255,255,255,0.25)';
  ctx.fillRect(dx + w - dotSize, dy, dotSize, dotSize);

  // Direction indicator — white dot on the facing edge
  const [ddx, ddy] = directionDotPos(cat.direction, dx, dy, w, h, dotSize);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(ddx, ddy, dotSize, dotSize);
}

// ── Direction dot position ────────────────────────────────────

function directionDotPos(
  dir: Direction,
  dx: number, dy: number, w: number, h: number,
  dotSize: number,
): [number, number] {
  const midX = dx + Math.round((w - dotSize) / 2);
  const midY = dy + Math.round((h - dotSize) / 2);
  switch (dir) {
    case 'up':    return [midX, dy];
    case 'down':  return [midX, dy + h - dotSize];
    case 'right': return [dx + w - dotSize, midY];
    case 'left':  return [dx, midY];
  }
}
