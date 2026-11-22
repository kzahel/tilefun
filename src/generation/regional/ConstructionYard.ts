import {
  CONSTRUCTION_BLOCK,
  CONSTRUCTION_CARGO,
  CONSTRUCTION_CRATE,
  CONSTRUCTION_PALLET,
} from "../../entities/ConstructionCargo.js";
import { CONSTRUCTION_RUBBLE } from "../../entities/ConstructionRubble.js";
import { Direction } from "../../entities/Entity.js";
import { RoadType } from "../../road/RoadType.js";
import type { ActorPlacement } from "../Generator.js";
import {
  MARBLE_CRANE_START,
  marbleRunActors,
  SEESAW_CAR_START,
  seesawActors,
} from "./ConstructionPlayground.js";
import type { MotocrossPark } from "./MotocrossPlanner.js";
import type { VehicleDepot } from "./VehicleDepotPlanner.js";

export interface ConstructionYard extends VehicleDepot {
  rubble: ActorPlacement[];
  cargo: ActorPlacement[];
}

export const CRATE_RUN_CAR = "race-coupe";

export const YARD_MARBLE_RUN = { x: -1.5, y: -12.75 };
export const YARD_SEESAW = { x: -14.875, y: 2.9 };

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
  const vehicle = (model: string, dx: number, dy: number, role = model) => ({
    identity: `placed-vehicle-v1:${id}:${role}`,
    model,
    wx: (x + dx) * 16,
    wy: (y + dy) * 16,
    facing: Direction.Right,
  });
  const cargo = (suffix: string, type: string, dx: number, dy: number, wz?: number) => ({
    featureId: `${id}:${suffix}`,
    type,
    wx: (x + dx) * 16,
    wy: (y + dy) * 16,
    ...(wz === undefined ? {} : { wz }),
    route: [],
  });
  const plan: ConstructionYard = {
    id,
    name: park.name.replace(/Motocross park$/, "Construction yard"),
    center: at(0, 0),
    arrival: at(-6, -2.5),
    bounds: { minX: x - 26, maxX: x + 17, minY: y - 15, maxY: y + 15 },
    vehicles: [
      vehicle("excavator", -6, 0),
      vehicle("dump-truck", -4, 4.5),
      vehicle("bulldozer", -11, -7),
      vehicle("mobile-crane", 5, -4),
      vehicle("forklift", -5.25, -6.6),
      vehicle("flatbed-truck", 6.4, 3.25),
      vehicle(CRATE_RUN_CAR, -11.5, 9.2),
      vehicle(
        "mobile-crane",
        YARD_MARBLE_RUN.x + MARBLE_CRANE_START.wx / 16,
        YARD_MARBLE_RUN.y + MARBLE_CRANE_START.wy / 16,
        "marble-crane",
      ),
      vehicle(
        "rally-hatchback",
        YARD_SEESAW.x + SEESAW_CAR_START.wx / 16,
        YARD_SEESAW.y,
        "seesaw-car",
      ),
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
        [13, 5],
        [14, 4],
      ].map(([dx = 0, dy = 0], i) => prop(`stone:${i}`, "prop-low-rock", dx, dy)),
    ],
    cargo: [
      ...marbleRunActors().map((actor) =>
        cargo(
          `marble:${actor.name}`,
          actor.type,
          YARD_MARBLE_RUN.x + actor.wx / 16,
          YARD_MARBLE_RUN.y + actor.wy / 16,
          "wz" in actor ? actor.wz : undefined,
        ),
      ),
      ...seesawActors().map((actor) =>
        cargo(
          `seesaw:${actor.name}`,
          actor.type,
          YARD_SEESAW.x + actor.wx / 16,
          YARD_SEESAW.y + actor.wy / 16,
        ),
      ),
      cargo("pallet:1", CONSTRUCTION_PALLET, 10.3, -4.38),
      cargo("pallet:2", CONSTRUCTION_PALLET, 10.65, -5.75),
      cargo("forklift:pallet", CONSTRUCTION_PALLET, -1.55, -6.6),
      cargo("forklift:spare-pallet", CONSTRUCTION_PALLET, -1.55, -8.2),
      ...[
        [-1, 0],
        [0, 0],
        [1, 0],
        [-0.5, 14.1],
        [0.8, 14.1],
      ].map(([dx = 0, wz = 0], i) =>
        cargo(`block:${i}`, CONSTRUCTION_BLOCK, 10.3 + dx * 1.3, -0.8, wz),
      ),
      ...[4, 3, 2].flatMap((count, row) =>
        Array.from({ length: count }, (_, column) =>
          cargo(
            `crate:${row}:${column}`,
            CONSTRUCTION_CRATE,
            7 - row * 0.15 + (column % 2 === 0 ? -0.27 : 0.27),
            9 + (column - (count - 1) / 2) * 1.1,
            row * (CONSTRUCTION_CARGO[CONSTRUCTION_CRATE].collider.physicalHeight + 0.05),
          ),
        ),
      ),
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
  if (dx >= -26 && dx < -8 && dy >= 1 && dy < 6) return RoadType.Asphalt;
  if (Math.abs(dx) < 16 && dy >= -15 && dy < -10) return RoadType.Asphalt;
  if (Math.abs(dx) >= 17 || dy < -12 || dy >= 12) return;
  return dy >= 6 || (dx > 6 && dx < 15 && dy > -8) ? RoadType.Asphalt : RoadType.None;
}
