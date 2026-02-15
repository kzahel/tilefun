import type { GameContext, GameScene } from "../core/GameScene.js";
import { drawEditorOverlay, drawRemoteCursors } from "../editor/EditorRenderer.js";
import { renderDebugOverlay, renderEntities, renderWorld } from "./renderWorld.js";

type Unsubscribe = () => void;

/**
 * Editor mode scene.
 * Handles: editor panel, brush painting, entity/prop placement, editor overlay.
 */
export class EditScene implements GameScene {
  readonly transparent = false;
  private unsubscribes: Unsubscribe[] = [];
  private lastCursorTileX = -Infinity;
  private lastCursorTileY = -Infinity;
  private lastCursorTab = "";
  private lastCursorBrush = "";

  onEnter(gc: GameContext): void {
    gc.editorMode.attach();
    gc.editorPanel.visible = true;
    if (gc.editorButton) gc.editorButton.textContent = "Play";

    // Tell server we're in editor mode
    if (!gc.serialized && gc.server) {
      gc.server.getLocalSession().editorEnabled = true;
    }
    gc.transport.send({ type: "set-editor-mode", enabled: true });

    // Bind editor-specific actions
    this.unsubscribes.push(
      gc.actions.on("toggle_paint_mode", () => gc.editorPanel.toggleMode()),
      gc.actions.on("cycle_bridge_depth", () => gc.editorPanel.cycleBridgeDepth()),
      gc.actions.on("cycle_brush_shape", () => gc.editorPanel.cycleBrushShape()),
      gc.actions.on("paint_positive", () => gc.editorPanel.setPaintMode("positive")),
      gc.actions.on("paint_unpaint", () => gc.editorPanel.setPaintMode("unpaint")),
      gc.actions.on("toggle_tab", () => gc.editorPanel.toggleTab()),
    );
  }

