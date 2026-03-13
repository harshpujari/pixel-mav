import { CAT_HEIGHT_PX, CAT_WIDTH_PX } from '../../constants.ts';
import type { Cat, CatBreed, CatState } from '../../types.ts';
import { cats } from '../catStore.ts';

// ── Breed base colours ───────────────────────────────────────
const BREED_BODY: Record<CatBreed, string> = {
  tabby:   '#cc8844',
  tuxedo:  '#3a3a3a',
  calico:  '#dd9966',
  siamese: '#d4b896',
  void:    '#1a1a2e',
  orange:  '#ff8c00',
};
const BREED_DARK: Record<CatBreed, string> = {
  tabby:   '#a06630',
  tuxedo:  '#222222',
  calico:  '#b87744',
  siamese: '#b89a78',
  void:    '#0e0e1a',
  orange:  '#cc6600',
};
const BREED_LIGHT: Record<CatBreed, string> = {
  tabby:   '#ddaa66',
  tuxedo:  '#cccccc',
  calico:  '#eeccaa',
  siamese: '#e8d8c4',
  void:    '#2a2a40',
  orange:  '#ffaa44',
};

// ── State indicator colours ──────────────────────────────────
const STATE_COLOR: Partial<Record<CatState, string>> = {
  type:    '#00ff88',
  read:    '#00aaff',
  wait:    '#ffcc00',
  sleep:   '#8888ff',
  groom:   '#ff88cc',
  stretch: '#ffaa44',
  walk:    '#ffffff',
  wander:  '#ffffff',
  zoomies: '#ff4444',
};

// ── Pixel art bitmaps (10 wide × 12 tall) ────────────────────
// Legend: 0=transparent, 1=body, 2=dark, 3=light, 4=eye, 5=nose/mouth, 6=inner ear

// Sitting front-facing (idle, type, read, wait)
const SPRITE_FRONT: number[][] = [
  [0,0,2,2,0,0,2,2,0,0], // ears
  [0,2,6,2,1,1,2,6,2,0], // ears + head
  [0,1,1,1,1,1,1,1,1,0], // head
  [0,1,4,1,1,1,4,1,1,0], // eyes
  [0,1,1,1,5,1,1,1,1,0], // nose
  [0,1,1,3,3,3,1,1,1,0], // mouth/chin
  [0,0,1,1,1,1,1,1,0,0], // neck
  [0,1,1,1,1,1,1,1,1,0], // body
  [0,1,1,3,3,3,1,1,1,0], // belly
  [0,1,1,1,1,1,1,1,1,0], // body
  [0,1,1,0,0,0,1,1,0,0], // legs
  [0,3,3,0,0,0,3,3,0,0], // paws
];

// Walking right (walk, wander, zoomies) — frame 0
const SPRITE_WALK_R0: number[][] = [
  [0,0,0,2,2,0,0,0,0,0],
  [0,0,2,6,2,2,0,0,0,0],
  [0,0,1,1,1,1,0,0,0,0],
  [0,0,1,4,1,4,0,0,0,0],
  [0,0,1,1,5,1,0,0,0,0],
  [0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,0,0],
  [2,0,0,1,1,1,1,1,0,0],
  [0,2,0,1,3,3,1,1,0,0],
  [0,0,2,1,1,1,1,1,0,0],
  [0,0,0,1,0,0,0,1,0,0],
  [0,0,0,3,0,0,0,3,0,0],
];

// Walking right — frame 1 (legs swapped)
const SPRITE_WALK_R1: number[][] = [
  [0,0,0,2,2,0,0,0,0,0],
  [0,0,2,6,2,2,0,0,0,0],
  [0,0,1,1,1,1,0,0,0,0],
  [0,0,1,4,1,4,0,0,0,0],
  [0,0,1,1,5,1,0,0,0,0],
  [0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,0,0],
  [0,2,0,1,1,1,1,1,0,0],
  [2,0,0,1,3,3,1,1,0,0],
  [0,0,0,1,1,1,1,1,0,0],
  [0,0,0,0,1,0,1,0,0,0],
  [0,0,0,0,3,0,3,0,0,0],
];

// Sleeping (curled up)
const SPRITE_SLEEP: number[][] = [
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,2,2,0,0,0,0,0,0],
  [0,2,1,1,1,1,1,0,0,0],
  [0,1,1,1,1,1,1,1,0,0],
  [0,1,2,2,1,3,3,1,1,0],
  [0,1,1,1,1,1,1,1,1,2],
  [0,0,1,1,1,1,1,1,2,0],
  [0,0,0,3,3,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
];

// Grooming (licking paw)
const SPRITE_GROOM: number[][] = [
  [0,0,2,2,0,0,2,2,0,0],
  [0,2,6,2,1,1,2,6,2,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,4,1,1,1,4,1,1,0],
  [0,1,1,1,5,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,3,1,0],
  [0,1,1,1,1,1,3,1,1,0],
  [0,1,1,3,3,3,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,1,0,0,0,1,1,0,0],
  [0,3,3,0,0,0,3,3,0,0],
];

