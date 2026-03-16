import { tileMap } from '../../environment/tileMap.ts';
import { furniture, furnitureSortY } from '../../environment/furnitureStore.ts';
import { drawEditorOverlay } from '../../editor/editorRenderer.ts';
import { cats } from '../catStore.ts';
import { drawSingleCat } from './catRenderer.ts';
import { drawFurnitureItem } from './furnitureRenderer.ts';
import { drawParticles } from './effectRenderer.ts';
import { drawTiles } from './tileRenderer.ts';
import { SPRITE_H } from './spriteData.ts';
import type { Camera } from './camera.ts';

/**
 * Main render orchestrator.
 *
 * All drawing uses manual offset + zoom coordinates (no ctx transforms).
 * This ensures crisp integer-pixel alignment for pixel art at any zoom
 * level and DPR.
 */
export class Renderer {
  private camera: Camera;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  /** Full render pass — called once per frame by the game loop */
  render(ctx: CanvasRenderingContext2D): void {
    const canvas = ctx.canvas;

    // Clear entire canvas (device pixels)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Read cached offset from camera (computed in update phase)
    const { offsetX, offsetY, zoom } = this.camera;

    // ── Tiles ─────────────────────────────────────────────
    drawTiles(ctx, tileMap, offsetX, offsetY, zoom);

    // ── Z-sorted entities (furniture + cats interleaved) ──
    const items: Array<{ sortY: number; draw: () => void }> = [];

    for (const item of furniture.values()) {
      const sy = furnitureSortY(item);
      items.push({
        sortY: sy,
        draw: () => drawFurnitureItem(ctx, item, offsetX, offsetY, zoom),
      });
    }

    for (const cat of cats.values()) {
      items.push({
        sortY: cat.y + SPRITE_H / 2,
        draw: () => drawSingleCat(ctx, cat, offsetX, offsetY, zoom),
      });
    }

    items.sort((a, b) => a.sortY - b.sortY);
    for (const item of items) item.draw();

    // ── Effects (particles on top) ───────────────────
    drawParticles(ctx, offsetX, offsetY, zoom);

    // ── Editor overlay (ghost, grid, selection) ────
    drawEditorOverlay(ctx, offsetX, offsetY, zoom);
  }
}
