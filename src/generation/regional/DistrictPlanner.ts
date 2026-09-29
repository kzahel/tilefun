import { TILE_SIZE } from "../../config/constants.js";
import { edgeHash } from "../RoadGenerator.js";
import { buildingRecipe } from "./BuildingRecipes.js";
import type { Bounds, Point, Settlement } from "./RegionalPlanner.js";

export interface DistrictStreet {
  id: string;
  points: Point[];
  width: number;
  sidewalk: number;
  kind: "avenue" | "street" | "alley";
}
export interface DistrictLot {
  id: string;
  bounds: Bounds;
  buildingType: string;
  anchor: Point;
  entrance: Point;
  facing: "south";
}
export interface DistrictBlock {
  id: string;
  bounds: Bounds;
  kind: "homes" | "shops" | "park";
  lots: DistrictLot[];
}
export interface DistrictPlan {
  style?: "market" | "garden" | "residential";
  id: string;
  settlementId: string;
  bounds: Bounds;
  streets: DistrictStreet[];
  blocks: DistrictBlock[];
  park: Bounds;
}

/** Owner-local connected hierarchy. No chunk, sprite loading, or recursive neighboring city solve. */
export function districtForSettlement(settlement: Settlement, seed: number): DistrictPlan {
  const city = settlement.kind === "city";
  const b = settlement.bounds;
  const margin = city ? 36 : 24;
  const x0 = Math.ceil(b.minX + margin),
    x1 = Math.floor(b.maxX - margin);
  const y0 = Math.ceil(b.minY + margin),
    y1 = Math.floor(b.maxY - margin);
  const center = settlement.center;
  const variation = Math.floor(
    edgeHash(settlement.owner.cx, settlement.owner.cy, seed + 7331) * 12,
  );
  const xs = [
    ...new Set([
      x0,
      center.x,
      ...(city ? [center.x - 56 - variation, center.x + 64 - variation] : []),
      x1,
    ]),
  ]
    .filter((x) => x >= x0 && x <= x1)
    .sort((a, b) => a - b);
  const ys = [
    ...new Set([
      y0,
      center.y,
      ...(city ? [center.y - 48 - variation, center.y + 52 - variation] : []),
      y1,
    ]),
  ]
    .filter((y) => y >= y0 && y <= y1)
    .sort((a, b) => a - b);
  const streets: DistrictStreet[] = [];
  for (const x of xs)
    streets.push({
      id: `${settlement.id}:street:v:${x}`,
      points: [
        { x, y: y0 },
        { x, y: y1 },
      ],
      width: x === center.x ? 8 : 6,
      sidewalk: 2,
      kind: x === center.x ? "avenue" : "street",
    });
  for (const y of ys)
    streets.push({
      id: `${settlement.id}:street:h:${y}`,
      points: [
        { x: x0, y },
        { x: x1, y },
      ],
      width: y === center.y ? 8 : 6,
      sidewalk: 2,
      kind: y === center.y ? "avenue" : "street",
    });
  const blocks: DistrictBlock[] = [];
  const parkColumn = Math.max(0, xs.indexOf(center.x) - 1);
  const parkRow = Math.max(0, ys.indexOf(center.y));
  let park: Bounds | null = null;
  for (let row = 0; row < ys.length - 1; row++)
    for (let col = 0; col < xs.length - 1; col++) {
      const left = xs[col],
        right = xs[col + 1],
        top = ys[row],
        bottom = ys[row + 1];
      if (left === undefined || right === undefined || top === undefined || bottom === undefined)
        continue;
      if (right - left < 20 || bottom - top < 20) continue;
      const bounds = { minX: left + 7, minY: top + 7, maxX: right - 7, maxY: bottom - 7 };
      const id = `${settlement.id}:block:${col}:${row}`;
      const kind =
        col === parkColumn && row === parkRow
          ? "park"
          : city && Math.abs(bottom - center.y) < 1
            ? "shops"
            : "homes";
      const lots: DistrictLot[] = [];
      if (kind === "park") park = bounds;
      else {
        const frontage = city ? 16 : 24;
        const count = Math.floor((bounds.maxX - bounds.minX) / frontage);
        for (let slot = 0; slot < count; slot++) {
          const lotId = `${id}:lot:${slot}`;
          const h = edgeHash(
            col * 19 + slot,
            row * 17,
            seed + settlement.owner.cx * 53 + settlement.owner.cy * 97,
          );
          const buildingType = city
            ? kind === "shops"
              ? h < 0.5
                ? "prop-regional-bakery"
                : "prop-regional-shop-apartment"
              : h < 0.5
                ? "prop-regional-apartment-2"
                : "prop-regional-apartment-3"
            : "prop-country-house";
          const x = bounds.minX + ((slot + 0.5) * (bounds.maxX - bounds.minX)) / count;
          const y = bottom - 10;
          const recipe = buildingRecipe(buildingType);
          const entrance = {
            x: x + (recipe?.entrance.dx ?? 0) / TILE_SIZE,
            y: y + (recipe?.entrance.dy ?? 4) / TILE_SIZE,
          };
          lots.push({
            id: lotId,
            bounds: {
              minX: x - frontage / 2,
              minY: Math.max(bounds.minY, y - 12),
              maxX: x + frontage / 2,
              maxY: bounds.maxY,
            },
            buildingType,
            anchor: { x, y },
            entrance,
            facing: "south",
          });
        }
        if (city && col % 2 === 1 && row % 2 === 0) {
          const x = Math.round((left + right) / 2);
          streets.push({
            id: `${id}:alley`,
            points: [
              { x, y: top },
              { x, y: (top + bottom) / 2 },
            ],
            width: 2,
            sidewalk: 1,
            kind: "alley",
          });
        }
      }
      blocks.push({ id, bounds, kind, lots });
    }
  if (!park) throw new Error("District has no viable park block.");
  return {
    id: `${settlement.id}:district`,
    settlementId: settlement.id,
    bounds: b,
    streets,
    blocks,
    park,
  };
}

/** A new revision composes the frozen block planner instead of rewriting its topology. */
export function settledDistrict(settlement: Settlement, seed: number): DistrictPlan {
  const plan = districtForSettlement(settlement, seed);
  const n = Math.floor(edgeHash(settlement.owner.cx, settlement.owner.cy, seed + 997) * 3);
  const style = (["market", "garden", "residential"] as const)[n] ?? "residential";
  if (settlement.kind === "city")
    for (const block of plan.blocks) {
      if (style === "garden" && block.kind === "homes")
        block.lots = block.lots.filter((_, i) => i % 2 === 0);
      if (style === "market" && block.kind === "homes")
        for (const [i, lot] of block.lots.entries())
          if (i % 3 === 0) {
            lot.buildingType = "prop-regional-bakery";
            const recipe = buildingRecipe(lot.buildingType);
            lot.entrance = {
              x: lot.anchor.x + (recipe?.entrance.dx ?? 0) / TILE_SIZE,
              y: lot.anchor.y + (recipe?.entrance.dy ?? 8) / TILE_SIZE,
            };
          }
    }
  return { ...plan, style };
}
