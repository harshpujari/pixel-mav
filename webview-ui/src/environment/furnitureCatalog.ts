import { TILE_SIZE } from '../constants.ts';

// ── Furniture definition ────────────────────────────────────

export interface FurnitureDef {
  id: string;
  w: number;          // footprint width in tiles
  h: number;          // footprint height in tiles
  seatOffset?: { col: number; row: number }; // desk seat position relative to top-left
  blocked: boolean;   // footprint tiles block pathfinding
  draw: (
    ctx: CanvasRenderingContext2D,
    x: number, y: number,       // device-pixel top-left of footprint
    zoom: number,
    active: boolean,
  ) => void;
}

// ── Catalog ─────────────────────────────────────────────────

export const CATALOG = new Map<string, FurnitureDef>();

// ── Helpers ─────────────────────────────────────────────────

const s = TILE_SIZE; // shorthand for world-pixel tile size

function px(worldPx: number, zoom: number): number {
  return Math.round(worldPx * zoom);
}

// ── Desk (2×1, front-facing) ────────────────────────────────
// Seat is 1 tile below the left edge of the desk.

CATALOG.set('desk', {
  id: 'desk',
  w: 2, h: 1,
  seatOffset: { col: 0, row: 1 },
  blocked: true,
  draw(ctx, x, y, zoom, active) {
    const tw = px(s * 2, zoom);
    const th = px(s, zoom);

    // Tabletop surface
    ctx.fillStyle = '#5a4838';
    ctx.fillRect(x, y + px(4, zoom), tw, th - px(4, zoom));

    // Top edge highlight
    ctx.fillStyle = '#6a5848';
    ctx.fillRect(x, y + px(4, zoom), tw, px(2, zoom));

    // Legs
    ctx.fillStyle = '#4a3828';
    const legW = px(2, zoom);
    ctx.fillRect(x + px(2, zoom), y + th - px(4, zoom), legW, px(4, zoom));
    ctx.fillRect(x + tw - px(4, zoom), y + th - px(4, zoom), legW, px(4, zoom));

    // Monitor
    const monW = px(8, zoom);
    const monH = px(6, zoom);
    const monX = x + px(12, zoom);
    const monY = y - px(2, zoom);
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(monX, monY, monW, monH);
    // Screen
    ctx.fillStyle = active ? '#224433' : '#1a1a1e';
    ctx.fillRect(monX + px(1, zoom), monY + px(1, zoom), monW - px(2, zoom), monH - px(2, zoom));
    if (active) {
      // Text lines on screen
      ctx.fillStyle = '#44ff88';
      for (let i = 0; i < 3; i++) {
        const lineW = px(3 + Math.floor(i * 1.5), zoom);
        ctx.fillRect(
          monX + px(2, zoom),
          monY + px(2 + i * 1.5, zoom),
          lineW,
          px(0.8, zoom) || 1,
        );
      }
    }

    // Monitor stand
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(monX + px(3, zoom), monY + monH, px(2, zoom), px(2, zoom));
  },
});

// ── Cat bed (1×1) ───────────────────────────────────────────

CATALOG.set('cat_bed', {
  id: 'cat_bed',
  w: 1, h: 1,
  blocked: false, // cats can walk on/through it
  draw(ctx, x, y, zoom) {
    const tw = px(s, zoom);
    const th = px(s, zoom);
    const pad = px(2, zoom);

    // Bed rim
    ctx.fillStyle = '#8866aa';
    ctx.fillRect(x + pad, y + pad, tw - pad * 2, th - pad * 2);

    // Cushion
    ctx.fillStyle = '#aa88cc';
    ctx.fillRect(x + pad + px(1, zoom), y + pad + px(1, zoom),
      tw - pad * 2 - px(2, zoom), th - pad * 2 - px(2, zoom));
  },
});

// ── Food bowl (1×1) ─────────────────────────────────────────

