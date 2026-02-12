import { TILE_SIZE } from "../config/constants.js";
import type { Camera } from "../rendering/Camera.js";
import { TileId } from "../world/TileRegistry.js";

interface PendingEdit {
  tx: number;
  ty: number;
  tileId: TileId;
}

export class EditorMode {
  selectedTerrain: TileId = TileId.Grass;
  cursorTileX = -Infinity;
  cursorTileY = -Infinity;

  private readonly canvas: HTMLCanvasElement;
  private readonly camera: Camera;
  private pendingEdits: PendingEdit[] = [];
  private isPainting = false;
  private isPanning = false;
  private spaceDown = false;
  private panStart = { sx: 0, sy: 0, camX: 0, camY: 0 };
  private lastPaintedTile = { tx: -Infinity, ty: -Infinity };

  // Touch state
  private activeTouches = new Map<number, { sx: number; sy: number }>();
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private pinchStartMid = { sx: 0, sy: 0 };
  private pinchStartCam = { x: 0, y: 0 };

  // Bound handlers for attach/detach
  private readonly onMouseDown: (e: MouseEvent) => void;
  private readonly onMouseMove: (e: MouseEvent) => void;
  private readonly onMouseUp: (e: MouseEvent) => void;
  private readonly onWheel: (e: WheelEvent) => void;
  private readonly onContextMenu: (e: Event) => void;
  private readonly onTouchStart: (e: TouchEvent) => void;
  private readonly onTouchMove: (e: TouchEvent) => void;
  private readonly onTouchEnd: (e: TouchEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.camera = camera;

    this.onMouseDown = (e) => this.handleMouseDown(e);
    this.onMouseMove = (e) => this.handleMouseMove(e);
    this.onMouseUp = (e) => this.handleMouseUp(e);
    this.onWheel = (e) => this.handleWheel(e);
    this.onContextMenu = (e) => e.preventDefault();
    this.onTouchStart = (e) => this.handleTouchStart(e);
    this.onTouchMove = (e) => this.handleTouchMove(e);
    this.onTouchEnd = (e) => this.handleTouchEnd(e);
    this.onKeyDown = (e) => {
      if (e.key === " ") this.spaceDown = true;
    };
    this.onKeyUp = (e) => {
      if (e.key === " ") this.spaceDown = false;
    };
  }

  attach(): void {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.onTouchEnd);
    this.canvas.addEventListener("touchcancel", this.onTouchEnd);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  detach(): void {
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.isPainting = false;
    this.isPanning = false;
    this.spaceDown = false;
    this.activeTouches.clear();
  }

  consumePendingEdits(): PendingEdit[] {
    if (this.pendingEdits.length === 0) return this.pendingEdits;
    const edits = this.pendingEdits;
    this.pendingEdits = [];
    return edits;
  }

