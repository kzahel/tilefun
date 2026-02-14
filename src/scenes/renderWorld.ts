import { TILE_SIZE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
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
 * Draw y-sorted entities and props on top of terrain.
 * Called after any scene-specific overlays (editor grid, etc.).
 */
export function renderEntities(gc: GameContext): void {
  const { ctx, camera, stateView, sheets } = gc;
  if (sheets.size === 0) return;

  const renderables: Renderable[] = [
    ...(stateView.entities.filter((e) => e.sprite) as Renderable[]),
    ...stateView.props,
  ];
  renderables.sort(
    (a, b) => a.position.wy + (a.sortOffsetY ?? 0) - (b.position.wy + (b.sortOffsetY ?? 0)),
  );
  drawEntities(ctx, camera, renderables, sheets, stateView.world);
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

  if (!gc.debugEnabled) return;

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
    },
    camera.getVisibleChunkRange(),
  );
}
