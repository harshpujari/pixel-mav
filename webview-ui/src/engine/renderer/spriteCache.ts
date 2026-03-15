import type { CatBreed } from '../../types.ts';
import {
  SPRITE_W,
  SPRITE_H,
  getBreedColors,
  getFrameBitmap,
  resolveColor,
} from './spriteData.ts';

// ── Per-zoom frame cache ────────────────────────────────────
// When zoom changes, the cache is flushed (lazy invalidation).
// Each entry is a tiny HTMLCanvasElement with the pre-scaled,
// colourised frame ready for ctx.drawImage().

let cachedZoom = -1;
const cache = new Map<string, HTMLCanvasElement>();

/**
 * Get a pre-rendered, pre-scaled sprite frame.
 *
 * Returns null if the sheet slot is empty (unused direction/state combo).
 */
export function getFrame(
  breed: CatBreed,
  row: number,
  col: number,
  flipH: boolean,
  zoom: number,
  hueShift: number = 0,
): HTMLCanvasElement | null {
  // Flush cache on zoom change (quantised to avoid float key drift)
  const zoomKey = Math.round(zoom * 100);
  if (zoomKey !== Math.round(cachedZoom * 100)) {
    cache.clear();
    cachedZoom = zoom;
  }

  const key = `${breed}-${hueShift}-${row}-${col}-${flipH ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const bitmap = getFrameBitmap(row, col);
  if (!bitmap) return null;

  const colors = getBreedColors(breed, hueShift);
  const w = Math.round(SPRITE_W * zoom);
  const h = Math.round(SPRITE_H * zoom);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Render each world pixel as a zoom-sized block
  for (let r = 0; r < SPRITE_H; r++) {
    for (let c = 0; c < SPRITE_W; c++) {
      const srcC = flipH ? (SPRITE_W - 1 - c) : c;
      const val = bitmap[r][srcC];
      if (val === 0) continue;

      ctx.fillStyle = resolveColor(val, colors);

      // Sub-pixel-precise rects (same approach as tileRenderer)
      const px = Math.round(c * zoom);
      const py = Math.round(r * zoom);
      const pw = Math.round((c + 1) * zoom) - px;
      const ph = Math.round((r + 1) * zoom) - py;
      ctx.fillRect(px, py, pw, ph);
    }
  }

  cache.set(key, canvas);
  return canvas;
}
