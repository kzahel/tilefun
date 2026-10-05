// Diagnostic fixture data only. Native colliders and gameplay rules are unchanged.
import { required } from "../../src/art/ArtCatalog.js";
import { createCow } from "../../src/entities/Cow.js";
import type { Entity } from "../../src/entities/Entity.js";
import { createPerson1 } from "../../src/entities/Person.js";
import { createPlayer } from "../../src/entities/Player.js";
import type { Movement } from "../../src/input/ActionManager.js";
import {
  FLAT_SCENARIO,
  type ScenarioRecipe,
  scenarioWalls,
} from "../../src/scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.js";
import { path, samplePath } from "../../src/traffic/LaneGraph.js";

export const CONTACT_CASES = [
  "free-walk",
  "static-wall",
  "person-still",
  "person-away",
  "person-crossing",
  "person-head-on",
  "cow-still",
  "cow-away",
  "car-roof",
  "train-roof",
] as const;
export type ContactCase = (typeof CONTACT_CASES)[number];
export const IDLE: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
export const RIGHT: Movement = { ...IDLE, dx: 1 };
export const COMMAND_DT = 0.01667;
export const SERVER_DT = 1 / 60;

export function contactRecipe(name: ContactCase): ScenarioRecipe {
  const recipe: ScenarioRecipe = {
    version: 1,
    id: `prediction-${name}`,
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
  };
  if (name === "static-wall") {
    recipe.props = [required(scenarioWalls(-128, -128, 48, 128)[3])];
  } else if (name.startsWith("person") || name.startsWith("cow")) {
    const npc = name.startsWith("cow") ? createCow(40, 0) : createPerson1(40, 0);
    const ai = required(npc.wanderAI);
    // A known initial native AI state prevents unrelated random direction changes.
    // Collision-triggered native reversals and separation still run normally.
    ai.timer = 100;
    ai.state = name.endsWith("still") ? "idle" : "walking";
    ai.dirX = name.endsWith("head-on") ? -1 : name.endsWith("away") ? 1 : 0;
    ai.dirY = name.endsWith("crossing") ? -1 : 0;
    if (name.endsWith("crossing")) npc.position = { wx: 48, wy: 14 };
    recipe.actors = [npc];
  } else if (name === "car-roof") {
    const a = { x: -512, y: 0 },
      b = { x: 1536, y: 0 };
    const route = path([a, b]);
    recipe.player = createPlayer(a.x, 100);
    recipe.roads = [{ left: -608, right: 1632, top: -48, bottom: 48 }];
    recipe.trafficSpeed = 36;
    recipe.trafficLanes = [
      {
        id: "prediction-straight-car",
        from: "start",
        to: "end",
        a,
        b,
        path: route,
        direction: samplePath(route, 0).direction,
        width: 96,
        intercity: false,
        surfaceFollowing: true,
      },
    ];
    recipe.traffic = [
      {
        name: "car",
        model: "compact-1",
        laneId: "prediction-straight-car",
        x: a.x,
        y: a.y,
        distance: 0,
      },
    ];
  } else if (name === "train-roof") {
    recipe.player = createPlayer(-1728, 100);
    recipe.railways = [
      {
        id: "prediction-straight-train",
        start: -128,
        end: 128,
        y: 0,
        path: {
          closed: false,
          segments: [{ kind: "line", x: -2048, y: 0, endX: 2048, endY: 0 }],
          stops: [
            { distance: 320, name: "Start" },
            { distance: 3776, name: "End" },
          ],
        },
      },
    ];
  }
  return recipe;
}

export async function openContactCase(name: ContactCase) {
  const session = await ScenarioSession.create(contactRecipe(name));
  try {
    if (name === "train-roof") {
      // Depart through the production eight-second dwell and reach cruise speed.
      for (let i = 0; i < 630; i++) await session.step(IDLE);
      await session.command({ kind: "train-position", roof: true });
    } else if (name === "car-roof") {
      for (let i = 0; i < 150; i++) await session.step(IDLE);
      await session.command({ kind: "traffic-position", roof: true });
    }
    const target = contactTarget(session, name);
    if (name.endsWith("roof")) {
      const expectedSpeed = name === "train-roof" ? 192 : 36;
      if (
        !target ||
        Math.abs(Math.hypot(target.velocity?.vx ?? 0, target.velocity?.vy ?? 0) - expectedSpeed) >
          0.01
      )
        throw Error(`Fixture did not reach cruise speed: ${name}`);
    }
    return session;
  } catch (error) {
    await session.close();
    throw error;
  }
}

export function contactTarget(session: ScenarioSession, name: ContactCase): Entity | undefined {
  if (name === "train-roof")
    return [...(session.realm.railway?.services.values() ?? [])][0]?.entity;
  return session.realm.entityManager.entities.find(
    (e) => e.id === session.handles.car || e.type === "person1" || e.type === "cow",
  );
}
