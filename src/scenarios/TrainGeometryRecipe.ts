import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

export const TRAIN_GEOMETRY_STARTS = {
  bridge: { position: { wx: -544, wy: -28 }, z: 64 },
  underpass: { position: { wx: -544, wy: 40 }, z: 0 },
  tunnel: { position: { wx: 1056, wy: -40 }, z: -96 },
  street: { position: { wx: 1056, wy: -40 }, z: 0 },
} as const;

/** One service, three independent body heights, two termini and shared physical surfaces. */
export function trainGeometryRecipe(reverse = false): ScenarioRecipe {
  const start = TRAIN_GEOMETRY_STARTS.tunnel;
  const player = createPlayer(start.position.wx, start.position.wy);
  player.wz = player.groundZ = start.z;
  const strip = (left: number, right: number) => ({ left, right, top: -48, bottom: 48 });
  return {
    version: 1,
    id: "train-grades-v1",
    generation: FLAT_SCENARIO,
    player,
    physics: { walkSpeed: 120 },
    railways: [
      {
        id: "grade-shuttle",
        start: -88,
        end: 88,
        y: 0,
        surfaceFollowing: { startZ: 0, endZ: -96, startAtEnd: reverse },
      },
    ],
    props: [
      surfaceProp(strip(-1120, -736), {
        id: "rail-up",
        spaceId: "rail",
        z: 0,
        riseX: 64,
        riseY: 0,
        thickness: 8,
        connectsTo: ["rail-bridge"],
      }),
      surfaceProp(strip(-736, -352), {
        id: "rail-bridge",
        spaceId: "rail",
        z: 64,
        riseX: 0,
        riseY: 0,
        thickness: 8,
        connectsTo: ["rail-up", "rail-down"],
      }),
      surfaceProp(strip(-352, 32), {
        id: "rail-down",
        spaceId: "rail",
        z: 64,
        riseX: -64,
        riseY: 0,
        thickness: 8,
        connectsTo: ["rail-bridge"],
      }),
      surfaceProp(strip(256, 768), {
        id: "rail-descent",
        spaceId: "tunnel-entry",
        z: 0,
        riseX: -96,
        riseY: 0,
        thickness: 8,
        connectsTo: ["rail-tunnel-floor"],
        excavation: {},
      }),
      surfaceProp(
        { left: 768, right: 1696, top: -112, bottom: 112 },
        {
          id: "rail-tunnel-floor",
          spaceId: "tunnel",
          z: -96,
          riseX: 0,
          riseY: 0,
          thickness: 8,
          connectsTo: ["rail-descent"],
          excavation: { ceilingId: "rail-tunnel-roof" },
        },
      ),
      surfaceProp(
        { left: 768, right: 1696, top: -112, bottom: 112 },
        {
          id: "rail-tunnel-roof",
          spaceId: "outside",
          z: 0,
          riseX: 0,
          riseY: 0,
          thickness: 8,
          connectsTo: [],
        },
      ),
      ...scenarioWalls(-1728, -160, 1728, 160),
    ],
  };
}
