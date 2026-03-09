import { useEffect, useRef } from 'react';

import { postMessage } from './vscodeApi.ts';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tell the extension we're ready
  useEffect(() => {
    postMessage({ type: 'webviewReady' });
  }, []);

  // Listen for messages from the extension
  useEffect(() => {
    function onMessage(event: MessageEvent<{ type: string } & Record<string, unknown>>) {
      const { type, ...payload } = event.data;
      console.log('[Pixel Mav] received:', type, payload);
      // Phase 2+: dispatch into game engine
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Resize canvas to match container and redraw placeholder
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      if (!canvas) return;
      const { offsetWidth: w, offsetHeight: h } = canvas.parentElement ?? canvas;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#2c2c2c';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3a3a3a';
      for (let x = 0; x < w; x += 16) {
        for (let y = 0; y < h; y += 16) {
          if (((x + y) / 16) % 2 === 0) ctx.fillRect(x, y, 16, 16);
        }
      }
      ctx.fillStyle = '#888';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Pixel Mav — Phase 1', w / 2, h / 2);
    }

    const observer = new ResizeObserver(draw);
    observer.observe(canvas.parentElement ?? canvas);
    draw();
    return () => observer.disconnect();
  }, []);

  // Phase 2: game loop replaces the placeholder draw above
  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
    />
  );
}
