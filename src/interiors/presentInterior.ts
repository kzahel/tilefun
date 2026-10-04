import type { Camera } from "../rendering/Camera.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import type { FurniturePlacement } from "./FurnitureCatalog.js";
import type { InteriorPresentation } from "./InteriorPresentation.js";

/** Game and embedded rooms submit the same cached geometry and actor ordering. */
export function presentInterior(
  renderer: RenderBackend,
  camera: Camera,
  presentation: InteriorPresentation,
  placements: readonly FurniturePlacement[],
  items: readonly SceneItem[],
): void {
  try {
    renderer.prepareInterior(presentation.content);
    renderer.submit(camera, {
      kind: "interior",
      contentId: presentation.content.id,
      draws: presentation.collect(placements, items),
    });
  } finally {
    presentation.release();
  }
}
