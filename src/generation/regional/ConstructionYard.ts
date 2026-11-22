import { CONSTRUCTION_RUBBLE } from "../../entities/ConstructionRubble.js";
import { Direction } from "../../entities/Entity.js";
import { RoadType } from "../../road/RoadType.js";
import type { ActorPlacement } from "../Generator.js";
import type { MotocrossPark } from "./MotocrossPlanner.js";
import type { VehicleDepot } from "./VehicleDepotPlanner.js";

export interface ConstructionYard extends VehicleDepot {
  rubble: ActorPlacement[];
}

const plans = new WeakMap<MotocrossPark, ConstructionYard>();

/** Use the dry east infield, clear of the race lanes and central practice rollers. */
export function constructionYard(park: MotocrossPark): ConstructionYard {
  const cached = plans.get(park);
  if (cached) return cached;
  const id = `${park.id.replace(/:motocross$/, "")}:construction`;
  const x = park.center.x + 55,
    y = park.center.y;
  const at = (dx: number, dy: number) => ({ x: x + dx, y: y + dy });
  const prop = (suffix: string, propType: string, dx: number, dy: number) => ({
    featureId: `${id}:${suffix}`,
    propType,
    wx: (x + dx) * 16,
    wy: (y + dy) * 16,
  });
  const vehicle = (model: string, dx: number, dy: number) => ({
    identity: `placed-vehicle-v1:${id}:${model}`,
    model,
    wx: (x + dx) * 16,
    wy: (y + dy) * 16,
    facing: Direction.Right,
  });
  const plan: ConstructionYard = {
    id,
    name: park.name.replace(/Motocross park$/, "Construction yard"),
    center: at(0, 0),
    arrival: at(-6, -2.5),
    bounds: { minX: x - 17, maxX: x + 17, minY: y - 12, maxY: y + 15 },
    vehicles: [
      vehicle("excavator", -6, 0),
      vehicle("dump-truck", -4, 4.5),
      vehicle("bulldozer", -11, -7),
    ],
    props: [
      prop("shed", "prop-shed", 11, -7),
      prop("lamp:left", "prop-street-lamp", -14, 11),
      prop("lamp:right", "prop-street-lamp", 15, 11),
      ...[-14, -10, -6, -2, 2, 6, 10, 14].map((dx) =>
        prop(`fence:${dx}`, "prop-city-street-v1-bollard", dx, -10),
      ),
      ...[
        [-14, -9],
        [-12, -9],
        [0, -8],
        [3, -7],
        [13, 5],
        [14, 4],
      ].map(([dx = 0, dy = 0], i) => prop(`stone:${i}`, "prop-low-rock", dx, dy)),
    ],
    rubble: [
      [-3, 0],
      [-2.65, -0.55],
      [-2.4, 0.3],
      [-1.8, -0.6],
      [-1.3, -0.3],
    ].map(([dx = 0, dy = 0], i) => ({
      featureId: `${id}:rubble:${i}`,
      type: CONSTRUCTION_RUBBLE,
      wx: (x + dx) * 16,
      wy: (y + dy) * 16,
      route: [],
    })),
  };
  plans.set(park, plan);
  return plan;
}

export function yardRoad(yard: ConstructionYard, x: number, y: number): RoadType | undefined {
  const dx = x - yard.center.x;
  const dy = y - yard.center.y;
  if (Math.abs(dx) < 3 && dy >= 10 && dy < 16) return RoadType.Asphalt;
  if (Math.abs(dx) >= 17 || dy < -12 || dy >= 12) return;
  return dy >= 6 || (dx > 6 && dx < 15 && dy > -8) ? RoadType.Asphalt : RoadType.None;
}
