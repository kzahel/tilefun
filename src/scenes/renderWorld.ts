import { TILE_SIZE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import type { ParticleItem } from "../rendering/SceneItem.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";

// ── 3D debug renderer (lazy-loaded) ──

type ThreeDebugRendererType = import("../rendering/ThreeDebugRenderer.js").ThreeDebugRenderer;
let threeDebug: ThreeDebugRendererType | null = null;
let threeLoading = false;

/** Toggle + render the Three.js 3D debug split-screen view based on r_show3d. */
export function render3DDebug(gc: GameContext): void {
  const show3d = gc.console.cvars.get("r_show3d")?.get() === true;

  if (show3d && !threeDebug && !threeLoading) {
    threeLoading = true;
    import("../rendering/ThreeDebugRenderer.js").then(({ ThreeDebugRenderer }) => {
      threeDebug = new ThreeDebugRenderer(gc.canvas);
      threeDebug.setEnabled(true);
      threeLoading = false;
    });
    return;
  }

  if (!show3d && threeDebug) {
    threeDebug.dispose();
    threeDebug = null;
    return;
  }

  if (threeDebug) {
    const { camera, stateView } = gc;
    threeDebug.render(
      camera.x,
      camera.y,
      stateView.entities as Entity[],
      stateView.props as Prop[],
      stateView.world,
      camera.getVisibleChunkRange(),
    );
  }
}

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

  // Elevation is drawn interleaved with entities via collectScene
  // (moved from a separate pass so cliffs properly occlude entities behind them)

  return; // Entities drawn after scene-specific overlays (editor grid goes between terrain and entities)
}

/**
 * Draw y-sorted entities, props, and grass blades on top of terrain.
 * Called after any scene-specific overlays (editor grid, etc.).
 * Collects a renderer-agnostic SceneItem[], then draws via Canvas2D backend.
 */
export function renderEntities(gc: GameContext, alpha = 1, extraParticles?: ParticleItem[]): void {
  const { ctx, camera, stateView, sheets, tileRenderer } = gc;
  if (sheets.size === 0) return;

  const visible = camera.getVisibleChunkRange();
  const grassSheet = sheets.get("grass-blades");
  const extrapolate = gc.console.cvars.get("cl_extrapolate")?.get() === true;
  const debugExtrapolation = gc.console.cvars.get("cl_debugextrapolation")?.get() === true;
  const extrapolateAmountRaw = gc.console.cvars.get("cl_extrapolate_amount")?.get();
  const extrapolateAmount =
    typeof extrapolateAmountRaw === "number" ? Math.max(0, extrapolateAmountRaw) : 0;
  const extrapolationGhosts =
    (debugExtrapolation || extrapolate) && extrapolateAmount > 0
      ? stateView.getExtrapolationGhosts?.(extrapolateAmount)
      : undefined;

  const items = collectScene(
    stateView.entities,
    stateView.props,
    stateView.world,
    camera,
    visible,
    alpha,
    tileRenderer,
    extraParticles ?? [],
    grassSheet !== undefined,
    debugExtrapolation ? extrapolationGhosts : undefined,
  );

  drawScene2D(ctx, camera, items, sheets, grassSheet);
}

/** FPS state — shared across scenes since it's a global counter. */
let frameCount = 0;
let fpsTimer = 0;
let currentFps = 0;

/** Net stats — KB/s receive rate, sampled every second alongside FPS. */
let lastBytesReceived = 0;
let currentNetKbps = 0;

/** Update FPS counter and render the debug overlay if enabled. */
export function renderDebugOverlay(gc: GameContext): void {
  // FPS tracking
  frameCount++;
  const now = performance.now() / 1000;
  if (now - fpsTimer >= 1) {
    currentFps = frameCount;
    frameCount = 0;

    // Net stats: compute KB/s from bytesReceived delta
    const rxNow = gc.transport.bytesReceived ?? 0;
    currentNetKbps = (rxNow - lastBytesReceived) / 1024;
    lastBytesReceived = rxNow;

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
      netKbps: gc.transport.bytesReceived !== undefined ? currentNetKbps : undefined,
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
      correction: stateView.predictionCorrection,
      reconcileStats: stateView.reconcileStats,
      extrapolationStats: stateView.extrapolationStats,
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
