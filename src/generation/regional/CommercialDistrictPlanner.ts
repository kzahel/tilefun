import {
  cityCrossingPieces,
  type SurfacePiece,
  type SurfaceRect,
} from "../../road/CitySurfaceRecipes.js";
import { commercialSurfaceAt as encodeSurface } from "../../road/CommercialCitySurface.js";
import { RoadType } from "../../road/RoadType.js";
import { edgeHash } from "../RoadGenerator.js";
import { COMMERCIAL_CITY_ASSETS as art } from "./CommercialCityAssets.js";
import {
  connectedDenseDistrict,
  type DenseDistrictPlan,
  DenseDistrictSource,
  denseSurfaceAt,
  insideDenseBounds,
} from "./DenseDistrictPlanner.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { type Bounds, type Settlement, settlementForOwner } from "./RegionalPlanner.js";

export interface CommercialDistrictPlan extends DenseDistrictPlan {
  readonly recipe: "commercial-district-v1";
  readonly commercial: {
    extensions: Bounds[];
    crossings: { id: string; bounds: Bounds; landing: Bounds | null }[];
    parking: { id: string; bounds: Bounds; occupied: boolean; facing: "east" | "west" }[];
    walkways: Bounds[];
    furnishingZones: Bounds[];
    furniture: FeaturePlacement[];
    /** Source-backed paint/islands, in native pixels. No prop colliders here. */
    overlays: SurfacePiece[];
  };
}
function template(id: string) {
  const t = art.templates.find((t) => t.caseId === id);
  if (!t) throw new Error("Missing promoted place template");
  return { ...t, overlays: t.overlays as unknown as SurfacePiece[] };
}
const shifted = (p: SurfacePiece, dx: number, dy: number): SurfacePiece => ({
  ...p,
  x: p.x + dx * 16,
  y: p.y + dy * 16,
});

/** One owner-local place plan: a wider commercial avenue, north-side bays,
 * refuge crossing and shorter east crossing. Native south-facing facades and
 * door paths reuse the dense layout rather than making a second showcase. */
