import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { Camera } from "../rendering/Camera.js";
import { type CanvasTerrainSource, drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { drawLayeredInteriorMap } from "../rendering/CanvasInteriorMap.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import type { FloorPlan } from "./ApartmentFloorPlan.js";
import type { FurniturePlacement, FurnitureRect } from "./FurnitureCatalog.js";
import {
  compileFurniture,
  furnishedSceneOrder,
  type PlacedFurniture,
  prepareFurnishedInterior,
} from "./FurnitureLayout.js";
import type { LayeredInteriorMap } from "./LayeredInteriorMap.js";

/** Neutral actor data; legacy Canvas composition adapters never accept callbacks. */
export interface FurnitureActor {
  id: string;
  depth: number;
  item: SceneItem;
}
export interface FurnitureCanvasAssets {
  sheets: Map<string, Spritesheet>;
  camera?: Camera;
  terrain?: CanvasTerrainSource;
}
const nativeCamera = new Camera();
nativeCamera.zoom = 1 / PIXEL_SCALE;
const emptySheets = new Map<string, Spritesheet>();

/** Initial catalog scenes use open room shells; complex interior-wall occlusion comes next. */
export function drawFurnishedInterior(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  map: LayeredInteriorMap,
  plan: FloorPlan,
  placements: readonly FurniturePlacement[],
  actors: readonly FurnitureActor[] = [],
  floorBounds?: FurnitureRect,
  actorAssets?: FurnitureCanvasAssets,
): void {
  const objects = prepareFurnishedInterior(map, plan, placements, floorBounds);
  drawPreparedFurnishedInterior(ctx, atlas, map, objects, actors, undefined, actorAssets);
}

export function drawPreparedFurnishedInterior(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  map: LayeredInteriorMap,
  objects: PlacedFurniture[],
  actors: readonly FurnitureActor[] = [],
  shellLayers?: { floor: CanvasImageSource; walls: CanvasImageSource },
  actorAssets?: FurnitureCanvasAssets,
): void {
  const draw = (o: PlacedFurniture) => {
    const entry = getModernInteriorsEntry(o.definition.key);
    if (!entry || entry.rect[2] !== o.definition.size[0] || entry.rect[3] !== o.definition.size[1])
      throw new Error(`Invalid furniture sprite: ${o.definition.id}`);
    ctx.drawImage(atlas, ...entry.rect, ...o.origin, ...o.definition.size);
  };
  if (shellLayers) ctx.drawImage(shellLayers.floor, 0, 0);
  else drawLayeredInteriorMap(ctx, atlas, map, ["floor"]);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(0, map.contentOffsetY ?? 0);
  for (const o of objects.filter((o) => o.definition.layer === "floor")) draw(o);
  ctx.restore();
  if (shellLayers) ctx.drawImage(shellLayers.walls, 0, 0);
  else drawLayeredInteriorMap(ctx, atlas, map, ["wall", "foreground", "objects"]);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(0, map.contentOffsetY ?? 0);
  for (const item of furnishedSceneOrder(objects, actors)) {
    if ("item" in item)
      drawScene2D(
        ctx,
        actorAssets?.camera ?? nativeCamera,
        [item.item],
        actorAssets?.sheets ?? emptySheets,
        undefined,
        false,
        actorAssets?.terrain,
      );
    else if (item.definition.layer !== "floor") draw(item);
  }
  ctx.restore();
}

/** Optional diagnostic overlay. It never becomes part of a visual approval hash. */
export function drawFurnitureFootprints(
  ctx: CanvasRenderingContext2D,
  plan: FloorPlan,
  placements: readonly FurniturePlacement[],
  offsetY = 0,
  floorBounds?: FurnitureRect,
): void {
  ctx.save();
  ctx.translate(0, offsetY);
  ctx.lineWidth = 1;
  for (const o of compileFurniture(plan, placements, floorBounds)) {
    if (o.definition.layer === "wall") continue;
    const r = o.footprint;
    ctx.strokeStyle = o.parent ? "#ffd36a" : o.definition.blocking ? "#ff719a" : "#70dfbf";
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
    if (o.definition.access) {
      const a = {
        ...o.definition.access,
        x: o.definition.access.x + o.x,
        y: o.definition.access.y + o.y,
      };
      ctx.strokeStyle = "#8dbbff";
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(a.x + 0.5, a.y + 0.5, a.width - 1, a.height - 1);
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}
