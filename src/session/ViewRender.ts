import { TERRAIN_PACING, type TerrainPacing } from "../rendering/PresentationSettings.js";
import type { RenderResources } from "../rendering/RenderFrame.js";
import type { TerrainRenderWorld } from "../rendering/TerrainPresentation.js";
import type { TerrainPreparationView } from "../rendering/TerrainResidency.js";
import type { View } from "./View.js";

const preparation: TerrainPreparationView[] = [];
/** Draw the unified scene for each view and show UI for any unavailable view.
 * Terrain is prepared once for their union; borrowed descriptors never escape. */
export function renderViews(
  renderer: RenderResources,
  views: readonly View[],
  terrain: { world: TerrainRenderWorld; pacing: TerrainPacing } | undefined,
  draw: (view: View, index: number) => boolean,
  unavailable: (view: View, index: number) => void,
): void {
  const waiting: { view: View; index: number }[] = [];
  views.forEach((view, index) => {
    if (!draw(view, index)) waiting.push({ view, index });
  });
  if (terrain && views.length) {
    try {
      for (const view of views)
        preparation.push({ view: view.camera, visible: view.interestRange() });
      renderer.prepareTerrainViews(
        preparation,
        terrain.world,
        TERRAIN_PACING[terrain.pacing].preparation,
      );
    } finally {
      preparation.length = 0;
    }
  }
  for (const { view, index } of waiting) unavailable(view, index);
}
