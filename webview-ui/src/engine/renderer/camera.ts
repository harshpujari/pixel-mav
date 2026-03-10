import {
  CAMERA_FOLLOW_LERP,
  CAMERA_FOLLOW_SNAP_THRESHOLD,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  PAN_MARGIN_FRACTION,
  TILE_SIZE,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_SCROLL_THRESHOLD,
} from '../../constants.ts';

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Camera for a pixel-art tile-based game.
 *
 * Coordinate system (matching pixel-agents):
 * - All internal state (pan, offset, canvas size) is in **device pixels**.
 * - Zoom is an integer multiplier: world pixels × zoom = device pixels.
 * - No ctx transforms — the renderer receives offsetX, offsetY, zoom
 *   and manually positions every draw call for crisp integer alignment.
 */
export class Camera {
  /** Pan offset in device pixels */
  panX = 0;
  panY = 0;
  zoom = ZOOM_DEFAULT;

  /** Canvas dimensions in device pixels — set by resize handler */
  canvasWidth = 0;
  canvasHeight = 0;

  /** Grid dimensions — updated when layout changes */
  gridCols = DEFAULT_GRID_COLS;
  gridRows = DEFAULT_GRID_ROWS;

  /**
   * Cached rendering offset (device pixels).
   * This is the top-left position of tile (0,0) on the canvas.
   * Updated each frame by computeOffset().
   */
  offsetX = 0;
  offsetY = 0;

  /** If set, the camera will smoothly follow this world position */
  followTarget: Vec2 | null = null;

  // ── Pan state (middle-drag / alt+left-drag) ──────────────
  private _isPanning = false;
  private panStart = { mouseX: 0, mouseY: 0, panX: 0, panY: 0 };

  // ── Zoom accumulator for trackpad pinch ──────────────────
  private zoomAccumulator = 0;

  /**
   * Compute the rendering offset and cache it.
   * Call once per frame before rendering (after update).
   */
  computeOffset(): void {
    const mapW = this.gridCols * TILE_SIZE * this.zoom;
    const mapH = this.gridRows * TILE_SIZE * this.zoom;
    this.offsetX = Math.floor((this.canvasWidth - mapW) / 2) + Math.round(this.panX);
    this.offsetY = Math.floor((this.canvasHeight - mapH) / 2) + Math.round(this.panY);
  }

  /**
   * Smoothly follow the target. Call each frame before computeOffset.
   * Uses a fixed per-frame lerp (frame-rate dependent, same as pixel-agents).
   */
  update(): void {
    if (!this.followTarget) return;

    const mapW = this.gridCols * TILE_SIZE * this.zoom;
    const mapH = this.gridRows * TILE_SIZE * this.zoom;
    // Target pan that would center the follow target on screen
    const targetPanX = mapW / 2 - this.followTarget.x * this.zoom;
    const targetPanY = mapH / 2 - this.followTarget.y * this.zoom;

    const dx = targetPanX - this.panX;
    const dy = targetPanY - this.panY;

    // Snap when close enough to avoid eternal sub-pixel oscillation
    if (
      Math.abs(dx) < CAMERA_FOLLOW_SNAP_THRESHOLD &&
      Math.abs(dy) < CAMERA_FOLLOW_SNAP_THRESHOLD
    ) {
      this.panX = targetPanX;
      this.panY = targetPanY;
    } else {
      this.panX += dx * CAMERA_FOLLOW_LERP;
      this.panY += dy * CAMERA_FOLLOW_LERP;
    }
  }

  /** Clamp pan so the map can't scroll entirely out of view */
  clampPan(): void {
    const mapW = this.gridCols * TILE_SIZE * this.zoom;
    const mapH = this.gridRows * TILE_SIZE * this.zoom;
    const marginX = this.canvasWidth * PAN_MARGIN_FRACTION;
    const marginY = this.canvasHeight * PAN_MARGIN_FRACTION;
    const maxPanX = mapW / 2 + this.canvasWidth / 2 - marginX;
    const maxPanY = mapH / 2 + this.canvasHeight / 2 - marginY;
    this.panX = clamp(this.panX, -maxPanX, maxPanX);
    this.panY = clamp(this.panY, -maxPanY, maxPanY);
  }

