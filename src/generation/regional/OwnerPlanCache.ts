import type { RegionalWorld } from "./WorldDescriptor.js";

interface Entries<T> {
  seed: number;
  values: Map<string, T>;
  cx?: number;
  cy?: number;
  last?: T;
  hasLast: boolean;
}
/** Bounded working memory per world identity, including negative/missing owners.
 * The last-owner fast path avoids coordinate strings in per-point terrain sampling. */
export class OwnerPlanCache<T> {
  private readonly worlds = new WeakMap<RegionalWorld, Entries<T>>();
  constructor(
    private readonly build: (world: RegionalWorld, cx: number, cy: number) => T,
    private readonly capacity = 128,
  ) {}
  get(world: RegionalWorld, cx: number, cy: number): T {
    let entries = this.worlds.get(world);
    if (!entries || entries.seed !== world.seed) {
      entries = { seed: world.seed, values: new Map(), hasLast: false };
      this.worlds.set(world, entries);
    }
    if (entries.hasLast && Object.is(entries.cx, cx) && Object.is(entries.cy, cy))
      return entries.last as T;
    const key = `${Object.is(cx, -0) ? "-0" : cx},${Object.is(cy, -0) ? "-0" : cy}`;
    let value: T;
    if (entries.values.has(key)) value = entries.values.get(key) as T;
    else {
      value = this.build(world, cx, cy);
      if (entries.values.size >= this.capacity) {
        const first = entries.values.keys().next();
        if (!first.done) entries.values.delete(first.value);
      }
      entries.values.set(key, value);
    }
    entries.cx = cx;
    entries.cy = cy;
    entries.last = value;
    entries.hasLast = true;
    return value;
  }
}
