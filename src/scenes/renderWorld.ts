import type { GameContext } from "../core/GameScene.js";
import { collectScene } from "../rendering/collectScene.js";
import { collectSceneOrder } from "../rendering/RenderFrame.js";
import type { ParticleItem } from "../rendering/SceneItem.js";
import { renderInterior } from "./renderInterior.js";

/**
 * Shared world rendering used by both PlayScene and EditScene.
 * Draws: canvas clear, terrain, elevation, entities/props (y-sorted).
 */
export function renderWorld(gc: GameContext): void {
  const { camera, stateView, renderer } = gc;
  renderer.submit(camera, { kind: "clear", color: "#1a1a2e" });

  if (gc.spriteCatalog.size === 0) return;

  const visible = camera.getVisibleChunkRange();

  if (stateView.interior) return;
  // Terrain + autotile + details (baked into chunk cache)
  renderer.prepareTerrain(camera, stateView.world, visible);
  renderer.submit(camera, {
    kind: "terrain",
    draws: renderer.collectTerrain(camera, stateView.world, visible),
  });

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
  const { camera, stateView, renderer } = gc;
  if (gc.spriteCatalog.size === 0) return;

  if (stateView.interior) {
    renderInterior(gc, alpha, extraParticles ?? []);
    return;
  }
  const visible = camera.getVisibleChunkRange();
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
    gc.doorPresentation?.entities(stateView.entities, gc.realmId ?? null) ?? stateView.entities,
    stateView.props,
    stateView.world,
    camera,
    visible,
    alpha,
    renderer,
    extraParticles ?? [],
    gc.spriteCatalog.has("grass-blades"),
    debugExtrapolation ? extrapolationGhosts : undefined,
    undefined,
    gc.sceneFrame,
  );

  gc.doorPresentation?.appendOverlays(items, gc.realmId ?? null);
  try {
    renderer.submit(camera, {
      kind: "scene",
      items,
      order: collectSceneOrder(items, gc.sceneFrame.drawOrder),
    });
  } finally {
    gc.sceneFrame.release();
  }
}
