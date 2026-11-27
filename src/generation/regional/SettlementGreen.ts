import { RoadType } from "../../road/RoadType.js";
import { type DenseDistrictPlan, insideDenseBounds } from "./DenseDistrictPlanner.js";
export function greenSurfaceAt(plan: DenseDistrictPlan, x: number, y: number): RoadType {
  for (const block of plan.blocks.filter((b) => b.kind === "park")) {
    const p = block.bounds,
      px = (p.minX + p.maxX) / 2,
      py = (p.minY + p.maxY) / 2;
    if (
      p.minX === plan.park.minX &&
      p.minY === plan.park.minY &&
      (plan.playYard ?? 0) >= 0.72 &&
      x >= px - 12 &&
      x < px - 2 &&
      y >= py - 10 &&
      y < py - 1
    )
      return RoadType.CityPavement;
    if (insideDenseBounds(p, x, y) && (Math.abs(x + 0.5 - px) < 1 || Math.abs(y + 0.5 - py) < 1))
      return RoadType.CityPavement;
  }
  return RoadType.None;
}
