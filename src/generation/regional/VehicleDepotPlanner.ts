import { getEntityAABB } from "../../entities/collision.js";
import { Direction } from "../../entities/Entity.js";
import { createProp } from "../../entities/PropFactories.js";
import { RoadType } from "../../road/RoadType.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import type { Racetrack } from "./RacetrackPlanner.js";
import type { Bounds, Point } from "./RegionalPlanner.js";

export interface DepotVehicle {
  identity: string;
  model: string;
  wx: number;
  wy: number;
  facing: Direction;
}
export interface VehicleDepot {
  id: string;
  name: string;
  center: Point;
  arrival: Point;
  bounds: Bounds;
  vehicles: DepotVehicle[];
  props: FeaturePlacement[];
}

/** Reuse already admitted, dry infield space. This never moves a track, road,
 * wildlife owner or refuge and has no downstream natural-planner dependency. */
const plans = new WeakMap<Racetrack, VehicleDepot>();
export function vehicleDepot(track: Racetrack): VehicleDepot {
  const cached = plans.get(track);
  if (cached) return cached;
  const { x, y } = track.center;
  const id = `${track.id}:vehicle-depot`;
  const at = (dx: number, dy: number) => ({ x: x + dx, y: y + dy });
  const prop = (suffix: string, propType: string, dx: number, dy: number): FeaturePlacement => ({
    featureId: `${id}:${suffix}`,
    propType,
    wx: (x + dx) * 16,
    wy: (y + dy) * 16,
  });
  const plan: VehicleDepot = {
    id,
    name: `${track.name.replace(/ Speedway$/, "")} Vehicle depot`,
    center: { x, y },
    arrival: at(-13, 0),
    bounds: { minX: x - 32, maxX: x + 32, minY: y - 16, maxY: y + 16 },
    vehicles: [
      ["carrier", "car-transporter", -6, 4],
      ["load", "beetle", -24, 4],
      ["recovery", "tow-truck", -6, 12],
      ["tow-car", "compact-1", -24, 12],
      ["bridge-car", "rosso-coupe", -8, -8],
      ["dump", "dump-truck", 13, 10],
      ["pickup", "pickup", 26, 10],
    ].map(([suffix, model, dx, dy]) => ({
      identity: `placed-vehicle-v1:${id}:${suffix}`,
      model: String(model),
      wx: (x + Number(dx)) * 16,
      wy: (y + Number(dy)) * 16,
      facing: Direction.Right,
    })),
    props: [
      ...["west", "deck", "east"].map((p) => prop(`bridge:${p}`, `prop-depot-bridge-${p}`, 13, -4)),
      prop("lamp:west", "prop-street-lamp", -30, -14),
      prop("lamp:east", "prop-street-lamp", 30, 14),
      prop("bench", "prop-bench", -23, -14),
    ],
  };
  plans.set(track, plan);
  return plan;
}

export function depotSurface(depot: VehicleDepot, x: number, y: number): number | undefined {
  const dx = x - depot.center.x,
    dy = y - depot.center.y;
  // Join the infield to the southern racing lane, leaving the circuit intact.
  if (Math.abs(dx) < 4 && dy >= 16 && dy < 21) return RoadType.Asphalt;
  if (dx < -32 || dx >= 32 || dy < -16 || dy >= 16) return;
  if (dx < -30 || dx >= 30 || dy < -14 || dy >= 14) return RoadType.CityPavement;
  if (dx >= -28 && dx < 0 && [1, 7].includes(dy)) return RoadType.CityLineHTop;
  if (dx >= 7 && dx < 29 && dy >= 7 && [7, 20, 29].includes(dx)) return RoadType.CityLineVLeft;
  return RoadType.Asphalt;
}

/** Include every intersecting surface footprint, even when its anchor is several
 * chunks away. Stable feature IDs deduplicate these ordinary procedural props. */
export function depotPlacements(depot: VehicleDepot, bounds: Bounds) {
  return depot.props.filter((p) => {
    const prop = createProp(p.propType, p.wx, p.wy);
    const box = prop.collider ? getEntityAABB(prop.position, prop.collider) : undefined;
    return (
      Math.min(box?.left ?? p.wx, p.wx - prop.sprite.spriteWidth / 2) < bounds.maxX * 16 &&
      Math.max(box?.right ?? p.wx, p.wx + prop.sprite.spriteWidth / 2) >= bounds.minX * 16 &&
      Math.min(box?.top ?? p.wy, p.wy - prop.sprite.spriteHeight) < bounds.maxY * 16 &&
      Math.max(box?.bottom ?? p.wy, p.wy) >= bounds.minY * 16
    );
  });
}
