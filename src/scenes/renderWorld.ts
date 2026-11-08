import type { GameContext } from "../core/GameScene.js";
import type { ParticlePresentation } from "../rendering/ParticleSystem.js";
import { drawViewScene, drawViewTerrain, renderViews } from "../session/ViewRender.js";
import { renderInterior } from "./renderInterior.js";

/**
 * The world through the shared view draw (226), used by PlayScene and EditScene:
 * canvas clear and terrain (`prepared` when a frame of views already prepared
 * it). Entities follow after scene-specific overlays (editor grid). The view
 * defaults to seat 0's; observers stay seat 0 until split screen (slice 5).
 */
export function renderWorld(gc: GameContext, prepared = false, view = gc.view): void {
  const { stateView } = gc;
  const ready = gc.spriteCatalog.size > 0 && !stateView.interior;
  drawViewTerrain(gc.renderer, view.camera, ready ? stateView.world : undefined, {
    background: "#1a1a2e",
    pacing: gc.debugPanel.terrainPacing,
    prepared,
  });
}

/**
 * Draw y-sorted entities, props, and grass blades on top of terrain.
 * Called after any scene-specific overlays (editor grid, etc.).
 */
export function renderEntities(
  gc: GameContext,
  alpha = 1,
  extraParticles?: ParticlePresentation,
  view = gc.view,
): void {
  const { stateView } = gc;
  if (gc.spriteCatalog.size === 0) return;
  if (stateView.interior) {
    // Rooms still draw with seat 0's camera and frame (one view until slice 5).
    renderInterior(gc, alpha, extraParticles ?? []);
    return;
  }
  const time = gc.time?.presentationSeconds ?? 0;
  const realm = gc.realmId ?? null;
  drawViewScene(
    gc.renderer,
    view.camera,
    gc.sceneFrame,
    view.fades,
    {
      world: stateView.world,
      props: stateView.props,
      entities: gc.doorPresentation?.entities(stateView.entities, realm) ?? stateView.entities,
      collectObserver: stateView.playerEntity,
      surfaceObserver: stateView.playerEntity,
    },
    {
      alpha,
      particles: extraParticles ?? [],
      grass: gc.spriteCatalog.has("grass-blades"),
      visibility: "auto",
      presentationTime: time,
      fadeSeconds: time,
      collected: (items) => gc.doorPresentation?.appendOverlays(items, realm),
    },
  );
}

/** Play's display frame: every view of the device (seat 0's today), with terrain
 * prepared once. Headless fixtures without graphics draw seat 0's view directly. */
export function renderPlayViews(
  gc: GameContext,
  alpha: number,
  particles: ParticlePresentation,
): void {
  const { beginView, endView } = gc;
  const draw = (view = gc.view) => {
    renderWorld(gc, !!beginView, view);
    renderEntities(gc, alpha, particles, view);
  };
  if (!beginView || !endView) {
    draw();
    return;
  }
  const outdoors = gc.spriteCatalog.size > 0 && !gc.stateView.interior;
  renderViews(
    { renderer: gc.renderer, beginView, endView },
    gc.session.views,
    outdoors ? { world: gc.stateView.world, pacing: gc.debugPanel.terrainPacing } : undefined,
    draw,
  );
}
