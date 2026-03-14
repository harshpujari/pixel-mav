/** Tile types for the 2D grid map. */
export enum TileType {
  VOID  = 0, // empty — non-walkable, transparent
  FLOOR = 1, // walkable — colorizable wood/carpet
  WALL  = 2, // non-walkable — auto-tiled edges
  SUNNY = 3, // walkable — cats gravitate here during wander
}
