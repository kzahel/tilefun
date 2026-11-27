import { TerrainId } from "../../autotile/TerrainId.js";
import { CHUNK_SIZE_PX } from "../../config/constants.js";
import { RailwayStrategy } from "../../railway/RailwayStrategy.js";
import { RoadType } from "../../road/RoadType.js";
import {
  crowNestTrees,
  foragePlacements,
  raccoonForagers,
} from "../../wildlife/ForagePlacements.js";
import { pastureHabitatProps } from "../../wildlife/PastureHabitat.js";
import { rangeHabitatProps } from "../../wildlife/RangeHabitat.js";
import type { Chunk } from "../../world/Chunk.js";
import { constructionYard, yardRoad } from "./ConstructionYard.js";
import { insideDenseBounds } from "./DenseDistrictPlanner.js";
import {
  motocrossPlacements,
  motocrossReserved,
  motocrossRoad,
  motocrossTerrain,
} from "./MotocrossPlanner.js";
import { type LandscapeProfile, NaturalLandscape } from "./NaturalLandscape.js";
import {
  finishOutingTerrain,
  inActorChunk,
  outingActors,
  outingProps,
} from "./OutingRealization.js";
import { racetrackReserved, racetrackSurface } from "./RacetrackPlanner.js";
import { intersects } from "./RegionalPlanner.js";
import { settlementPets } from "./SettlementPets.js";
import { depotPlacements, depotSurface, vehicleDepot } from "./VehicleDepotPlanner.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Regional natural cover composed with production rail/traffic route sources. */
export class NaturalStrategy extends RailwayStrategy {
  readonly nature: NaturalLandscape;
  constructor(world: RegionalWorld, profile: LandscapeProfile) {
    super(world);
    this.nature = new NaturalLandscape(world, profile);
  }
  override generate(chunk: Chunk, cx: number, cy: number) {
    super.generate(chunk, cx, cy);
    const bounds = { minX: cx * 16 - 1, minY: cy * 16 - 1, maxX: cx * 16 + 17, maxY: cy * 16 + 17 };
    const outings = this.nature.leisure(bounds);
    const farms = this.nature.farms.query(bounds);
    const tracks = this.racetracks.query(bounds);
    const parks = this.motocross.query(bounds);
    const yards = parks.map(constructionYard).filter((yard) => intersects(yard.bounds, bounds));
    let changed = false;
    for (let sy = 0; sy < 33; sy++)
      for (let sx = 0; sx < 33; sx++) {
        const x = cx * 16 + sx / 2,
          y = cy * 16 + sy / 2;
        if (tracks.some((t) => racetrackReserved(t, x, y))) {
          chunk.setSubgrid(sx, sy, TerrainId.Grass);
          changed = true;
          continue;
        }
        const park = parks.find((p) => motocrossReserved(p, x, y));
        if (park) {
          chunk.setSubgrid(
            sx,
            sy,
            yards.some((yard) => insideDenseBounds(yard.bounds, x, y))
              ? TerrainId.DirtWarm
              : motocrossTerrain(park, x, y),
          );
          changed = true;
          continue;
        }
        const farmTerrain = this.nature.farms.terrain(farms, x, y);
        if (farmTerrain !== undefined) {
          chunk.setSubgrid(sx, sy, farmTerrain);
          changed = true;
        }
        const terrain = this.nature.terrain(x, y);
        // Ponds were admitted against all infrastructure before realization.
        if (
          terrain !== TerrainId.Grass &&
          (this.nature.pondAt(cx * 16 + sx / 2, cy * 16 + sy / 2) ||
            this.nature.lagoonAt(cx * 16 + sx / 2, cy * 16 + sy / 2) ||
            this.nature.lakeAt(x, y))
        ) {
          chunk.setSubgrid(sx, sy, terrain);
          changed = true;
        }
      }
    finishOutingTerrain(chunk, cx, cy, outings, changed);
    for (let ly = 0; ly < 16; ly++)
      for (let lx = 0; lx < 16; lx++) {
        const x = cx * 16 + lx,
          y = cy * 16 + ly;
        for (const track of tracks)
          if (racetrackReserved(track, x + 0.5, y + 0.5)) {
            const surface =
              depotSurface(vehicleDepot(track), x, y) ?? racetrackSurface(track, x, y);
            // Keep any pre-existing city/outbound road at the access junction.
            const existing = chunk.getRoad(lx, ly);
            if (
              insideDenseBounds(track.bounds, x, y) ||
              !existing ||
              ((existing === RoadType.Sidewalk || existing === RoadType.CityPavement) &&
                surface === RoadType.Asphalt)
            )
              chunk.setRoad(lx, ly, surface);
            chunk.setHeight(lx, ly, 0);
          }
        for (const park of parks)
          if (motocrossReserved(park, x + 0.5, y + 0.5)) {
            const surface = yardRoad(constructionYard(park), x, y) ?? motocrossRoad(park, x, y);
            const existing = chunk.getRoad(lx, ly);
            // Keep the city's own outbound road where the access road joins it.
            if (
              insideDenseBounds(park.bounds, x, y) ||
              !existing ||
              ((existing === RoadType.Sidewalk || existing === RoadType.CityPavement) &&
                surface === RoadType.Asphalt)
            )
              chunk.setRoad(lx, ly, surface);
            chunk.setHeight(lx, ly, 0);
          }
      }
  }
  depotVehicles(cx: number, cy: number) {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    return [
      ...this.racetracks.query(bounds).flatMap((t) => vehicleDepot(t).vehicles),
      ...this.motocross
        .query(bounds)
        .flatMap((p) => [...p.vehicles, ...constructionYard(p).vehicles]),
    ].filter(inActorChunk(cx, cy));
  }
  boats(cx: number, cy: number) {
    return this.nature.boats(cx, cy);
  }
  constructionCargo(cx: number, cy: number) {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    return this.motocross
      .query(bounds)
      .flatMap((park) => constructionYard(park).cargo)
      .filter(
        (actor) =>
          Math.floor(actor.wx / CHUNK_SIZE_PX) === cx &&
          Math.floor(actor.wy / CHUNK_SIZE_PX) === cy,
      );
  }

