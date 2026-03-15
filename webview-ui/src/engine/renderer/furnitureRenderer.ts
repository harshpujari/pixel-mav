import { TILE_SIZE } from '../../constants.ts';
import { CATALOG } from '../../environment/furnitureCatalog.ts';
import type { PlacedFurniture } from '../../environment/furnitureStore.ts';

/**
 * Draw a single placed furniture item at its world position.
 * Called by the renderer during the unified Z-sort pass.
 */
export function drawFurnitureItem(
  ctx: CanvasRenderingContext2D,
  item: PlacedFurniture,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const def = CATALOG.get(item.type);
  if (!def) return;

  const x = Math.round(offsetX + item.col * TILE_SIZE * zoom);
  const y = Math.round(offsetY + item.row * TILE_SIZE * zoom);

  def.draw(ctx, x, y, zoom, item.active);
}
