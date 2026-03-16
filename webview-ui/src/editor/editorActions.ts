import { MAX_GRID_SIZE } from '../constants.ts';
import { TileType } from '../environment/types.ts';
import { tileMap, getTile, setTile } from '../environment/tileMap.ts';
import {
  furniture,
  getRotatedW,
  getRotatedH,
  type PlacedFurniture,
} from '../environment/furnitureStore.ts';
import { CATALOG } from '../environment/furnitureCatalog.ts';
import { cats } from '../engine/catStore.ts';
import { tileCenter } from '../engine/movement.ts';
import {
  editor,
  undoStack,
  redoStack,
  notify,
  type EditorTool,
  type LayoutSnapshot,
} from './editorState.ts';

const MAX_UNDO = 50;
let nextFurnitureId = 100;

// ── Snapshot / Undo / Redo ──────────────────────────────────

function captureSnapshot(): LayoutSnapshot {
  return {
    tiles: [...tileMap.tiles],
    cols: tileMap.cols,
    rows: tileMap.rows,
    furniture: [...furniture.values()].map(f => ({ ...f })),
  };
}

function restoreSnapshot(snap: LayoutSnapshot): void {
  tileMap.tiles = [...snap.tiles];
  tileMap.cols = snap.cols;
  tileMap.rows = snap.rows;

  furniture.clear();
  for (const f of snap.furniture) {
    furniture.set(f.id, { ...f });
  }
}

function pushUndo(): void {
  undoStack.push(captureSnapshot());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

export function undo(): void {
  if (undoStack.length === 0) return;
  redoStack.push(captureSnapshot());
  restoreSnapshot(undoStack.pop()!);
  notify();
}

export function redo(): void {
  if (redoStack.length === 0) return;
  undoStack.push(captureSnapshot());
  restoreSnapshot(redoStack.pop()!);
  notify();
}

// ── Toggle editor ───────────────────────────────────────────

export function toggleEditor(): void {
  editor.active = !editor.active;
  if (!editor.active) {
    editor.selectedFurnitureId = null;
  }
  notify();
}

// ── Tool setters ────────────────────────────────────────────

export function setTool(tool: EditorTool): void {
  editor.tool = tool;
  editor.selectedFurnitureId = null;
  notify();
}

export function setFurnitureType(type: string): void {
  editor.furnitureType = type;
  editor.tool = 'furniture';
  notify();
}

export function rotateGhost(): void {
  editor.ghostRotation = ((editor.ghostRotation + 1) % 4) as 0 | 1 | 2 | 3;
  notify();
}

// ── Drag painting (tiles) ───────────────────────────────────

export function startDrag(col: number, row: number): void {
  editor.isDragging = true;
  if (isTilePaintTool(editor.tool)) {
    pushUndo();
    applyToolRaw(col, row);
  } else {
    applyToolSingle(col, row);
  }
}

export function continueDrag(col: number, row: number): void {
  if (!editor.isDragging) return;
  if (isTilePaintTool(editor.tool)) {
    applyToolRaw(col, row);
  }
}

export function endDrag(): void {
  editor.isDragging = false;
}

function isTilePaintTool(tool: EditorTool): boolean {
  return tool === 'floor' || tool === 'wall' || tool === 'sunny' || tool === 'erase';
}

// ── Tool application ────────────────────────────────────────

/** Apply tool at (col, row) as a new action (pushes undo). */
function applyToolSingle(col: number, row: number): void {
  // Check for grid expansion (click outside grid)
  if (col < 0 || row < 0 || col >= tileMap.cols || row >= tileMap.rows) {
    tryExpandGrid(col, row);
    return;
  }

  switch (editor.tool) {
    case 'furniture':
      placeFurniture(col, row);
      break;
    case 'select':
      selectAt(col, row);
      break;
    case 'eyedropper':
      eyedropAt(col, row);
      break;
  }
  notify();
}

/** Apply tile paint tool without pushing undo (used during drag). */
function applyToolRaw(col: number, row: number): void {
  if (col < 0 || row < 0 || col >= tileMap.cols || row >= tileMap.rows) return;

  switch (editor.tool) {
    case 'floor':
      setTile(tileMap, col, row, TileType.FLOOR);
      break;
    case 'wall':
      setTile(tileMap, col, row, TileType.WALL);
      break;
    case 'sunny':
      setTile(tileMap, col, row, TileType.SUNNY);
      break;
    case 'erase':
      eraseAtRaw(col, row);
      break;
  }
}

// ── Erase ───────────────────────────────────────────────────

/** Erase via right-click (always pushes undo). */
export function eraseAt(col: number, row: number): void {
  if (col < 0 || row < 0 || col >= tileMap.cols || row >= tileMap.rows) return;
  pushUndo();
  eraseAtRaw(col, row);
  notify();
}

function eraseAtRaw(col: number, row: number): void {
  const furn = findFurnitureAt(col, row);
  if (furn) {
    furniture.delete(furn.id);
  } else {
    setTile(tileMap, col, row, TileType.VOID);
  }
}

// ── Select ──────────────────────────────────────────────────

function selectAt(col: number, row: number): void {
  const furn = findFurnitureAt(col, row);
  editor.selectedFurnitureId = furn?.id ?? null;
  notify();
}

// ── Eyedropper ──────────────────────────────────────────────

function eyedropAt(col: number, row: number): void {
  const furn = findFurnitureAt(col, row);
  if (furn) {
    editor.tool = 'furniture';
    editor.furnitureType = furn.type;
    editor.ghostRotation = furn.rotation;
  } else {
    const tile = getTile(tileMap, col, row);
    switch (tile) {
      case TileType.FLOOR: editor.tool = 'floor'; break;
      case TileType.WALL:  editor.tool = 'wall'; break;
      case TileType.SUNNY: editor.tool = 'sunny'; break;
      default:             editor.tool = 'erase'; break;
    }
  }
  notify();
}

// ── Furniture placement ─────────────────────────────────────

function placeFurniture(col: number, row: number): void {
  if (!canPlaceFurniture(col, row, editor.furnitureType, editor.ghostRotation)) return;

  pushUndo();
  const id = `furn-${nextFurnitureId++}`;
  furniture.set(id, {
    id,
    type: editor.furnitureType,
    col,
    row,
    rotation: editor.ghostRotation,
    active: false,
  });
}

export function canPlaceFurniture(
  col: number,
  row: number,
  type: string,
  rotation: 0 | 1 | 2 | 3,
): boolean {
  const def = CATALOG.get(type);
  if (!def) return false;

  const w = (rotation % 2 === 0) ? def.w : def.h;
  const h = (rotation % 2 === 0) ? def.h : def.w;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const tc = col + c;
      const tr = row + r;
      if (tc < 0 || tc >= tileMap.cols || tr < 0 || tr >= tileMap.rows) return false;
      const tile = getTile(tileMap, tc, tr);
      if (tile !== TileType.FLOOR && tile !== TileType.SUNNY) return false;
      if (findFurnitureAt(tc, tr)) return false;
    }
  }
  return true;
}

