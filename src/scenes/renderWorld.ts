import { TILE_SIZE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities, drawEntityShadows } from "../rendering/EntityRenderer.js";
import { collectGrassBladeRenderables } from "../rendering/GrassBladeRenderer.js";
import type { Renderable } from "../rendering/Renderable.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";

/**
 * Shared world rendering used by both PlayScene and EditScene.
 * Draws: canvas clear, terrain, elevation, entities/props (y-sorted).
 */
export function renderWorld(gc: GameContext): void {
  const { ctx, canvas, camera, stateView, sheets, tileRenderer } = gc;

  ctx.imageSmoothingEnabled = false;

  // Clear
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (sheets.size === 0) return;

  const visible = camera.getVisibleChunkRange();

  // Terrain + autotile + details (baked into chunk cache)
  tileRenderer.drawTerrain(ctx, camera, stateView.world, sheets, visible);

  // Elevation is drawn interleaved with entities via collectElevationRenderables
  // (moved from a separate pass so cliffs properly occlude entities behind them)

  return; // Entities drawn after scene-specific overlays (editor grid goes between terrain and entities)
}

/**
 * Draw y-sorted entities, props, and grass blades on top of terrain.
 * Called after any scene-specific overlays (editor grid, etc.).
 * Culls entities outside the viewport before Y-sorting.
 */
export function renderEntities(gc: GameContext, alpha = 1, extraRenderables?: Renderable[]): void {
  const { ctx, camera, stateView, sheets } = gc;
  if (sheets.size === 0) return;

  // Viewport bounds in world coordinates
  const vpTL = camera.screenToWorld(0, 0);
  const vpBR = camera.screenToWorld(camera.viewportWidth, camera.viewportHeight);
  // Small margin for rendering effects not captured by sprite bounds (drawOffsetY, elevation, shadows)
  const M = 16;

  const renderables: Renderable[] = [];
  for (const e of stateView.entities) {
    if (!e.sprite) continue;
    const effectiveWy = e.position.wy - (e.wz ?? 0);
    const halfW = e.sprite.spriteWidth / 2;
    if (
      e.position.wx + halfW < vpTL.wx - M ||
      e.position.wx - halfW > vpBR.wx + M ||
      effectiveWy < vpTL.wy - M ||
      effectiveWy - e.sprite.spriteHeight > vpBR.wy + M
    )
      continue;
    renderables.push(e as Renderable);
  }
  for (const p of stateView.props) {
    const sw = p.sprite?.spriteWidth ?? 16;
    const sh = p.sprite?.spriteHeight ?? 16;
    const halfW = sw / 2;
    if (
      p.position.wx + halfW < vpTL.wx - M ||
      p.position.wx - halfW > vpBR.wx + M ||
      p.position.wy < vpTL.wy - M ||
      p.position.wy - sh > vpBR.wy + M
    )
      continue;
    renderables.push(p);
  }

  // Collect grass blade renderables for Y-sorting with entities/props
  const visible = camera.getVisibleChunkRange();
  const grassSheet = sheets.get("grass-blades");
  if (grassSheet) {
    const grassBlades = collectGrassBladeRenderables(
      ctx,
      camera,
      stateView.world,
      stateView.entities,
      grassSheet,
      visible,
    );
    for (const blade of grassBlades) {
      renderables.push(blade);
    }
  }

  // Collect elevation renderables so cliff faces interleave with entities
  // in the Y-sort — entities behind cliffs get occluded correctly
  const elevationRenderables = gc.tileRenderer.collectElevationRenderables(
    ctx,
    camera,
    stateView.world,
    visible,
  );
  for (const elev of elevationRenderables) {
    renderables.push(elev);
  }

  // Extra renderables (e.g. particles) passed in by the scene
  if (extraRenderables) {
    for (const r of extraRenderables) {
      renderables.push(r);
    }
  }

  // Sort by interpolated Y + Z for correct depth ordering. Z_SORT_FACTOR
  // makes elevated entities sort later (drawn on top). Factor 1 means 1px of
  // Z counts the same as 1px of Y depth — enough to draw entities above the
  // prop they're standing on, without being so aggressive that ground-level
  // entities in front incorrectly sort behind elevated ones.
  const Z_SORT_FACTOR = 1;
  renderables.sort((a, b) => {
    const ay = a.prevPosition
      ? a.prevPosition.wy + (a.position.wy - a.prevPosition.wy) * alpha
      : a.position.wy;
    const by = b.prevPosition
      ? b.prevPosition.wy + (b.position.wy - b.prevPosition.wy) * alpha
      : b.position.wy;
    return (
      ay +
      (a.sortOffsetY ?? 0) +
      (a.wz ?? 0) * Z_SORT_FACTOR -
      (by + (b.sortOffsetY ?? 0) + (b.wz ?? 0) * Z_SORT_FACTOR)
    );
  });
  // Pre-pass: shadows at terrain level, drawn before all sprites so they
  // appear behind props (e.g. table shadow peeks out at edges, not on top)
  drawEntityShadows(ctx, camera, renderables, alpha, stateView.world);
  drawEntities(ctx, camera, renderables, sheets, alpha, stateView.world);
}

