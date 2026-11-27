import { BOAT_MOORING_RADIUS, type BoatPlacement } from "../../boats/Boat.js";
import { CHUNK_SIZE_PX } from "../../config/constants.js";
import { fbm, valueNoise } from "../noise.js";
import { leisureCells } from "./LeisureCells.js";
import { type LeisurePlace, leisurePlace } from "./LeisurePlaces.js";
import type { NaturalLandscape, NaturalPond } from "./NaturalLandscape.js";
import { type Bounds, intersects } from "./RegionalPlanner.js";

const beaches = new WeakMap<NaturalPond, LeisurePlace>();
/** The south shore is independent of the northern boat landing and its shallow shelf. */
export function lakeBeach(lake: NaturalPond, seed: number): LeisurePlace {
  const cached = beaches.get(lake);
  if (cached) return cached;
  const x = Math.round(lake.x),
    y = Math.ceil(lake.y + lake.ry) + 8;
  const bounds = { minX: x - 12, minY: y - 5, maxX: x + 13, maxY: y + 12 };
  const beach = leisurePlace(
    "beach",
    `${lake.id}:beach`,
    "Lakeside beach",
    { x, y },
    bounds,
    { x: x + 10, y: y + 8 },
    valueNoise(x, y, seed + 7401),
  );
  // A few remote banks double as small overnight stops.
  if (valueNoise(x, y, seed + 7409) < 0.28) {
    beach.name = "Lakeside camping beach";
    beach.props.push({
      featureId: `${beach.id}:tent`,
      propType: "prop-tent-green",
      wx: (x - 7) * 16,
      wy: (y + 9) * 16,
    });
    beach.actors.push({
      featureId: `${beach.id}:fire`,
      type: "campfire",
      wx: (x - 3) * 16,
      wy: (y + 8) * 16,
      route: [],
    });
  }
  beaches.set(lake, beach);
  return beach;
}
export function waterline(pond: NaturalPond, seed: number, x: number, y: number) {
  // Quiet straight northern boarding beach; the rest keeps an organic shoreline.
  const beach = Math.abs(x - pond.x) < 8 && y < pond.y - pond.ry * 0.75;
  const radius = beach
    ? Math.abs(y - pond.y) / pond.ry
    : Math.hypot((x - pond.x) / pond.rx, (y - pond.y) / pond.ry);
  const edge = beach ? 1 : 1 + fbm(x / 24, y / 24, seed + 9127, 2) * 0.04;
  return { pond, distance: radius / edge };
}
export function lakeBoats(
  lake: NaturalPond | null,
  seed: number,
  cx: number,
  cy: number,
): BoatPlacement[] {
  if (!lake) return [];
  const wx = lake.x * 16,
    // Terrain collision samples tile centers. Snap the entire northern hull
    // edge inside the first water row, including fractional/negative shores.
    wy = Math.floor(lake.y - lake.ry + 0.5) * 16 + 1 + BOAT_MOORING_RADIUS;
  return Math.floor(wx / CHUNK_SIZE_PX) === cx && Math.floor(wy / CHUNK_SIZE_PX) === cy
    ? [
        {
          identity: `lake-boat:${seed}:${Math.floor(cx / 32)}:${Math.floor(cy / 32)}`,
          wx,
          wy,
        },
      ]
    : [];
}

export function lakeOutings(nature: NaturalLandscape, bounds: Bounds) {
  const places: LeisurePlace[] = [];
  for (const { x, y } of leisureCells(bounds, 512)) {
    const lake = nature.lake(x, y);
    if (!lake) continue;
    const p = lakeBeach(lake, nature.world.seed);
    if (intersects(p.bounds, bounds)) places.push(p);
  }
  return places;
}
