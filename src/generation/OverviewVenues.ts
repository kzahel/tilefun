import type { OverviewResult } from "./Overview.js";
import { constructionYard } from "./regional/ConstructionYard.js";
import type { DenseDistrictSource } from "./regional/DenseDistrictSource.js";
import { leisureCells } from "./regional/LeisureCells.js";
import type { LeisureDestination } from "./regional/LeisurePlaces.js";
import { MotocrossSource } from "./regional/MotocrossPlanner.js";
import type { NaturalLandscape } from "./regional/NaturalLandscape.js";
import { RacetrackSource } from "./regional/RacetrackPlanner.js";
import {
  intersects,
  type RegionalRequest,
  type RegionalResult,
} from "./regional/RegionalPlanner.js";
import { vehicleDepot } from "./regional/VehicleDepotPlanner.js";
import type { RegionalWorld } from "./regional/WorldDescriptor.js";

export function* overviewVenues(
  world: RegionalWorld,
  result: RegionalResult,
  request: RegionalRequest,
) {
  const racetracks: NonNullable<OverviewResult["racetracks"]> = [];
  const vehicleDepots: NonNullable<OverviewResult["vehicleDepots"]> = [];
  if (result.detail === "region") {
    const tracks = yield* new RacetrackSource(world).querySteps(
      request.bounds,
      request.limits.maxOwners,
    );
    if (result.stats.features + tracks.length * 2 <= request.limits.maxFeatures) {
      for (const track of tracks) {
        const { id, name, center, bounds, access } = track;
        racetracks.push({ id, name, center, bounds, access });
        const depot = vehicleDepot(track);
        vehicleDepots.push({
          id: depot.id,
          name: depot.name,
          center: depot.center,
          arrival: depot.arrival,
          bounds: depot.bounds,
        });
      }
      result.stats.features += tracks.length * 2;
    }
  }
  const constructionYards: NonNullable<OverviewResult["constructionYards"]> = [];
  const motocross: NonNullable<OverviewResult["motocross"]> = [];
  if (result.detail === "region") {
    const parks = yield* new MotocrossSource(world).querySteps(
      request.bounds,
      request.limits.maxOwners,
    );
    if (result.stats.features + parks.length <= request.limits.maxFeatures) {
      for (const { id, name, center, arrival, bounds, access, straight } of parks)
        motocross.push({ id, name, center, arrival, bounds, access, straight });
      result.stats.features += parks.length;
    }
    if (motocross.length && result.stats.features + parks.length <= request.limits.maxFeatures) {
      for (const park of parks) {
        const { id, name, center, arrival, bounds } = constructionYard(park);
        constructionYards.push({ id, name, center, arrival, bounds });
      }
      result.stats.features += parks.length;
    }
  }
  return { racetracks, vehicleDepots, motocross, constructionYards };
}

export function* overviewOutings(
  request: RegionalRequest,
  result: RegionalResult,
  nature: NaturalLandscape,
  districts: DenseDistrictSource,
) {
  const places = new Map<string, LeisureDestination>();
  const limit = request.limits.maxFeatures - result.stats.features;
  const b = request.bounds;
  for (const town of result.settlements) {
    if (places.size >= limit) break;
    const plan = districts.owner(town.owner.cx, town.owner.cy);
    if (!plan || !intersects(b, plan.park)) continue;
    const id = `${town.id}:play`;
    places.set(id, {
      id,
      name: `${town.name} · Play yard`,
      kind: "play",
      arrival: {
        x: (plan.park.minX + plan.park.maxX) / 2,
        y: (plan.park.minY + plan.park.maxY) / 2,
      },
    });
  }
  for (const { x, y } of leisureCells(b, 512, request.limits.maxOwners)) {
    if (places.size >= limit) break;
    const cell = {
      minX: Math.max(b.minX, x * 512),
      minY: Math.max(b.minY, y * 512),
      maxX: Math.min(b.maxX, (x + 1) * 512),
      maxY: Math.min(b.maxY, (y + 1) * 512),
    };
    for (const { id, name, kind, arrival } of nature.leisure(cell)) {
      if (places.size >= limit) break;
      places.set(id, { id, name, kind, arrival });
    }
    yield;
  }
  return [...places.values()];
}
