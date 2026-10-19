import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { TrafficTestHarness } from "./TrafficTestHarness.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("places, drives and reloads the coupe through the shared Realm and saved traffic codec", async () => {
  const session = await ScenarioSession.create({
    version: 1,
    id: "original-coupe",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
  });
  try {
    session.player.editorEnabled = true;
    session.realm.handleMessage(session.player.clientId, session.player, {
      type: "edit-spawn",
      entityType: "vehicle-v1:rosso-coupe",
      wx: 160,
      wy: 0,
    });
    const car = required([...required(session.realm.traffic).states.values()][0]);
    expect(car.entity.type).toBe("vehicle-v1:rosso-coupe");
    expect(car.placed).toBe(true);
    const identity = car.entity.proceduralId;
    session.player.editorEnabled = false;
    session.player.player.position = { wx: 160, wy: -16 };
    session.realm.vehicles.enter(session.player, car.entity.id);
    for (let i = 0; i < 100; i++) await session.step({ ...idle, dx: 1 });
    expect(car.entity.position.wx).toBeGreaterThan(300);
    const position = { ...car.entity.position };
    await session.reload();
    const restored = required(
      [...required(session.realm.traffic).states.values()].find(
        (state) => state.entity.proceduralId === identity,
      ),
    );
    expect(restored.entity.type).toBe("vehicle-v1:rosso-coupe");
    expect(restored.entity.position).toEqual(position);
    expect(session.player.player.parentId).toBe(restored.entity.id);
    session.realm.vehicles.exit(session.player);
    for (let i = 0; i < 60; i++) await session.step(idle);
    expect(restored.parked).toBe(true);
    expect(restored.entity.position).toEqual(position);
  } finally {
    await session.close();
  }
});

it("selects the coupe in ordinary automatic traffic on actual generated roads", () => {
  const scene = new TrafficTestHarness();
  for (const state of [...scene.traffic.states.values()])
    scene.entities.remove(state.entity.id, false);
  // Simulate persisted exclusions for other identities so a 12-car quota cannot
  // mask this family's admission. Lane selection, model choice and collision
  // checks remain the production implementation, with no manually added coupe.
  scene.traffic.canSpawn = (identity) => identity.includes(":rosso-coupe:");
  const graph = scene.strategy.trafficNetwork(4800, 8304);
  const positions = [
    { x: 4800, y: 8304 },
    ...[...graph.lanes.values()].slice(0, 12).map((lane) => lane.a),
  ];
  for (const position of positions) {
    scene.player.position = { wx: position.x, wy: position.y };
    const cx = Math.floor(position.x / 256),
      cy = Math.floor(position.y / 256);
    for (let y = cy - 7; y <= cy + 7; y++)
      for (let x = cx - 7; x <= cx + 7; x++) scene.world.getChunk(x, y);
    scene.traffic.visibleRanges = [{ minCx: cx, maxCx: cx, minCy: cy, maxCy: cy }];
    scene.traffic.tick(2.1, [scene.player]);
    if (scene.traffic.states.size) break;
  }
  const car = required([...scene.traffic.states.values()][0]);
  expect(car.entity.type).toBe("vehicle-v1:rosso-coupe");
  expect(car.placed).not.toBe(true);
  expect(car.lane.width).toBeGreaterThanOrEqual(84);
  expect(car.entity.proceduralId).toContain("traffic-v1:");
});
