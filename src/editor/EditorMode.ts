import { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Camera } from "../rendering/Camera.js";
import type { EditorTab } from "./EditorPanel.js";

export type BrushMode = "tile" | "subgrid" | "corner" | "cross" | "x";
export type PaintMode = "positive" | "unpaint";
export type SubgridShape = 1 | 2 | 3 | "cross" | "x";

interface PendingTileEdit {
  tx: number;
  ty: number;
  terrainId: number | null;
}

export interface PendingSubgridEdit {
  gsx: number;
  gsy: number;
  terrainId: number | null;
}

export interface PendingRoadEdit {
  tx: number;
  ty: number;
  roadType: number;
}

export interface PendingElevationEdit {
  tx: number;
  ty: number;
  height: number;
  gridSize: number;
}

export interface PendingEntitySpawn {
  wx: number;
  wy: number;
  entityType: string;
}

export class EditorMode {
  selectedTerrain: number | null = TerrainId.Grass;
  selectedRoadType = 0;
  selectedEntityType = "chicken";
  selectedPropType = "prop-flower-red";
  /** When true, left-click/tap deletes instead of placing. */
  deleteMode = false;
  selectedElevation = 1;
  elevationGridSize = 1;
  editorTab: EditorTab = "natural";
  brushMode: BrushMode = "tile";
  paintMode: PaintMode = "positive";

  /** Reference to live entities for right-click deletion lookup. */
  entities: readonly Entity[] = [];
  /** Reference to live props for right-click deletion lookup. */
  props: readonly Prop[] = [];

  // Tile-mode cursor (whole tile)
  cursorTileX = -Infinity;
  cursorTileY = -Infinity;

  // Subgrid-mode cursor (half-tile position)
  cursorSubgridX = -Infinity;
  cursorSubgridY = -Infinity;

  // Corner-mode cursor (tile corner = even subgrid position)
  cursorCornerX = -Infinity;
  cursorCornerY = -Infinity;

  private readonly canvas: HTMLCanvasElement;
  private readonly camera: Camera;
  private pendingTileEdits: PendingTileEdit[] = [];
  private pendingSubgridEdits: PendingSubgridEdit[] = [];
  private pendingCornerEdits: PendingSubgridEdit[] = [];
  private pendingRoadEdits: PendingRoadEdit[] = [];
  private pendingElevationEdits: PendingElevationEdit[] = [];
  private pendingEntitySpawns: PendingEntitySpawn[] = [];
  private pendingEntityDeletions: number[] = [];
  private pendingPropDeletions: number[] = [];
  private isPainting = false;
  private isPanning = false;
  /** True while right-click is held for temporary unpaint. */
  rightClickUnpaint = false;
  private spaceDown = false;
  private keysDown = new Set<string>();
  private panStart = { sx: 0, sy: 0, camX: 0, camY: 0 };
  private lastPaintedTile = { tx: -Infinity, ty: -Infinity };
  private lastPaintedSubgrid = { gsx: -Infinity, gsy: -Infinity };
  private lastPaintedCorner = { gsx: -Infinity, gsy: -Infinity };

