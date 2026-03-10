import { MAX_DELTA_SEC } from '../constants.ts';

export interface GameLoopCallbacks {
  update: (dt: number) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
}

/**
 * Start a requestAnimationFrame game loop.
 *
 * - `update(dt)` receives clamped elapsed time in **seconds**.
 * - `render(ctx)` draws after update, with imageSmoothingEnabled = false.
 * - First frame gets dt=0 to avoid any initial jump.
 * - Delta is capped at MAX_DELTA_SEC (100ms) to prevent spiral of death
 *   after tab sleep or debugger pause — no visibilitychange handler needed.
 *
 * Returns a stop function.
 */
export function startGameLoop(
  canvas: HTMLCanvasElement,
  callbacks: GameLoopCallbacks,
): () => void {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  let lastTime = 0;
  let rafId = 0;
  let stopped = false;

  const frame = (time: number) => {
    if (stopped) return;

    // First frame gets dt=0; subsequent frames get clamped delta in seconds
    const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, MAX_DELTA_SEC);
    lastTime = time;

    callbacks.update(dt);

    ctx.imageSmoothingEnabled = false;
    callbacks.render(ctx);

    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}
