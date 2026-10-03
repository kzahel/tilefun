import { CanvasInteriorResources } from "../rendering/CanvasInteriorResources.js";
import type { FloorPlan } from "./ApartmentFloorPlan.js";
import type { FurnitureActor, FurnitureCanvasAssets } from "./FurnishedInterior.js";
import type { FurniturePlacement, FurnitureRect } from "./FurnitureCatalog.js";
import { InteriorPresentation } from "./InteriorPresentation.js";
import type { LayeredInteriorMap } from "./LayeredInteriorMap.js";

/** Canvas composition adapter for existing native review/benchmark surfaces.
 * Production uses RenderBackend; all callers share the same presentation order.
 */
export class CachedInteriorRenderer {
  private readonly presentation: InteriorPresentation;
  private readonly resources: CanvasInteriorResources;
  private readonly emptySheets = new Map();
  constructor(
    atlas: CanvasImageSource,
    map: LayeredInteriorMap,
    plan: FloorPlan,
    floorBounds?: FurnitureRect | ((rect: FurnitureRect) => boolean),
    editable = false,
    review = false,
  ) {
    this.presentation = new InteriorPresentation(map, plan, floorBounds, editable);
    this.resources = new CanvasInteriorResources(atlas, this.presentation.content, review);
  }
  draw(
    ctx: CanvasRenderingContext2D,
    placements: readonly FurniturePlacement[],
    actors: readonly FurnitureActor[] = [],
    assets?: FurnitureCanvasAssets,
  ): void {
    try {
      const draws = this.presentation.collect(
        placements,
        actors.map((a) => a.item),
        actors,
      );
      this.resources.draw(ctx, draws, assets?.sheets ?? this.emptySheets, assets?.terrain);
    } finally {
      this.presentation.release();
    }
  }
}
