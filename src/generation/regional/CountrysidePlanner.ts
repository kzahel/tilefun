import { TerrainId } from "../../autotile/TerrainId.js";
import { TILE_SIZE } from "../../config/constants.js";
import type { ActorPlacement } from "../Generator.js";
import { edgeHash } from "../RoadGenerator.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { pathDistance } from "./PlanGeometry.js";
import {
  type Bounds,
  intersects,
  type Point,
  plannedElevation,
  plannedMoisture,
  QUERY_LIMITS,
  queryRegion,
  REGION_SIZE,
  settlementForOwner,
} from "./RegionalPlanner.js";

export { pathDistance } from "./PlanGeometry.js";

import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export interface CountryPlan {
  id: string;
  kind: "farm" | "woodland";
  name: string;
  owner: { cx: number; cy: number };
  bounds: Bounds;
  center: Point;
  paths: Point[][];
  props: FeaturePlacement[];
  actors: ActorPlacement[];
}
const point = (x: number, y: number): Point => ({ x, y });
export class CountrySource {
  private cache = new Map<string, CountryPlan | null>();
  constructor(readonly world: RegionalWorld) {}
  private memo(key: string, build: () => CountryPlan | null): CountryPlan | null {
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const result = build();
    this.cache.set(key, result);
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value ?? "");
    return result;
  }
  private dry(x: number, y: number): boolean {
    return regionalTerrainForElevation(plannedElevation(this.world, x, y)) === TerrainId.Grass;
  }
  farm(cx: number, cy: number): CountryPlan | null {
    return this.memo(`farm:${cx},${cy}`, () => {
      const s = settlementForOwner(this.world, cx, cy);
      if (!s || s.kind !== "village") return null;
      const x = Math.ceil(s.bounds.maxX) + 26,
        y = s.center.y - 36;
      const bounds = { minX: x - 18, minY: y - 14, maxX: x + 18, maxY: y + 14 };
      for (let py = bounds.minY; py <= bounds.maxY; py += 4)
        for (let px = bounds.minX; px <= bounds.maxX; px += 4) if (!this.dry(px, py)) return null;
      const regional = queryRegion(this.world, {
        bounds,
        detail: "region",
        sampleStep: 64,
        limits: QUERY_LIMITS,
      });
      if (regional.connections.some((c) => intersects(c.bounds, bounds))) return null;
      const paths = [
        [point(s.center.x, s.center.y), point(x, s.center.y), point(x, y + 12)],
        [point(x - 15, y + 12), point(x + 15, y + 12)],
      ];
      for (const path of paths)
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1],
            b = path[i];
          if (!a || !b) continue;
          const length = Math.hypot(b.x - a.x, b.y - a.y),
            steps = Math.ceil(length / 2);
          for (let n = 0; n <= steps; n++)
            for (const offset of [-2, 0, 2])
              if (
                !this.dry(
                  a.x + ((b.x - a.x) * n) / steps + offset,
                  a.y + ((b.y - a.y) * n) / steps + offset,
                )
              )
                return null;
        }
      const id = `farm:${cx}:${cy}`;
      const props: FeaturePlacement[] = [
        {
          featureId: `${id}:shed`,
          propType: "prop-shed",
          wx: (x - 12) * TILE_SIZE,
          wy: (y - 5) * TILE_SIZE,
        },
      ];
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 5; col++)
          props.push({
            featureId: `${id}:crop:${col}:${row}`,
            propType: col % 2 ? "prop-regional-berries" : "prop-regional-seedling",
            wx: (x - 12 + col * 3) * TILE_SIZE,
            wy: (y + row * 2) * TILE_SIZE,
          });
      for (let row = 0; row < 4; row++)
        props.push({
          featureId: `${id}:sunflower:${row}`,
          propType: "prop-regional-sunflower",
          wx: (x + 3) * 16,
          wy: (y + row * 3) * 16,
        });
      const actors: ActorPlacement[] = [
        {
          featureId: `${id}:farmer`,
          type: `person${1 + Math.floor(edgeHash(cx, cy, this.world.seed + 31) * 20)}`,
          wx: (x - 12) * 16,
          wy: (y + 12) * 16,
          route: [
            { wx: (x - 12) * 16, wy: (y + 12) * 16 },
            { wx: (x + 12) * 16, wy: (y + 12) * 16 },
          ],
        },
        {
          featureId: `${id}:cow`,
          type: "cow",
          wx: (x + 9) * 16,
          wy: (y - 4) * 16,
          route: [
            { wx: (x + 9) * 16, wy: (y - 4) * 16 },
            { wx: (x + 9) * 16, wy: (y + 5) * 16 },
          ],
        },
        {
          featureId: `${id}:chicken`,
          type: "chicken",
          wx: (x + 14) * 16,
          wy: y * 16,
          route: [
            { wx: (x + 14) * 16, wy: y * 16 },
            { wx: (x + 14) * 16, wy: (y + 6) * 16 },
          ],
        },
      ];
      return {
        id,
        kind: "farm",
        name: `${s.name} farm`,
        owner: { cx, cy },
        bounds,
        center: point(x, y),
        paths,
        props,
        actors,
      };
    });
  }
  woodland(cx: number, cy: number): CountryPlan | null {
    return this.memo(`wood:${cx},${cy}`, () => {
      const x = cx * 128,
        y = cy * 128,
        bounds = { minX: x, minY: y, maxX: x + 128, maxY: y + 128 };
      if (plannedMoisture(this.world, x + 64, y + 64) <= 0.02) return null;
      const region = queryRegion(this.world, {
        bounds,
        detail: "region",
        sampleStep: 64,
        limits: QUERY_LIMITS,
      });
      if (region.settlements.some((s) => intersects(s.bounds, bounds))) return null;
      const blocked = (px: number, py: number) =>
        !this.dry(px, py) || region.connections.some((c) => pathDistance(c.points, px, py) <= 10);
      const loop = [
        point(x + 32, y + 32),
        point(x + 96, y + 32),
        point(x + 96, y + 96),
        point(x + 32, y + 96),
        point(x + 32, y + 32),
      ];
      // Admit an entire dry trail. No implicit bridge through water or trunk road.
      for (let py = y + 28; py <= y + 100; py += 4)
        for (let px = x + 28; px <= x + 100; px += 4)
          if (pathDistance(loop, px, py) <= 4 && blocked(px, py)) return null;
      const id = `woodland:${cx}:${cy}`,
        props: FeaturePlacement[] = [];
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++) {
          const px =
              x +
              8 +
              col * 16 +
              Math.floor(edgeHash(col, row, this.world.seed + cx * 11 + cy * 19) * 7) -
              3,
            py =
              y +
              8 +
              row * 16 +
              Math.floor(edgeHash(row, col, this.world.seed + cx * 31 + cy * 13) * 7) -
              3;
          if (
            blocked(px, py) ||
            pathDistance(loop, px, py) < 5 ||
            (Math.abs(px - x - 38) < 5 && Math.abs(py - y - 38) < 5) ||
            [-1, 1].some((dx) => [-1, 1].some((dy) => blocked(px + dx, py + dy)))
          )
            continue;
          props.push({
            featureId: `${id}:tree:${col}:${row}`,
            propType: "prop-oak-tree",
            wx: px * 16,
            wy: py * 16,
          });
          if (edgeHash(col, row, this.world.seed + cx * 17 + cy * 31) < 0.35)
            props.push({
              featureId: `${id}:mushroom:${col}:${row}`,
              propType: "prop-regional-mushroom",
              wx: (px + 3) * 16,
              wy: (py + 2) * 16,
            });
        }
      props.push({
        featureId: `${id}:picnic`,
        propType: "prop-picnic-table",
        wx: (x + 38) * 16,
        wy: (y + 38) * 16,
      });
      return {
        id,
        kind: "woodland",
        name: "Woodland loop",
        owner: { cx, cy },
        bounds,
        center: point(x + 64, y + 64),
        paths: [loop],
        props,
        actors: [
          {
            featureId: `${id}:crow`,
            type: "crow",
            wx: (x + 32) * 16,
            wy: (y + 32) * 16,
            route: loop.slice(0, -1).map((p) => ({ wx: p.x * 16, wy: p.y * 16 })),
          },
        ],
      };
    });
  }
  query(bounds: Bounds): CountryPlan[] {
    const plans: CountryPlan[] = [];
    const minX = Math.floor(bounds.minX / 128),
      maxX = Math.floor(bounds.maxX / 128),
      minY = Math.floor(bounds.minY / 128),
      maxY = Math.floor(bounds.maxY / 128);
    if ((maxX - minX + 1) * (maxY - minY + 1) > 144) return plans;
    for (let cy = minY; cy <= maxY; cy++)
      for (let cx = minX; cx <= maxX; cx++) {
        const p = this.woodland(cx, cy);
        if (p) plans.push(p);
      }
    for (
      let cy = Math.floor((bounds.minY - 160) / REGION_SIZE);
      cy <= Math.floor((bounds.maxY + 160) / REGION_SIZE);
      cy++
    )
      for (
        let cx = Math.floor((bounds.minX - 160) / REGION_SIZE);
        cx <= Math.floor((bounds.maxX + 160) / REGION_SIZE);
        cx++
      ) {
        const p = this.farm(cx, cy);
        if (
          p &&
          (intersects(p.bounds, bounds) ||
            p.paths.some((path) =>
              path.some(
                (v) =>
                  v.x >= bounds.minX - 128 &&
                  v.x <= bounds.maxX + 128 &&
                  v.y >= bounds.minY - 128 &&
                  v.y <= bounds.maxY + 128,
              ),
            ))
        )
          plans.push(p);
      }
    return plans;
  }
}