  onExit(gc: GameContext): void {
    gc.editorMode.detach();
    gc.editorPanel.visible = false;
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];
  }

  onResume(gc: GameContext): void {
    gc.editorMode.attach();
    gc.editorPanel.visible = true;

    // Re-bind editor-specific actions
    this.unsubscribes.push(
      gc.actions.on("toggle_paint_mode", () => gc.editorPanel.toggleMode()),
      gc.actions.on("cycle_bridge_depth", () => gc.editorPanel.cycleBridgeDepth()),
      gc.actions.on("cycle_brush_shape", () => gc.editorPanel.cycleBrushShape()),
      gc.actions.on("paint_positive", () => gc.editorPanel.setPaintMode("positive")),
      gc.actions.on("paint_unpaint", () => gc.editorPanel.setPaintMode("unpaint")),
      gc.actions.on("toggle_tab", () => gc.editorPanel.toggleTab()),
    );
  }

  onPause(gc: GameContext): void {
    gc.editorMode.detach();
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];
  }

  update(dt: number, gc: GameContext): void {
    // Save camera state for render interpolation
    gc.camera.savePrev();

    // Debug panel state
    if (gc.debugPanel.consumeBaseModeChange() || gc.debugPanel.consumeConvexChange()) {
      if (gc.serialized) {
        gc.transport.send({ type: "invalidate-all-chunks" });
      } else if (gc.server) {
        gc.server.invalidateAllChunks();
      }
    }

    if (gc.serialized) {
      gc.transport.send({
        type: "set-debug",
        paused: gc.debugPanel.paused,
        noclip: gc.debugPanel.noclip,
      });
    } else if (gc.server) {
      const session = gc.server.getLocalSession();
      session.debugPaused = gc.debugPanel.paused;
      session.debugNoclip = gc.debugPanel.noclip;
    }

    // Sync editor panel state → editor mode
    gc.editorPanel.setTemporaryUnpaint(gc.editorMode.rightClickUnpaint);
    gc.editorMode.selectedTerrain = gc.editorPanel.selectedTerrain;
    gc.editorMode.selectedRoadType = gc.editorPanel.selectedRoadType;
    gc.editorMode.brushMode = gc.editorPanel.brushMode;
    gc.editorMode.paintMode = gc.editorPanel.effectivePaintMode;
    gc.editorMode.editorTab = gc.editorPanel.editorTab;
    gc.editorMode.selectedEntityType = gc.editorPanel.selectedEntityType;
    gc.editorMode.selectedPropType = gc.editorPanel.selectedPropType;
    gc.editorMode.deleteMode = gc.editorPanel.deleteMode;
    gc.editorMode.selectedElevation = gc.editorPanel.selectedElevation;
    gc.editorMode.elevationGridSize = gc.editorPanel.elevationGridSize;
    gc.editorMode.entities = gc.stateView.entities as import("../entities/Entity.js").Entity[];
    gc.editorMode.props = gc.stateView.props as import("../entities/Prop.js").Prop[];
    gc.editorMode.update(dt);

    const paintMode = gc.editorPanel.effectivePaintMode;
    const bridgeDepth = gc.editorPanel.bridgeDepth;

    // Apply terrain edits (tile mode)
    for (const edit of gc.editorMode.consumePendingEdits()) {
      gc.transport.send({
        type: "edit-terrain-tile",
        tx: edit.tx,
        ty: edit.ty,
        terrainId: edit.terrainId,
        paintMode,
        bridgeDepth,
      });
    }

    // Apply subgrid edits
    const subgridShape =
      gc.editorPanel.brushMode === "cross"
        ? ("cross" as const)
        : gc.editorPanel.brushMode === "x"
          ? ("x" as const)
          : gc.editorPanel.subgridShape;
    for (const edit of gc.editorMode.consumePendingSubgridEdits()) {
      gc.transport.send({
        type: "edit-terrain-subgrid",
        gsx: edit.gsx,
        gsy: edit.gsy,
        terrainId: edit.terrainId,
        paintMode,
        bridgeDepth,
        shape: subgridShape,
      });
    }

    // Apply corner edits
    for (const edit of gc.editorMode.consumePendingCornerEdits()) {
      gc.transport.send({
        type: "edit-terrain-corner",
        gsx: edit.gsx,
        gsy: edit.gsy,
        terrainId: edit.terrainId,
        paintMode,
        bridgeDepth,
      });
    }

    // Apply road edits
    for (const edit of gc.editorMode.consumePendingRoadEdits()) {
      gc.transport.send({
        type: "edit-road",
        tx: edit.tx,
        ty: edit.ty,
        roadType: edit.roadType,
        paintMode,
      });
    }

    // Apply elevation edits
    for (const edit of gc.editorMode.consumePendingElevationEdits()) {
      gc.transport.send({
        type: "edit-elevation",
        tx: edit.tx,
        ty: edit.ty,
        height: edit.height,
        gridSize: edit.gridSize,
      });
    }

    // Apply entity/prop spawns
    for (const spawn of gc.editorMode.consumePendingEntitySpawns()) {
      gc.transport.send({
        type: "edit-spawn",
        wx: spawn.wx,
        wy: spawn.wy,
        entityType: spawn.entityType,
      });
    }

    // Apply entity deletions
    for (const id of gc.editorMode.consumePendingEntityDeletions()) {
      gc.transport.send({ type: "edit-delete-entity", entityId: id });
    }

    // Apply prop deletions
    for (const id of gc.editorMode.consumePendingPropDeletions()) {
      gc.transport.send({ type: "edit-delete-prop", propId: id });
    }

    // Handle clear canvas
    const clearId = gc.editorPanel.consumeClearRequest();
    if (clearId !== null) {
      gc.transport.send({ type: "edit-clear-terrain", terrainId: clearId });
    }
    if (gc.editorPanel.consumeRoadClearRequest()) {
      gc.transport.send({ type: "edit-clear-roads" });
    }

    // Send editor cursor to server (only when changed)
    const curTX = gc.editorMode.cursorTileX;
    const curTY = gc.editorMode.cursorTileY;
    const curTab = gc.editorPanel.editorTab;
    const curBrush = gc.editorPanel.brushMode;
    if (
      curTX !== this.lastCursorTileX ||
      curTY !== this.lastCursorTileY ||
      curTab !== this.lastCursorTab ||
      curBrush !== this.lastCursorBrush
    ) {
      this.lastCursorTileX = curTX;
      this.lastCursorTileY = curTY;
      this.lastCursorTab = curTab;
      this.lastCursorBrush = curBrush;
      gc.transport.send({
        type: "editor-cursor",
        tileX: curTX,
        tileY: curTY,
        editorTab: curTab,
        brushMode: curBrush,
      });
    }

    // Server tick + chunk loading (no camera follow — editor pans manually)
    if (gc.serialized) {
      if (gc.debugPanel.observer && gc.camera.zoom !== 1) {
        const savedZoom = gc.camera.zoom;
        gc.camera.zoom = 1;
        gc.sendVisibleRange();
        gc.camera.zoom = savedZoom;
      } else {
        gc.sendVisibleRange();
      }
    } else if (gc.server) {
      const session = gc.server.getLocalSession();
      session.visibleRange = gc.camera.getVisibleChunkRange();
      gc.server.tick(dt);

      session.cameraX = gc.camera.x;
      session.cameraY = gc.camera.y;
      session.cameraZoom = gc.camera.zoom;

      if (gc.debugPanel.observer && gc.camera.zoom !== 1) {
        const savedZoom = gc.camera.zoom;
        gc.camera.zoom = 1;
        gc.server.updateVisibleChunks(gc.camera.getVisibleChunkRange());
        gc.camera.zoom = savedZoom;
      } else {
        gc.server.updateVisibleChunks(gc.camera.getVisibleChunkRange());
      }
    }
  }

  render(alpha: number, gc: GameContext): void {
    gc.camera.applyInterpolation(alpha);
    renderWorld(gc);

    // Editor overlays (grid + cursor highlight + elevation tint) — drawn between terrain and entities
    const visible = gc.camera.getVisibleChunkRange();
    drawEditorOverlay(
      gc.ctx,
      gc.camera,
      gc.editorMode,
      {
        brushMode: gc.editorPanel.brushMode,
        effectivePaintMode: gc.editorPanel.effectivePaintMode,
        subgridShape:
          gc.editorPanel.brushMode === "cross"
            ? "cross"
            : gc.editorPanel.brushMode === "x"
              ? "x"
              : gc.editorPanel.subgridShape,
        brushSize: gc.editorPanel.brushSize,
        editorTab: gc.editorPanel.editorTab,
        elevationGridSize: gc.editorPanel.elevationGridSize,
        bridgeDepth: gc.editorPanel.bridgeDepth,
      },
      visible,
      gc.stateView.world,
    );

    // Draw other players' editor cursors
    drawRemoteCursors(gc.ctx, gc.camera, gc.stateView.remoteCursors);

    renderEntities(gc, alpha);
    renderDebugOverlay(gc);
    gc.camera.restoreActual();
  }
}
