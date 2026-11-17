import {
  currentDenseDistrict,
  type DenseDistrictPlan,
  denseDistrict,
} from "./DenseDistrictPlanner.js";
import { type Bounds, intersects, REGION_SIZE, settlementForOwner } from "./RegionalPlanner.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Bounded working memory for district plans, including missing owners. */
export class DenseDistrictSource {
  private readonly cache = new Map<string, DenseDistrictPlan | null>();
  constructor(
    readonly world: RegionalWorld,
    private readonly connectEntrances = false,
  ) {}
  owner(cx: number, cy: number): DenseDistrictPlan | null {
    const key = `${cx},${cy}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const settlement = settlementForOwner(this.world, cx, cy),
      plan = settlement
        ? this.connectEntrances
          ? currentDenseDistrict(settlement, this.world.seed)
          : denseDistrict(settlement, this.world.seed)
        : null;
    this.cache.set(key, plan);
    if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value ?? "");
    return plan;
  }
  at(x: number, y: number): DenseDistrictPlan | null {
    const plan = this.owner(Math.floor(x / REGION_SIZE), Math.floor(y / REGION_SIZE));
    if (!plan) return null;
    const { minX, minY, maxX, maxY } = plan.bounds;
    return x >= minX && x < maxX && y >= minY && y < maxY ? plan : null;
  }
  query(bounds: Bounds): DenseDistrictPlan[] {
    const plans: DenseDistrictPlan[] = [];
    const minCx = Math.floor(bounds.minX / REGION_SIZE),
      maxCx = Math.floor(bounds.maxX / REGION_SIZE);
    const minCy = Math.floor(bounds.minY / REGION_SIZE),
      maxCy = Math.floor(bounds.maxY / REGION_SIZE);
    if ((maxCx - minCx + 1) * (maxCy - minCy + 1) > 16) return plans;
    for (let cy = minCy; cy <= maxCy; cy++)
      for (let cx = minCx; cx <= maxCx; cx++) {
        const plan = this.owner(cx, cy);
        if (plan && intersects(plan.bounds, bounds)) plans.push(plan);
      }
    return plans;
  }
}