// ── Selected furniture operations ───────────────────────────

export function rotateSelected(): void {
  if (!editor.selectedFurnitureId) return;
  const item = furniture.get(editor.selectedFurnitureId);
  if (!item) return;
  pushUndo();
  item.rotation = ((item.rotation + 1) % 4) as 0 | 1 | 2 | 3;
  notify();
}

export function deleteSelected(): void {
  if (!editor.selectedFurnitureId) return;
  pushUndo();
  furniture.delete(editor.selectedFurnitureId);
  editor.selectedFurnitureId = null;
  notify();
}

export function toggleSelectedActive(): void {
  if (!editor.selectedFurnitureId) return;
  const item = furniture.get(editor.selectedFurnitureId);
  if (!item) return;
  pushUndo();
  item.active = !item.active;
  notify();
}

// ── Grid expansion ──────────────────────────────────────────

function tryExpandGrid(col: number, row: number): void {
  let direction: 'north' | 'south' | 'east' | 'west' | null = null;

  if (row === -1 && col >= 0 && col < tileMap.cols) direction = 'north';
  else if (row === tileMap.rows && col >= 0 && col < tileMap.cols) direction = 'south';
  else if (col === -1 && row >= 0 && row < tileMap.rows) direction = 'west';
  else if (col === tileMap.cols && row >= 0 && row < tileMap.rows) direction = 'east';

  if (!direction) return;
  if (!expandGrid(direction)) return;

  // Apply current tool to the newly-created tile
  const newCol = direction === 'west' ? 0 : col;
  const newRow = direction === 'north' ? 0 : row;
  setTile(tileMap, newCol, newRow, TileType.FLOOR);
  notify();
}

function expandGrid(direction: 'north' | 'south' | 'east' | 'west'): boolean {
  const map = tileMap;
  const isHoriz = direction === 'east' || direction === 'west';
  const newCols = isHoriz ? map.cols + 1 : map.cols;
  const newRows = !isHoriz ? map.rows + 1 : map.rows;

  if (newCols > MAX_GRID_SIZE || newRows > MAX_GRID_SIZE) return false;

  pushUndo();

  const dx = direction === 'west' ? 1 : 0;
  const dy = direction === 'north' ? 1 : 0;

  // Resize tile array
  const newTiles = new Array(newCols * newRows).fill(TileType.VOID);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      newTiles[(r + dy) * newCols + (c + dx)] = map.tiles[r * map.cols + c];
    }
  }
  map.tiles = newTiles;
  map.cols = newCols;
  map.rows = newRows;

  // Shift furniture and cats when expanding north/west
  if (dx > 0 || dy > 0) {
    for (const item of furniture.values()) {
      item.col += dx;
      item.row += dy;
    }
    for (const cat of cats.values()) {
      cat.tileCol += dx;
      cat.tileRow += dy;
      cat.seatCol += dx;
      cat.seatRow += dy;
      cat.x = tileCenter(cat.tileCol);
      cat.y = tileCenter(cat.tileRow);
      for (const step of cat.path) {
        step.col += dx;
        step.row += dy;
      }
    }
  }

  return true;
}

// ── Helpers ─────────────────────────────────────────────────

function findFurnitureAt(col: number, row: number): PlacedFurniture | null {
  for (const item of furniture.values()) {
    const w = getRotatedW(item);
    const h = getRotatedH(item);
    if (col >= item.col && col < item.col + w && row >= item.row && row < item.row + h) {
      return item;
    }
  }
  return null;
}
