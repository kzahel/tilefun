import { TILE_SIZE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import { renderGrassBlades as renderGrassBladesImpl } from "../rendering/GrassBladeRenderer.js";
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

  // Elevation: cliff faces + Y-offset
  tileRenderer.drawElevation(ctx, camera, stateView.world, visible);

  return; // Entities drawn after scene-specific overlays (editor grid goes between terrain and entities)
}

/**
 * Draw animated grass blade overlays on full-grass tiles.
 * Blades sway idly and push away from nearby entities.
 * Call after renderWorld() and before renderEntities().
 */
export function drawGrassBlades(gc: GameContext): void {
  const { ctx, camera, stateView, sheets } = gc;
  const sheet = sheets.get("grass-blades");
  if (!sheet) return;
  const visible = camera.getVisibleChunkRange();
  renderGrassBladesImpl(ctx, camera, stateView.world, stateView.entities, sheet, visible);
}

/**
 * Draw y-sorted entities and props on top of terrain.
 * Called after any scene-specific overlays (editor grid, etc.).
 * Culls entities outside the viewport before Y-sorting.
 */
export function renderEntities(gc: GameContext, alpha = 1): void {
  const { ctx, camera, stateView, sheets } = gc;
  if (sheets.size === 0) return;

  // Viewport bounds in world coordinates, with margin for sprites partially on-screen
  const CULL_MARGIN = 48; // pixels — covers largest sprite height (player = 48px)
  const topLeft = camera.screenToWorld(-CULL_MARGIN * camera.scale, -CULL_MARGIN * camera.scale);
  const bottomRight = camera.screenToWorld(
    camera.viewportWidth + CULL_MARGIN * camera.scale,
    camera.viewportHeight + CULL_MARGIN * camera.scale,
  );

  const renderables: Renderable[] = [];
  for (const e of stateView.entities) {
    if (
      !e.sprite ||
      e.position.wx < topLeft.wx ||
      e.position.wx > bottomRight.wx ||
      e.position.wy < topLeft.wy ||
      e.position.wy > bottomRight.wy
    )
      continue;
    renderables.push(e as Renderable);
  }
  for (const p of stateView.props) {
    if (
      p.position.wx < topLeft.wx ||
      p.position.wx > bottomRight.wx ||
      p.position.wy < topLeft.wy ||
      p.position.wy > bottomRight.wy
    )
      continue;
    renderables.push(p);
  }

  // Sort by interpolated Y position for correct depth ordering
  renderables.sort((a, b) => {
    const ay = a.prevPosition
      ? a.prevPosition.wy + (a.position.wy - a.prevPosition.wy) * alpha
      : a.position.wy;
    const by = b.prevPosition
      ? b.prevPosition.wy + (b.position.wy - b.prevPosition.wy) * alpha
      : b.position.wy;
    return ay + (a.sortOffsetY ?? 0) - (by + (b.sortOffsetY ?? 0));
  });
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
      playerJumpZ: stateView.playerEntity.jumpZ,
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
