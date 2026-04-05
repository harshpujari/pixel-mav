import { DESPAWN_DURATION, SPAWN_DURATION } from '../../constants.ts';
import type { Cat, CatState } from '../../types.ts';
import { cats } from '../catStore.ts';
import { getEffectiveState } from '../stateMachine.ts';
import { getFrame } from './spriteCache.ts';
import {
  SPRITE_W,
  SPRITE_H,
  SITTING_OFFSET,
  ANIM_DEFS,
  DIR_ROW,
  getBreedColors,
} from './spriteData.ts';

// ── State indicator colours ──────────────────────────────────
const STATE_COLOR: Partial<Record<CatState, string>> = {
  type:     '#00ff88',
  read:     '#00aaff',
  wait:     '#ffcc00',
  sleep:    '#8888ff',
  groom:    '#ff88cc',
  stretch:  '#ffaa44',
  walk:     '#ffffff',
  wander:   '#ffffff',
  zoomies:  '#ff4444',
  nap_pile: '#8888ff',
  play:     '#44ff44',
  headbonk: '#ff88ff',
};

// States where the cat is sitting at a desk
const SITTING_STATES = new Set<CatState>(['type', 'read', 'wait']);

// ── Public draw call ─────────────────────────────────────────

export function drawCats(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  // Z-sort by Y (bottom-edge; constant SPRITE_H means y-sort is equivalent)
  const sorted = [...cats.values()].sort((a, b) => a.y - b.y);
  for (const cat of sorted) {
    drawSingleCat(ctx, cat, offsetX, offsetY, zoom);
  }
}

// ── Per-cat drawing ──────────────────────────────────────────

export function drawSingleCat(
  ctx: CanvasRenderingContext2D,
  cat: Cat,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  // Resolve sheet position from animation state (social states use effective state)
  const effectiveState = getEffectiveState(cat);
  const anim = ANIM_DEFS[effectiveState];
  const col = anim ? anim.frames[cat.frame % anim.frames.length] : 0;
  const row = anim
    ? (anim.row === 'dir' ? DIR_ROW[cat.direction] : anim.row)
    : DIR_ROW[cat.direction];
  const flipH = cat.direction === 'left';

  const frame = getFrame(cat.breed, row, col, flipH, zoom, cat.hueShift);
  if (!frame) return;

  // Position: sprite centered on cat world position
  const w = Math.round(SPRITE_W * zoom);
  const h = Math.round(SPRITE_H * zoom);
  const sittingOff = SITTING_STATES.has(cat.state)
    ? Math.round(SITTING_OFFSET * zoom)
    : 0;
  const dx = Math.round(offsetX + cat.x * zoom - w / 2);
  const dy = Math.round(offsetY + cat.y * zoom - h / 2) + sittingOff;

  // Spawn/despawn fade
  const fadeAlpha = cat.spawnEffect
    ? Math.min(1, cat.effectTimer / SPAWN_DURATION)
    : cat.despawnEffect
    ? Math.max(0, 1 - cat.effectTimer / DESPAWN_DURATION)
    : 1;

  ctx.globalAlpha = fadeAlpha;
  ctx.drawImage(frame, dx, dy);

  // Blink overlay: read state (frame 1) or idle blink timer
  const shouldBlink =
    (cat.state === 'read' && cat.frame === 1) ||
    (cat.state === 'idle' && cat.direction === 'down' && cat.blinkTimer <= 0);
  if (shouldBlink) {
    drawBlinkOverlay(ctx, dx, dy, zoom, cat.breed, cat.hueShift, flipH);
  }

  // Activity badge (tool name) or state dot
  if (cat.activeTool && SITTING_STATES.has(cat.state)) {
    drawCatBadge(ctx, dx + w / 2, dy - Math.round(zoom), zoom, cat.activeTool, cat.state);
  } else {
    const stateCol = STATE_COLOR[cat.state];
    if (stateCol) {
      const dotSize = Math.max(2, Math.round(2 * zoom));
      ctx.fillStyle = stateCol;
      ctx.fillRect(
        Math.round(dx + w / 2 - dotSize / 2),
        dy - dotSize - Math.round(zoom),
        dotSize,
        dotSize,
      );
    }
  }

  // Z-bubble for sleeping (includes nap_pile when not walking)
  if (cat.state === 'sleep' || (cat.state === 'nap_pile' && cat.path.length === 0)) {
    drawZzz(ctx, dx + w, dy, zoom, cat.stateTimer, fadeAlpha);
  }

  // Permission bubble
  if (cat.bubbleType === 'permission' && cat.state === 'wait') {
    drawBubble(ctx, dx + w / 2, dy - Math.round(4 * zoom), zoom, '?');
  }

  ctx.globalAlpha = 1;
}

