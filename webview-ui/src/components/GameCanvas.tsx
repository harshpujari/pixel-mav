import { useCallback, useEffect, useRef } from 'react';

import { startGameLoop } from '../engine/gameLoop.ts';
import { warmUpAudio } from '../engine/audio/audioEngine.ts';
import { cats, updateAllCats } from '../engine/catStore.ts';
import { Camera } from '../engine/renderer/camera.ts';
import { updateDebugFps, toggleDebug } from '../engine/renderer/debugOverlay.ts';
import { Renderer } from '../engine/renderer/renderer.ts';
import { postMessage } from '../vscodeApi.ts';
import { SPRITE_W, SPRITE_H } from '../engine/renderer/spriteData.ts';
import { tileMap } from '../environment/tileMap.ts';

import { editor, notify } from '../editor/editorState.ts';
import {
  toggleEditor,
  startDrag,
  continueDrag,
  endDrag,
  eraseAt,
  undo,
  redo,
  rotateGhost,
  rotateSelected,
  deleteSelected,
  toggleSelectedActive,
} from '../editor/editorActions.ts';

/**
 * The main game canvas. Owns the Camera, Renderer, and GameLoop.
 *
 * - Container div for reliable resize detection
 * - Canvas backing store at device pixels (no ctx.scale)
 * - Native wheel listener with { passive: false }
 * - All pan/zoom state in camera ref (no React re-renders)
 * - Editor input handling when editor mode is active
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(new Camera());

  // Track last tile during drag to avoid redundant applies
  const lastDragTile = useRef({ col: -1, row: -1 });

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

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.handleWheel(e);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Game loop
    const stop = startGameLoop(canvas, {
      update: (dt) => {
        updateAllCats(dt);
        updateDebugFps(dt);
        // Sync camera grid dimensions (may change from editor)
        camera.gridCols = tileMap.cols;
        camera.gridRows = tileMap.rows;
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
    };
  }, [resizeCanvas]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // F3: toggle debug overlay (always)
      if (e.key === 'F3') {
        toggleDebug();
        e.preventDefault();
        return;
      }

      // E: toggle editor (always)
      if (e.key === 'e' || e.key === 'E') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          toggleEditor();
          e.preventDefault();
          return;
        }
      }

      if (!editor.active) return;

      // Ctrl/Cmd+Z: undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        undo();
        e.preventDefault();
      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: redo
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        redo();
        e.preventDefault();
      // R: rotate
      } else if (e.key === 'r' || e.key === 'R') {
        if (editor.selectedFurnitureId) rotateSelected();
        else rotateGhost();
        e.preventDefault();
      // T: toggle active state
      } else if (e.key === 't' || e.key === 'T') {
        toggleSelectedActive();
        e.preventDefault();
      // Escape: deselect or exit editor
      } else if (e.key === 'Escape') {
        if (editor.selectedFurnitureId) {
          editor.selectedFurnitureId = null;
          notify();
        } else {
          toggleEditor();
        }
        e.preventDefault();
      // Delete/Backspace: delete selected furniture
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Helper: get tile coord from mouse event ────────────────
  const getTileFromEvent = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const camera = cameraRef.current;
    const world = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    return camera.worldToTile(world.x, world.y);
  }, []);

  // ── Click: editor tool or focus agent terminal ─────────────
  const onClick = useCallback((e: React.MouseEvent) => {
    warmUpAudio(); // satisfy browser autoplay policy on first interaction
    if (editor.active) return; // handled by mousedown/up

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const camera = cameraRef.current;
    const worldPos = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    // Hit test cats
    const halfW = SPRITE_W / 2;
    const halfH = SPRITE_H / 2;
    for (const cat of cats.values()) {
      if (
        cat.agentId &&
        worldPos.x >= cat.x - halfW && worldPos.x <= cat.x + halfW &&
        worldPos.y >= cat.y - halfH && worldPos.y <= cat.y + halfH
      ) {
        postMessage({ type: 'focusCat', agentId: cat.agentId });
        break;
      }
    }
  }, []);

  // ── Mouse: down/move/up → pan or editor tool ──────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Pan: middle button or alt+left (always works)
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      cameraRef.current.handleMouseDown(e.nativeEvent);
      if (cameraRef.current.isPanning) {
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = 'grabbing';
      }
      return;
    }

    // Editor: left click applies tool
    if (editor.active && e.button === 0) {
      const tile = getTileFromEvent(e);
      if (tile) {
        lastDragTile.current = { col: tile.col, row: tile.row };
        startDrag(tile.col, tile.row);
      }
      return;
    }
  }, [getTileFromEvent]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    // Camera pan
    if (cameraRef.current.isPanning) {
      cameraRef.current.handleMouseMove(e.nativeEvent);
      return;
    }

    if (!editor.active) return;

    // Update cursor position for ghost preview
    const tile = getTileFromEvent(e);
    if (tile) {
      editor.cursorCol = tile.col;
      editor.cursorRow = tile.row;

      // Continue drag painting
      if (editor.isDragging) {
        if (tile.col !== lastDragTile.current.col || tile.row !== lastDragTile.current.row) {
          lastDragTile.current = { col: tile.col, row: tile.row };
          continueDrag(tile.col, tile.row);
        }
      }
    }
  }, [getTileFromEvent]);

  const onMouseUp = useCallback(() => {
    cameraRef.current.handleMouseUp();
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = editor.active ? 'crosshair' : 'default';

    if (editor.isDragging) {
      endDrag();
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    cameraRef.current.handleMouseUp();
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = editor.active ? 'crosshair' : 'default';

    if (editor.isDragging) {
      endDrag();
    }

    if (editor.active) {
      editor.cursorCol = -1;
      editor.cursorRow = -1;
    }
  }, []);

  // Right-click: prevent context menu + erase in editor
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (editor.active) {
      const tile = getTileFromEvent(e);
      if (tile) {
        eraseAt(tile.col, tile.row);
      }
    }
  }, [getTileFromEvent]);

  // Prevent default middle-click browser behavior
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
        onClick={onClick}
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
