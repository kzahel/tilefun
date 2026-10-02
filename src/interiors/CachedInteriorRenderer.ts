import type { FloorPlan } from "./ApartmentFloorPlan.js";
import {
  drawPreparedFurnishedInterior,
  type FurnitureActor,
  prepareFurnishedInterior,
} from "./FurnishedInterior.js";
import type { FurniturePlacement, FurnitureRect } from "./FurnitureCatalog.js";
import {
  drawLayeredInteriorMap,
  type InteriorLayer,
  type LayeredInteriorMap,
} from "./LayeredInteriorMap.js";

/** Bounded to one room. Cache only static native-pixel shell layers; actors,
 * edited furniture and its depth ordering remain live. No saved-world changes. */
export class CachedInteriorRenderer {
  private readonly layers: { floor: HTMLCanvasElement; walls: HTMLCanvasElement };
  private placementKey = "";
  private objects: ReturnType<typeof prepareFurnishedInterior> = [];
  constructor(
    private readonly atlas: CanvasImageSource,
    private readonly map: LayeredInteriorMap,
    private readonly plan: FloorPlan,
    private readonly floorBounds?: FurnitureRect,
  ) {
    const raster = (layers: readonly InteriorLayer[]) => {
      const canvas = document.createElement("canvas");
      canvas.width = map.width * 16;
      // The nominal review viewport crops the south doorway. Gameplay also
      // draws that protruding threshold, so retain the complete cell extent.
      canvas.height = Math.max(map.pixelHeight, map.height * 16 + (map.contentOffsetY ?? 0));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Missing interior layer canvas");
      drawLayeredInteriorMap(ctx, atlas, map, layers);
      return canvas;
    };
    this.layers = { floor: raster(["floor"]), walls: raster(["wall", "foreground", "objects"]) };
  }
  draw(
    ctx: CanvasRenderingContext2D,
    placements: readonly FurniturePlacement[],
    actors: readonly FurnitureActor[] = [],
  ): void {
    const key = JSON.stringify(placements);
    if (key !== this.placementKey) {
      this.objects = prepareFurnishedInterior(this.map, this.plan, placements, this.floorBounds);
      this.placementKey = key;
    }
    drawPreparedFurnishedInterior(ctx, this.atlas, this.map, this.objects, actors, this.layers);
  }
}
