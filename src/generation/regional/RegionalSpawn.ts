import { plannedElevation, REGION_SIZE, settlementForOwner } from "./RegionalPlanner.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Bounded direct planning queries find a dry starting place without realizing an atlas. */
export function regionalStart(world: RegionalWorld): { x: number; y: number } {
  const candidates: { x: number; y: number }[] = [];
  for (let cy = -4; cy <= 4; cy++)
    for (let cx = -4; cx <= 4; cx++) {
      const settlement = settlementForOwner(world, cx, cy);
      if (settlement) candidates.push(settlement.center);
    }
  candidates.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || a.x - b.x || a.y - b.y);
  if (candidates[0]) return candidates[0];
  for (let radius = 0; radius <= 32; radius++) {
    for (let y = -radius; y <= radius; y++)
      for (let x = -radius; x <= radius; x++) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
        const point = { x: (x * REGION_SIZE) / 8, y: (y * REGION_SIZE) / 8 };
        if (plannedElevation(world, point.x, point.y) >= 0.06) return point;
      }
  }
  throw new Error("No dry starting place found within the Regional spawn budget.");
}
