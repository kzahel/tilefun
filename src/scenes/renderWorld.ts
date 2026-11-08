import { VIEW_BACKDROP_CSS } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import type { ParticlePresentation } from "../rendering/ParticleSystem.js";
import { seatEntity } from "../session/SeatFocus.js";
import { drawViewScene, drawViewTerrain, renderViews } from "../session/ViewRender.js";
import { renderInterior } from "./renderInterior.js";

/**
 * The world through the shared view draw (226), used by PlayScene and EditScene:
 * canvas clear and terrain (`prepared` when a frame of views already prepared
 * it). Entities follow after scene-specific overlays (editor grid). The view
 * defaults to seat 0's.
 */
export function renderWorld(gc: GameContext, prepared = false, view = gc.view): void {
  const { stateView } = gc;
  const ready = gc.spriteCatalog.size > 0 && !stateView.interior;
  drawViewTerrain(gc.renderer, view.camera, ready ? stateView.world : undefined, {
    background: VIEW_BACKDROP_CSS,
    pacing: gc.debugPanel.terrainPacing,
    prepared,
  });
}

/**
 * Draw y-sorted entities, props, and grass blades on top of terrain.
 * Called after any scene-specific overlays (editor grid, etc.). Cutaways follow
 * the view's own seat (226).
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
    renderInterior(gc, alpha, extraParticles ?? [], view.camera);
    return;
  }
  const observer =
    (view.seat ? seatEntity(gc.session, view.seat) : undefined) ?? stateView.playerEntity;
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
      collectObserver: observer,
      surfaceObserver: observer,
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

/** Play's display frame: every view of the device (one per seat), with terrain
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
