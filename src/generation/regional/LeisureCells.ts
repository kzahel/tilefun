import type { Bounds } from "./RegionalPlanner.js";

/** Half-open bounds: a query ending on a seam never inspects the next owner. */
export function* leisureCells(b: Bounds, size: number, limit = Infinity) {
  const left = Math.floor(b.minX / size),
    top = Math.floor(b.minY / size);
  const right = Math.ceil(b.maxX / size),
    bottom = Math.ceil(b.maxY / size);
  if ((right - left) * (bottom - top) > limit) return;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) yield { x, y };
}
