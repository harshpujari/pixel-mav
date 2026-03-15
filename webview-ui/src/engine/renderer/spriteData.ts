import type { CatBreed, CatState, Direction } from '../../types.ts';

// ── Sprite frame dimensions (world pixels) ──────────────────
export const SPRITE_W = 10;
export const SPRITE_H = 12;

// ── Sheet layout ────────────────────────────────────────────
// 8 columns × 4 rows of SPRITE_W × SPRITE_H frames
// Row 0 (down):    idle, walkA, walkB, walkC, sit, typeA, typeB, read
// Row 1 (up):      idle, walkA, walkB, walkC, –, –, –, –
// Row 2 (right):   idle, walkA, walkB, walkC, –, –, –, –
// Row 3 (special): sleepA, sleepB, groomA, groomB, stretchA, stretchB, –, –
export const SHEET_COLS = 8;
export const SHEET_ROWS = 4;

// ── Sitting offset (world pixels) ───────────────────────────
// Cat renders lower when typing/reading at desk
export const SITTING_OFFSET = 3;

// ── Animation definitions ───────────────────────────────────

export interface AnimDef {
  /** Column indices into the sprite sheet per animation frame. */
  frames: number[];
  /** 'dir' = use direction row, or fixed row index. */
  row: 'dir' | number;
}

/**
 * Maps cat states to their animation definition.
 * `cat.frame` (0,1,2,…) indexes into `frames[]` to get the sheet column.
 * States not listed here render as idle (col 0, direction row).
 */
export const ANIM_DEFS: Partial<Record<CatState, AnimDef>> = {
  idle:    { frames: [0], row: 'dir' },
  walk:    { frames: [1, 2, 3, 2], row: 'dir' },
  wander:  { frames: [1, 2, 3, 2], row: 'dir' },
  zoomies: { frames: [1, 2, 3, 2], row: 'dir' },
  type:    { frames: [5, 6], row: 0 },
  read:    { frames: [7, 7], row: 0 },   // blink overlay handled in renderer
  wait:    { frames: [4], row: 0 },
  sleep:   { frames: [0, 1], row: 3 },
  groom:   { frames: [2, 3], row: 3 },
  stretch:  { frames: [4, 5], row: 3 },
  nap_pile: { frames: [0, 1], row: 3 },          // reuses sleep animation
  play:     { frames: [1, 2, 3, 2], row: 'dir' }, // reuses walk animation
  headbonk: { frames: [0], row: 'dir' },          // idle pose at target
};

/** Direction → sheet row. Left uses right row, rendered flipped. */
export const DIR_ROW: Record<Direction, number> = {
  down: 0,
  up: 1,
  right: 2,
  left: 2,
};

// ── Breed colour palettes ───────────────────────────────────

export interface BreedColors {
  body: string;
  dark: string;
  light: string;
  eye: string;
  nose: string;
  earInner: string;
}

export const BREED_PALETTE: Record<CatBreed, BreedColors> = {
  tabby:   { body: '#cc8844', dark: '#a06630', light: '#ddaa66', eye: '#111111', nose: '#ff8899', earInner: '#ffaaaa' },
  tuxedo:  { body: '#3a3a3a', dark: '#222222', light: '#cccccc', eye: '#111111', nose: '#ff8899', earInner: '#ffaaaa' },
  calico:  { body: '#dd9966', dark: '#b87744', light: '#eeccaa', eye: '#111111', nose: '#ff8899', earInner: '#ffaaaa' },
  siamese: { body: '#d4b896', dark: '#b89a78', light: '#e8d8c4', eye: '#4488cc', nose: '#cc8888', earInner: '#e0b8a0' },
  void:    { body: '#1a1a2e', dark: '#0e0e1a', light: '#2a2a40', eye: '#aaffaa', nose: '#444466', earInner: '#333355' },
  orange:  { body: '#ff8c00', dark: '#cc6600', light: '#ffaa44', eye: '#111111', nose: '#ff8899', earInner: '#ffaaaa' },
};

/** Map colour index (1-6) to a colour string from the breed palette. */
export function resolveColor(index: number, colors: BreedColors): string {
  switch (index) {
    case 1: return colors.body;
    case 2: return colors.dark;
    case 3: return colors.light;
    case 4: return colors.eye;
    case 5: return colors.nose;
    case 6: return colors.earInner;
    default: return '#ff00ff'; // debug magenta
  }
}

// ── Bitmap data ─────────────────────────────────────────────
// Colour indices: 0=transparent  1=body  2=dark  3=light  4=eye  5=nose  6=earInner
// Each frame: 10 wide × 12 tall, encoded as strings for readability.

function parse(rows: string[]): number[][] {
  return rows.map(row => [...row].map(c => c === '.' ? 0 : +c));
}

// ── Row 0: Down-facing ──────────────────────────────────────

const DOWN_IDLE = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '..111111..',
  '.11111111.',
  '.11333111.',
  '.11111111.',
  '.11...11..',
  '.33...33..',
]);

const DOWN_WALK_A = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '..111111..',
  '.11111111.',
  '.11333111.',
  '.11111111.',
  '11.....11.',
  '33.....33.',
]);

const DOWN_WALK_B = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '..111111..',
  '.11111111.',
  '.11333111.',
  '.11111111.',
  '..11.11...',
  '..33.33...',
]);

const DOWN_WALK_C = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '..111111..',
  '.11111111.',
  '.11333111.',
  '.11111111.',
  '.11....11.',
  '.33....33.',
]);

const DOWN_SIT = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '.11111111.',
  '.11111111.',
  '.11333111.',
  '.11111111.',
  '..111111..',
  '..333333..',
]);

