// ── Debug overlay (dev only) ────────────────────────────────
// Toggle with F3. Shows FPS, entity counts, and cat path visualization.

import { TILE_SIZE } from '../../constants.ts';
import { tileMap } from '../../environment/tileMap.ts';
import { furniture } from '../../environment/furnitureStore.ts';
import { cats } from '../catStore.ts';
import { tileCenter } from '../movement.ts';
import { getParticleCount } from './effectRenderer.ts';

// ── State ───────────────────────────────────────────────────

let enabled = false;

// FPS tracking (smoothed rolling average)
const FPS_SAMPLES = 60;
const frameTimes: number[] = [];
let fps = 0;

export function isDebugEnabled(): boolean {
  return enabled;
}

export function toggleDebug(): void {
  enabled = !enabled;
  frameTimes.length = 0;
  fps = 0;
}

/** Call once per frame with delta time in seconds */
export function updateDebugFps(dt: number): void {
  if (!enabled) return;
  if (dt <= 0) return; // skip first frame

  frameTimes.push(dt);
  if (frameTimes.length > FPS_SAMPLES) frameTimes.shift();

  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  fps = avg > 0 ? 1 / avg : 0;
}

// ── Render ──────────────────────────────────────────────────

export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  if (!enabled) return;

  drawPaths(ctx, offsetX, offsetY, zoom);
  drawStats(ctx);
}

// ── Path visualization ──────────────────────────────────────

function drawPaths(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const cat of cats.values()) {
    if (cat.path.length === 0) continue;

    const lineW = Math.max(1, zoom * 0.5);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.setLineDash([lineW * 2, lineW * 2]);

    ctx.beginPath();

    // Start from cat's current position
    const sx = Math.round(offsetX + cat.x * zoom);
    const sy = Math.round(offsetY + cat.y * zoom);
    ctx.moveTo(sx, sy);

    // Draw through each waypoint
    for (const wp of cat.path) {
      const wx = Math.round(offsetX + tileCenter(wp.col) * zoom);
      const wy = Math.round(offsetY + tileCenter(wp.row) * zoom);
      ctx.lineTo(wx, wy);
    }

    ctx.stroke();

    // Draw destination dot
    const last = cat.path[cat.path.length - 1];
    const dx = Math.round(offsetX + tileCenter(last.col) * zoom);
    const dy = Math.round(offsetY + tileCenter(last.row) * zoom);
    const dotR = Math.max(2, zoom);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.setLineDash([]);

  // Draw tile grid lines
  drawTileGrid(ctx, offsetX, offsetY, zoom);
}

function drawTileGrid(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const { cols, rows } = tileMap;
  const tileW = TILE_SIZE * zoom;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;

  for (let c = 0; c <= cols; c++) {
    const x = Math.round(offsetX + c * tileW);
    ctx.beginPath();
    ctx.moveTo(x, Math.round(offsetY));
    ctx.lineTo(x, Math.round(offsetY + rows * tileW));
    ctx.stroke();
  }

  for (let r = 0; r <= rows; r++) {
    const y = Math.round(offsetY + r * tileW);
    ctx.beginPath();
    ctx.moveTo(Math.round(offsetX), y);
    ctx.lineTo(Math.round(offsetX + cols * tileW), y);
    ctx.stroke();
  }
}

// ── HUD stats (screen-space, top-left) ──────────────────────

function drawStats(ctx: CanvasRenderingContext2D): void {
  const catCount = cats.size;
  const furnCount = furniture.size;
  const particleCount = getParticleCount();

  // Count cats by state
  let active = 0;
  let idle = 0;
  let walking = 0;
  for (const cat of cats.values()) {
    if (cat.state === 'type' || cat.state === 'read' || cat.state === 'wait') active++;
    else if (cat.state === 'walk' || cat.state === 'wander' || cat.state === 'zoomies') walking++;
    else idle++;
  }

  const lines = [
    `FPS: ${Math.round(fps)}`,
    `Cats: ${catCount} (active:${active} idle:${idle} walk:${walking})`,
    `Furniture: ${furnCount}`,
    `Particles: ${particleCount}`,
  ];

  const fontSize = 11;
  const lineHeight = 14;
  const padX = 8;
  const padY = 6;
  const boxW = 280;
  const boxH = padY * 2 + lines.length * lineHeight;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(4, 4, boxW, boxH);
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, boxW, boxH);

  // Text
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = '#0ff';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 4 + padX, 4 + padY + i * lineHeight);
  }

  ctx.textBaseline = 'alphabetic';
}
