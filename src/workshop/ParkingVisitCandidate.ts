import { sha256 } from "../art/ArtSource.js";
import collision from "../entities/collision.ts?raw";
import entityMotion from "../entities/EntityManager.ts?raw";
import planner from "../generation/regional/DenseDistrictPlanner.ts?raw";
import { cityParkingRecipe } from "../scenarios/CityParkingRecipe.js";
import cityRecipe from "../scenarios/CityParkingRecipe.ts?raw";
import { parkingRecipe } from "../scenarios/ParkingRecipe.js";
import recipe from "../scenarios/ParkingRecipe.ts?raw";
import authority from "../server/Realm.ts?raw";
import driving from "../traffic/Driving.ts?raw";
import layout from "../traffic/ParkingLayout.ts?raw";
import service from "../traffic/ParkingSystem.ts?raw";
import centers from "../traffic/ShoppingCenter.ts?raw";
import scenery from "../traffic/ShoppingScenery.ts?raw";
import traffic from "../traffic/TrafficSystem.ts?raw";
import vehicle from "../traffic/Vehicle.ts?raw";
import { scenarioRuntimeSource } from "./ScenarioRuntimeSource.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildParkingVisitCandidate(city = false): Promise<WorkshopCandidate> {
  return {
    id: city ? "geometry:city-shopping-v1" : "geometry:parking-visits-v1",
    batchId: "parking-visits",
    kind: "geometry",
    name: city
      ? "Generated city · road to shopping center"
      : "Shopping center · parking and shoppers",
    prompt: city
      ? "Follow the same native road car into the generated shopping center, watch its shopper visit and return, then follow its checked merge back onto the boulevard. One visitor per center; no entrance or exit teleport."
      : "Watch complete shopping trips, two-car maneuver admission, pedestrian crossings, obstruction waits and paused save/reload. Four reserved paired bays use forward exits. GPU meshes are the playable default; regional cities also have connected centers.",
    url: `/tilefun/workshop.html#/tool/parking-lab?play=1${city ? "&city=1" : ""}`,
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          scene: city ? cityParkingRecipe() : parkingRecipe(),
          cityRecipe,
          centers,
          scenery,
          layout,
          traffic,
          planner,
          recipe,
          authority,
          service,
          driving,
          vehicle,
          collision,
          entityMotion,
          runtime: scenarioRuntimeSource,
        }),
      ),
    ),
    excluded:
      "Playable behavior study; static parking-pattern review snapshots retain their own identities.",
  };
}
