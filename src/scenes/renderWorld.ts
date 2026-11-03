import type { GameContext } from "../core/GameScene.js";
import { collectScene } from "../rendering/collectScene.js";
import { presentTerrain } from "../rendering/OutdoorPresentation.js";
import type { ParticlePresentation } from "../rendering/ParticleSystem.js";
import { presentSurfaceScene } from "../rendering/presentSurfaceScene.js";
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
  presentTerrain(renderer, camera, stateView.world, visible, gc.debugPanel.terrainPacing);

  // Elevation is drawn interleaved with entities via collectScene
  // (moved from a separate pass so cliffs properly occlude entities behind them)

  return; // Entities drawn after scene-specific overlays (editor grid goes between terrain and entities)
}

/**
 * Draw y-sorted entities, props, and grass blades on top of terrain.
 * Called after any scene-specific overlays (editor grid, etc.).
 * Collects a renderer-agnostic SceneItem[], then draws via Canvas2D backend.
 */
export function renderEntities(
  gc: GameContext,
  alpha = 1,
  extraParticles?: ParticlePresentation,
): void {
  const { camera, stateView, renderer } = gc;
  if (gc.spriteCatalog.size === 0) return;

  if (stateView.interior) {
    renderInterior(gc, alpha, extraParticles ?? []);
    return;
  }
  const visible = camera.getVisibleChunkRange();
  gc.sceneFrame.presentationTime = gc.time?.presentationSeconds ?? 0;
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
    undefined,
    undefined,
    gc.sceneFrame,
    { observer: stateView.playerEntity, visibility: "auto" },
  );

  gc.doorPresentation?.appendOverlays(items, gc.realmId ?? null);
  try {
    presentSurfaceScene(
      renderer,
      camera,
      gc.sceneFrame,
      items,
      stateView.props,
      stateView.playerEntity,
      "auto",
      alpha,
    );
  } finally {
    gc.sceneFrame.release();
  }
}
