import type { Entity } from "../entities/Entity.js";

const CELL = 32;
const cell = (wx: number, wy: number) =>
  (Math.floor(wx / CELL) + 0x100000) * 0x200000 + Math.floor(wy / CELL) + 0x100000;

let indexed: readonly Entity[] | undefined;
let grid: Map<number, Entity[]> | undefined;

/** One decision pass over `animals`: poses are fixed until physics integrates, so
 * hop planners may share one grid of the solid bodies instead of each scanning
 * the whole population per candidate. Outside a pass the same question scans. */
export function duringDecisions<T>(animals: readonly Entity[], decide: () => T): T {
  const outer = indexed,
    outerGrid = grid;
  indexed = animals;
  grid = undefined;
  try {
    return decide();
  } finally {
    indexed = outer;
    grid = outerGrid;
  }
}

function build(animals: readonly Entity[]) {
  const cells = new Map<number, Entity[]>();
  for (const a of animals) {
    if (!a.collider?.solid) continue;
    const key = cell(a.position.wx, a.position.wy);
    const bucket = cells.get(key);
    if (bucket) bucket.push(a);
    else cells.set(key, [a]);
  }
  return cells;
}

/** Whether a solid body other than `self` has its origin within `radius` of `point`
 * (strictly), optionally also satisfying `also`. */
export function solidWithin(
  animals: readonly Entity[],
  self: Entity,
  point: { wx: number; wy: number },
  radius: number,
  also?: (other: Entity) => boolean,
): boolean {
  const near = (a: Entity) =>
    a !== self &&
    !!a.collider?.solid &&
    Math.hypot(point.wx - a.position.wx, point.wy - a.position.wy) < radius &&
    (!also || also(a));
  if (animals !== indexed || !Number.isFinite(radius)) return animals.some(near);
  grid ??= build(animals);
  const left = Math.floor((point.wx - radius) / CELL),
    right = Math.floor((point.wx + radius) / CELL),
    top = Math.floor((point.wy - radius) / CELL),
    bottom = Math.floor((point.wy + radius) / CELL);
  for (let cx = left; cx <= right; cx++)
    for (let cy = top; cy <= bottom; cy++) {
      const bucket = grid.get((cx + 0x100000) * 0x200000 + cy + 0x100000);
      if (bucket) for (const a of bucket) if (near(a)) return true;
    }
  return false;
}