CATALOG.set('food_bowl', {
  id: 'food_bowl',
  w: 1, h: 1,
  blocked: false,
  draw(ctx, x, y, zoom) {
    const cx = x + px(s / 2, zoom);
    const cy = y + px(s / 2, zoom);
    const r = px(4, zoom);

    // Bowl
    ctx.fillStyle = '#aa7755';
    ctx.beginPath();
    ctx.ellipse(cx, cy + px(1, zoom), r, px(3, zoom), 0, 0, Math.PI * 2);
    ctx.fill();

    // Food
    ctx.fillStyle = '#886644';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r - px(1, zoom), px(2, zoom), 0, 0, Math.PI * 2);
    ctx.fill();

    // Kibble highlights
    ctx.fillStyle = '#997755';
    const dotSz = Math.max(1, px(1, zoom));
    ctx.fillRect(cx - px(2, zoom), cy - px(1, zoom), dotSz, dotSz);
    ctx.fillRect(cx + px(1, zoom), cy, dotSz, dotSz);
  },
});

// ── Plant (1×1, extends above tile) ─────────────────────────

CATALOG.set('plant', {
  id: 'plant',
  w: 1, h: 1,
  blocked: true,
  draw(ctx, x, y, zoom) {
    const tw = px(s, zoom);

    // Pot
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x + px(4, zoom), y + px(8, zoom), px(8, zoom), px(8, zoom));
    ctx.fillStyle = '#a0693b';
    ctx.fillRect(x + px(3, zoom), y + px(7, zoom), px(10, zoom), px(2, zoom));

    // Leaves (extend above the tile)
    ctx.fillStyle = '#3a7a3a';
    ctx.fillRect(x + px(5, zoom), y - px(2, zoom), px(6, zoom), px(10, zoom));
    ctx.fillStyle = '#4a8a4a';
    ctx.fillRect(x + px(3, zoom), y + px(0, zoom), px(4, zoom), px(6, zoom));
    ctx.fillRect(x + px(9, zoom), y + px(1, zoom), px(4, zoom), px(5, zoom));

    // Leaf tips
    ctx.fillStyle = '#5a9a5a';
    ctx.fillRect(x + px(2, zoom), y - px(1, zoom), px(2, zoom), px(3, zoom));
    ctx.fillRect(x + tw - px(4, zoom), y, px(2, zoom), px(3, zoom));
  },
});

// ── Bookshelf (2×1, placed against wall) ────────────────────

CATALOG.set('bookshelf', {
  id: 'bookshelf',
  w: 2, h: 1,
  blocked: true,
  draw(ctx, x, y, zoom) {
    const tw = px(s * 2, zoom);
    const th = px(s, zoom);

    // Frame
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(x, y, tw, th);

    // Shelves (3 rows)
    ctx.fillStyle = '#6a5040';
    for (let i = 0; i < 3; i++) {
      const sy = y + px(1 + i * 5, zoom);
      ctx.fillRect(x + px(1, zoom), sy, tw - px(2, zoom), px(1, zoom));
    }

    // Books (colored spines)
    const bookColors = ['#cc4444', '#4466cc', '#44aa44', '#ccaa44', '#aa44aa', '#44aaaa'];
    for (let shelf = 0; shelf < 3; shelf++) {
      const sy = y + px(2 + shelf * 5, zoom);
      let bx = x + px(2, zoom);
      for (let b = 0; b < 6; b++) {
        const bw = px(1.5 + Math.random() * 1.5, zoom) || px(2, zoom);
        const bh = px(3 + Math.random(), zoom);
        ctx.fillStyle = bookColors[(shelf * 6 + b) % bookColors.length];
        ctx.fillRect(bx, sy + px(4, zoom) - bh, bw, bh);
        bx += bw + (px(0.5, zoom) || 1);
        if (bx > x + tw - px(3, zoom)) break;
      }
    }
  },
});
