import type { ChunkRange } from "../world/ChunkManager.js";
import { TERRAIN_PACING, type TerrainPacing } from "./PresentationSettings.js";
import type { RenderBackend, RenderView } from "./RenderFrame.js";
import type { TerrainRenderWorld } from "./TerrainPresentation.js";
import type { TerrainPreparationView } from "./TerrainResidency.js";

/** A frame of several views (226) prepares their terrain once with one budget;
 * each view then presents with `prepared` set. */
export function prepareViewTerrain(
  renderer: RenderBackend,
  views: readonly TerrainPreparationView[],
  world: TerrainRenderWorld,
  pacing: TerrainPacing,
): void {
  renderer.prepareTerrainViews(views, world, TERRAIN_PACING[pacing].preparation);
}

/** One preparation/publication policy for gameplay and embedded outdoor views. */
export function presentTerrain(
  renderer: RenderBackend,
  camera: RenderView,
  world: TerrainRenderWorld,
  visible: ChunkRange,
  pacing: TerrainPacing,
  prepared = false,
): void {
  const policy = TERRAIN_PACING[pacing];
  if (!prepared) renderer.prepareTerrain(camera, world, visible, policy.preparation);
  renderer.submit(camera, {
    kind: "terrain",
    draws: renderer.collectTerrain(camera, world, visible, policy.drawing),
  });
}
