import { TILE_SIZE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
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
  const transportDebug = gc.transport.getDebugInfo?.();

  drawDebugOverlay(
    ctx,
    camera,
    stateView.entities as import("../entities/Entity.js").Entity[],
    stateView.props as import("../entities/Prop.js").Prop[],
    {
      fps: currentFps,
      netKbps: gc.transport.bytesReceived !== undefined ? currentNetKbps : undefined,
      transport: transportDebug?.transport,
      transportRttMs: transportDebug?.rttMs,
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
