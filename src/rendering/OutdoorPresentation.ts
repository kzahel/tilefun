import type { ChunkRange } from "../world/ChunkManager.js";
import { TERRAIN_PACING, type TerrainPacing } from "./PresentationSettings.js";
import type { RenderBackend, RenderView } from "./RenderFrame.js";
import type { TerrainRenderWorld } from "./TerrainPresentation.js";

/** One preparation/publication policy for gameplay and embedded outdoor views. */
export function presentTerrain(
  renderer: RenderBackend,
  camera: RenderView,
  world: TerrainRenderWorld,
  visible: ChunkRange,
  pacing: TerrainPacing,
): void {
  const policy = TERRAIN_PACING[pacing];
  renderer.prepareTerrain(camera, world, visible, policy.preparation);
  renderer.submit(camera, {
    kind: "terrain",
    draws: renderer.collectTerrain(camera, world, visible, policy.drawing),
  });
}