  // Touch state
  private activeTouches = new Map<number, { sx: number; sy: number }>();
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private pinchStartMid = { sx: 0, sy: 0 };
  private pinchStartCam = { x: 0, y: 0 };
  /** Deferred first-touch paint — cancelled if a second finger arrives (pinch). */
  private touchPaintTimer: ReturnType<typeof setTimeout> | null = null;
  private touchPaintStart: { sx: number; sy: number } | null = null;
  /** True while a pinch gesture is active — suppresses paint on 2→1 finger transition. */
  private wasPinching = false;

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
      this.keysDown.add(e.key);
    };
    this.onKeyUp = (e) => {
      if (e.key === " ") this.spaceDown = false;
      this.keysDown.delete(e.key);
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
    this.keysDown.clear();
    this.activeTouches.clear();
  }

  /** Call from game loop to apply continuous key-based panning. */
  update(dt: number): void {
    const PAN_SPEED = CHUNK_SIZE * TILE_SIZE * 2; // 2 chunks/sec
    let dx = 0;
    let dy = 0;
    if (this.keysDown.has("ArrowLeft") || this.keysDown.has("a")) dx -= 1;
    if (this.keysDown.has("ArrowRight") || this.keysDown.has("d")) dx += 1;
    if (this.keysDown.has("ArrowUp") || this.keysDown.has("w")) dy -= 1;
    if (this.keysDown.has("ArrowDown") || this.keysDown.has("s")) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const speed = PAN_SPEED / this.camera.zoom;
      this.camera.x += dx * speed * dt;
      this.camera.y += dy * speed * dt;
    }
  }

  consumePendingEdits(): PendingTileEdit[] {
    if (this.pendingTileEdits.length === 0) return this.pendingTileEdits;
    const edits = this.pendingTileEdits;
    this.pendingTileEdits = [];
    return edits;
  }

  consumePendingSubgridEdits(): PendingSubgridEdit[] {
    if (this.pendingSubgridEdits.length === 0) return this.pendingSubgridEdits;
    const edits = this.pendingSubgridEdits;
    this.pendingSubgridEdits = [];
    return edits;
  }

  consumePendingCornerEdits(): PendingSubgridEdit[] {
    if (this.pendingCornerEdits.length === 0) return this.pendingCornerEdits;
    const edits = this.pendingCornerEdits;
    this.pendingCornerEdits = [];
    return edits;
  }

  consumePendingRoadEdits(): PendingRoadEdit[] {
    if (this.pendingRoadEdits.length === 0) return this.pendingRoadEdits;
    const edits = this.pendingRoadEdits;
    this.pendingRoadEdits = [];
    return edits;
  }

  consumePendingElevationEdits(): PendingElevationEdit[] {
    if (this.pendingElevationEdits.length === 0) return this.pendingElevationEdits;
    const edits = this.pendingElevationEdits;
    this.pendingElevationEdits = [];
    return edits;
  }

  consumePendingEntitySpawns(): PendingEntitySpawn[] {
    if (this.pendingEntitySpawns.length === 0) return this.pendingEntitySpawns;
    const spawns = this.pendingEntitySpawns;
    this.pendingEntitySpawns = [];
    return spawns;
  }

  consumePendingEntityDeletions(): number[] {
    if (this.pendingEntityDeletions.length === 0) return this.pendingEntityDeletions;
    const dels = this.pendingEntityDeletions;
    this.pendingEntityDeletions = [];
    return dels;
  }

  consumePendingPropDeletions(): number[] {
    if (this.pendingPropDeletions.length === 0) return this.pendingPropDeletions;
    const dels = this.pendingPropDeletions;
    this.pendingPropDeletions = [];
    return dels;
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

  /** Snap to nearest half-tile (subgrid) position. */
  private screenToSubgrid(sx: number, sy: number): { gsx: number; gsy: number } {
    const { wx, wy } = this.camera.screenToWorld(sx, sy);
    const halfTile = TILE_SIZE / 2;
    return {
      gsx: Math.round(wx / halfTile),
      gsy: Math.round(wy / halfTile),
    };
  }

  /** Snap to nearest tile corner (even subgrid position = vertex between 4 tiles). */
  private screenToCorner(sx: number, sy: number): { gsx: number; gsy: number } {
    const { wx, wy } = this.camera.screenToWorld(sx, sy);
    return {
      gsx: Math.round(wx / TILE_SIZE) * 2,
      gsy: Math.round(wy / TILE_SIZE) * 2,
    };
  }

  private screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    return this.camera.screenToWorld(sx, sy);
  }

  private spawnEntityAt(sx: number, sy: number): void {
    const { wx, wy } = this.screenToWorld(sx, sy);
    this.pendingEntitySpawns.push({
      wx,
      wy,
      entityType: this.selectedEntityType,
    });
  }

  private spawnPropAt(sx: number, sy: number): void {
    const { wx, wy } = this.screenToWorld(sx, sy);
    // Snap to tile center for clean placement
    const snappedWx = Math.floor(wx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const snappedWy = Math.floor(wy / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    this.pendingEntitySpawns.push({
      wx: snappedWx,
      wy: snappedWy,
      entityType: this.selectedPropType,
    });
  }

  private deleteEntityAt(sx: number, sy: number): void {
    const { wx, wy } = this.screenToWorld(sx, sy);
    let bestDist = 24; // max world-pixel distance to pick
    let bestEntityId = -1;
    let bestPropId = -1;
    for (const entity of this.entities) {
      const dx = entity.position.wx - wx;
      const dy = entity.position.wy - wy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestEntityId = entity.id;
        bestPropId = -1;
      }
    }
    for (const prop of this.props) {
      const dx = prop.position.wx - wx;
      const dy = prop.position.wy - wy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Scale pick radius for larger props
      const pickRadius = Math.max(
        24,
        Math.max(prop.sprite.spriteWidth, prop.sprite.spriteHeight) / 2,
      );
      if (dist < pickRadius && dist < bestDist) {
        bestDist = dist;
        bestPropId = prop.id;
        bestEntityId = -1;
      }
    }
    if (bestEntityId >= 0) {
      this.pendingEntityDeletions.push(bestEntityId);
    } else if (bestPropId >= 0) {
      this.pendingPropDeletions.push(bestPropId);
    }
  }

  private paintAt(sx: number, sy: number): void {
    if (this.editorTab === "road") {
      this.paintRoadAt(sx, sy);
      return;
    }
    if (this.editorTab === "elevation") {
      this.paintElevationAt(sx, sy);
      return;
    }
    if (this.brushMode === "subgrid" || this.brushMode === "cross" || this.brushMode === "x") {
      this.paintSubgridAt(sx, sy);
    } else if (this.brushMode === "corner") {
      this.paintCornerAt(sx, sy);
    } else {
      this.paintTileAt(sx, sy);
    }
  }

  private paintElevationAt(sx: number, sy: number): void {
    const { tx, ty } = this.screenToTile(sx, sy);
    if (tx === this.lastPaintedTile.tx && ty === this.lastPaintedTile.ty) return;
    this.lastPaintedTile.tx = tx;
    this.lastPaintedTile.ty = ty;
    const height = this.rightClickUnpaint ? 0 : this.selectedElevation;
    this.pendingElevationEdits.push({
      tx,
      ty,
      height,
      gridSize: this.elevationGridSize,
    });
  }

  private paintRoadAt(sx: number, sy: number): void {
    const { tx, ty } = this.screenToTile(sx, sy);
    if (tx === this.lastPaintedTile.tx && ty === this.lastPaintedTile.ty) return;
    this.lastPaintedTile.tx = tx;
    this.lastPaintedTile.ty = ty;
    this.pendingRoadEdits.push({ tx, ty, roadType: this.selectedRoadType });
  }

  private paintTileAt(sx: number, sy: number): void {
    const { tx, ty } = this.screenToTile(sx, sy);
    if (tx === this.lastPaintedTile.tx && ty === this.lastPaintedTile.ty) return;
    this.lastPaintedTile.tx = tx;
    this.lastPaintedTile.ty = ty;
    this.pendingTileEdits.push({ tx, ty, terrainId: this.selectedTerrain });
  }

  private paintSubgridAt(sx: number, sy: number): void {
    const { gsx, gsy } = this.screenToSubgrid(sx, sy);
    if (gsx === this.lastPaintedSubgrid.gsx && gsy === this.lastPaintedSubgrid.gsy) return;
    this.lastPaintedSubgrid.gsx = gsx;
    this.lastPaintedSubgrid.gsy = gsy;
    this.pendingSubgridEdits.push({
      gsx,
      gsy,
      terrainId: this.selectedTerrain,
    });
  }

  private paintCornerAt(sx: number, sy: number): void {
    const { gsx, gsy } = this.screenToCorner(sx, sy);
    if (gsx === this.lastPaintedCorner.gsx && gsy === this.lastPaintedCorner.gsy) return;
    this.lastPaintedCorner.gsx = gsx;
    this.lastPaintedCorner.gsy = gsy;
    this.pendingCornerEdits.push({
      gsx,
      gsy,
      terrainId: this.selectedTerrain,
    });
  }

  private updateCursor(sx: number, sy: number): void {
    const { tx, ty } = this.screenToTile(sx, sy);
    this.cursorTileX = tx;
    this.cursorTileY = ty;
    const { gsx, gsy } = this.screenToSubgrid(sx, sy);
    this.cursorSubgridX = gsx;
    this.cursorSubgridY = gsy;
    const corner = this.screenToCorner(sx, sy);
    this.cursorCornerX = corner.gsx;
    this.cursorCornerY = corner.gsy;
  }

  // --- Mouse handlers ---

  private handleMouseDown(e: MouseEvent): void {
    // Ignore synthetic mouse events generated from touch
    if (this.activeTouches.size > 0 || this.wasPinching) return;

    const { sx, sy } = this.canvasCoords(e);

    // Middle button or space+left = pan (always, regardless of tab)
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

    if (this.editorTab === "entities") {
      if (e.button === 0 && !this.deleteMode) {
        this.spawnEntityAt(sx, sy);
      } else if (e.button === 2 || (e.button === 0 && this.deleteMode)) {
        this.deleteEntityAt(sx, sy);
      }
      return;
    }

    if (this.editorTab === "props") {
      if (e.button === 0 && !this.deleteMode) {
        this.spawnPropAt(sx, sy);
      } else if (e.button === 2 || (e.button === 0 && this.deleteMode)) {
        this.deleteEntityAt(sx, sy);
      }
      return;
    }

    // Left button = paint terrain, Right button = unpaint
    if (e.button === 0 || e.button === 2) {
      this.isPainting = true;
      this.rightClickUnpaint = e.button === 2;
      this.lastPaintedTile.tx = -Infinity;
      this.lastPaintedTile.ty = -Infinity;
      this.lastPaintedSubgrid.gsx = -Infinity;
      this.lastPaintedSubgrid.gsy = -Infinity;
      this.lastPaintedCorner.gsx = -Infinity;
      this.lastPaintedCorner.gsy = -Infinity;
      this.paintAt(sx, sy);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.activeTouches.size > 0 || this.wasPinching) return;

    const { sx, sy } = this.canvasCoords(e);

    this.updateCursor(sx, sy);

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
    this.rightClickUnpaint = false;
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const { sx, sy } = this.canvasCoords(e);

    // Always zoom toward cursor
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
      // Defer single-touch paint — a second finger may arrive for pinch/pan.
      const [first] = this.activeTouches.values();
      if (first) {
        this.touchPaintStart = { sx: first.sx, sy: first.sy };
        this.touchPaintTimer = setTimeout(() => {
          this.commitTouchPaint();
        }, 200);
      }
    } else if (this.activeTouches.size >= 2) {
      // Second finger arrived — cancel deferred paint and start pinch/pan
      this.cancelTouchPaint();
      this.wasPinching = true;
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
      const [first] = this.activeTouches.values();
      if (first) {
        // If deferred paint is pending, commit it now (user is dragging to paint)
        if (this.touchPaintStart) {
          this.commitTouchPaint();
        }
        // In entity/props mode, don't drag-to-spam
        if (this.editorTab !== "entities" && this.editorTab !== "props" && !this.wasPinching) {
          this.paintAt(first.sx, first.sy);
        }
        this.updateCursor(first.sx, first.sy);
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
    if (this.activeTouches.size === 0) {
      // All fingers lifted — if deferred paint is still pending, it was a quick tap
      if (this.touchPaintStart) {
        this.commitTouchPaint();
      }
      this.wasPinching = false;
    } else if (this.activeTouches.size === 1) {
      // 2→1 fingers — reset paint dedup but don't start painting (still part of gesture)
      this.lastPaintedTile.tx = -Infinity;
      this.lastPaintedTile.ty = -Infinity;
      this.lastPaintedSubgrid.gsx = -Infinity;
      this.lastPaintedSubgrid.gsy = -Infinity;
      this.lastPaintedCorner.gsx = -Infinity;
      this.lastPaintedCorner.gsy = -Infinity;
    }
  }

  private cancelTouchPaint(): void {
    if (this.touchPaintTimer !== null) {
      clearTimeout(this.touchPaintTimer);
      this.touchPaintTimer = null;
    }
    this.touchPaintStart = null;
  }

  private commitTouchPaint(): void {
    const start = this.touchPaintStart;
    this.cancelTouchPaint();
    if (!start) return;
    if (this.editorTab === "entities") {
      if (this.deleteMode) {
        this.deleteEntityAt(start.sx, start.sy);
      } else {
        this.spawnEntityAt(start.sx, start.sy);
      }
    } else if (this.editorTab === "props") {
      if (this.deleteMode) {
        this.deleteEntityAt(start.sx, start.sy);
      } else {
        this.spawnPropAt(start.sx, start.sy);
      }
    } else {
      this.lastPaintedTile.tx = -Infinity;
      this.lastPaintedTile.ty = -Infinity;
      this.lastPaintedSubgrid.gsx = -Infinity;
      this.lastPaintedSubgrid.gsy = -Infinity;
      this.paintAt(start.sx, start.sy);
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
