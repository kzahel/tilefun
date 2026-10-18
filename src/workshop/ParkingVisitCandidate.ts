import { sha256 } from "../art/ArtSource.js";
import collision from "../entities/collision.ts?raw";
import entityMotion from "../entities/EntityManager.ts?raw";
import planner from "../generation/regional/DenseDistrictPlanner.ts?raw";
import layout from "../generation/regional/ParkingLayout.ts?raw";
import scenery from "../generation/regional/ShoppingScenery.ts?raw";
import surfaces from "../road/ParkingSurface.ts?raw";
import { cityParkingRecipe } from "../scenarios/CityParkingRecipe.js";
import cityRecipe from "../scenarios/CityParkingRecipe.ts?raw";
import authority from "../server/Realm.ts?raw";
import driving from "../traffic/Driving.ts?raw";
import service from "../traffic/ParkingSystem.ts?raw";
import centers from "../traffic/ShoppingCenter.ts?raw";
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
      : "Watch the normal generated city shopping trip, with native road arrival, return, obstruction waits and paused save/reload. Pavement and markings use the ordinary terrain chunk renderer.",
    url: `/tilefun/workshop.html#/tool/parking-lab?play=1${city ? "&city=1" : ""}`,
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          scene: cityParkingRecipe(),
          cityRecipe,
          centers,
          scenery,
          layout,
          surfaces,
          traffic,
          planner,
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
