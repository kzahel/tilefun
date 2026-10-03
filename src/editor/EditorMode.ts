import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { ActionManager } from "../input/ActionManager.js";
import { type InteriorIdentity, interiorRealmId } from "../interiors/GameplayInterior.js";
import {
  compileGameplayRoom,
  type GameplayRoomState,
  validateRoomOccupancy,
} from "../interiors/GameplayRoom.js";
import { editTreeRuns, type TreeRun, treeRunLength } from "../patterns/FencedTrees.js";
import { type GridPoint, gridLine, strokeCells } from "../patterns/GridStroke.js";
import { applyPatternEdit, type PatternEdit } from "../patterns/PatternDocument.js";
import type { TreeBrushCommand } from "../patterns/TreeBrushEditor.js";
import type { Camera } from "../rendering/Camera.js";
import type { EditorModel } from "./EditorModel.js";

export type { BrushMode, PaintMode, SubgridShape } from "./EditorTypes.js";

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
  /** Reference to live entities for right-click deletion lookup. */
  entities: readonly Entity[] = [];
  roomState: GameplayRoomState | null = null;
  interior: InteriorIdentity | null = null;
  private roomStroke: { roomId: string; expectedRevision: number; edit: PatternEdit } | null = null;
  private pendingRooms: { roomId: string; expectedRevision: number; edit: PatternEdit }[] = [];
  private roomPreviewKey = "";
  private roomPreview: {
    room: ReturnType<typeof compileGameplayRoom> | null;
    points: GridPoint[];
    error: string;
  } | null = null;
  consumePendingRooms() {
    const result = this.pendingRooms;
    this.pendingRooms = [];
    return result;
  }
  getRoomPreview() {
    if (
      !this.roomStroke ||
      !this.roomState ||
      !this.interior ||
      this.roomStroke.roomId !==
        interiorRealmId(this.interior.parentWorldId, this.interior.featureId)
    )
      return null;
    const key = JSON.stringify([this.roomStroke, this.roomState.revision]);
    if (key === this.roomPreviewKey) return this.roomPreview;
    this.roomPreviewKey = key;
    let points: GridPoint[] = [];
    try {
      points = strokeCells(this.roomStroke.edit.path, this.roomStroke.edit.shape);
      const document = applyPatternEdit(this.roomState.document, this.roomStroke.edit);
      const room = compileGameplayRoom(this.interior, { ...this.roomState, document });
      validateRoomOccupancy(
        room,
        this.props,
        this.entities.filter((e) => e.type === "player"),
      );
      this.roomPreview = { room, points, error: "" };
    } catch (e) {
      this.roomPreview = { room: null, points, error: e instanceof Error ? e.message : String(e) };
    }
    return this.roomPreview;
  }
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
  private readonly actions: ActionManager;
  private readonly model: EditorModel;
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
  private panStart = { sx: 0, sy: 0, camX: 0, camY: 0 };
  private pendingPatterns: TreeBrushCommand[] = [];
  private patternStroke: TreeBrushCommand | null = null;
  consumePendingPatterns(): TreeBrushCommand[] {
    const result = this.pendingPatterns;
    this.pendingPatterns = [];
    return result;
  }
  getPatternPreview(): {
    runs: TreeRun[];
    points: GridPoint[];
    error: string;
    erase: boolean;
  } | null {
    const stroke = this.patternStroke;
    if (!stroke) return null;
    let points: GridPoint[] = [];
    try {
      points = strokeCells([stroke.start, stroke.end], "horizontal");
      const row = this.props
        .filter(
          (p) => treeRunLength(p.type) !== null && p.position.wy === (stroke.start.y + 1) * 16,
        )
        .map((p) => ({
          x: (p.position.wx - (treeRunLength(p.type) ?? 0) * 8) / 16,
          y: stroke.start.y,
          length: treeRunLength(p.type) ?? 0,
        }));
      return {
        runs: editTreeRuns(row, points, stroke.erase),
        points,
        error: "",
        erase: stroke.erase,
      };
    } catch (e) {
      return {
        runs: [],
        points,
        error: e instanceof Error ? e.message : String(e),
        erase: stroke.erase,
      };
    }
  }
  private finishPattern(cancel = false): void {
    if (this.roomStroke && !cancel) this.pendingRooms.push(this.roomStroke);
    this.roomStroke = null;
    this.roomPreviewKey = "";
    this.roomPreview = null;
    if (this.patternStroke && !cancel) this.pendingPatterns.push(this.patternStroke);
    this.patternStroke = null;
  }
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
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.closest("input,textarea,select,[contenteditable=true]"))
      return;
    if (e.key === "Escape") {
      this.finishPattern(true);
      this.isPainting = false;
      this.cancelTouchPaint();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "z" &&
      this.model.editorTab === "patterns"
    ) {
      e.preventDefault();
      this.model.onPatternHistory?.(e.shiftKey ? "redo" : "undo");
    }
  };
  private readonly onBlur = () => {
    this.finishPattern(true);
    this.isPainting = false;
    this.isPanning = false;
    this.rightClickUnpaint = false;
    this.cancelTouchPaint();
  };
  private readonly onMouseDown: (e: MouseEvent) => void;
  private readonly onMouseMove: (e: MouseEvent) => void;
  private readonly onMouseUp: (e: MouseEvent) => void;
  private readonly onWheel: (e: WheelEvent) => void;
  private readonly onContextMenu: (e: Event) => void;
  private readonly onTouchStart: (e: TouchEvent) => void;
  private readonly onTouchMove: (e: TouchEvent) => void;
  private readonly onTouchEnd: (e: TouchEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    actions: ActionManager,
    model: EditorModel,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.actions = actions;
    this.model = model;

    this.onMouseDown = (e) => this.handleMouseDown(e);
    this.onMouseMove = (e) => this.handleMouseMove(e);
    this.onMouseUp = (e) => this.handleMouseUp(e);
    this.onWheel = (e) => this.handleWheel(e);
    this.onContextMenu = (e) => e.preventDefault();
    this.onTouchStart = (e) => this.handleTouchStart(e);
    this.onTouchMove = (e) => this.handleTouchMove(e);
    this.onTouchEnd = (e) => this.handleTouchEnd(e);
  }

  attach(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("blur", this.onBlur);
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
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    this.isPainting = false;
    this.isPanning = false;
    this.finishPattern(true);
    this.pendingRooms = [];
    this.cancelTouchPaint();
    this.activeTouches.clear();
  }

  /** Call from game loop to apply continuous key-based panning. */
  update(dt: number): void {
    const PAN_SPEED = CHUNK_SIZE * TILE_SIZE * 2; // 2 chunks/sec
    const { dx, dy } = this.actions.getPanDirection();
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
      entityType: this.model.selectedEntityType,
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
      entityType: this.model.selectedPropType,
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
    if (this.model.editorTab === "patterns" && this.model.indoor) {
      if (!this.roomState || !this.interior) return;
      const { wx, wy } = this.screenToWorld(sx, sy),
        point = { x: Math.floor(wx / 32), y: Math.floor(wy / 32) };
      if (!this.roomStroke)
        this.roomStroke = {
          roomId: interiorRealmId(this.interior.parentWorldId, this.interior.featureId),
          expectedRevision: this.roomState.revision,
          edit: {
            path: [point],
            shape: this.model.roomRectangle ? "rectangle" : "free",
            value: this.model.roomValue,
            erase: this.rightClickUnpaint || this.model.paintMode === "unpaint",
            roomRectangle: this.model.roomRectangle,
          },
        };
      else {
        const path = this.roomStroke.edit.path;
        if (this.roomStroke.edit.shape === "rectangle")
          this.roomStroke.edit.path = [path[0] as GridPoint, point];
        else if (path.at(-1)?.x !== point.x || path.at(-1)?.y !== point.y)
          this.roomStroke.edit.path = [...path, point];
      }
      return;
    }
    if (this.model.editorTab === "patterns") {
      const { tx, ty } = this.screenToTile(sx, sy);
      if (!this.patternStroke)
        this.patternStroke = {
          start: { x: tx, y: ty },
          end: { x: tx, y: ty },
          erase: this.rightClickUnpaint || this.model.paintMode === "unpaint",
        };
      else this.patternStroke.end = { x: tx, y: this.patternStroke.start.y };
      return;
    }
    if (this.model.editorTab === "road") {
      this.paintRoadAt(sx, sy);
      return;
    }
    if (this.model.editorTab === "elevation") {
      this.paintElevationAt(sx, sy);
      return;
    }
    if (
      this.model.brushMode === "subgrid" ||
      this.model.brushMode === "cross" ||
      this.model.brushMode === "x"
    ) {
      this.paintSubgridAt(sx, sy);
    } else if (this.model.brushMode === "corner") {
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
    const height = this.rightClickUnpaint ? 0 : this.model.selectedElevation;
    this.pendingElevationEdits.push({
      tx,
      ty,
      height,
      gridSize: this.model.elevationGridSize,
    });
  }

  private paintRoadAt(sx: number, sy: number): void {
    const { tx, ty } = this.screenToTile(sx, sy);
    if (tx === this.lastPaintedTile.tx && ty === this.lastPaintedTile.ty) return;
    const line = Number.isFinite(this.lastPaintedTile.tx)
      ? gridLine(
          { x: this.lastPaintedTile.tx, y: this.lastPaintedTile.ty },
          { x: tx, y: ty },
        ).slice(1)
      : [{ x: tx, y: ty }];
    this.lastPaintedTile.tx = tx;
    this.lastPaintedTile.ty = ty;
    for (const p of line)
      this.pendingRoadEdits.push({ tx: p.x, ty: p.y, roadType: this.model.selectedRoadType });
  }

  private paintTileAt(sx: number, sy: number): void {
    const { tx, ty } = this.screenToTile(sx, sy);
    if (tx === this.lastPaintedTile.tx && ty === this.lastPaintedTile.ty) return;
    const line = Number.isFinite(this.lastPaintedTile.tx)
      ? gridLine(
          { x: this.lastPaintedTile.tx, y: this.lastPaintedTile.ty },
          { x: tx, y: ty },
        ).slice(1)
      : [{ x: tx, y: ty }];
    this.lastPaintedTile.tx = tx;
    this.lastPaintedTile.ty = ty;
    for (const p of line)
      this.pendingTileEdits.push({ tx: p.x, ty: p.y, terrainId: this.model.selectedTerrain });
  }

  private paintSubgridAt(sx: number, sy: number): void {
    const { gsx, gsy } = this.screenToSubgrid(sx, sy);
    if (gsx === this.lastPaintedSubgrid.gsx && gsy === this.lastPaintedSubgrid.gsy) return;
    const line = Number.isFinite(this.lastPaintedSubgrid.gsx)
      ? gridLine(
          { x: this.lastPaintedSubgrid.gsx, y: this.lastPaintedSubgrid.gsy },
          { x: gsx, y: gsy },
        ).slice(1)
      : [{ x: gsx, y: gsy }];
    this.lastPaintedSubgrid.gsx = gsx;
    this.lastPaintedSubgrid.gsy = gsy;
    for (const p of line)
      this.pendingSubgridEdits.push({ gsx: p.x, gsy: p.y, terrainId: this.model.selectedTerrain });
  }

  private paintCornerAt(sx: number, sy: number): void {
    const { gsx, gsy } = this.screenToCorner(sx, sy);
    if (gsx === this.lastPaintedCorner.gsx && gsy === this.lastPaintedCorner.gsy) return;
    const line = Number.isFinite(this.lastPaintedCorner.gsx)
      ? gridLine(
          { x: this.lastPaintedCorner.gsx, y: this.lastPaintedCorner.gsy },
          { x: gsx, y: gsy },
        ).slice(1)
      : [{ x: gsx, y: gsy }];
    this.lastPaintedCorner.gsx = gsx;
    this.lastPaintedCorner.gsy = gsy;
    for (const p of line)
      this.pendingCornerEdits.push({ gsx: p.x, gsy: p.y, terrainId: this.model.selectedTerrain });
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
    if (e.button === 1 || (e.button === 0 && (e.shiftKey || this.actions.isHeld("pan_modifier")))) {
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

    if (this.model.editorTab === "entities") {
      if (e.button === 0 && !this.model.deleteMode) {
        this.spawnEntityAt(sx, sy);
      } else if (e.button === 2 || (e.button === 0 && this.model.deleteMode)) {
        this.deleteEntityAt(sx, sy);
      }
      return;
    }

    if (this.model.editorTab === "props") {
      if (e.button === 0 && !this.model.deleteMode) {
        this.spawnPropAt(sx, sy);
      } else if (e.button === 2 || (e.button === 0 && this.model.deleteMode)) {
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
    this.finishPattern();
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
      this.finishPattern(true);
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
        if (
          this.model.editorTab !== "entities" &&
          this.model.editorTab !== "props" &&
          !this.wasPinching
        ) {
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
      this.finishPattern(e.type === "touchcancel");
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
    if (this.model.editorTab === "entities") {
      if (this.model.deleteMode) {
        this.deleteEntityAt(start.sx, start.sy);
      } else {
        this.spawnEntityAt(start.sx, start.sy);
      }
    } else if (this.model.editorTab === "props") {
      if (this.model.deleteMode) {
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
