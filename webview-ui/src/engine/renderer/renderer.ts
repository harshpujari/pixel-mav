import { tileMap } from '../../environment/tileMap.ts';
import { drawCats } from './catRenderer.ts';
import { drawParticles } from './effectRenderer.ts';
import { drawTiles } from './tileRenderer.ts';
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

    // ── Cats ──────────────────────────────────────────────
    drawCats(ctx, offsetX, offsetY, zoom);

    // ── Effects (particles on top) ───────────────────
    drawParticles(ctx, offsetX, offsetY, zoom);
  }
}
