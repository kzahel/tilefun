import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import type { FloorPlan } from "./ApartmentFloorPlan.js";
import {
  FURNITURE_CATALOG_VERSION,
  type FurnitureDefinition,
  type FurniturePlacement,
  type FurnitureRect,
  furnitureDefinition,
  parseFurniturePlacements,
} from "./FurnitureCatalog.js";
import { drawLayeredInteriorMap, type LayeredInteriorMap } from "./LayeredInteriorMap.js";

export interface PlacedFurniture {
  placement: FurniturePlacement;
  definition: FurnitureDefinition;
  x: number;
  y: number;
  origin: [number, number];
  footprint: FurnitureRect;
  depth: number;
  parent?: PlacedFurniture;
}
const shifted = (r: FurnitureRect, x: number, y: number): FurnitureRect => ({
  ...r,
  x: r.x + x,
  y: r.y + y,
});
export const furnitureOverlaps = (a: FurnitureRect, b: FurnitureRect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const contains = (outer: FurnitureRect, inner: FurnitureRect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** No sprite/image work: validate semantic placements and resolve support relationships. */
export function compileFurniture(
  plan: FloorPlan,
  input: readonly FurniturePlacement[],
  floorBounds?: FurnitureRect | ((rect: FurnitureRect) => boolean),
): PlacedFurniture[] {
  const placements = parseFurniturePlacements(input);
  const resolved = new Map<string, PlacedFurniture>(),
    visiting = new Set<string>();
  const resolve = (p: FurniturePlacement): PlacedFurniture => {
    const prior = resolved.get(p.id);
    if (prior) return prior;
    if (visiting.has(p.id)) throw new Error(`Cyclic furniture support: ${p.id}`);
    visiting.add(p.id);
    const d = furnitureDefinition(p.asset);
    let parent: PlacedFurniture | undefined;
    if (p.on) {
      const host = placements.find((v) => v.id === p.on);
      if (!host) throw new Error(`Missing support for ${p.id}`);
      parent = resolve(host);
      if (d.layer !== "surface" || !parent.definition.surface)
        throw new Error(`Invalid support for ${p.id}`);
      if (!contains(parent.definition.surface, shifted(d.footprint, p.x, p.y)))
        throw new Error(`Object leaves support surface: ${p.id}`);
    } else if (d.layer === "surface") throw new Error(`Object requires a support: ${p.id}`);
    const x = p.x + (parent?.origin[0] ?? 0),
      y = p.y + (parent?.origin[1] ?? 0);
    const result: PlacedFurniture = {
      placement: p,
      definition: d,
      x,
      y,
      origin: [x - d.anchor[0], y - d.anchor[1]],
      footprint: shifted(d.footprint, x, y),
      depth: parent?.depth ?? y,
      ...(parent ? { parent } : {}),
    };
    resolved.set(p.id, result);
    visiting.delete(p.id);
    return result;
  };
  const objects = placements.map(resolve);
  const onFloor = (r: FurnitureRect) => {
    if (typeof floorBounds === "function") return floorBounds(r);
    if (floorBounds) return contains(floorBounds, r);
    for (let y = Math.floor(r.y / 32); y <= Math.floor((r.y + r.height - 1) / 32); y++)
      for (let x = Math.floor(r.x / 32); x <= Math.floor((r.x + r.width - 1) / 32); x++)
        if (!"LBKTH".includes(plan.rows[y]?.[x] ?? "!")) return false;
    return true;
  };
  for (const o of objects) {
    const d = o.definition;
    if (d.layer === "wall") {
      // First catalog round supports the visible north wall face only.
      const x = Math.floor(o.x / 32);
      if (
        o.y < 16 ||
        o.y > 31 ||
        plan.rows[0]?.[x] !== "#" ||
        !"LBKTH".includes(plan.rows[1]?.[x] ?? "!")
      )
        throw new Error(`Picture needs a north wall: ${o.placement.id}`);
    } else if (!o.parent && !onFloor(o.footprint))
      throw new Error(`Furniture leaves the floor or blocks a doorway: ${o.placement.id}`);
    if (d.access && !onFloor(shifted(d.access, o.x, o.y)))
      throw new Error(`Furniture access leaves the floor: ${o.placement.id}`);
    for (const other of objects) {
      if (o === other) continue;
      if (
        d.blocking &&
        other.definition.blocking &&
        furnitureOverlaps(o.footprint, other.footprint)
      )
        throw new Error(`Furniture collision: ${o.placement.id}, ${other.placement.id}`);
      if (o.parent && o.parent === other.parent && furnitureOverlaps(o.footprint, other.footprint))
        throw new Error(`Surface objects overlap: ${o.placement.id}, ${other.placement.id}`);
      if (
        d.access &&
        other.definition.blocking &&
        furnitureOverlaps(shifted(d.access, o.x, o.y), other.footprint)
      )
        throw new Error(`Furniture access blocked: ${o.placement.id}`);
    }
  }
  return objects;
}

/** A support and its children stay together at the support's ground depth. */
export function furnitureDrawOrder(objects: PlacedFurniture[]): PlacedFurniture[] {
  const order: PlacedFurniture[] = [];
  const sort = (a: PlacedFurniture, b: PlacedFurniture) =>
    a.depth - b.depth || a.y - b.y || a.placement.id.localeCompare(b.placement.id);
  const visit = (o: PlacedFurniture) => {
    order.push(o);
    for (const child of objects.filter((c) => c.parent === o).sort(sort)) visit(child);
  };
  for (const layer of ["floor", "wall", "standing"])
    for (const root of objects.filter((o) => !o.parent && o.definition.layer === layer).sort(sort))
      visit(root);
  return order;
}

export interface FurnitureActor {
  id: string;
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}
/** Actors sort at their feet, without splitting a table from its supported items. */
export function furnishedSceneOrder(
  objects: PlacedFurniture[],
  actors: readonly FurnitureActor[],
): (PlacedFurniture | FurnitureActor)[] {
  const pending = [...actors].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  const result: (PlacedFurniture | FurnitureActor)[] = [];
  for (const o of furnitureDrawOrder(objects)) {
    if (o.definition.layer === "standing" && !o.parent)
      while (pending[0] && pending[0].depth < o.depth) {
        const actor = pending.shift();
        if (actor) result.push(actor);
      }
    result.push(o);
  }
  return [...result, ...pending];
}

/** Metadata changes also reopen furniture verdicts, even when pixels stay identical. */
export function furnitureSignature(placements: readonly FurniturePlacement[]): string {
  return JSON.stringify({
    version: FURNITURE_CATALOG_VERSION,
    placements: [...placements].sort((a, b) => a.id.localeCompare(b.id)),
    definitions: [...new Set(placements.map((p) => p.asset))].sort().map(furnitureDefinition),
  });
}

/** Initial catalog scenes use open room shells; complex interior-wall occlusion comes next. */
export function drawFurnishedInterior(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  map: LayeredInteriorMap,
  plan: FloorPlan,
  placements: readonly FurniturePlacement[],
  actors: readonly FurnitureActor[] = [],
  floorBounds?: FurnitureRect,
): void {
  const objects = prepareFurnishedInterior(map, plan, placements, floorBounds);
  drawPreparedFurnishedInterior(ctx, atlas, map, objects, actors);
}

/** Validation belongs to changed room state, rather than every animation frame. */
export function prepareFurnishedInterior(
  map: LayeredInteriorMap,
  plan: FloorPlan,
  placements: readonly FurniturePlacement[],
  floorBounds?: FurnitureRect,
): PlacedFurniture[] {
  for (let y = 1; y < plan.height - 1; y++)
    if (plan.rows[y]?.slice(1, -1).some((c) => c === "#" || c === " "))
      throw new Error("Furniture catalog scenes currently require an open room shell");
  const objects = furnitureDrawOrder(compileFurniture(plan, placements, floorBounds));
  for (const o of objects) {
    const [x, y] = o.origin;
    if (
      x < 0 ||
      y + (map.contentOffsetY ?? 0) < 0 ||
      x + o.definition.size[0] > map.width * 16 ||
      y + (map.contentOffsetY ?? 0) + o.definition.size[1] > map.pixelHeight
    )
      throw new Error(`Furniture sprite leaves viewport: ${o.placement.id}`);
  }
  return objects;
}

export function drawPreparedFurnishedInterior(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  map: LayeredInteriorMap,
  objects: PlacedFurniture[],
  actors: readonly FurnitureActor[] = [],
  shellLayers?: { floor: CanvasImageSource; walls: CanvasImageSource },
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
    if ("draw" in item) item.draw(ctx);
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
      const a = shifted(o.definition.access, o.x, o.y);
      ctx.strokeStyle = "#8dbbff";
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(a.x + 0.5, a.y + 0.5, a.width - 1, a.height - 1);
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}