  override actors(cx: number, cy: number) {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    const residents = this.nature.farms
      .query(bounds)
      .flatMap((p) => p.actors)
      .filter(inActorChunk(cx, cy));
    const pets = this.districts
      .query(bounds)
      .flatMap((p) => settlementPets(p, this.world.seed))
      .filter(inActorChunk(cx, cy));
    const wildlife = [...this.nature.wildlife(cx, cy), ...raccoonForagers(this.nature, cx, cy)];
    return [
      ...super.actors(cx, cy),
      ...residents,
      ...pets,
      ...outingActors(this.nature, this.districts, cx, cy, bounds),
      ...this.spectators(cx, cy),
      ...this.constructionCargo(cx, cy),
      ...this.motocross
        .query(bounds)
        .flatMap((p) => constructionYard(p).rubble)
        .filter(inActorChunk(cx, cy)),
      ...wildlife,
      ...foragePlacements(
        [
          ...wildlife,
          ...residents.filter(
            (a) =>
              a.type.startsWith("wildlife-goat-") ||
              a.type.startsWith("wildlife-piglet-") ||
              a.type.startsWith("wildlife-horse-") ||
              a.type.startsWith("wildlife-cow-") ||
              a.type.startsWith("wildlife-donkey-"),
          ),
        ],
        this.nature,
        cx,
        cy,
      ),
    ];
  }
  spectators(cx: number, cy: number) {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    return [
      ...this.racetracks.query(bounds).flatMap((t) => t.actors),
      ...this.motocross.query(bounds).flatMap((p) => p.actors),
    ].filter(inActorChunk(cx, cy));
  }
  override placements(cx: number, cy: number) {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    return [
      ...super.placements(cx, cy),
      ...outingProps(this.nature, bounds),
      ...this.nature.farms.placements(this.nature.farms.query(bounds), bounds),
      ...this.nature.placements(cx, cy),
      ...crowNestTrees(this.nature, cx, cy),
      ...pastureHabitatProps(this.nature, cx, cy),
      ...rangeHabitatProps(this.nature, cx, cy),
      ...this.racetracks.query(bounds).flatMap((t) => depotPlacements(vehicleDepot(t), bounds)),
      ...this.motocross
        .query(bounds)
        .flatMap((p) => [
          ...motocrossPlacements(p, bounds),
          ...depotPlacements(constructionYard(p), bounds),
        ]),
      ...this.racetracks
        .query({
          minX: bounds.minX - 4,
          minY: bounds.minY - 6,
          maxX: bounds.maxX + 4,
          maxY: bounds.maxY + 6,
        })
        .flatMap((t) => t.props)
        .filter(
          (p) =>
            p.wx / 16 >= bounds.minX - 3 &&
            p.wx / 16 < bounds.maxX + 3 &&
            p.wy / 16 >= bounds.minY - 1 &&
            p.wy / 16 < bounds.maxY + 6,
        ),
    ];
  }
}