// ── Activity badge (tool name above cat) ────────────────────

const MAX_BADGE_CHARS = 8;

const BADGE_BG: Partial<Record<CatState, string>> = {
  type: 'rgba(0, 255, 136, 0.18)',
  read: 'rgba(0, 170, 255, 0.18)',
  wait: 'rgba(255, 204, 0, 0.18)',
};

const BADGE_TEXT: Partial<Record<CatState, string>> = {
  type: '#00ff88',
  read: '#00aaff',
  wait: '#ffcc00',
};

function drawCatBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  zoom: number,
  toolName: string,
  state: CatState,
): void {
  const label = toolName.length > MAX_BADGE_CHARS
    ? toolName.slice(0, MAX_BADGE_CHARS - 1) + '\u2026'
    : toolName;

  const fontSize = Math.max(4, Math.round(3.5 * zoom));
  ctx.font = `${fontSize}px monospace`;
  const metrics = ctx.measureText(label);
  const textW = metrics.width;

  const padX = Math.round(1.5 * zoom);
  const padY = Math.round(0.8 * zoom);
  const boxW = textW + padX * 2;
  const boxH = fontSize + padY * 2;
  const boxX = Math.round(cx - boxW / 2);
  const boxY = Math.round(y - boxH - zoom);

  // Background pill
  const radius = Math.round(1.5 * zoom);
  ctx.fillStyle = BADGE_BG[state] ?? 'rgba(60, 60, 60, 0.8)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, radius);
  ctx.fill();

  // Border
  ctx.strokeStyle = BADGE_TEXT[state] ?? '#888';
  ctx.lineWidth = Math.max(0.5, 0.5 * zoom);
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, radius);
  ctx.stroke();

  // Text
  ctx.fillStyle = BADGE_TEXT[state] ?? '#ccc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, boxY + boxH / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ── Blink overlay (2px over eye positions) ──────────────────

function drawBlinkOverlay(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  zoom: number,
  breed: Cat['breed'],
  hueShift: number,
  flipH: boolean,
): void {
  // Eyes are at row 3, cols 2 and 6 in the down-facing read bitmap
  const eyeRow = 3;
  const eyeCols = [2, 6];
  ctx.fillStyle = getBreedColors(breed, hueShift).body;
  for (const ec of eyeCols) {
    const c = flipH ? (SPRITE_W - 1 - ec) : ec;
    const px = Math.round(c * zoom);
    const py = Math.round(eyeRow * zoom);
    const pw = Math.round((c + 1) * zoom) - px;
    const ph = Math.round((eyeRow + 1) * zoom) - py;
    ctx.fillRect(dx + px, dy + py, pw, ph);
  }
}

// ── Z-bubble for sleeping ────────────────────────────────────

function drawZzz(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  timer: number,
  baseAlpha: number = 1,
): void {
  const phase = (timer * 0.8) % 3;
  ctx.font = `${Math.round(3 * zoom)}px monospace`;
  ctx.fillStyle = 'rgba(136, 136, 255, 0.7)';

  const offsets = [
    { dx: 0, dy: 0 },
    { dx: 2, dy: -4 },
    { dx: 4, dy: -8 },
  ];

  for (let i = 0; i < 3; i++) {
    const o = offsets[i];
    const bob = Math.sin((phase + i) * 2) * zoom;
    const alpha = Math.max(0, 1 - ((phase + i * 0.5) % 3) / 3);
    ctx.globalAlpha = alpha * 0.7 * baseAlpha;
    ctx.fillText(
      'z',
      x + Math.round(o.dx * zoom),
      y + Math.round(o.dy * zoom) + bob,
    );
  }
}

// ── Permission bubble ────────────────────────────────────────

function drawBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  zoom: number,
  text: string,
): void {
  const r = Math.round(3 * zoom);
  const bx = Math.round(cx - r);
  const by = Math.round(y - r * 2);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(bx + r, by + r, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#cc6600';
  ctx.font = `bold ${Math.round(3 * zoom)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + r, by + r);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
