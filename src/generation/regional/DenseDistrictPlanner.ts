import { TILE_SIZE } from "../../config/constants.js";
import { RoadType } from "../../road/RoadType.js";
import type { ActorPlacement } from "../Generator.js";
import { edgeHash } from "../RoadGenerator.js";
import { denseBuilding } from "./DenseCityAssets.js";
import { denseDoorThresholds } from "./DenseDoorThresholds.js";
import type { DistrictBlock, DistrictPlan, DistrictStreet } from "./DistrictPlanner.js";
import { DistrictSource } from "./DistrictStrategy.js";
import { type Bounds, type Settlement, settlementForOwner } from "./RegionalPlanner.js";

export interface DenseDistrictPlan extends DistrictPlan {
  readonly recipe: "dense-district-v1" | "dense-district-v2";
  readonly center: { x: number; y: number };
  readonly actors: ActorPlacement[];
  /** Absent in frozen v4. Threshold-to-sidewalk connections belong to v5. */
  readonly entrancePaths?: readonly {
    lotId: string;
    doorId: string;
    bounds: Bounds;
    threshold: { x: number; y: number };
    sidewalk: { x: number; y: number };
  }[];
}
export const insideDenseBounds = (b: Bounds, x: number, y: number) =>
  x >= b.minX && x < b.maxX && y >= b.minY && y < b.maxY;
function item<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error("Incomplete dense district geometry");
  return value;
}
const type = (suffix: string) => `prop-city-dense-v1-${suffix}`;

/** A compact 2×2 place recipe, then seeded family choice. All art faces south;
 * rear/side gaps remain landscaped rather than inventing rotated elevations.
 */
export function denseDistrict(settlement: Settlement, seed: number): DenseDistrictPlan {
  const { x, y } = settlement.center;
  const xs = [x - 44, x, x + 44],
    ys = [y - 40, y, y + 40];
  const bounds = { minX: x - 48, minY: y - 44, maxX: x + 48, maxY: y + 44 };
  const streets: DistrictStreet[] = [];
  for (const sx of xs)
    streets.push({
      id: `${settlement.id}:street:v:${sx}`,
      points: [
        { x: sx, y: bounds.minY },
        { x: sx, y: bounds.maxY },
      ],
      width: sx === x ? 8 : 6,
      sidewalk: 3,
      kind: sx === x ? "avenue" : "street",
    });
  for (const sy of ys)
    streets.push({
      id: `${settlement.id}:street:h:${sy}`,
      points: [
        { x: bounds.minX, y: sy },
        { x: bounds.maxX, y: sy },
      ],
      width: sy === y ? 8 : 6,
      sidewalk: 3,
      kind: sy === y ? "avenue" : "street",
    });
  const blocks: DistrictBlock[] = [],
    actors: ActorPlacement[] = [];
  let park: Bounds | undefined;
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++) {
      const left = item(xs, col),
        right = item(xs, col + 1),
        top = item(ys, row),
        bottom = item(ys, row + 1);
      const hl = left === x ? 4 : 3,
        hr = right === x ? 4 : 3,
        ht = top === y ? 4 : 3,
        hb = bottom === y ? 4 : 3;
      const b = {
        minX: left + hl + 3,
        maxX: right - hr - 3,
        minY: top + ht + 3,
        maxY: bottom - hb - 3,
      };
      const id = `${settlement.id}:block:${col}:${row}`;
      const kind = row === 1 && col === 1 ? "park" : row === 0 && col === 1 ? "shops" : "homes";
      const block: DistrictBlock = { id, bounds: b, kind, lots: [] };
      if (kind === "park") park = b;
      else {
        const variation = edgeHash(settlement.owner.cx, settlement.owner.cy, seed + 17303);
        const suffixes =
          kind === "shops"
            ? ["bakery-3", "butcher-2", "ice-cream-3", "gym-3"]
            : row === 1
              ? ["hotel-4-roof-sign", "condo-bay-3"]
              : variation < 0.5
                ? ["condo-bay-3", "condo-narrow-5"]
                : ["condo-bay-5", "condo-narrow-5"];
        const recipes = suffixes.map((s) => denseBuilding(type(s)));
        const total = recipes.reduce((n, p) => n + p.width / TILE_SIZE, 0),
          gap = (b.maxX - b.minX - total) / (recipes.length + 1);
        if (gap < 0) throw new Error("Dense frontage does not fit its lot");
        let cursor = b.minX + gap;
        for (const [slot, recipe] of recipes.entries()) {
          const anchor = { x: cursor + recipe.width / TILE_SIZE / 2, y: bottom - hb - 6 };
          const entrance = {
            x: anchor.x + recipe.entrance.dx / TILE_SIZE,
            y: anchor.y + recipe.entrance.dy / TILE_SIZE,
          };
          block.lots.push({
            id: `${id}:lot:${slot}`,
            bounds: {
              minX: cursor,
              minY: anchor.y - recipe.height / TILE_SIZE,
              maxX: cursor + recipe.width / TILE_SIZE,
              maxY: anchor.y + recipe.groundDepth / TILE_SIZE / 2,
            },
            buildingType: recipe.type,
            anchor,
            entrance,
            facing: "south",
          });
          cursor += recipe.width / TILE_SIZE + gap;
        }
      }
      blocks.push(block);
      const route = [
        { wx: (left + hl + 1.5) * 16, wy: (top + ht + 1.5) * 16 },
        { wx: (right - hr - 1.5) * 16, wy: (top + ht + 1.5) * 16 },
        { wx: (right - hr - 1.5) * 16, wy: (bottom - hb - 1.5) * 16 },
        { wx: (left + hl + 1.5) * 16, wy: (bottom - hb - 1.5) * 16 },
      ];
      actors.push({
        featureId: `${id}:walker`,
        type: `person${1 + Math.floor(edgeHash(col, row, seed) * 20)}`,
        wx: item(route, 0).wx,
        wy: item(route, 0).wy,
        route,
      });
    }
  actors.push({
    featureId: `${settlement.id}:crossing:walker`,
    type: "person7",
    wx: (x - 18) * 16,
    wy: (y - 6) * 16,
    route: [
      { wx: (x - 18) * 16, wy: (y - 6) * 16 },
      { wx: (x + 18) * 16, wy: (y - 6) * 16 },
    ],
  });
  if (!park) throw new Error("Missing dense pocket green");
  return {
    recipe: "dense-district-v1",
    center: { x, y },
    id: `${settlement.id}:dense-district-v1`,
    settlementId: settlement.id,
    bounds,
    streets,
    blocks,
    park,
    actors,
  };
}

