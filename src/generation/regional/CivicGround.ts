import { TerrainId } from "../../autotile/TerrainId.js";
import type { CivicSite } from "./CivicSites.js";
import { insideDenseBounds } from "./PlanGeometry.js";

export function civicGround(sites: readonly CivicSite[], x: number, y: number): TerrainId {
  const s = sites.find((s) => insideDenseBounds(s.bounds, x, y));
  if (!s) return TerrainId.Grass;
  const dx = x - s.center.x,
    dy = y - s.center.y;
  if (s.kind === "salvage" && Math.abs(dx) < 12 && dy >= -10 && dy < 8) return TerrainId.DirtWarm;
  if (
    s.kind === "nursery" &&
    dy >= 5 &&
    dy <= 7 &&
    ((dx >= 2 && dx <= 10) || (dx >= -9 && dx <= -3))
  )
    return TerrainId.DirtLight;
  if (
    s.kind === "school" &&
    dx >= 3 &&
    dx <= 12 &&
    dy >= 1 &&
    dy <= 10 &&
    (dx <= 3.5 || dx >= 11.5 || dy <= 1.5 || dy >= 9.5 || Math.abs(dy - 5.5) < 0.3)
  )
    return TerrainId.SandLight;
  return TerrainId.Grass;
}
