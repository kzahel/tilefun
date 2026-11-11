import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Movement } from "../shared/Movement.js";
import {
  FLAT_SCENARIO,
  type ParkedScenarioVehicle,
  type ScenarioRecipe,
} from "./ScenarioRecipe.js";

export type DrivingFixture = "clear" | "jam";
export const DRIVING_VERSION = "straight-and-queue-v1";
export const DRIVING_IDLE: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
// World-relative east, ordinary throttle, no boost. No steering timers or route discovery.
export const DRIVING_INPUT: Movement = { ...DRIVING_IDLE, dx: 1 };
export const DRIVING_WARMUP_TICKS = 180;

/** Controlled flat-road workloads, deliberately separate from the exploratory
 * generated-city drive. Roads are admitted before timing; render terrain still
 * enters the moving camera. No ambient actors or procedurally populated traffic. */
export function drivingBenchRecipe(fixture: DrivingFixture): ScenarioRecipe {
  if (fixture !== "clear" && fixture !== "jam") throw Error("Unknown driving fixture");
  const jam = fixture === "jam";
  const wx = jam ? -432 : 0,
    wy = jam ? -64 : 32;
  const vehicles: ParkedScenarioVehicle[] = [
    { name: "car", model: "compact-1", wx, wy, facing: Direction.Right },
  ];
  if (jam)
    for (const y of [-128, -64, 64, 128]) {
      const right = y === -64 || y === 128;
      for (let i = 0; i < 8; i++)
        vehicles.push({
          name: `queue:${y}:${i}`,
          model: "compact-1",
          wx: -312 + i * 80,
          wy: y,
          facing: right ? Direction.Right : Direction.Left,
          autonomous: true,
        });
      // Ordinary parked leaders keep all four lanes backed up throughout a run.
      vehicles.push({
        name: `leader:${y}`,
        model: "compact-1",
        wx: right ? 408 : -408,
        wy: y,
        facing: right ? Direction.Right : Direction.Left,
      });
    }
  return {
    version: 1,
    id: `${DRIVING_VERSION}:${fixture}`,
    generation: { ...FLAT_SCENARIO, seed: 2026 },
    player: createPlayer(wx, wy + 38),
    props: [],
    measurePhysics: true,
    fixedTrafficPopulation: true,
    parkedVehicles: vehicles,
    roads: jam
      ? [-96, 96].map((y) => ({ left: -512, right: 512, top: y - 64, bottom: y + 64 }))
      : [{ left: -256, right: 7680, top: -64, bottom: 64 }],
    trafficRoads: jam
      ? [-6, 6].map((y) => ({
          a: { x: -32, y },
          b: { x: 32, y },
          width: 8,
          intercity: false,
        }))
      : [],
  };
}