const DOWN_TYPE_A = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '.11111111.',
  '.11111111.',
  '.11333111.',
  '.11111111.',
  '1.111111..',
  '..333333..',
]);

const DOWN_TYPE_B = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '.11111111.',
  '.11111111.',
  '.11333111.',
  '.11111111.',
  '..111111.1',
  '..333333..',
]);

// DOWN_READ reuses DOWN_SIT — blink overlay differentiates the read state at render time
const DOWN_READ = DOWN_SIT;

// ── Row 1: Up-facing (back view) ────────────────────────────

const UP_IDLE = parse([
  '..22..22..',
  '.22111222.',
  '.11111111.',
  '.11111111.',
  '.11111111.',
  '..111111..',
  '..111111..',
  '.11111111.',
  '.11131131.',
  '.11111111.',
  '.11...111.',
  '.33...33..',
]);

const UP_WALK_A = parse([
  '..22..22..',
  '.22111222.',
  '.11111111.',
  '.11111111.',
  '.11111111.',
  '..111111..',
  '..111111..',
  '.11111111.',
  '.11131131.',
  '.11111111.',
  '11.....11.',
  '33.....33.',
]);

const UP_WALK_B = parse([
  '..22..22..',
  '.22111222.',
  '.11111111.',
  '.11111111.',
  '.11111111.',
  '..111111..',
  '..111111..',
  '.11111111.',
  '.11131131.',
  '.11111111.',
  '..11.11...',
  '..33.33...',
]);

const UP_WALK_C = parse([
  '..22..22..',
  '.22111222.',
  '.11111111.',
  '.11111111.',
  '.11111111.',
  '..111111..',
  '..111111..',
  '.11111111.',
  '.11131131.',
  '.11111111.',
  '.11....11.',
  '.33....33.',
]);

// ── Row 2: Right-facing (left = flip) ───────────────────────

const RIGHT_IDLE = parse([
  '...22.....',
  '..2622....',
  '..1111....',
  '..1414....',
  '..1151....',
  '..11111...',
  '...11111..',
  '...11111..',
  '...13311..',
  '...11111..',
  '...1..1...',
  '.1.3..3...',
]);

const RIGHT_WALK_A = parse([
  '...22.....',
  '..2622....',
  '..1111....',
  '..1414....',
  '..1151....',
  '..11111...',
  '...11111..',
  '2..11111..',
  '.2.13311..',
  '..211111..',
  '...1...1..',
  '...3...3..',
]);

const RIGHT_WALK_B = parse([
  '...22.....',
  '..2622....',
  '..1111....',
  '..1414....',
  '..1151....',
  '..11111...',
  '...11111..',
  '.2.11111..',
  '2..13311..',
  '...11111..',
  '...1.1....',
  '...3.3....',
]);

const RIGHT_WALK_C = parse([
  '...22.....',
  '..2622....',
  '..1111....',
  '..1414....',
  '..1151....',
  '..11111...',
  '...11111..',
  '.2.11111..',
  '2..13311..',
  '...11111..',
  '....1.1...',
  '....3.3...',
]);

// ── Row 3: Special poses ────────────────────────────────────

const SLEEP_A = parse([
  '..........',
  '..........',
  '..........',
  '..........',
  '..22......',
  '.211111...',
  '.1111111..',
  '.12213311.',
  '.111111112',
  '..1111112.',
  '...33.....',
  '..........',
]);

const SLEEP_B = parse([
  '..........',
  '..........',
  '..........',
  '..........',
  '..22......',
  '.211111...',
  '.1111111..',
  '.12213311.',
  '.11111111.',
  '..1111112.',
  '...33...2.',
  '..........',
]);

const GROOM_A = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11111111.',
  '.11111131.',
  '.11111311.',
  '.11333111.',
  '.11111111.',
  '.11...11..',
  '.33...33..',
]);

const GROOM_B = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14111411.',
  '.11151111.',
  '.11333111.',
  '.11111111.',
  '.11113111.',
  '.11333111.',
  '.11111111.',
  '.11...11..',
  '.33...33..',
]);

const STRETCH_A = parse([
  '..........',
  '..........',
  '..22......',
  '.262......',
  '.1111.....',
  '.11511....',
  '.111111...',
  '..1111111.',
  '..1131111.',
  '..1111111.',
  '...11.11..',
  '...33.33..',
]);

const STRETCH_B = parse([
  '..22..22..',
  '.26211262.',
  '.11111111.',
  '.14.1.411.',
  '.11111111.',
  '.11111111.',
  '..111111..',
  '..111111..',
  '.11111111.',
  '.11111111.',
  '.11...11..',
  '.33...33..',
]);

// ── Sheet assembly ──────────────────────────────────────────
// SHEET[row][col] → bitmap | null

const SHEET: (number[][] | null)[][] = [
  // Row 0 — Down
  [DOWN_IDLE, DOWN_WALK_A, DOWN_WALK_B, DOWN_WALK_C, DOWN_SIT, DOWN_TYPE_A, DOWN_TYPE_B, DOWN_READ],
  // Row 1 — Up
  [UP_IDLE, UP_WALK_A, UP_WALK_B, UP_WALK_C, null, null, null, null],
  // Row 2 — Right (left = flip at render time)
  [RIGHT_IDLE, RIGHT_WALK_A, RIGHT_WALK_B, RIGHT_WALK_C, null, null, null, null],
  // Row 3 — Special
  [SLEEP_A, SLEEP_B, GROOM_A, GROOM_B, STRETCH_A, STRETCH_B, null, null],
];

/** Look up a frame bitmap by sheet position. Returns null for empty slots. */
export function getFrameBitmap(row: number, col: number): number[][] | null {
  return SHEET[row]?.[col] ?? null;
}
