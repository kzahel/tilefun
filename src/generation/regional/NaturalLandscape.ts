import { TerrainId } from "../../autotile/TerrainId.js";
import { FOREST_KITS, FOREST_ROW_STEP, forestRowType } from "../../patterns/ForestThicket.js";
import { nearestRail } from "../../railway/RailPath.js";
import { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import { createDeer, DEER_TYPE } from "../../wildlife/Deer.js";
import {
  createFauna,
  FAUNA_PROFILES,
  FAUNA_ROSTER,
  type FaunaSpecies,
  faunaType,
} from "../../wildlife/Fauna.js";
import { createFrog, FROG_TYPE } from "../../wildlife/Frog.js";
import { createMallard, MALLARD_TYPE } from "../../wildlife/Mallard.js";
import { createRabbit, RABBIT_TYPE } from "../../wildlife/Rabbit.js";
import { createRobin, ROBIN_TYPE } from "../../wildlife/Robin.js";
import type { ActorPlacement } from "../Generator.js";
import { fbm, valueNoise } from "../noise.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { FarmsteadSource } from "./FarmsteadPlanner.js";
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
/** Current regional composition, shared by gameplay and the explorer. */
export const DEFAULT_LANDSCAPE_PROFILE: LandscapeProfile = "thicket";
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
export interface FaunaHome {
  id: string;
  species: FaunaSpecies;
  x: number;
  y: number;
  clearance: number;
}
export interface RabbitGlade {
  id: string;
  x: number;
  y: number;
  shelter: { wx: number; wy: number };
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
  readonly farms: FarmsteadSource;
  private dryRefugePlanner?: NaturalLandscape;
  private reservations = new Map<string, ReturnType<NaturalLandscape["buildReservations"]>>();
  private lagoons = new Map<string, NaturalPond | null>();
  private ponds = new Map<string, NaturalPond | null>();
  private faunaHomes = new Map<string, FaunaHome | null>();
  private deerGlades = new Map<string, RabbitGlade | null>();
  private glades = new Map<string, RabbitGlade | null>();
  private forests = new Map<string, ForestRow[]>();
  constructor(
    readonly world: RegionalWorld,
    readonly profile: LandscapeProfile,
    private readonly waterRefuges = true,
  ) {
    landscapeProfile(profile);
    this.railways = new RailwayPlanner(world);
    this.farms = new FarmsteadSource(world);
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
    return { region, lines: this.railways.query(bounds), farms: this.farms.query(bounds) };
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
    if (this.farms.reserved(plans.farms, x, y, r)) return true;
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
  /** Broad, rare water refuges; upstream of forests and wildlife to avoid planner cycles. */
  lagoon(cx: number, cy: number): NaturalPond | null {
    if (!this.waterRefuges) return null;
    const key = `${cx},${cy}`;
    if (this.lagoons.has(key)) return this.lagoons.get(key) ?? null;
    const h = (salt: number) => valueNoise(cx, cy, this.world.seed + salt);
    let lagoon: NaturalPond | null = null;
    if (h(8201) < 0.22) {
      const x = cx * 256 + 80 + h(8209) * 96,
        y = cy * 256 + 80 + h(8211) * 96,
        rx = 36,
        ry = 28,
        radius = 48;
      let valid = !this.reserved(x, y, radius);
      for (let dy = -radius; dy <= radius && valid; dy += 4)
        for (let dx = -radius; dx <= radius && valid; dx += 4) valid = this.dry(x + dx, y + dy);
      for (
        let py = Math.floor((y - radius) / 128);
        py <= Math.floor((y + radius) / 128) && valid;
        py++
      )
        for (
          let px = Math.floor((x - radius) / 128);
          px <= Math.floor((x + radius) / 128) && valid;
          px++
        ) {
          const pond = this.pond(px, py);
          if (pond && near(pond.bounds, x, y, radius)) valid = false;
        }
      if (valid && !this.potentialDryHomeNear(x, y, radius))
        lagoon = { id: `lagoon:${cx}:${cy}`, x, y, rx, ry, bounds: rect(x, y, radius) };
    }
    this.lagoons.set(key, lagoon);
    if (this.lagoons.size > 128) this.lagoons.delete(this.lagoons.keys().next().value ?? "");
    return lagoon;
  }
  /** The dry-only planner is upstream: it never admits lagoons or calls this instance. */
  private potentialDryHomeNear(x: number, y: number, radius: number): boolean {
    if (!this.dryRefugePlanner)
      this.dryRefugePlanner = new NaturalLandscape(this.world, this.profile, false);
    const dry = this.dryRefugePlanner;
    const margin = radius + 24;
    for (let cy = Math.floor((y - margin) / 64); cy <= Math.floor((y + margin) / 64); cy++)
      for (let cx = Math.floor((x - margin) / 64); cx <= Math.floor((x + margin) / 64); cx++) {
        const fauna = dry.faunaHome(cx, cy),
          rabbit = dry.rabbitGlade(cx, cy),
          deer = dry.deerGlade(cx, cy);
        if (
          [
            fauna && { ...fauna, r: fauna.clearance },
            rabbit && { ...rabbit, r: 8 },
            deer && { ...deer, r: 11 },
          ].some((h) => h && Math.hypot(h.x - x, h.y - y) < radius + h.r + 2)
        )
          return true;
      }
    return false;
  }
  lagoonAt(x: number, y: number) {
    const pond = this.lagoon(Math.floor(x / 256), Math.floor(y / 256));
    if (!pond || !near(pond.bounds, x, y, 0.01)) return undefined;
    const radius = Math.hypot((x - pond.x) / pond.rx, (y - pond.y) / pond.ry);
    const edge = 1 + fbm(x / 18, y / 18, this.world.seed + 8221, 2) * 0.08;
    return { pond, distance: radius / edge };
  }
  private waterFauna(cx: number, cy: number): ActorPlacement[] {
    const actors: ActorPlacement[] = [];
    const pond = this.pond(Math.floor(cx / 8), Math.floor(cy / 8));
    const lagoon = this.lagoon(Math.floor(cx / 16), Math.floor(cy / 16));
    const add = (
      species: FaunaSpecies,
      refuge: NaturalPond,
      home: { wx: number; wy: number },
      positions: { wx: number; wy: number }[],
    ) => {
      const profile = FAUNA_PROFILES.find((p) => p.species === species);
      if (!profile) return;
      const groupId = `wildlife:${species}:${this.world.seed}:${refuge.id}`;
      positions.forEach((point, i) => {
        if (Math.floor(point.wx / 256) !== cx || Math.floor(point.wy / 256) !== cy) return;
        const fauna = createFauna(species, point.wx, point.wy).fauna;
        if (!fauna) throw Error("Missing water fauna behavior");
        fauna.home = { ...home };
        fauna.shelter = { ...home };
        if (profile.group > 1) fauna.groupId = groupId;
        fauna.water = [TerrainId.DeepWater, TerrainId.ShallowWater].includes(
          this.terrain(point.wx / 16, point.wy / 16),
        );
        fauna.randomState =
          Math.floor(
            valueNoise(
              refuge.x,
              refuge.y,
              this.world.seed + 8241 + i + FAUNA_ROSTER.indexOf(species) * 19,
            ) * 4294967296,
          ) >>> 0;
        fauna.timer = 1.5 + i * 0.5;
        actors.push({
          featureId: `${groupId}:${i}`,
          type: faunaType(species),
          wx: point.wx,
          wy: point.wy,
          route: [],
          fauna,
        });
      });
    };
    if (pond) {
      const home = { wx: pond.x * 16, wy: pond.y * 16 };
      add(
        "fish",
        pond,
        home,
        [0, 1, 2].map((i) => ({
          wx: home.wx + Math.cos((i * Math.PI * 2) / 3) * 24,
          wy: home.wy + Math.sin((i * Math.PI * 2) / 3) * 24,
        })),
      );
    }
    if (lagoon) {
      const home = { wx: lagoon.x * 16, wy: (lagoon.y - lagoon.ry * 0.45) * 16 };
      add("manta-ray", lagoon, home, [home]);
      // Opposite open sandy arcs give both shore groups space to change gait.
      for (const species of ["penguin", "harbor-seal"] as const) {
        const p = FAUNA_PROFILES.find((p) => p.species === species);
        if (!p) continue;
        const side = species === "penguin" ? -1 : 1;
        const x = lagoon.x + side * lagoon.rx * 0.4;
        const y = lagoon.y - lagoon.ry * Math.sqrt(1 - 0.4 ** 2) * 1.02;
        const shore = { wx: x * 16, wy: y * 16 };
        add(
          species,
          lagoon,
          shore,
          Array.from({ length: p.group }, (_, i) => ({
            wx: shore.wx + (i - (p.group - 1) / 2) * (p.body[0] + 12),
            wy: shore.wy,
          })),
        );
      }
    }
    return actors;
  }

  terrain(x: number, y: number): TerrainId {
    const base = regionalTerrainForElevation(plannedElevation(this.world, x, y));
    const local = this.pondAt(x, y) ?? this.lagoonAt(x, y);
    if (!local) return base;
    if (local.distance < 0.65) return TerrainId.DeepWater;
    if (local.distance < 1) return TerrainId.ShallowWater;
    if (local.distance < 1.1) return TerrainId.Sand;
    if (local.distance < 1.23) return TerrainId.SandLight;
    return base;
  }
  /** Reserve an open ring around admitted ponds for wildlife and player access. */
  pondBank(x: number, y: number, clearance = 0): boolean {
    const p = this.pond(Math.floor(x / 128), Math.floor(y / 128));
    const bay = this.lagoon(Math.floor(x / 256), Math.floor(y / 256));
    return (
      (!!p && Math.hypot((x - p.x) / (p.rx + clearance), (y - p.y) / (p.ry + clearance)) < 1.5) ||
      (!!bay &&
        Math.hypot(
          (x - bay.x) / (bay.rx * 1.3 + clearance),
          (y - bay.y) / (bay.ry * 1.3 + clearance),
        ) < 1)
    );
  }
  /** Seed once; persistence owns subsequent movement and deletion, never a respawn timer. */
  wildlife(cx: number, cy: number): ActorPlacement[] {
    const pond = this.pond(Math.floor(cx / 8), Math.floor(cy / 8));
    const actors = [
      ...this.rabbits(cx, cy),
      ...this.robins(cx, cy),
      ...this.deer(cx, cy),
      ...this.fauna(cx, cy),
      ...this.waterFauna(cx, cy),
    ];
    if (!pond) return actors;
    const px = Math.floor(pond.x / 128),
      py = Math.floor(pond.y / 128);
    const h = (salt: number) => valueNoise(px, py, this.world.seed + salt);
    const count = 2 + Math.floor(h(7401) * 3);
    for (let i = 0; i < count; i++) {
      // A fixed dry-bank arc leaves each member room and easy access to the pond.
      const angle = h(7411) * Math.PI * 2 + i * 0.5;
      const wx = (pond.x + Math.cos(angle) * pond.rx * 1.32) * 16;
      const wy = (pond.y + Math.sin(angle) * pond.ry * 1.32) * 16;
      if (Math.floor(wx / 256) !== cx || Math.floor(wy / 256) !== cy) continue;
      const duck = createMallard(wx, wy),
        ai = duck.mallard;
      if (!ai) throw new Error("Missing mallard behavior");
      ai.home = { wx: pond.x * 16, wy: pond.y * 16 };
      ai.radius = Math.max(pond.rx, pond.ry) * 1.5 * 16;
      ai.randomState = Math.floor(h(7421 + i) * 4294967296) >>> 0;
      ai.timer = 1 + i * 1.1;
      actors.push({
        featureId: `wildlife:mallard:${this.world.seed}:${pond.id}:${i}`,
        type: MALLARD_TYPE,
        wx,
        wy,
        route: [],
        mallard: ai,
      });
    }
    // Frogs occupy a separate grassy outer-bank arc, leaving the duck bank and
    // shallow-water entry open. Existing pondBank reservations keep trees away.
    const frogCount = 2 + Math.floor(h(7501) * 3);
    const occupied = Array.from({ length: count }, (_, j) => {
      const angle = h(7411) * Math.PI * 2 + j * 0.5;
      return {
        wx: (pond.x + Math.cos(angle) * pond.rx * 1.32) * 16,
        wy: (pond.y + Math.sin(angle) * pond.ry * 1.32) * 16,
      };
    });
    for (let i = 0; i < frogCount; i++) {
      let point: { wx: number; wy: number } | undefined;
      // Rotate a crowded candidate around the open ring. Calculate every slot
      // before its chunk filter so neighboring queries choose identical positions.
      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = h(7511) * Math.PI * 2 + i * 0.65 + (attempt * Math.PI) / 6;
        const candidate = {
          wx: (pond.x + Math.cos(angle) * pond.rx * 1.4) * 16,
          wy: (pond.y + Math.sin(angle) * pond.ry * 1.4) * 16,
        };
        if (occupied.some((p) => Math.hypot(candidate.wx - p.wx, candidate.wy - p.wy) < 14))
          continue;
        point = candidate;
        break;
      }
      if (!point) continue;
      occupied.push(point);
      const { wx, wy } = point;
      if (Math.floor(wx / 256) !== cx || Math.floor(wy / 256) !== cy) continue;
      const frog = createFrog(wx, wy),
        ai = frog.frog;
      if (!ai) throw new Error("Missing frog behavior");
      ai.home = { wx: pond.x * 16, wy: pond.y * 16 };
      ai.radius = Math.max(pond.rx, pond.ry) * 1.5 * 16;
      ai.randomState = Math.floor(h(7521 + i) * 4294967296) >>> 0;
      ai.timer = 1.4 + i * 0.8;
      actors.push({
        featureId: `wildlife:frog:${this.world.seed}:${pond.id}:${i}`,
        type: FROG_TYPE,
        wx,
        wy,
        route: [],
        frog: ai,
      });
    }
    return actors;
  }
  /** A 64-tile owner admits one small, dry glade beside natural woodland cover.
   * Forest collision bands remain intact; scattered trees leave its interior open. */
  rabbitGlade(cx: number, cy: number): RabbitGlade | null {
    const key = `${cx},${cy}`;
    if (this.glades.has(key)) return this.glades.get(key) ?? null;
    const h = (salt: number) => valueNoise(cx, cy, this.world.seed + salt);
    let glade: RabbitGlade | null = null;
    if (h(7601) < 0.35) {
      for (let attempt = 0; attempt < 4 && !glade; attempt++) {
        const x = cx * 64 + 16 + h(7611 + attempt * 2) * 32;
        const y = cy * 64 + 16 + h(7612 + attempt * 2) * 32;
        if (this.reserved(x, y, 8) || this.pondBank(x, y, 8) || this.inThicket(x, y, 8)) continue;
        let valid = true;
        for (let dy = -6; dy <= 6 && valid; dy += 2)
          for (let dx = -6; dx <= 6 && valid; dx += 2)
            valid = this.terrain(x + dx, y + dy) === TerrainId.Grass;
        if (!valid) continue;
        // Pick an open edge facing denser woodland, never a solid thicket interior.
        let cover = -Infinity,
          angle = 0;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const density = naturalHabitat(
            this.world,
            this.profile,
            x + Math.cos(a) * 10,
            y + Math.sin(a) * 10,
          ).density;
          if (density > cover) {
            cover = density;
            angle = a;
          }
        }
        if (cover < 0.13) continue;
        glade = {
          id: `glade:${cx}:${cy}`,
          x,
          y,
          shelter: { wx: (x + Math.cos(angle) * 4) * 16, wy: (y + Math.sin(angle) * 4) * 16 },
        };
      }
    }
    this.glades.set(key, glade);
    if (this.glades.size > 128) this.glades.delete(this.glades.keys().next().value ?? "");
    return glade;
  }
  /** Wider open glades for larger bodies, separate from the existing rabbit homes.
   * Pure habitat queries precede scattered vegetation; forest bands remain intact. */
  deerGlade(cx: number, cy: number): RabbitGlade | null {
    const key = `${cx},${cy}`;
    if (this.deerGlades.has(key)) return this.deerGlades.get(key) ?? null;
    const h = (salt: number) => valueNoise(cx, cy, this.world.seed + salt);
    let glade: RabbitGlade | null = null;
    if (h(7901) < 0.22) {
      const rabbit = this.rabbitGlade(cx, cy);
      for (let attempt = 0; attempt < 4 && !glade; attempt++) {
        const x = cx * 64 + 16 + h(7911 + attempt * 2) * 32,
          y = cy * 64 + 16 + h(7912 + attempt * 2) * 32;
        if (
          this.reserved(x, y, 11) ||
          this.pondBank(x, y, 11) ||
          this.inThicket(x, y, 11) ||
          (rabbit && Math.hypot(x - rabbit.x, y - rabbit.y) < 18)
        )
          continue;
        let valid = true;
        for (let dy = -10; dy <= 10 && valid; dy += 2)
          for (let dx = -10; dx <= 10 && valid; dx += 2)
            valid = this.terrain(x + dx, y + dy) === TerrainId.Grass;
        if (!valid) continue;
        let cover = -Infinity,
          angle = 0;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const density = naturalHabitat(
            this.world,
            this.profile,
            x + Math.cos(a) * 13,
            y + Math.sin(a) * 13,
          ).density;
          if (density > cover) {
            cover = density;
            angle = a;
          }
        }
        if (cover < 0.13) continue;
        glade = {
          id: `deer-glade:${cx}:${cy}`,
          x,
          y,
          shelter: { wx: (x + Math.cos(angle) * 5) * 16, wy: (y + Math.sin(angle) * 5) * 16 },
        };
      }
    }
    this.deerGlades.set(key, glade);
    if (this.deerGlades.size > 128)
      this.deerGlades.delete(this.deerGlades.keys().next().value ?? "");
    return glade;
  }
  private deerClearing(x: number, y: number): boolean {
    for (let cy = Math.floor((y - 11) / 64); cy <= Math.floor((y + 11) / 64); cy++)
      for (let cx = Math.floor((x - 11) / 64); cx <= Math.floor((x + 11) / 64); cx++) {
        const glade = this.deerGlade(cx, cy);
        if (glade && Math.hypot(x - glade.x, y - glade.y) < 11) return true;
      }
    return false;
  }
  private deer(cx: number, cy: number): ActorPlacement[] {
    const gx = Math.floor(cx / 4),
      gy = Math.floor(cy / 4),
      glade = this.deerGlade(gx, gy);
    if (!glade) return [];
    const h = (salt: number) => valueNoise(gx, gy, this.world.seed + salt),
      count = 2 + Math.floor(h(7951) * 2);
    const actors: ActorPlacement[] = [];
    const herdId = `wildlife:deer:${this.world.seed}:${glade.id}`;
    for (let i = 0; i < count; i++) {
      const angle = h(7953) * Math.PI * 2 + (i * Math.PI * 2) / count;
      const wx = (glade.x + Math.cos(angle) * 3) * 16,
        wy = (glade.y + Math.sin(angle) * 3) * 16;
      if (Math.floor(wx / 256) !== cx || Math.floor(wy / 256) !== cy) continue;
      const ai = createDeer(wx, wy).deer;
      if (!ai) throw new Error("Missing deer behavior");
      ai.home = { wx: glade.x * 16, wy: glade.y * 16 };
      ai.shelter = { ...glade.shelter };
      ai.herdId = herdId;
      ai.randomState = Math.floor(h(7961 + i) * 4294967296) >>> 0;
      ai.timer = 1.5 + i * 0.8;
      actors.push({ featureId: `${herdId}:${i}`, type: DEER_TYPE, wx, wy, route: [], deer: ai });
    }
    return actors;
  }
  /** Stable fixed-roster owner selection; never fill an inactive species with another one. */
  faunaHome(cx: number, cy: number): FaunaHome | null {
    const key = `${cx},${cy}`;
    if (this.faunaHomes.has(key)) return this.faunaHomes.get(key) ?? null;
    const h = (salt: number) => valueNoise(cx, cy, this.world.seed + salt);
    const species = FAUNA_ROSTER[Math.floor(h(8011) * FAUNA_ROSTER.length)];
    const profile = FAUNA_PROFILES.find((p) => p.species === species);
    let home: FaunaHome | null = null;
    if (profile && h(8001) < 0.65 && !["pond", "shore", "deep"].includes(profile.habitat)) {
      const clearance = Math.ceil(profile.radius / 16 + profile.body[0] / 32 + 4);
      for (let attempt = 0; attempt < 4 && !home; attempt++) {
        const x = cx * 64 + 24 + h(8021 + attempt * 2) * 16,
          y = cy * 64 + 24 + h(8022 + attempt * 2) * 16;
        const rabbit = this.rabbitGlade(cx, cy),
          deer = this.deerGlade(cx, cy);
        if (
          this.reserved(x, y, clearance) ||
          this.pondBank(x, y, clearance) ||
          this.inThicket(x, y, clearance) ||
          (rabbit && Math.hypot(x - rabbit.x, y - rabbit.y) < clearance + 8) ||
          (deer && Math.hypot(x - deer.x, y - deer.y) < clearance + 12)
        )
          continue;
        let valid = true;
        for (let dy = -clearance; dy <= clearance && valid; dy += 2)
          for (let dx = -clearance; dx <= clearance && valid; dx += 2)
            valid = this.terrain(x + dx, y + dy) === TerrainId.Grass;
        if (!valid) continue;
        if (
          profile.habitat === "woodland" &&
          Math.max(
            ...[0, 1, 2, 3].map(
              (i) =>
                naturalHabitat(
                  this.world,
                  this.profile,
                  x + Math.cos((i * Math.PI) / 2) * (clearance + 2),
                  y + Math.sin((i * Math.PI) / 2) * (clearance + 2),
                ).density,
            ),
          ) < 0.13
        )
          continue;
        home = { id: `fauna-home:${cx}:${cy}`, species: profile.species, x, y, clearance };
      }
    }
    this.faunaHomes.set(key, home);
    if (this.faunaHomes.size > 128)
      this.faunaHomes.delete(this.faunaHomes.keys().next().value ?? "");
    return home;
  }
  private faunaClearing(x: number, y: number): boolean {
    // Largest current/proposed ground body has a 160px home and 56px body.
    for (let cy = Math.floor((y - 20) / 64); cy <= Math.floor((y + 20) / 64); cy++)
      for (let cx = Math.floor((x - 20) / 64); cx <= Math.floor((x + 20) / 64); cx++) {
        const home = this.faunaHome(cx, cy);
        if (home && Math.hypot(x - home.x, y - home.y) < home.clearance) return true;
      }
    return false;
  }
  private fauna(cx: number, cy: number): ActorPlacement[] {
    const home = this.faunaHome(Math.floor(cx / 4), Math.floor(cy / 4));
    if (!home) return [];
    const p = FAUNA_PROFILES.find((p) => p.species === home.species);
    if (!p) return [];
    const h = (salt: number) =>
      valueNoise(Math.floor(cx / 4), Math.floor(cy / 4), this.world.seed + salt);
    const groupId = `wildlife:${home.species}:${this.world.seed}:${home.id}`;
    const actors: ActorPlacement[] = [];
    for (let i = 0; i < p.group; i++) {
      const angle = h(8031) * Math.PI * 2 + (i * Math.PI * 2) / p.group;
      const separation = p.group === 1 ? 0 : Math.max(24, p.body[0] + 8);
      const wx = home.x * 16 + Math.cos(angle) * separation,
        wy = home.y * 16 + Math.sin(angle) * separation;
      if (Math.floor(wx / 256) !== cx || Math.floor(wy / 256) !== cy) continue;
      const fauna = createFauna(p.species, wx, wy).fauna;
      if (!fauna) throw new Error("Missing fauna behavior");
      fauna.home = { wx: home.x * 16, wy: home.y * 16 };
      fauna.shelter = { wx: (home.x + 4) * 16, wy: home.y * 16 };
      if (p.group > 1) fauna.groupId = groupId;
      fauna.timer = 1.5 + i * 0.5;
      fauna.randomState = Math.floor(h(8041 + i) * 4294967296) >>> 0;
      actors.push({
        featureId: `${groupId}:${i}`,
        type: faunaType(p.species),
        wx,
        wy,
        route: [],
        fauna,
      });
    }
    return actors;
  }
  private rabbitClearing(x: number, y: number): boolean {
    // Entire glade stays inside its owner. Check adjacent owners for a tree's clearance.
    for (let cy = Math.floor((y - 7) / 64); cy <= Math.floor((y + 7) / 64); cy++)
      for (let cx = Math.floor((x - 7) / 64); cx <= Math.floor((x + 7) / 64); cx++) {
        const glade = this.rabbitGlade(cx, cy);
        if (glade && Math.hypot(x - glade.x, y - glade.y) < 7) return true;
      }
    return false;
  }
  /** Sparse individuals at ordinary tree edges with both dry ground and real crowns.
   * Discover a halo before assigning the spawn's owner; IDs never depend on query order. */
  private robins(cx: number, cy: number): ActorPlacement[] {
    const trees = new Map<string, FeaturePlacement>();
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const p of this.placements(cx + dx, cy + dy))
          if (p.propType === "prop-oak-tree") trees.set(p.featureId, p);
    const actors: ActorPlacement[] = [];
    for (const tree of trees.values()) {
      const gx = Math.floor(tree.wx / 64),
        gy = Math.floor(tree.wy / 64);
      if (valueNoise(gx, gy, this.world.seed + 7801) > 0.22) continue;
      const side = valueNoise(gx, gy, this.world.seed + 7803) < 0.5 ? -1 : 1;
      const wx = tree.wx + side * 28,
        wy = tree.wy + 8;
      if (Math.floor(wx / 256) !== cx || Math.floor(wy / 256) !== cy) continue;
      if (
        this.reserved(wx / 16, wy / 16, 1) ||
        this.inThicket(wx / 16, wy / 16, 1) ||
        [-0.5, 0, 0.5].some((dx) =>
          [-0.5, 0, 0.5].some((dy) => this.terrain(wx / 16 + dx, wy / 16 + dy) !== TerrainId.Grass),
        ) ||
        [...trees.values()].some((p) => Math.abs(p.wx - wx) < 12 && Math.abs(p.wy - wy) < 10)
      )
        continue;
      const ai = createRobin(wx, wy).robin;
      if (!ai) throw new Error("Missing robin behavior");
      ai.home = { wx: tree.wx, wy: tree.wy };
      ai.randomState = Math.floor(valueNoise(gx, gy, this.world.seed + 7807) * 4294967296) >>> 0;
      ai.timer = 1 + valueNoise(gx, gy, this.world.seed + 7811) * 2;
      actors.push({
        featureId: `wildlife:robin:${this.world.seed}:${tree.featureId}:0`,
        type: ROBIN_TYPE,
        wx,
        wy,
        route: [],
        robin: ai,
      });
    }
    return actors.sort((a, b) => a.featureId.localeCompare(b.featureId));
  }
  private rabbits(cx: number, cy: number): ActorPlacement[] {
    const gx = Math.floor(cx / 4),
      gy = Math.floor(cy / 4);
    const glade = this.rabbitGlade(gx, gy);
    if (!glade) return [];
    const h = (salt: number) => valueNoise(gx, gy, this.world.seed + salt);
    const count = 2 + Math.floor(h(7651) * 2),
      actors: ActorPlacement[] = [];
    for (let i = 0; i < count; i++) {
      const angle = h(7653) * Math.PI * 2 + (i * Math.PI * 2) / count;
      const wx = (glade.x + Math.cos(angle) * 1.4) * 16;
      const wy = (glade.y + Math.sin(angle) * 1.4) * 16;
      if (Math.floor(wx / 256) !== cx || Math.floor(wy / 256) !== cy) continue;
      const ai = createRabbit(wx, wy).rabbit;
      if (!ai) throw new Error("Missing rabbit behavior");
      ai.home = { wx: glade.x * 16, wy: glade.y * 16 };
      ai.shelter = { ...glade.shelter };
      ai.randomState = Math.floor(h(7661 + i) * 4294967296) >>> 0;
      ai.timer = 1.2 + i * 0.8;
      actors.push({
        featureId: `wildlife:rabbit:${this.world.seed}:${glade.id}:${i}`,
        type: RABBIT_TYPE,
        wx,
        wy,
        route: [],
        rabbit: ai,
      });
    }
    return actors;
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
            valid =
              this.terrain(tx, ty) === TerrainId.Grass &&
              !this.reserved(tx, ty, 2) &&
              !this.pondBank(tx, ty);
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
          this.reserved(x, y, 4) ||
          this.pondBank(x, y, 4) ||
          this.rabbitClearing(x, y) ||
          this.deerClearing(x, y) ||
          this.faunaClearing(x, y)
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
      glades: this.glades.size,
      deerGlades: this.deerGlades.size,
      faunaHomes: this.faunaHomes.size,
      lagoons: this.lagoons.size,
    };
  }
}
