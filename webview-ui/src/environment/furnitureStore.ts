import { TILE_SIZE } from '../constants.ts';
import { CATALOG } from './furnitureCatalog.ts';

// ── Placed furniture instance ────────────────────────────────

export interface PlacedFurniture {
  id: string;
  type: string;             // references FurnitureDef.id in CATALOG
  col: number;              // top-left tile column
  row: number;              // top-left tile row
  rotation: 0 | 1 | 2 | 3; // 0=front, 1=right, 2=back, 3=left
  active: boolean;          // for toggleable furniture (desk monitor on/off)
}

// ── Module-level singleton ───────────────────────────────────

export const furniture = new Map<string, PlacedFurniture>();

// ── Rotation helpers ─────────────────────────────────────────

/** Effective width after rotation (swap w/h for 90° and 270°). */
export function getRotatedW(item: PlacedFurniture): number {
  const def = CATALOG.get(item.type);
  if (!def) return 1;
  return (item.rotation % 2 === 0) ? def.w : def.h;
}

/** Effective height after rotation (swap w/h for 90° and 270°). */
export function getRotatedH(item: PlacedFurniture): number {
  const def = CATALOG.get(item.type);
  if (!def) return 1;
  return (item.rotation % 2 === 0) ? def.h : def.w;
}

// ── Blocked tiles ────────────────────────────────────────────

/** Compute the set of tiles blocked by all placed furniture with `blocked: true`. */
export function getBlockedTiles(): Set<string> {
  const blocked = new Set<string>();
  for (const item of furniture.values()) {
    const def = CATALOG.get(item.type);
    if (!def || !def.blocked) continue;
    const w = getRotatedW(item);
    const h = getRotatedH(item);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        blocked.add(`${item.col + c},${item.row + r}`);
      }
    }
  }
  return blocked;
}

// ── Seat positions ───────────────────────────────────────────

/** Rotate a seat offset by the given rotation. */
function rotateSeatOffset(
  offset: { col: number; row: number },
  rotation: 0 | 1 | 2 | 3,
): { col: number; row: number } {
  switch (rotation) {
    case 0: return offset;
    case 1: return { col: -offset.row, row: offset.col };
    case 2: return { col: -offset.col, row: -offset.row };
    case 3: return { col: offset.row, row: -offset.col };
  }
}

/** Derive seat positions from all placed desks (furniture with seatOffset). */
export function getSeatPositions(): Array<{ col: number; row: number }> {
  const seats: Array<{ col: number; row: number }> = [];
  for (const item of furniture.values()) {
    const def = CATALOG.get(item.type);
    if (!def?.seatOffset) continue;
    const { col: sc, row: sr } = rotateSeatOffset(def.seatOffset, item.rotation);
    seats.push({ col: item.col + sc, row: item.row + sr });
  }
  return seats;
}

// ── Toggle desk active state ─────────────────────────────────

/** Set the active state of the desk whose seat matches (seatCol, seatRow). */
export function setDeskActiveBySeat(seatCol: number, seatRow: number, active: boolean): void {
  for (const item of furniture.values()) {
    const def = CATALOG.get(item.type);
    if (!def?.seatOffset) continue;
    const { col: sc, row: sr } = rotateSeatOffset(def.seatOffset, item.rotation);
    if (item.col + sc === seatCol && item.row + sr === seatRow) {
      item.active = active;
      return;
    }
  }
}

// ── Sort Y for Z-ordering ────────────────────────────────────

/** Bottom-edge world Y of a placed furniture item (for Z-sort). */
export function furnitureSortY(item: PlacedFurniture): number {
  return (item.row + getRotatedH(item)) * TILE_SIZE;
}

// ── Default layout ───────────────────────────────────────────

let nextId = 0;

function place(type: string, col: number, row: number, rotation: 0 | 1 | 2 | 3 = 0): void {
  const id = `furn-${nextId++}`;
  furniture.set(id, { id, type, col, row, rotation, active: false });
}

export function createDefaultFurniture(): void {
  furniture.clear();
  nextId = 0;

  // 8 desks — seatOffset {col:0, row:1} gives seats matching DEFAULT_SEATS
  // Row 2 desks → seats at row 3
  place('desk', 3, 2);
  place('desk', 7, 2);
  place('desk', 11, 2);
  place('desk', 15, 2);
  // Row 6 desks → seats at row 7
  place('desk', 3, 6);
  place('desk', 7, 6);
  place('desk', 11, 6);
  place('desk', 15, 6);

  // Bookshelves against top wall
  place('bookshelf', 1, 1);
  place('bookshelf', 12, 1);

  // Plants in corners
  place('plant', 18, 1);
  place('plant', 1, 5);

  // Cat beds in open areas
  place('cat_bed', 10, 4);
  place('cat_bed', 6, 8);

  // Food bowl in corner
  place('food_bowl', 18, 9);
}

// Initialize on module load
createDefaultFurniture();
