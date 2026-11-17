import type { GameContext } from "../core/GameScene.js";
import type { ParticlePresentation } from "../rendering/ParticleSystem.js";
import { drawViewUnavailable } from "../rendering/ViewUnavailable.js";
import { renderViews } from "../session/ViewRender.js";
import { renderFirstPerson } from "./firstPersonPlay.js";

/** Every seat draws through the unified scene; unavailable graphics use UI. */
export function renderPlayViews(
  gc: GameContext,
  alpha: number,
  particles: ParticlePresentation,
): void {
  const outdoors = gc.spriteCatalog.size > 0 && !gc.stateView.interior;
  renderViews(
    gc.renderer,
    gc.session.views,
    outdoors ? { world: gc.stateView.world, pacing: gc.debugPanel.terrainPacing } : undefined,
    (view) => renderFirstPerson(gc, view, alpha, particles),
    (view) =>
      drawViewUnavailable(
        gc.drawUiOverlay,
        view,
        gc.view3d?.available === false
          ? "Graphics paused. Waiting for your browser…"
          : gc.firstPerson?.unavailableMessage,
      ),
  );
}
