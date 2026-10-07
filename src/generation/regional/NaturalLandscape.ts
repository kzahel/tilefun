import { TerrainId } from "../../autotile/TerrainId.js";
import { FOREST_KITS, FOREST_ROW_STEP, forestRowType } from "../../patterns/ForestThicket.js";
import { nearestRail } from "../../railway/RailPath.js";
import { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import { fbm, valueNoise } from "../noise.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { pathDistance } from "./PlanGeometry.js";
import {
  type Bounds,
  intersects,
  plannedElevation,
  plannedMoisture,
  QUERY_LIMITS,
  queryRegion,
} from "./RegionalPlanner.js";
import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export const LANDSCAPE_PROFILES = ["sparse", "balanced", "lush", "thicket"] as const;
export const landscapeLabel = (profile: LandscapeProfile) =>
  profile === "thicket" ? "Extra dense · forest patterns" : profile;
export type LandscapeProfile = (typeof LANDSCAPE_PROFILES)[number];
export function landscapeProfile(value: unknown): LandscapeProfile | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!LANDSCAPE_PROFILES.includes(value as LandscapeProfile))
    throw new Error("Unknown landscape preview");
  return value as LandscapeProfile;
}
export const LANDSCAPE_SETTINGS = {
  sparse: { cover: -0.12, density: 0.68, scatter: 0.009, ponds: 0.2 },
  balanced: { cover: 0, density: 0.86, scatter: 0.018, ponds: 0.32 },
  lush: { cover: 0.12, density: 0.98, scatter: 0.03, ponds: 0.44 },
  thicket: { cover: 0.25, density: 0.98, scatter: 0.03, ponds: 0.44 },
} as const;
export interface NaturalPond {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  bounds: Bounds;
}
export type Habitat = "meadow" | "grove" | "forest";
export interface ForestRow extends FeaturePlacement {
  bounds: Bounds;
  ground: Bounds;
  kit: number;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const rect = (x: number, y: number, r: number): Bounds => ({
  minX: x - r,
  minY: y - r,
  maxX: x + r,
  maxY: y + r,
});
const near = (b: Bounds, x: number, y: number, r: number) => intersects(b, rect(x, y, r));

/** Coordinate-addressable natural cover. Geographic noise is not physical height. */
export function naturalHabitat(
  world: RegionalWorld,
  profile: LandscapeProfile,
  x: number,
  y: number,
) {
  const settings = LANDSCAPE_SETTINGS[profile];
  const broad =
    fbm(x / 290, y / 290, world.seed + 7013, 2) * 0.65 +
    plannedMoisture(world, x, y) * 0.35 +
    settings.cover;
  const grove = fbm(x / 54, y / 54, world.seed + 7027, 2);
  const clearing = valueNoise(x / 26, y / 26, world.seed + 7043);
  const cover = clamp((broad + grove * 0.28 + 0.08) * 2.8);
  const openness = clamp((0.8 - clearing) * 5);
  const density = settings.scatter + cover * openness * settings.density;
  const habitat: Habitat = density > 0.48 ? "forest" : density > 0.13 ? "grove" : "meadow";
  return { density, habitat };
}

/** Bounded cells own ponds and reservation caches; tree IDs use an independent 4-tile lattice. */
export class NaturalLandscape {
  readonly railways: RailwayPlanner;
  private reservations = new Map<string, ReturnType<NaturalLandscape["buildReservations"]>>();
  private ponds = new Map<string, NaturalPond | null>();
  private forests = new Map<string, ForestRow[]>();
  constructor(
    readonly world: RegionalWorld,
    readonly profile: LandscapeProfile,
  ) {
    landscapeProfile(profile);
    this.railways = new RailwayPlanner(world);
  }
  private buildReservations(cx: number, cy: number) {
    const bounds = {
      minX: cx * 128 - 40,
      minY: cy * 128 - 40,
      maxX: (cx + 1) * 128 + 40,
      maxY: (cy + 1) * 128 + 40,
    };
    const region = queryRegion(this.world, {
      bounds,
      detail: "region",
      sampleStep: 128,
      limits: QUERY_LIMITS,
    });
    return { region, lines: this.railways.query(bounds) };
  }
  /** r includes the proposed feature's footprint/visual clearance. */
  reserved(x: number, y: number, r = 3): boolean {
    const cx = Math.floor(x / 128),
      cy = Math.floor(y / 128),
      key = `${cx},${cy}`;
    let plans = this.reservations.get(key);
    if (!plans) {
      plans = this.buildReservations(cx, cy);
      this.reservations.set(key, plans);
      if (this.reservations.size > 64)
        this.reservations.delete(this.reservations.keys().next().value ?? "");
    }
    if (plans.region.settlements.some((s) => near(s.bounds, x, y, r + 4))) return true;
    if (plans.region.connections.some((c) => pathDistance(c.points, x, y) <= c.width / 2 + r))
      return true;
    return plans.lines.some((line) => {
      if (
        line.stations.some((s) => near(s.platform, x, y, r) || near(s.access, x, y, r)) ||
        line.bridges.some((b) => near(b.bounds, x, y, r))
      )
        return true;
      return line.path
        ? nearestRail(line.path, x * 16, y * 16).distance <= (7 + r) * 16
        : x >= line.start - r && x <= line.end + r && Math.abs(y - line.y) <= 3 + r;
    });
  }
  private dry(x: number, y: number) {
    return regionalTerrainForElevation(plannedElevation(this.world, x, y)) === TerrainId.Grass;
  }
  pond(cx: number, cy: number): NaturalPond | null {
    const key = `${cx},${cy}`;
    if (this.ponds.has(key)) return this.ponds.get(key) ?? null;
    const h = (salt: number) => valueNoise(cx, cy, this.world.seed + salt);
    let pond: NaturalPond | null = null;
    if (h(7101) < LANDSCAPE_SETTINGS[this.profile].ponds) {
      const x = cx * 128 + 28 + h(7109) * 72,
        y = cy * 128 + 28 + h(7121) * 72;
      const rx = 6 + h(7127) * 8,
        ry = 5 + h(7129) * 6,
        radius = Math.max(rx, ry) * 1.5 + 2;
      let valid = !this.reserved(x, y, radius);
      for (let dy = -radius; dy <= radius && valid; dy += 2)
        for (let dx = -radius; dx <= radius && valid; dx += 2) valid = this.dry(x + dx, y + dy);
      if (valid) pond = { id: `pond:${cx}:${cy}`, x, y, rx, ry, bounds: rect(x, y, radius) };
    }
    this.ponds.set(key, pond);
    if (this.ponds.size > 128) this.ponds.delete(this.ponds.keys().next().value ?? "");
    return pond;
  }
  pondAt(x: number, y: number) {
    // Centers and their complete banks are contained by the owner cell.
    const pond = this.pond(Math.floor(x / 128), Math.floor(y / 128));
    if (!pond || !near(pond.bounds, x, y, 0.01)) return undefined;
    const radius = Math.hypot((x - pond.x) / pond.rx, (y - pond.y) / pond.ry);
    const edge = 1 + fbm(x / 9, y / 9, this.world.seed + 7151, 2) * 0.18;
    return { pond, distance: radius / edge };
  }
  terrain(x: number, y: number): TerrainId {
    const base = regionalTerrainForElevation(plannedElevation(this.world, x, y));
    const local = this.pondAt(x, y);
    if (!local) return base;
    if (local.distance < 0.65) return TerrainId.DeepWater;
    if (local.distance < 1) return TerrainId.ShallowWater;
    if (local.distance < 1.1) return TerrainId.Sand;
    if (local.distance < 1.23) return TerrainId.SandLight;
    return base;
  }
  /** Bounded 128-tile owners hold irregular forest masses. Rows retain native
   * periods and overlap; phases use global row coordinates, never chunk order. */
  forest(cx: number, cy: number): ForestRow[] {
    if (this.profile !== "thicket") return [];
    const key = `${cx},${cy}`;
    const cached = this.forests.get(key);
    if (cached) return cached;
    const h = (salt: number) => valueNoise(cx, cy, this.world.seed + salt);
    const x = cx * 128 + 64 + (h(7301) - 0.5) * 20;
    const y = cy * 128 + 64 + (h(7309) - 0.5) * 20;
    const rows: ForestRow[] = [];
    if (naturalHabitat(this.world, this.profile, x, y).density > 0.45 && h(7319) < 0.85) {
      const kit = FOREST_KITS[Math.min(2, Math.floor(h(7321) * 3))];
      if (!kit) throw new Error("Missing forest kit");
      const rx = 28 + h(7331) * 12,
        ry = 20 + h(7333) * 12;
      for (let row = Math.ceil((y - ry) / 3); row <= Math.floor((y + ry) / 3); row++) {
        const wy = row * FOREST_ROW_STEP;
        const half = rx * Math.sqrt(Math.max(0, 1 - ((wy / 16 - y) / ry) ** 2));
        const phase =
          Math.floor(valueNoise(row, cx, this.world.seed + 7339) * (kit.period / 16)) * 16;
        const left = Math.ceil(((x - half) * 16 - phase) / kit.period) * kit.period + phase;
        const repeats = Math.min(9, Math.floor(((x + half) * 16 - left) / kit.period));
        if (repeats < 2) continue;
        const bounds = {
          minX: (left - 48) / 16,
          maxX: (left + repeats * kit.period + 32) / 16,
          minY: (wy - kit.height) / 16,
          maxY: wy / 16,
        };
        // Keep source crowns and every collision band on dry, unreserved ground.
        let valid = true;
        for (let ty = bounds.minY; ty <= bounds.maxY && valid; ty += 1)
          for (let tx = bounds.minX; tx <= bounds.maxX && valid; tx += 1)
            valid = this.terrain(tx, ty) === TerrainId.Grass && !this.reserved(tx, ty, 2);
        if (!valid) continue;
        rows.push({
          featureId: `nature:thicket:${cx}:${cy}:${row}`,
          propType: forestRowType(kit.id, repeats),
          wx: left - 48 + (repeats * kit.period + 80) / 2,
          wy,
          kit: kit.id,
          bounds,
          ground: {
            minX: left / 16,
            maxX: (left + repeats * kit.period) / 16,
            minY: (wy - FOREST_ROW_STEP) / 16,
            maxY: wy / 16,
          },
        });
      }
    }
    this.forests.set(key, rows);
    if (this.forests.size > 64) this.forests.delete(this.forests.keys().next().value ?? "");
    return rows;
  }
  forestRows(bounds: Bounds): ForestRow[] {
    if (this.profile !== "thicket") return [];
    const rows: ForestRow[] = [];
    // Complete crowns stay inside their owner, including staggered cap overhangs.
    for (let cy = Math.floor(bounds.minY / 128); cy <= Math.floor(bounds.maxY / 128); cy++)
      for (let cx = Math.floor(bounds.minX / 128); cx <= Math.floor(bounds.maxX / 128); cx++)
        rows.push(...this.forest(cx, cy).filter((r) => intersects(r.bounds, bounds)));
    return rows;
  }
  inThicket(x: number, y: number, r = 0.01) {
    return this.forestRows(rect(x, y, r)).some((row) => near(row.ground, x, y, r));
  }
  sample(x: number, y: number) {
    const terrain = this.terrain(x, y);
    const habitat = naturalHabitat(this.world, this.profile, x, y);
    return { ...habitat, terrain, reserved: this.reserved(x, y), thicket: this.inThicket(x, y) };
  }
  placements(cx: number, cy: number): FeaturePlacement[] {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    const result: FeaturePlacement[] = this.forestRows(bounds).map(
      ({ featureId, propType, wx, wy }) => ({ featureId, propType, wx, wy }),
    );
    // Include every canopy-touching chunk, preserving ordinary procedural deduplication.
    for (let gy = Math.floor((bounds.minY - 1) / 4); gy <= Math.floor((bounds.maxY + 5) / 4); gy++)
      for (
        let gx = Math.floor((bounds.minX - 3) / 4);
        gx <= Math.floor((bounds.maxX + 3) / 4);
        gx++
      ) {
        const x = gx * 4 + 2 + (valueNoise(gx, gy, this.world.seed + 7201) - 0.5) * 3.2;
        const y = gy * 4 + 2 + (valueNoise(gx, gy, this.world.seed + 7207) - 0.5) * 3.2;
        // Full-cell jitter avoids planted rows; priority resolves close pairs without query-order state.
        const priority = valueNoise(gx, gy, this.world.seed + 7221);
        let crowded = false;
        for (let oy = -1; oy <= 1 && !crowded; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            if ((!ox && !oy) || valueNoise(gx + ox, gy + oy, this.world.seed + 7221) >= priority)
              continue;
            const nx =
              (gx + ox) * 4 +
              2 +
              (valueNoise(gx + ox, gy + oy, this.world.seed + 7201) - 0.5) * 3.2;
            const ny =
              (gy + oy) * 4 +
              2 +
              (valueNoise(gx + ox, gy + oy, this.world.seed + 7207) - 0.5) * 3.2;
            if (Math.hypot(nx - x, ny - y) < 2.6) crowded = true;
          }
        if (crowded || this.forestRows(rect(x, y, 4)).length) continue;

        if (!intersects(bounds, { minX: x - 2, maxX: x + 2, minY: y - 4, maxY: y + 1 })) continue;
        if (
          valueNoise(gx, gy, this.world.seed + 7211) >=
            naturalHabitat(this.world, this.profile, x, y).density ||
          this.reserved(x, y, 4)
        )
          continue;
        // Full trunk and crown ground projection remain on dry land, clear of shore.
        if (
          [-2, 0, 2].some((dx) =>
            [-4, -2, 1].some((dy) => this.terrain(x + dx, y + dy) !== TerrainId.Grass),
          )
        )
          continue;
        result.push({
          featureId: `nature:oak:${gx}:${gy}`,
          propType: "prop-oak-tree",
          wx: x * 16,
          wy: y * 16,
        });
      }
    return result;
  }
  get cacheSizes() {
    return {
      reservations: this.reservations.size,
      ponds: this.ponds.size,
      forests: this.forests.size,
    };
  }
}
