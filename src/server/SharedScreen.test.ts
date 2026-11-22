import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { SHARED_SCREEN_SPAN } from "../physics/SharedScreenLeash.js";
import { FLAT_SCENARIO, scenarioWalls } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { World } from "../world/World.js";
import { PlayerSession, seatSessionId } from "./PlayerSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("brakes the driving seat at the shared edge, lets it reverse, and leaves another device free", async () => {
  const scenario = await ScenarioSession.create({
    version: 1,
    id: "shared-screen-car",
    generation: FLAT_SCENARIO,
    player: createPlayer(16, 64),
    props: [],
    parkedVehicles: [{ model: "compact-1", wx: 64, wy: 64, facing: 3 }],
  });
  const predictor = new PlayerPredictor(
    () => 1,
    () => 0,
  );
  try {
    const { realm, player: host } = scenario;
    const car = realm.entityManager.entities.find((e) => e.type === "vehicle-v1:compact-1");
    if (!car?.collider) throw Error("Missing car");
    const box = getEntityAABB(car.position, car.collider);
    await scenario.command({ kind: "teleport", position: { wx: box.left - 12, wy: 64 } });
    await scenario.command({ kind: "enter-vehicle", entityId: car.id });
    const guest = new PlayerSession(seatSessionId(host.clientId, 1));
    const remote = new PlayerSession("other-device");
    for (const session of [guest, remote]) {
      session.editorEnabled = false;
      await realm.addPlayer(session);
      session.visibleRange = { ...host.visibleRange };
    }
    guest.player.position = { wx: 64 - SHARED_SCREEN_SPAN.x + 12, wy: 64 };
    remote.player.position = { wx: 64, wy: 116 };
    await scenario.ready();
    let sequence = 0;
    function step(driver: number, walker = 0, sharedScreen = true) {
      ++sequence;
      for (const [session, dx] of [
        [host, driver],
        [guest, walker],
        [remote, 1],
      ] as const) {
        realm.handleMessage(session.clientId, session, {
          type: "player-input",
          ...idle,
          dx,
          seq: sequence,
          ...(session === host && sharedScreen && { sharedScreen }),
        });
      }
      scenario.tick();
    }
    const spread = () => car.position.wx - guest.player.position.wx;
    for (let i = 0; i < 60; i++) step(1);
    expect(spread()).toBeCloseTo(SHARED_SCREEN_SPAN.x, 0);
    expect(Math.abs(car.velocity?.vx ?? 0)).toBeLessThan(1);
    expect(remote.player.position.wx).toBeGreaterThan(car.position.wx + 30);

    // The same barrier applies in unacknowledged forward prediction. Compare
    // actual predicted/solved poses, independently of camera interpolation.
    const view = new RemoteStateView(new World());
    for (const message of realm.replicate(host.clientId, [guest])) {
      if (message.type === "frame") view.applyFrame(message, 0);
      else if (message.type.startsWith("sync-"))
        view.applyMessage(message as Parameters<typeof view.applyMessage>[0]);
    }
    if (!view.physicsState) throw Error("Missing physics snapshot");
    await predictor.ready;
    predictor.reset(view.serverPlayerEntity, view.serverEntityMap.get(car.id));
    predictor.reconcile(
      view.serverPlayerEntity,
      sequence,
      view.world,
      view.props,
      view.serverEntityMap,
      undefined,
      { physics: view.physicsState, seats: view.seats.entities },
    );
    for (let i = 1; i <= 8; i++) {
      const move = { ...idle, dx: 1 };
      predictor.storeInput(sequence + i, move, PHYSICS_DT, new Map([[1, idle]]), true);
      predictor.update(PHYSICS_DT, move, view.world, view.props, view.entities);
    }
    const predictedCar = predictor.publishedBody(car.id).body;
    expect(predictedCar?.position.wx).toBeCloseTo(car.position.wx, 0);

    for (let i = 0; i < 20; i++) step(-1);
    expect(spread()).toBeLessThan(SHARED_SCREEN_SPAN.x - 5);
    for (let i = 0; i < 40; i++) step(1);
    const edge = car.position.wx;
    for (let i = 0; i < 30; i++) step(1, 1);
    expect(car.position.wx).toBeGreaterThan(edge + 10);
    expect(spread()).toBeLessThanOrEqual(SHARED_SCREEN_SPAN.x + 0.1);

    for (let i = 0; i < 30; i++) step(1, 0, false);
    expect(spread()).toBeGreaterThan(SHARED_SCREEN_SPAN.x + 12);
    const separated = spread();
    for (let i = 0; i < 15; i++) step(1);
    expect(spread()).toBeCloseTo(separated, 0);
  } finally {
    predictor.clearPredicted();
    await scenario.close();
  }
});

it("does not let a leading seat creep away when the trailing seat walks into a wall", async () => {
  const scenario = await ScenarioSession.create({
    version: 1,
    id: "shared-screen-wall",
    generation: FLAT_SCENARIO,
    player: createPlayer(SHARED_SCREEN_SPAN.x, 0),
    props: scenarioWalls(-80, -80, 8, 80),
  });
  try {
    const { realm, player: host } = scenario;
    const guest = new PlayerSession(seatSessionId(host.clientId, 1));
    guest.editorEnabled = false;
    await realm.addPlayer(guest);
    guest.player.position = { wx: 0, wy: 0 };
    guest.visibleRange = { ...host.visibleRange };
    await scenario.ready();
    for (let seq = 1; seq <= 90; seq++) {
      realm.handleMessage(host.clientId, host, {
        type: "player-input",
        ...idle,
        dx: 1,
        seq,
        sharedScreen: true,
      });
      realm.handleMessage(guest.clientId, guest, { type: "player-input", ...idle, dx: 1, seq });
      scenario.tick();
    }
    expect(guest.player.position.wx).toBeLessThan(8);
    expect(host.player.position.wx - guest.player.position.wx).toBeCloseTo(SHARED_SCREEN_SPAN.x, 0);
  } finally {
    await scenario.close();
  }
});
