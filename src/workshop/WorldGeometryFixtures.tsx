import { cityTrainRecipe } from "../scenarios/CityTrainRecipe.js";
import { CROWD_VIEW, crowdBenchRecipe } from "../scenarios/CrowdBenchRecipe.js";
import { JUMP_STARTS, type JumpLane, jumpParkRecipe } from "../scenarios/JumpParkRecipe.js";
import { outskirtsParkRecipe, PARK_STARTS } from "../scenarios/OutskirtsParkRecipe.js";
import { CROSSING_STARTS, railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import { realmPhysicsRecipe } from "../scenarios/RealmPhysicsRecipe.js";
import {
  crowdedRoadTrafficRecipe,
  roadTrafficRecipe,
  TRAFFIC_STARTS,
} from "../scenarios/RoadTrafficRecipe.js";
import type { ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { TREE_HOUSE_AT, TREE_HOUSE_STARTS, treeHouseRecipe } from "../scenarios/TreeHouseRecipe.js";
import { GARAGE_STARTS, undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import { DYNAMICS_STARTS, vehicleDynamicsRecipe } from "../scenarios/VehicleDynamicsRecipe.js";
import {
  VEHICLE_BRIDGE_STARTS,
  VEHICLE_GARAGE_STARTS,
  vehicleGeometryRecipe,
} from "../scenarios/VehicleGeometryRecipe.js";
import { GEOMETRY_STARTS, worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import type { TRAFFIC_FIXTURES } from "./TrafficFixtures.js";

type Start = { position: { wx: number; wy: number }; z: number };
interface FixtureChoice {
  fixture: string;
  generated?:
    | {
        recipe: ScenarioRecipe;
        starts: Record<string, Start>;
        bridge?: { x: number; y: number };
      }
    | undefined;
  ambient?: (typeof TRAFFIC_FIXTURES)[string] | undefined;
}

/** World geometry fixtures with one fixed recipe and named teleport starts. */
const STATIC_FIXTURES: Record<
  string,
  { recipe: () => ScenarioRecipe; starts?: Record<string, Start> }
> = {
  "tree-house": { recipe: treeHouseRecipe, starts: TREE_HOUSE_STARTS },
  "outskirts-park": { recipe: outskirtsParkRecipe, starts: PARK_STARTS },
  crossing: { recipe: railCrossingRecipe, starts: CROSSING_STARTS },
  garage: { recipe: undergroundGarageRecipe, starts: GARAGE_STARTS },
  traffic: { recipe: roadTrafficRecipe, starts: TRAFFIC_STARTS },
  "traffic-crowd": { recipe: crowdedRoadTrafficRecipe },
  crowd: { recipe: () => crowdBenchRecipe() },
  train: { recipe: cityTrainRecipe },
};

export function geometryRecipe(
  choice: FixtureChoice & {
    vehicleModel: string;
    route: keyof typeof DYNAMICS_STARTS;
    lane: JumpLane;
    reverse: boolean;
  },
): ScenarioRecipe {
  const { fixture, generated, ambient } = choice;
  if (generated) return generated.recipe;
  if (fixture === "car-dynamics") return vehicleDynamicsRecipe(choice.vehicleModel, choice.route);
  if (fixture === "car-jumps") return jumpParkRecipe(choice.vehicleModel, choice.lane);
  if (fixture === "realm") {
    const crowd = new URLSearchParams(location.search).get("crowd");
    return realmPhysicsRecipe(crowd === null ? undefined : Number(crowd));
  }
  if (fixture.startsWith("car-"))
    return vehicleGeometryRecipe(fixture === "car-garage", choice.reverse, choice.vehicleModel);
  return STATIC_FIXTURES[fixture]?.recipe() ?? ambient?.recipe() ?? worldGeometryRecipe();
}

export function geometryStarts(
  { fixture, generated, ambient }: FixtureChoice,
  recipe: ScenarioRecipe,
): Record<string, Start> {
  if (generated) return generated.starts;
  if (fixture === "train") return { bench: { position: recipe.player.position, z: 0 } };
  if (fixture === "traffic-crowd" || fixture === "crowd" || ambient)
    return { sidewalk: { position: recipe.player.position, z: 0 } };
  if (fixture === "car-dynamics") return DYNAMICS_STARTS;
  if (fixture === "car-jumps") return JUMP_STARTS;
  if (fixture.startsWith("car-"))
    return fixture === "car-garage" ? VEHICLE_GARAGE_STARTS : VEHICLE_BRIDGE_STARTS;
  return STATIC_FIXTURES[fixture]?.starts ?? GEOMETRY_STARTS;
}

const TERRAIN_FIXTURES = new Set([
  "realm",
  "crowd",
  "traffic",
  "traffic-crowd",
  "train",
  "car-dynamics",
  "car-jumps",
  "tree-house",
  "outskirts-park",
]);
const FOLLOW_FIXTURES = new Set(["outskirts-park", "realm", "train"]);
const ZOOMS: Record<string, number> = {
  "traffic-crowd": 0.125,
  crowd: CROWD_VIEW.zoom,
  "car-jumps": 0.25,
  "tree-house": 1,
  "outskirts-park": 0.7,
  "car-dynamics": 0.4,
  train: 0.4,
  crossing: 0.225,
  traffic: 0.225,
};

/** Terrain, camera and zoom per fixture. `&zoom=` overrides zoom for overview captures. */
export function geometryView({ fixture, generated, ambient }: FixtureChoice) {
  const follow = fixture.startsWith("car-") || FOLLOW_FIXTURES.has(fixture);
  const fixed = generated?.bridge
    ? { wx: generated.bridge.x * 16, wy: generated.bridge.y * 16 - 16 }
    : fixture === "tree-house"
      ? { wx: TREE_HOUSE_AT.wx, wy: TREE_HOUSE_AT.wy - 72 }
      : fixture === "crowd"
        ? CROWD_VIEW.camera
        : (ambient?.camera ?? { wx: 0, wy: -16 });
  const override = Number(new URLSearchParams(location.search).get("zoom")) || undefined;
  return {
    terrain: !!generated || !!ambient || TERRAIN_FIXTURES.has(fixture),
    camera: follow ? undefined : fixed,
    zoom: override ?? ambient?.zoom ?? ZOOMS[fixture] ?? (generated ? 0.225 : 0.625),
  };
}

export function GeometryIntro({ fixture }: { fixture: string }) {
  if (fixture === "outskirts-park")
    return (
      <>
        <h1>Outskirts park</h1>
        <p>
          Walk in under the camping sign and follow the dirt trails: west to the campground (tents,
          campfire, log seats you can stand on), east to the fishing pond and its dock, north-west
          to the tree house ladder, and north-east to the fenced wildlife meadow with deer and
          rabbits — hop the low fence to visit. Ducks and frogs live at the pond. The buttons jump
          to each area. Arrows / WASD / D-pad move, Space jumps.
        </p>
      </>
    );
  if (fixture === "tree-house")
    return (
      <>
        <h1>Tree house</h1>
        <p>
          The deck is just above a jump, so take the ladder: walk to its foot and hold ↑ / W / D-pad
          up to climb, ↓ to climb down, and let go to hang on. ← or → lets go of the ladder. At the
          top, keep pressing ↑ to step onto the porch, then walk through the door: the roof and
          branches lift away while you are inside the cabin. Touch and controller use the same
          controls; Space jumps.
        </p>
      </>
    );
  if (fixture === "car-jumps")
    return (
      <>
        <h1>Jump park</h1>
        <p>
          Five jump lanes, west to east: <b>kicker</b> with a curved lip, <b>sky</b> quarter-pipe
          lip, straight <b>double</b>, long <b>tabletop</b> and <b>rollers</b>. Each lane button
          restarts seated at its start line. ↑/W drives, ←/→ steer, hold Shift / RT / Boost for full
          speed. Race-tuned cars are faster and boost harder. F / D-pad down rights an overturned
          car; E gets out.
        </p>
      </>
    );
  const traffic = fixture === "traffic";
  return (
    <>
      <h1>{traffic ? "Driving and traffic" : "World geometry lab"}</h1>
      <p>
        {traffic
          ? "Watch road cars follow lanes and wait at crossings, or drive the parked car beside the sidewalk. "
          : "Walk ramps, cross bridges, pass underneath and drive freely rotating cars. "}
        Arrows/WASD move, Space jumps, E enters or leaves a nearby car. Driving: ↑/W forward, ↓/S
        reverse, ←/→ or A/D steer. R also reverses. Touch and controller use the same controls. F /
        D-pad down rights an overturned car or works stopped equipment (dump bed, tow, ramp).
        {fixture === "car-dynamics" &&
          " Main lane: bridge ascent/descent. South: jump ramp. North: narrow tipping ledge and overlapping cars. Ramp and roof starts let you jump in place to inspect shadows and landing dust. "}
        At a station bench, E / Interact calls the train; nearby vehicle roofs give a higher jump.
        Bed, tow and transport starts set up each machine.
      </p>
    </>
  );
}