/** FPS state — shared across scenes since it's a global counter. */
let frameCount = 0;
let fpsTimer = 0;
let currentFps = 0;

/** Update FPS counter and render the debug overlay if enabled. */
export function renderDebugOverlay(gc: GameContext): void {
  // FPS tracking
  frameCount++;
  const now = performance.now() / 1000;
  if (now - fpsTimer >= 1) {
    currentFps = frameCount;
    frameCount = 0;
    fpsTimer = now;
  }

  // Check both legacy debugEnabled and individual render cvars
  const showFps = gc.console.cvars.get("r_showfps")?.get() === true;
  const showBboxes = gc.console.cvars.get("r_showbboxes")?.get() === true;
  const showChunks = gc.console.cvars.get("r_showchunks")?.get() === true;
  const showGrid = gc.console.cvars.get("r_showgrid")?.get() === true;
  const anyCvar = showFps || showBboxes || showChunks || showGrid;

  if (!gc.debugEnabled && !anyCvar) return;

  const { ctx, camera, stateView } = gc;
  const px = stateView.playerEntity.position.wx;
  const py = stateView.playerEntity.position.wy;
  const ptx = Math.floor(px / TILE_SIZE);
  const pty = Math.floor(py / TILE_SIZE);
  const terrain = stateView.world.getTerrainIfLoaded(ptx, pty);
  const collision = stateView.world.getCollision(ptx, pty);
  const collisionParts: string[] = [];
  if (collision === 0) collisionParts.push("None");
  if (collision & CollisionFlag.Solid) collisionParts.push("Solid");
  if (collision & CollisionFlag.Water) collisionParts.push("Water");
  if (collision & CollisionFlag.SlowWalk) collisionParts.push("SlowWalk");

  drawDebugOverlay(
    ctx,
    camera,
    stateView.entities as import("../entities/Entity.js").Entity[],
    stateView.props as import("../entities/Prop.js").Prop[],
    {
      fps: currentFps,
      entityCount: stateView.entities.length,
      chunkCount: stateView.world.chunks.loadedCount,
      playerWx: px,
      playerWy: py,
      playerTx: ptx,
      playerTy: pty,
      terrainName: TileId[terrain] ?? `Unknown(${terrain})`,
      collisionFlags: collisionParts.join("|"),
      speedMultiplier: collision & CollisionFlag.SlowWalk ? 0.5 : 1.0,
      playerWz: stateView.playerEntity.wz,
      playerJumpZ: stateView.playerEntity.jumpZ,
      serverWx: stateView.serverPlayerPosition?.wx,
      serverWy: stateView.serverPlayerPosition?.wy,
      serverWz: stateView.serverPlayerPosition?.wz,
    },
    camera.getVisibleChunkRange(),
    gc.debugEnabled
      ? undefined // legacy path: show all
      : {
          showInfoPanel: showFps,
          showChunkBorders: showChunks,
          showBboxes,
          showGrid,
          showPlayerNames: false,
        },
    stateView.playerNames,
    stateView.world,
  );
}