  /**
   * Convert CSS coords (relative to canvas element) to world coords.
   * Uses the cached offset — call computeOffset() first.
   */
  screenToWorld(cssX: number, cssY: number): Vec2 {
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (cssX * dpr - this.offsetX) / this.zoom,
      y: (cssY * dpr - this.offsetY) / this.zoom,
    };
  }

  /** Convert world position to tile coordinate */
  worldToTile(wx: number, wy: number): { col: number; row: number } {
    return {
      col: Math.floor(wx / TILE_SIZE),
      row: Math.floor(wy / TILE_SIZE),
    };
  }

  /** Whether the camera is currently being panned */
  get isPanning(): boolean {
    return this._isPanning;
  }

  // ── Input handlers ───────────────────────────────────────

  /**
   * Handle wheel event.
   * - Ctrl/Cmd + wheel → zoom toward cursor (with trackpad accumulator)
   * - Plain wheel → pan (trackpad two-finger scroll / mouse wheel)
   */
  handleWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      // ── Zoom ──────────────────────────────────────────────
      // Accumulate delta for smooth trackpad pinch
      this.zoomAccumulator += e.deltaY;
      if (Math.abs(this.zoomAccumulator) < ZOOM_SCROLL_THRESHOLD) return;

      const direction = this.zoomAccumulator < 0 ? 1 : -1;
      this.zoomAccumulator = 0;
      const newZoom = clamp(this.zoom + direction, ZOOM_MIN, ZOOM_MAX);
      if (newZoom === this.zoom) return;

      // Zoom toward cursor: keep the world point under the mouse fixed
      const dpr = window.devicePixelRatio || 1;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const deviceX = (e.clientX - rect.left) * dpr;
      const deviceY = (e.clientY - rect.top) * dpr;

      // World point under cursor (current offset)
      const worldX = (deviceX - this.offsetX) / this.zoom;
      const worldY = (deviceY - this.offsetY) / this.zoom;

      this.zoom = newZoom;

      // Solve for panX/Y so the same world point stays at the same device pixel:
      // deviceX = worldX * newZoom + floor((canvasW - mapW_new) / 2) + round(panX_new)
      const newMapW = this.gridCols * TILE_SIZE * newZoom;
      const newMapH = this.gridRows * TILE_SIZE * newZoom;
      this.panX = deviceX - worldX * newZoom - (this.canvasWidth - newMapW) / 2;
      this.panY = deviceY - worldY * newZoom - (this.canvasHeight - newMapH) / 2;

      this.clampPan();
      this.computeOffset();
    } else {
      // ── Pan ───────────────────────────────────────────────
      const dpr = window.devicePixelRatio || 1;
      this.followTarget = null; // break follow on manual pan
      this.panX -= e.deltaX * dpr;
      this.panY -= e.deltaY * dpr;
      this.clampPan();
    }
  }

  /** Start panning (middle mouse button or alt+left) */
  handleMouseDown(e: MouseEvent): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this._isPanning = true;
      this.followTarget = null; // break follow on manual pan
      this.panStart = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: this.panX,
        panY: this.panY,
      };
    }
  }

  /** Continue panning */
  handleMouseMove(e: MouseEvent): void {
    if (!this._isPanning) return;
    const dpr = window.devicePixelRatio || 1;
    const dx = (e.clientX - this.panStart.mouseX) * dpr;
    const dy = (e.clientY - this.panStart.mouseY) * dpr;
    this.panX = this.panStart.panX + dx;
    this.panY = this.panStart.panY + dy;
    this.clampPan();
  }

  /** End panning */
  handleMouseUp(): void {
    this._isPanning = false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