export class DenseDistrictSource extends DistrictSource {
  private cache = new Map<string, DenseDistrictPlan | null>();
  constructor(
    world: DistrictSource["world"],
    private readonly connectEntrances = false,
  ) {
    super(world);
  }
  override owner(cx: number, cy: number): DenseDistrictPlan | null {
    const key = `${cx},${cy}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const settlement = settlementForOwner(this.world, cx, cy),
      plan = settlement
        ? this.connectEntrances
          ? connectedDenseDistrict(settlement, this.world.seed)
          : denseDistrict(settlement, this.world.seed)
        : null;
    this.cache.set(key, plan);
    if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value ?? "");
    return plan;
  }
  override at(x: number, y: number): DenseDistrictPlan | null {
    return super.at(x, y) as DenseDistrictPlan | null;
  }
  override query(bounds: Bounds): DenseDistrictPlan[] {
    return super.query(bounds) as DenseDistrictPlan[];
  }
}

/** Reuse the pinned building layout; revise approach paving and doorway alignment.
 * Interaction positions are outside collision and cannot stand in for the art's
 * door threshold. Start under the facade/last step and overlap the real sidewalk.
 */
export function connectedDenseDistrict(settlement: Settlement, seed: number): DenseDistrictPlan {
  const plan = denseDistrict(settlement, seed);
  const blocks = plan.blocks.map((block) => ({
    ...block,
    lots: block.lots.map((lot) => {
      const primary = denseDoorThresholds(denseBuilding(lot.buildingType)).find((d) => d.primary);
      if (!primary) throw new Error(`Missing primary doorway for ${lot.id}`);
      return { ...lot, entrance: { ...lot.entrance, x: lot.anchor.x + primary.dx / TILE_SIZE } };
    }),
  }));
  const entrancePaths = blocks.flatMap((block) =>
    block.lots.flatMap((lot) => {
      const doors = denseDoorThresholds(denseBuilding(lot.buildingType));
      const street = plan.streets.find(
        (s) =>
          item(s.points, 0).y === item(s.points, 1).y &&
          item(s.points, 0).y > lot.anchor.y &&
          item(s.points, 0).y - s.width / 2 - s.sidewalk === block.bounds.maxY,
      );
      if (!street) throw new Error(`No sidewalk for ${lot.id}`);
      return doors.map((door) => {
        const threshold = {
          x: lot.anchor.x + door.dx / TILE_SIZE,
          y: lot.anchor.y + door.dy / TILE_SIZE,
        };
        const sidewalk = {
          x: threshold.x,
          y: item(street.points, 0).y - street.width / 2 - street.sidewalk,
        };
        return {
          lotId: lot.id,
          doorId: door.id,
          threshold,
          sidewalk,
          bounds: {
            minX: Math.floor(threshold.x - door.width / TILE_SIZE / 2),
            maxX: Math.ceil(threshold.x + door.width / TILE_SIZE / 2),
            minY: threshold.y - 1,
            maxY: sidewalk.y + 1,
          },
        };
      });
    }),
  );
  return {
    ...plan,
    recipe: "dense-district-v2",
    id: `${settlement.id}:dense-district-v2`,
    blocks,
    entrancePaths,
  };
}
/** Surface facts are encoded in the existing persistent roadGrid; the shared
 * tile composer/renderer resolves their original art in both game and preview.
 */
export function denseSurfaceAt(plan: DenseDistrictPlan, x: number, y: number): RoadType {
  const onH = plan.streets.find(
    (s) =>
      item(s.points, 0).y === item(s.points, 1).y &&
      y >= item(s.points, 0).y - s.width / 2 &&
      y < item(s.points, 0).y + s.width / 2,
  );
  const onV = plan.streets.find(
    (s) =>
      item(s.points, 0).x === item(s.points, 1).x &&
      x >= item(s.points, 0).x - s.width / 2 &&
      x < item(s.points, 0).x + s.width / 2,
  );
  if (onH || onV) {
    if (onH && !onV) {
      const near = plan.streets.find(
        (s) =>
          item(s.points, 0).x === item(s.points, 1).x &&
          (x === item(s.points, 0).x - s.width / 2 - 3 ||
            x === item(s.points, 0).x - s.width / 2 - 2 ||
            x === item(s.points, 0).x + s.width / 2 + 1 ||
            x === item(s.points, 0).x + s.width / 2 + 2),
      );
      const sy = item(onH.points, 0).y;
      if (near && y > sy - onH.width / 2 && y < sy + onH.width / 2 - 1) {
        const start =
          x < item(near.points, 0).x
            ? item(near.points, 0).x - near.width / 2 - 3
            : item(near.points, 0).x + near.width / 2 + 1;
        return x === start ? RoadType.CityCrossHLeft : RoadType.CityCrossHRight;
      }
      if (!near && x % 2 === 0) {
        if (y === sy - 1) return RoadType.CityLineHTop;
        if (y === sy) return RoadType.CityLineHBottom;
      }
    }
    if (onV && !onH) {
      const near = plan.streets.find(
        (s) =>
          item(s.points, 0).y === item(s.points, 1).y &&
          (y === item(s.points, 0).y - s.width / 2 - 3 ||
            y === item(s.points, 0).y - s.width / 2 - 2 ||
            y === item(s.points, 0).y + s.width / 2 + 1 ||
            y === item(s.points, 0).y + s.width / 2 + 2),
      );
      const sx = item(onV.points, 0).x;
      if (near && x > sx - onV.width / 2 && x < sx + onV.width / 2 - 1) {
        const start =
          y < item(near.points, 0).y
            ? item(near.points, 0).y - near.width / 2 - 3
            : item(near.points, 0).y + near.width / 2 + 1;
        return y === start ? RoadType.CityCrossVTop : RoadType.CityCrossVBottom;
      }
      if (!near && y % 2 === 0) {
        if (x === sx - 1) return RoadType.CityLineVLeft;
        if (x === sx) return RoadType.CityLineVRight;
      }
    }
    return RoadType.CityAsphalt;
  }
  if (
    plan.streets.some((s) => {
      const p = item(s.points, 0);
      return p.y === item(s.points, 1).y
        ? Math.abs(y + 0.5 - p.y) < s.width / 2 + 3
        : Math.abs(x + 0.5 - p.x) < s.width / 2 + 3;
    })
  )
    return RoadType.CityPavement;
  if (plan.entrancePaths) {
    if (plan.entrancePaths.some((p) => insideDenseBounds(p.bounds, x + 0.5, y + 0.5)))
      return RoadType.CityPavement;
  } else {
    for (const b of plan.blocks)
      for (const lot of b.lots)
        if (
          Math.abs(x + 0.5 - lot.entrance.x) < 1.5 &&
          y + 0.5 >= lot.entrance.y - 1 &&
          y < lot.entrance.y + 4
        )
          return RoadType.CityPavement;
  }
  const p = plan.park,
    px = (p.minX + p.maxX) / 2,
    py = (p.minY + p.maxY) / 2;
  if (insideDenseBounds(p, x, y) && (Math.abs(x + 0.5 - px) < 1 || Math.abs(y + 0.5 - py) < 1))
    return RoadType.CityPavement;
  return RoadType.None;
}
