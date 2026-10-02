import type { SurfacePiece } from "../../road/CitySurfaceRecipes.js";
import { commercialSurfaceAt } from "../../road/CommercialCitySurface.js";
import { RoadType } from "../../road/RoadType.js";
import { edgeHash } from "../RoadGenerator.js";
import { architectureDistrict } from "./CityArchitecturePlanner.js";
import { COMMERCIAL_CITY_ASSETS } from "./CommercialCityAssets.js";
import {
  type CommercialDistrictPlan,
  commercialDistrict,
  commercialDistrictSurfaceAt,
  commercialRoadAt,
} from "./CommercialDistrictPlanner.js";
import {
  type DenseDistrictPlan,
  DenseDistrictSource,
  insideDenseBounds,
} from "./DenseDistrictPlanner.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { publicSpace } from "./PublicSpaceRecipes.js";
import { type Bounds, type Settlement, settlementForOwner } from "./RegionalPlanner.js";

export type CityPlacesRevision = 7 | 8 | 9;
export interface CityPlace {
  id: string;
  kind: "parking-lot" | "pocket-park" | "neighborhood-park" | "square";
  paving?: Bounds[];
  bounds: Bounds;
  driving: Bounds[];
  paths: Bounds[];
  bays: { id: string; bounds: Bounds; occupied: boolean; facing: "east" | "west" }[];
  furniture: FeaturePlacement[];
  overlays: SurfacePiece[];
  entrances: { x: number; y: number; mode: "walking" | "driving" }[];
}
export interface CityPlacesPlan extends DenseDistrictPlan {
  recipe: "city-places-v7" | "city-places-v8" | "city-places-v9";
  commercial: CommercialDistrictPlan["commercial"];
  places: CityPlace[];
}
/** Shared place facts, in tiles; source-backed paint and prop anchors in pixels. */
export function parkingLot(id: string, bounds: Bounds, seed: number): CityPlace {
  const x = bounds.minX,
    y = bounds.minY;
  const furniture: FeaturePlacement[] = [],
    overlays: SurfacePiece[] = [],
    bays: CityPlace["bays"] = [];
  const marking = COMMERCIAL_CITY_ASSETS.templates
    .find((t) => t.caseId === "surface-v2-parking")
    ?.overlays.find((p) => p.label === "Marked curbside parking bay");
  if (!marking) throw new Error("Missing approved parking art");
  for (let row = 0; row < 2; row++)
    for (let slot = 0; slot < 3; slot++) {
      const bx = x + 2 + slot * 7,
        by = y + 2 + row * 12;
      const facing = edgeHash(slot, row, seed + 35137) < 0.5 ? "east" : "west";
      const occupied = edgeHash(slot, row, seed + 49117) > 0.32;
      const bayId = `${id}:bay:${row}:${slot}`;
      bays.push({
        id: bayId,
        bounds: { minX: bx, minY: by, maxX: bx + 5, maxY: by + 2 },
        occupied,
        facing,
      });
      overlays.push({
        ...marking,
        role: "paint",
        rect: marking.rect as [number, number, number, number],
        x: bx * 16,
        y: by * 16,
      });
      if (occupied)
        furniture.push({
          featureId: `${bayId}:car`,
          propType: `prop-city-commercial-v1-car-${facing}`,
          wx: (bx + 2.5) * 16,
          wy: (by + 1) * 16 + 10,
        });
    }
  furniture.push({
    featureId: `${id}:meter`,
    propType: "prop-city-commercial-v1-meter",
    wx: (x - 0.5) * 16,
    wy: (y + 19) * 16,
  });
  for (const dx of [5, 17])
    furniture.push({
      featureId: `${id}:tree:${dx}`,
      propType: "prop-oak-tree",
      wx: (x + dx) * 16,
      wy: (y - 1) * 16,
    });
  return {
    id,
    kind: "parking-lot",
    bounds,
    driving: [
      { ...bounds, maxY: bounds.maxY - 2 },
      { minX: bounds.maxX, minY: y + 7, maxX: bounds.maxX + 6, maxY: y + 13 },
    ],
    paths: [
      { minX: x, minY: y + 18, maxX: bounds.maxX, maxY: y + 20 },
      { minX: x + 11, minY: y + 18, maxX: x + 14, maxY: y + 25 },
    ],
    bays,
    furniture,
    overlays,
    entrances: [
      { x: bounds.maxX + 6, y: y + 10, mode: "driving" },
      { x: x + 12.5, y: y + 25, mode: "walking" },
    ],
  };
}
export function cityPlacesDistrict(
  settlement: Settlement,
  seed: number,
  revision: CityPlacesRevision,
): CityPlacesPlan {
  if (revision === 9)
    return architectureDistrict(
      cityPlacesDistrict(settlement, seed, 8),
      seed,
      `${settlement.id}:city-places-v9`,
    );
  const base = commercialDistrict(settlement, seed),
    { x, y } = base.center;
  const id = `${settlement.id}:city-places-v${revision}`;
  const lot = parkingLot(
    `${id}:parking`,
    { minX: x - 36, minY: y + 12, maxX: x - 10, maxY: y + 32 },
    seed,
  );
  const blocks = base.blocks.map((b) => (b.id.endsWith(":0:1") ? { ...b, lots: [] } : b));
  const removed = new Set(base.blocks.find((b) => b.id.endsWith(":0:1"))?.lots.map((l) => l.id));
  // Reserve service access before street paint, avoiding markings across its mouth.
  const overlays = base.commercial.overlays.filter(
    (p) => !(p.x / 16 >= x - 12 && p.x / 16 <= x + 2 && p.y / 16 >= y + 16 && p.y / 16 <= y + 28),
  );
  if (revision >= 8) {
    const nw = base.blocks.find((b) => b.id.endsWith(":0:0"));
    const home = nw?.lots[0];
    if (!home) throw new Error("Missing public-space residential frontage");
    const dx = x - 14 - home.anchor.x;
    const moved = {
      ...home,
      anchor: { ...home.anchor, x: home.anchor.x + dx },
      entrance: { ...home.entrance, x: home.entrance.x + dx },
      bounds: { ...home.bounds, minX: home.bounds.minX + dx, maxX: home.bounds.maxX + dx },
    };
    const publicBlocks = blocks.map((b) => (b.id === nw.id ? { ...b, lots: [moved] } : b));
    const remaining = new Set(publicBlocks.flatMap((b) => b.lots.map((l) => l.id)));
    return {
      ...base,
      id,
      recipe: "city-places-v8",
      blocks: publicBlocks,
      entrancePaths: (base.entrancePaths ?? [])
        .filter((p) => remaining.has(p.lotId))
        .map((p) =>
          p.lotId === home.id
            ? {
                ...p,
                threshold: { ...p.threshold, x: p.threshold.x + dx },
                sidewalk: { ...p.sidewalk, x: p.sidewalk.x + dx },
                bounds: { ...p.bounds, minX: p.bounds.minX + dx, maxX: p.bounds.maxX + dx },
              }
            : p,
        ),
      commercial: base.commercial,
      places: [
        publicSpace(`${id}:pocket`, "pocket-park", {
          minX: x - 37,
          minY: y - 33,
          maxX: x - 23,
          maxY: y - 10,
        }),
        publicSpace(`${id}:park`, "neighborhood-park", {
          minX: x - 37,
          minY: y + 10,
          maxX: x - 8,
          maxY: y + 33,
        }),
        publicSpace(`${id}:square`, "square", base.park),
      ],
    };
  }
  return {
    ...base,
    id,
    recipe: "city-places-v7",
    blocks,
    entrancePaths: (base.entrancePaths ?? []).filter((p) => !removed.has(p.lotId)),
    commercial: { ...base.commercial, overlays },
    places: [lot],
  };
}
export function cityPlacesSurfaceAt(plan: CityPlacesPlan, x: number, y: number): number {
  const road = (x: number, y: number) =>
    commercialRoadAt(plan as unknown as CommercialDistrictPlan, x, y) ||
    plan.places.some((p) => p.driving.some((b) => insideDenseBounds(b, x, y)));
  const paved =
    road(x, y) ||
    plan.places.some((p) =>
      [...p.paths, ...(p.paving ?? [])].some((b) => insideDenseBounds(b, x, y)),
    ) ||
    commercialDistrictSurfaceAt(plan as unknown as CommercialDistrictPlan, x, y) !== RoadType.None;
  return paved
    ? commercialSurfaceAt(x, y, road, [
        ...plan.commercial.overlays,
        ...plan.places.flatMap((p) => p.overlays),
      ])
    : RoadType.None;
}
export class CityPlacesSource extends DenseDistrictSource {
  private placesCache = new Map<string, CityPlacesPlan | null>();
  constructor(
    world: DenseDistrictSource["world"],
    readonly revision: CityPlacesRevision,
  ) {
    super(world);
  }
  override owner(cx: number, cy: number): CityPlacesPlan | null {
    const key = `${cx},${cy}`;
    if (this.placesCache.has(key)) return this.placesCache.get(key) ?? null;
    const settlement = settlementForOwner(this.world, cx, cy),
      plan = settlement ? cityPlacesDistrict(settlement, this.world.seed, this.revision) : null;
    this.placesCache.set(key, plan);
    if (this.placesCache.size > 16)
      this.placesCache.delete(this.placesCache.keys().next().value ?? "");
    return plan;
  }
}