export function commercialDistrict(settlement: Settlement, seed: number): CommercialDistrictPlan {
  const base = connectedDenseDistrict(settlement, seed, true),
    { x, y } = base.center;
  const id = `${settlement.id}:commercial-district-v1`,
    rect = (minX: number, minY: number, maxX: number, maxY: number) => ({
      minX: x + minX,
      minY: y + minY,
      maxX: x + maxX,
      maxY: y + maxY,
    });
  const parkingTemplate = template("surface-v2-parking"),
    refugeTemplate = template("surface-v2-refuge");
  const extensions = [
    ...parkingTemplate.geometry.sidewalkExtensions.map((b) =>
      rect(7 + b.minX / 16, -6, 7 + b.maxX / 16, -4),
    ),
    rect(33, -6, 37, -4),
    rect(33, 4, 37, 6),
  ];
  const parking = parkingTemplate.geometry.parking.map((b, slot) => ({
    id: `${id}:bay:${slot}`,
    bounds: rect(7 + b.minX / 16, -6, 7 + b.maxX / 16, -4),
    occupied: slot !== seed % 3,
    facing:
      edgeHash(slot, settlement.owner.cx, seed + 29003) < 0.5
        ? ("east" as const)
        : ("west" as const),
  }));
  const crossings = [
    { id: `${id}:crossing:refuge`, bounds: rect(-24, -6, -22, 6), landing: rect(-24, -1, -22, 1) },
    { id: `${id}:crossing:east`, bounds: rect(34, -4, 36, 4), landing: null },
  ];
  const overlays: SurfacePiece[] = refugeTemplate.overlays
    .filter((p) => p.role === "median")
    .map((p) => shifted(p as SurfacePiece, x - 39, y - 12));
  overlays.push(
    ...parkingTemplate.overlays
      .filter((p) => p.label === "Marked curbside parking bay")
      .map((p) => shifted(p as SurfacePiece, x + 7, y - 14)),
  );
  const clip = (label: string): SurfaceRect => {
    const p = refugeTemplate.overlays.find((p) => p.label === label);
    if (!p) throw new Error("Missing promoted crossing clip");
    return p.rect as SurfaceRect;
  };
  const clips = {
    entry: clip("Crossing entry at sidewalk"),
    stripe: clip("Zebra crossing"),
    exit: clip("Crossing exit at sidewalk"),
  };
  for (const c of crossings)
    overlays.push(
      ...cityCrossingPieces(
        [{ x: c.bounds.minX * 16, width: 32, top: c.bounds.minY * 16, bottom: c.bounds.maxY * 16 }],
        c.landing ? { minY: c.landing.minY * 16, maxY: c.landing.maxY * 16 } : null,
        clips,
      ),
    );
  // Paint is omitted at corners, crossing sight lines and the refuge island.
  for (const street of base.streets) {
    const a = street.points[0];
    if (!a) throw new Error("Missing street anchor");
    const horizontal = street.points[1]?.y === a.y;
    for (
      let n = horizontal ? base.bounds.minX : base.bounds.minY;
      n < (horizontal ? base.bounds.maxX : base.bounds.maxY);
      n++
    ) {
      if (n % 2 !== 0) continue;
      const nearJunction = base.streets.some((s) => {
        const p = s.points[0];
        return (
          p &&
          (s.points[1]?.y === p.y) !== horizontal &&
          Math.abs(n - (horizontal ? p.x : p.y)) < s.width / 2 + 5
        );
      });
      if (nearJunction) continue;
      if (
        horizontal &&
        a.y === y &&
        ((n >= x - 34 && n < x - 12) ||
          crossings.some((c) => n >= c.bounds.minX - 3 && n < c.bounds.maxX + 3))
      )
        continue;
      overlays.push({
        label: "Promoted lane divider",
        rect: horizontal ? [32, 1968, 16, 16] : [16, 1984, 16, 16],
        x: (horizontal ? n : a.x - 0.5) * 16,
        y: (horizontal ? a.y - 0.5 : n) * 16,
        role: "paint",
      });
    }
  }
  const furniture: FeaturePlacement[] = [],
    add = (suffix: string, propType: string, tx: number, ty: number) =>
      furniture.push({ featureId: `${id}:${suffix}`, propType, wx: tx * 16, wy: ty * 16 });
  for (const [slot, bay] of parking.entries()) {
    const bx = (bay.bounds.minX + bay.bounds.maxX) / 2;
    add(`meter:${slot}`, "prop-city-commercial-v1-meter", bx, y - 6.5);
    if (bay.occupied)
      add(`car:${slot}`, `prop-city-commercial-v1-car-${bay.facing}`, bx, y - 5 + 10 / 16);
  }
  add("lamp:west", "prop-street-lamp", x + 8, y - 6.5);
  add("lamp:east", "prop-street-lamp", x + 39, y - 6.5);
  add("bench", "prop-bench", x + 17, y - 6.75);
  add("bin", "prop-city-commercial-v1-bin-blue", x + 23, y - 6.5);
  add("planter", "prop-city-commercial-v1-planter", x + 31, y - 6.5);
  const walkways = [
    rect(5, -10, 40, -8),
    rect(5, 8, 40, 10),
    rect(-40, -10, -5, -8),
    rect(-40, 8, -5, 10),
  ];
  const actors = base.actors.filter((a) => !a.featureId.includes(":crossing:"));
  for (const c of crossings)
    actors.push({
      featureId: `${c.id}:walker`,
      type: "person7",
      wx: (c.bounds.minX + 1) * 16,
      wy: (y - 8.5) * 16,
      route: [
        { wx: (c.bounds.minX + 1) * 16, wy: (y - 8.5) * 16 },
        { wx: (c.bounds.minX + 1) * 16, wy: (y + 8.5) * 16 },
      ],
    });
  return {
    ...base,
    id,
    recipe: "commercial-district-v1",
    actors,
    commercial: {
      extensions,
      crossings,
      parking,
      walkways,
      furnishingZones: [rect(5, -8, 40, -6)],
      furniture,
      overlays,
    },
  };
}
export function commercialRoadAt(plan: CommercialDistrictPlan, x: number, y: number): boolean {
  if (plan.commercial.extensions.some((b) => insideDenseBounds(b, x, y))) return false;
  return plan.streets.some((s) => {
    const a = s.points[0];
    if (!a) return false;
    return s.points[1]?.y === a.y
      ? y >= a.y - s.width / 2 && y < a.y + s.width / 2
      : x >= a.x - s.width / 2 && x < a.x + s.width / 2;
  });
}
export function commercialDistrictSurfaceAt(
  plan: CommercialDistrictPlan,
  x: number,
  y: number,
): number {
  const road = (x: number, y: number) => commercialRoadAt(plan, x, y);
  const paved =
    road(x, y) ||
    plan.commercial.extensions.some((b) => insideDenseBounds(b, x, y)) ||
    plan.streets.some((s) => {
      const a = s.points[0];
      if (!a) return false;
      return (
        Math.abs(s.points[1]?.y === a.y ? y + 0.5 - a.y : x + 0.5 - a.x) < s.width / 2 + s.sidewalk
      );
    }) ||
    denseSurfaceAt(plan, x, y) === RoadType.CityPavement;
  return paved ? encodeSurface(x, y, road, plan.commercial.overlays) : RoadType.None;
}
export class CommercialDistrictSource extends DenseDistrictSource {
  private commercialCache = new Map<string, CommercialDistrictPlan | null>();
  override owner(cx: number, cy: number): CommercialDistrictPlan | null {
    const key = `${cx},${cy}`;
    if (this.commercialCache.has(key)) return this.commercialCache.get(key) ?? null;
    const settlement = settlementForOwner(this.world, cx, cy),
      plan = settlement ? commercialDistrict(settlement, this.world.seed) : null;
    this.commercialCache.set(key, plan);
    if (this.commercialCache.size > 16)
      this.commercialCache.delete(this.commercialCache.keys().next().value ?? "");
    return plan;
  }
}
