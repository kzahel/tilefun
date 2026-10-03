import { reviewContext2D } from "../art/reviewCanvas.js";
import type { FloorPlan } from "./ApartmentFloorPlan.js";
import {
  compileFurniture,
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
  private readonly wallActors: FurnitureActor[] = [];
  private placementKey = "";
  private objects: ReturnType<typeof prepareFurnishedInterior> = [];
  constructor(
    private readonly atlas: CanvasImageSource,
    private readonly map: LayeredInteriorMap,
    private readonly plan: FloorPlan,
    private readonly floorBounds?: FurnitureRect | ((rect: FurnitureRect) => boolean),
    private readonly editable = false,
    review = false,
  ) {
    const raster = (layers: readonly InteriorLayer[]) => {
      const canvas = document.createElement("canvas");
      canvas.width = map.width * 16;
      // The nominal review viewport crops the south doorway. Gameplay also
      // draws that protruding threshold, so retain the complete cell extent.
      canvas.height = Math.max(map.pixelHeight, map.height * 16 + (map.contentOffsetY ?? 0));
      const ctx = review ? reviewContext2D(canvas) : canvas.getContext("2d");
      if (!ctx) throw new Error("Missing interior layer canvas");
      drawLayeredInteriorMap(ctx, atlas, map, layers);
      return canvas;
    };
    this.layers = { floor: raster(["floor"]), walls: raster(["wall", "foreground", "objects"]) };
    if (editable) {
      this.layers.walls
        .getContext("2d")
        ?.clearRect(0, 0, this.layers.walls.width, this.layers.walls.height);
      // Cache row bands once per revision. Interior partitions participate in
      // the same ground-depth ordering as furniture and actors.
      for (let y = 0; y < map.height; y += 2) {
        const rows = map.cells.slice(y, y + 2);
        if (
          !rows.some((r) => r.some((c) => c.wall.length || c.foreground.length || c.objects.length))
        )
          continue;
        const canvas = document.createElement("canvas");
        canvas.width = map.width * 16;
        canvas.height = 64;
        const ctx = review ? reviewContext2D(canvas) : canvas.getContext("2d");
        if (!ctx) throw new Error("Missing wall band canvas");
        ctx.translate(0, 16);
        drawLayeredInteriorMap(
          ctx,
          atlas,
          { ...map, height: rows.length, pixelHeight: 32, cells: rows },
          ["wall", "foreground", "objects"],
        );
        this.wallActors.push({
          id: `room-wall:${y}`,
          depth: y * 16 + 32,
          draw: (target) => target.drawImage(canvas, 0, y * 16 - 16),
        });
      }
    }
  }
  draw(
    ctx: CanvasRenderingContext2D,
    placements: readonly FurniturePlacement[],
    actors: readonly FurnitureActor[] = [],
  ): void {
    const key = JSON.stringify(placements);
    if (key !== this.placementKey) {
      this.objects = this.editable
        ? compileFurniture(this.plan, placements, this.floorBounds)
        : prepareFurnishedInterior(
            this.map,
            this.plan,
            placements,
            typeof this.floorBounds === "function" ? undefined : this.floorBounds,
          );
      this.placementKey = key;
    }
    drawPreparedFurnishedInterior(
      ctx,
      this.atlas,
      this.map,
      this.objects,
      [...this.wallActors, ...actors],
      this.layers,
    );
  }
}
