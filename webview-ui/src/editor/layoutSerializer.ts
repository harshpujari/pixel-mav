import { tileMap } from '../environment/tileMap.ts';
import { furniture } from '../environment/furnitureStore.ts';

// ── Layout JSON format ──────────────────────────────────────

export interface LayoutJSON {
  version: 1;
  cols: number;
  rows: number;
  tiles: number[];
  furniture: Array<{
    type: string;
    col: number;
    row: number;
    rotation: 0 | 1 | 2 | 3;
  }>;
}

// ── Serialize ───────────────────────────────────────────────

export function serializeLayout(): string {
  const layout: LayoutJSON = {
    version: 1,
    cols: tileMap.cols,
    rows: tileMap.rows,
    tiles: [...tileMap.tiles],
    furniture: [...furniture.values()].map(f => ({
      type: f.type,
      col: f.col,
      row: f.row,
      rotation: f.rotation,
    })),
  };
  return JSON.stringify(layout, null, 2);
}

// ── Deserialize ─────────────────────────────────────────────

export function deserializeLayout(json: string): boolean {
  try {
    const layout = JSON.parse(json) as LayoutJSON;
    if (layout.version !== 1) return false;
    if (!Array.isArray(layout.tiles) || !Array.isArray(layout.furniture)) return false;
    if (layout.tiles.length !== layout.cols * layout.rows) return false;

    // Apply to tileMap
    tileMap.cols = layout.cols;
    tileMap.rows = layout.rows;
    tileMap.tiles = layout.tiles;

    // Apply furniture
    furniture.clear();
    for (let i = 0; i < layout.furniture.length; i++) {
      const f = layout.furniture[i];
      const id = `furn-${i}`;
      furniture.set(id, {
        id,
        type: f.type,
        col: f.col,
        row: f.row,
        rotation: f.rotation,
        active: false,
      });
    }

    return true;
  } catch {
    return false;
  }
}