  private canvasCoords(e: MouseEvent): { sx: number; sy: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      sx: ((e.clientX - rect.left) / rect.width) * this.canvas.width,
      sy: ((e.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  private screenToTile(sx: number, sy: number): { tx: number; ty: number } {
    const { wx, wy } = this.camera.screenToWorld(sx, sy);
    return {
      tx: Math.floor(wx / TILE_SIZE),
      ty: Math.floor(wy / TILE_SIZE),
    };
  }

  private paintAt(sx: number, sy: number): void {
    const { tx, ty } = this.screenToTile(sx, sy);
    // Avoid duplicate edits on same tile during drag
    if (tx === this.lastPaintedTile.tx && ty === this.lastPaintedTile.ty) return;
    this.lastPaintedTile.tx = tx;
    this.lastPaintedTile.ty = ty;
    this.pendingEdits.push({ tx, ty, tileId: this.selectedTerrain });
  }

  // --- Mouse handlers ---

  private handleMouseDown(e: MouseEvent): void {
    const { sx, sy } = this.canvasCoords(e);

    // Middle button or space+left = pan
    if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
      this.isPanning = true;
      this.panStart = {
        sx: e.clientX,
        sy: e.clientY,
        camX: this.camera.x,
        camY: this.camera.y,
      };
      e.preventDefault();
      return;
    }

    // Left button = paint
    if (e.button === 0) {
      this.isPainting = true;
      this.lastPaintedTile.tx = -Infinity;
      this.lastPaintedTile.ty = -Infinity;
      this.paintAt(sx, sy);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const { sx, sy } = this.canvasCoords(e);

    // Update cursor highlight
    const { tx, ty } = this.screenToTile(sx, sy);
    this.cursorTileX = tx;
    this.cursorTileY = ty;

    if (this.isPanning) {
      const dx = (e.clientX - this.panStart.sx) / this.camera.scale;
      const dy = (e.clientY - this.panStart.sy) / this.camera.scale;
      this.camera.x = this.panStart.camX - dx;
      this.camera.y = this.panStart.camY - dy;
      return;
    }

    if (this.isPainting) {
      this.paintAt(sx, sy);
    }
  }

  private handleMouseUp(_e: MouseEvent): void {
    this.isPainting = false;
    this.isPanning = false;
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const { sx, sy } = this.canvasCoords(e);

    // Zoom toward cursor
    const worldBefore = this.camera.screenToWorld(sx, sy);
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = Math.max(0.05, Math.min(3, this.camera.zoom * zoomFactor));
    const worldAfter = this.camera.screenToWorld(sx, sy);

    // Adjust camera so the world point under cursor stays fixed
    this.camera.x += worldBefore.wx - worldAfter.wx;
    this.camera.y += worldBefore.wy - worldAfter.wy;
  }

  // --- Touch handlers ---

  private touchCoords(touch: Touch): { sx: number; sy: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      sx: ((touch.clientX - rect.left) / rect.width) * this.canvas.width,
      sy: ((touch.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t) {
        this.activeTouches.set(t.identifier, this.touchCoords(t));
      }
    }

    if (this.activeTouches.size === 1) {
      // Single touch = paint
      const [first] = this.activeTouches.values();
      if (first) {
        this.lastPaintedTile.tx = -Infinity;
        this.lastPaintedTile.ty = -Infinity;
        this.paintAt(first.sx, first.sy);
      }
    } else if (this.activeTouches.size >= 2) {
      // Two fingers = start pinch/pan
      this.startPinch();
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t) {
        this.activeTouches.set(t.identifier, this.touchCoords(t));
      }
    }

    if (this.activeTouches.size >= 2) {
      this.updatePinch();
    } else if (this.activeTouches.size === 1) {
      // Single drag = continuous paint
      const [first] = this.activeTouches.values();
      if (first) {
        this.paintAt(first.sx, first.sy);
        const { tx, ty } = this.screenToTile(first.sx, first.sy);
        this.cursorTileX = tx;
        this.cursorTileY = ty;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t) {
        this.activeTouches.delete(t.identifier);
      }
    }
    // If going from 2→1 fingers, restart as potential paint
    if (this.activeTouches.size === 1) {
      this.lastPaintedTile.tx = -Infinity;
      this.lastPaintedTile.ty = -Infinity;
    }
  }

  private startPinch(): void {
    const pts = [...this.activeTouches.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return;
    this.pinchStartDist = Math.hypot(a.sx - b.sx, a.sy - b.sy);
    this.pinchStartZoom = this.camera.zoom;
    this.pinchStartMid = {
      sx: (a.sx + b.sx) / 2,
      sy: (a.sy + b.sy) / 2,
    };
    this.pinchStartCam = { x: this.camera.x, y: this.camera.y };
  }

  private updatePinch(): void {
    const pts = [...this.activeTouches.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return;

    const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy);
    const mid = { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };

    // Zoom
    if (this.pinchStartDist > 0) {
      const ratio = dist / this.pinchStartDist;
      this.camera.zoom = Math.max(0.05, Math.min(3, this.pinchStartZoom * ratio));
    }

    // Pan: how much the midpoint moved in world space
    const midDx = (mid.sx - this.pinchStartMid.sx) / this.camera.scale;
    const midDy = (mid.sy - this.pinchStartMid.sy) / this.camera.scale;
    this.camera.x = this.pinchStartCam.x - midDx;
    this.camera.y = this.pinchStartCam.y - midDy;
  }
}
