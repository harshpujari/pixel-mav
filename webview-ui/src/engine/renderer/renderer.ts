import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, TILE_SIZE } from '../../constants.ts';
import { drawCats } from './catRenderer.ts';
import type { Camera } from './camera.ts';

/**
 * Main render orchestrator.
 *
 * All drawing uses manual offset + zoom coordinates (no ctx transforms).
 * This ensures crisp integer-pixel alignment for pixel art at any zoom
 * level and DPR.
 *
 * Phase 2: draws a placeholder tile grid to verify camera, zoom, pan.
 * Later phases will add tile, entity, effect, and UI rendering layers.
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

    // ── Placeholder grid ──────────────────────────────────
    this.drawPlaceholderGrid(ctx, offsetX, offsetY, zoom);

    // ── Cats ──────────────────────────────────────────────
    drawCats(ctx, offsetX, offsetY, zoom);
  }

  /** Draws a checkerboard grid as a visual placeholder for the tile map */
  private drawPlaceholderGrid(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    zoom: number,
  ): void {
    const cols = DEFAULT_GRID_COLS;
    const rows = DEFAULT_GRID_ROWS;
    const s = TILE_SIZE * zoom; // tile size in device pixels

    // Floor tiles
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * s;
        const y = offsetY + row * s;
        const isEven = (col + row) % 2 === 0;
        ctx.fillStyle = isEven ? '#3a3a3a' : '#2c2c2c';
        ctx.fillRect(x, y, s, s);
      }
    }

    // Grid lines — +0.5 offset for crisp 1px lines in device pixels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 0; col <= cols; col++) {
      const x = offsetX + col * s + 0.5;
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + rows * s);
    }
    for (let row = 0; row <= rows; row++) {
      const y = offsetY + row * s + 0.5;
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + cols * s, y);
    }
    ctx.stroke();

    // Label (fixed device-pixel font size for readability at any zoom)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const fontSize = Math.round(12 * (window.devicePixelRatio || 1));
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Pixel Mav — Phase 3',
      offsetX + (cols * s) / 2,
      offsetY + (rows * s) / 2,
    );
  }
}
