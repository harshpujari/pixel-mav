import { useCallback, useEffect, useRef } from 'react';

import { startGameLoop } from '../engine/gameLoop.ts';
import { addCat, makeCat, removeCat, updateAllCats } from '../engine/catStore.ts';
import { Camera } from '../engine/renderer/camera.ts';
import { Renderer } from '../engine/renderer/renderer.ts';

/**
 * The main game canvas. Owns the Camera, Renderer, and GameLoop.
 *
 * - Container div for reliable resize detection
 * - Canvas backing store at device pixels (no ctx.scale)
 * - Native wheel listener with { passive: false }
 * - All pan/zoom state in camera ref (no React re-renders)
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(new Camera());

  // ── Resize: canvas backing store → device pixels ────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    // No ctx.scale(dpr) — we render directly in device pixels

    cameraRef.current.canvasWidth = canvas.width;
    cameraRef.current.canvasHeight = canvas.height;
  }, []);

  // ── Setup: game loop, resize observer, wheel listener ───
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const camera = cameraRef.current;
    const renderer = new Renderer(camera);

    resizeCanvas();

    // ── Phase 3: spawn test cats to verify entity loop ───
    const TEST_CATS = [
      makeCat('test-tabby',   5,  3, 'tabby'),
      makeCat('test-tuxedo', 10,  5, 'tuxedo'),
      makeCat('test-orange', 15,  8, 'orange'),
    ];
    for (const cat of TEST_CATS) addCat(cat);

    // Observe container for resize
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    // Wheel listener — must be native with { passive: false }
    // for reliable preventDefault() in VS Code webview
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.handleWheel(e);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Game loop
    const stop = startGameLoop(canvas, {
      update: (dt) => {
        updateAllCats(dt);
        camera.update();
        camera.computeOffset();
      },
      render: (ctx) => {
        renderer.render(ctx);
      },
    });

    return () => {
      stop();
      observer.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      for (const cat of TEST_CATS) removeCat(cat.id);
    };
  }, [resizeCanvas]);

  // ── Mouse: down/move/up → pan ─────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    cameraRef.current.handleMouseDown(e.nativeEvent);
    if (cameraRef.current.isPanning) {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'grabbing';
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    cameraRef.current.handleMouseMove(e.nativeEvent);
  }, []);

  const onMouseUp = useCallback(() => {
    cameraRef.current.handleMouseUp();
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'default';
  }, []);

  const onMouseLeave = useCallback(() => {
    cameraRef.current.handleMouseUp();
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'default';
  }, []);

  // Prevent context menu
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Prevent default middle-click browser behavior (auto-scroll)
  const onAuxClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1e1e1e',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
        onAuxClick={onAuxClick}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          cursor: 'default',
        }}
      />
    </div>
  );
}