// ── Public draw call ─────────────────────────────────────────

export function drawCats(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const sorted = [...cats.values()].sort((a, b) => a.y - b.y);
  for (const cat of sorted) {
    drawCat(ctx, cat, offsetX, offsetY, zoom);
  }
}

// ── Per-cat drawing ──────────────────────────────────────────

function drawCat(
  ctx: CanvasRenderingContext2D,
  cat: Cat,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const w = Math.round(CAT_WIDTH_PX * zoom);
  const h = Math.round(CAT_HEIGHT_PX * zoom);
  const dx = Math.round(offsetX + cat.x * zoom - w / 2);
  const dy = Math.round(offsetY + cat.y * zoom - h / 2);
  const px = zoom; // size of one "pixel" in device pixels

  const bitmap = pickBitmap(cat);
  const flipH = cat.direction === 'left';

  const body = BREED_BODY[cat.breed];
  const dark = BREED_DARK[cat.breed];
  const light = BREED_LIGHT[cat.breed];

  for (let row = 0; row < bitmap.length; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      const val = bitmap[row][col];
      if (val === 0) continue;

      const c = flipH ? (CAT_WIDTH_PX - 1 - col) : col;
      const px0 = Math.round(dx + c * px);
      const py0 = Math.round(dy + row * px);
      const pw = Math.round(dx + (c + 1) * px) - px0;
      const ph = Math.round(dy + (row + 1) * px) - py0;

      switch (val) {
        case 1: ctx.fillStyle = body; break;
        case 2: ctx.fillStyle = dark; break;
        case 3: ctx.fillStyle = light; break;
        case 4: ctx.fillStyle = '#111111'; break;  // eyes
        case 5: ctx.fillStyle = '#ff8899'; break;  // nose
        case 6: ctx.fillStyle = '#ffaaaa'; break;  // inner ear
      }
      ctx.fillRect(px0, py0, pw, ph);
    }
  }

  // Closed eyes for sleep
  if (cat.state === 'sleep') {
    // no eye pixels in the sleep sprite, so nothing extra needed
  }

  // State dot — small indicator above the cat
  const dotSize = Math.max(2, Math.round(2 * zoom));
  const stateCol = STATE_COLOR[cat.state];
  if (stateCol) {
    ctx.fillStyle = stateCol;
    ctx.fillRect(
      Math.round(dx + w / 2 - dotSize / 2),
      dy - dotSize - Math.round(zoom),
      dotSize,
      dotSize,
    );
  }

  // Z bubble for sleeping cats
  if (cat.state === 'sleep') {
    drawZzz(ctx, dx + w, dy, zoom, cat.stateTimer);
  }

  // Permission bubble
  if (cat.bubbleType === 'permission' && (cat.state === 'wait')) {
    drawBubble(ctx, dx + w / 2, dy - Math.round(4 * zoom), zoom, '?');
  }
}

// ── Bitmap selection ─────────────────────────────────────────

function pickBitmap(cat: Cat): number[][] {
  switch (cat.state) {
    case 'sleep':
      return SPRITE_SLEEP;
    case 'groom':
      return cat.frame % 2 === 0 ? SPRITE_GROOM : SPRITE_FRONT;
    case 'walk':
    case 'wander':
    case 'zoomies':
      return cat.frame % 2 === 0 ? SPRITE_WALK_R0 : SPRITE_WALK_R1;
    case 'type':
      // Alternate between front and a slight shift
      return cat.frame % 2 === 0 ? SPRITE_FRONT : SPRITE_GROOM;
    default:
      return SPRITE_FRONT;
  }
}

// ── Z-bubble for sleeping ────────────────────────────────────

function drawZzz(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  zoom: number, timer: number,
): void {
  const phase = (timer * 0.8) % 3;
  ctx.font = `${Math.round(3 * zoom)}px monospace`;
  ctx.fillStyle = 'rgba(136, 136, 255, 0.7)';

  const offsets = [
    { dx: 0, dy: 0, size: 1 },
    { dx: 2, dy: -4, size: 0.8 },
    { dx: 4, dy: -8, size: 0.6 },
  ];

  for (let i = 0; i < 3; i++) {
    const o = offsets[i];
    const bob = Math.sin((phase + i) * 2) * zoom;
    const alpha = Math.max(0, 1 - ((phase + i * 0.5) % 3) / 3);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillText(
      'z',
      x + Math.round(o.dx * zoom),
      y + Math.round(o.dy * zoom) + bob,
    );
  }
  ctx.globalAlpha = 1;
}

// ── Permission bubble ────────────────────────────────────────

function drawBubble(
  ctx: CanvasRenderingContext2D,
  cx: number, y: number,
  zoom: number, text: string,
): void {
  const r = Math.round(3 * zoom);
  const bx = Math.round(cx - r);
  const by = Math.round(y - r * 2);

  // Bubble background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(bx + r, by + r, r, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = '#cc6600';
  ctx.font = `bold ${Math.round(3 * zoom)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + r, by + r);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
