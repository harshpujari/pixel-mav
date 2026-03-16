import { TILE_SIZE } from '../constants.ts';
import { tileMap } from '../environment/tileMap.ts';
import { furniture, getRotatedW, getRotatedH } from '../environment/furnitureStore.ts';
import { CATALOG } from '../environment/furnitureCatalog.ts';
import { editor } from './editorState.ts';
import { canPlaceFurniture } from './editorActions.ts';

// ── Public entry point ──────────────────────────────────────

export function drawEditorOverlay(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  if (!editor.active) return;

  drawEditorGrid(ctx, offsetX, offsetY, zoom);
  drawExpansionGhosts(ctx, offsetX, offsetY, zoom);
  drawGhost(ctx, offsetX, offsetY, zoom);
  drawSelection(ctx, offsetX, offsetY, zoom);
}

// ── Editor grid (stronger lines) ────────────────────────────

function drawEditorGrid(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let c = 0; c <= tileMap.cols; c++) {
    const x = Math.round(offsetX + c * s) + 0.5;
    ctx.moveTo(x, Math.round(offsetY));
    ctx.lineTo(x, Math.round(offsetY + tileMap.rows * s));
  }
  for (let r = 0; r <= tileMap.rows; r++) {
    const y = Math.round(offsetY + r * s) + 0.5;
    ctx.moveTo(Math.round(offsetX), y);
    ctx.lineTo(Math.round(offsetX + tileMap.cols * s), y);
  }

  ctx.stroke();
}

// ── Expansion ghost border ──────────────────────────────────

function drawExpansionGhosts(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1;

  // Top border (row -1)
  for (let c = 0; c < tileMap.cols; c++) {
    const x = Math.round(offsetX + c * s) + 0.5;
    const y = Math.round(offsetY - s) + 0.5;
    const w = Math.round(offsetX + (c + 1) * s) - Math.round(offsetX + c * s) - 1;
    const h = Math.round(s) - 1;
    ctx.strokeRect(x, y, w, h);
  }
  // Bottom border
  for (let c = 0; c < tileMap.cols; c++) {
    const x = Math.round(offsetX + c * s) + 0.5;
    const y = Math.round(offsetY + tileMap.rows * s) + 0.5;
    const w = Math.round(offsetX + (c + 1) * s) - Math.round(offsetX + c * s) - 1;
    const h = Math.round(s) - 1;
    ctx.strokeRect(x, y, w, h);
  }
  // Left border (col -1)
  for (let r = 0; r < tileMap.rows; r++) {
    const x = Math.round(offsetX - s) + 0.5;
    const y = Math.round(offsetY + r * s) + 0.5;
    const w = Math.round(s) - 1;
    const h = Math.round(offsetY + (r + 1) * s) - Math.round(offsetY + r * s) - 1;
    ctx.strokeRect(x, y, w, h);
  }
  // Right border
  for (let r = 0; r < tileMap.rows; r++) {
    const x = Math.round(offsetX + tileMap.cols * s) + 0.5;
    const y = Math.round(offsetY + r * s) + 0.5;
    const w = Math.round(s) - 1;
    const h = Math.round(offsetY + (r + 1) * s) - Math.round(offsetY + r * s) - 1;
    ctx.strokeRect(x, y, w, h);
  }

  ctx.setLineDash([]);
}

// ── Ghost preview at cursor ─────────────────────────────────

function drawGhost(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const { tool, cursorCol, cursorRow } = editor;
  const s = TILE_SIZE * zoom;

  // Tile ghost for tile paint tools
  if (tool === 'floor' || tool === 'wall' || tool === 'sunny') {
    const inBounds = cursorCol >= 0 && cursorRow >= 0 &&
      cursorCol < tileMap.cols && cursorRow < tileMap.rows;
    const isExpansion = !inBounds && isAdjacentToGrid(cursorCol, cursorRow);

    if (!inBounds && !isExpansion) return;

    const x = Math.round(offsetX + cursorCol * s);
    const y = Math.round(offsetY + cursorRow * s);
    const w = Math.round(offsetX + (cursorCol + 1) * s) - x;
    const h = Math.round(offsetY + (cursorRow + 1) * s) - y;
    ctx.fillStyle = inBounds ? 'rgba(0, 200, 100, 0.3)' : 'rgba(100, 180, 255, 0.2)';
    ctx.fillRect(x, y, w, h);
    return;
  }

  // Furniture ghost
  if (tool === 'furniture') {
    const def = CATALOG.get(editor.furnitureType);
    if (!def) return;

    const fw = (editor.ghostRotation % 2 === 0) ? def.w : def.h;
    const fh = (editor.ghostRotation % 2 === 0) ? def.h : def.w;
    const valid = canPlaceFurniture(cursorCol, cursorRow, editor.furnitureType, editor.ghostRotation);

    // Draw semi-transparent furniture
    const x = Math.round(offsetX + cursorCol * s);
    const y = Math.round(offsetY + cursorRow * s);
    ctx.globalAlpha = 0.5;
    def.draw(ctx, x, y, zoom, false);
    ctx.globalAlpha = 1;

    // Tinted footprint overlay
    for (let r = 0; r < fh; r++) {
      for (let c = 0; c < fw; c++) {
        const tx = Math.round(offsetX + (cursorCol + c) * s);
        const ty = Math.round(offsetY + (cursorRow + r) * s);
        const tw = Math.round(offsetX + (cursorCol + c + 1) * s) - tx;
        const th = Math.round(offsetY + (cursorRow + r + 1) * s) - ty;
        ctx.fillStyle = valid ? 'rgba(0, 200, 100, 0.2)' : 'rgba(200, 0, 0, 0.2)';
        ctx.fillRect(tx, ty, tw, th);
      }
    }
    return;
  }

  // Erase ghost
  if (tool === 'erase') {
    if (cursorCol < 0 || cursorRow < 0 || cursorCol >= tileMap.cols || cursorRow >= tileMap.rows) return;
    const x = Math.round(offsetX + cursorCol * s);
    const y = Math.round(offsetY + cursorRow * s);
    const w = Math.round(offsetX + (cursorCol + 1) * s) - x;
    const h = Math.round(offsetY + (cursorRow + 1) * s) - y;
    ctx.fillStyle = 'rgba(200, 50, 50, 0.25)';
    ctx.fillRect(x, y, w, h);
    return;
  }

  // Select / eyedropper: subtle highlight
  if (tool === 'select' || tool === 'eyedropper') {
    if (cursorCol < 0 || cursorRow < 0 || cursorCol >= tileMap.cols || cursorRow >= tileMap.rows) return;
    const x = Math.round(offsetX + cursorCol * s);
    const y = Math.round(offsetY + cursorRow * s);
    const w = Math.round(offsetX + (cursorCol + 1) * s) - x;
    const h = Math.round(offsetY + (cursorRow + 1) * s) - y;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

// ── Selection highlight ─────────────────────────────────────

function drawSelection(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  if (!editor.selectedFurnitureId) return;
  const item = furniture.get(editor.selectedFurnitureId);
  if (!item) return;

  const s = TILE_SIZE * zoom;
  const w = getRotatedW(item);
  const h = getRotatedH(item);
  const x = Math.round(offsetX + item.col * s);
  const y = Math.round(offsetY + item.row * s);
  const pw = Math.round(offsetX + (item.col + w) * s) - x;
  const ph = Math.round(offsetY + (item.row + h) * s) - y;

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#00aaff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, pw, ph);
  ctx.setLineDash([]);
}

// ── Helpers ─────────────────────────────────────────────────

function isAdjacentToGrid(col: number, row: number): boolean {
  return (
    (row === -1 && col >= 0 && col < tileMap.cols) ||
    (row === tileMap.rows && col >= 0 && col < tileMap.cols) ||
    (col === -1 && row >= 0 && row < tileMap.rows) ||
    (col === tileMap.cols && row >= 0 && row < tileMap.rows)
  );
}
