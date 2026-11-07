import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import { PhysicsScene } from "../physics/PhysicsScene.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import { cityTrainRecipe } from "../scenarios/CityTrainRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { required } from "../shared/required.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createTrain, createTrainCarriages, TRAIN_CARRIAGES } from "./Train.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const ground = {
  getCollision: () => 0,
  getHeight: () => 0,
  queryProps: () => [],
  geometryVersion: () => ({ identity: 1, revision: 0 }),
};
it("carries a standing roof rider in the common step and replays the same prescribed body", async () => {
  const scene = await PhysicsScene.create(),
    train = createTrain(0, 32),
    player = createPlayer(0, 32);
  train.id = 1;
  player.id = 2;
  player.wz = 44;
  const actors = [train, player];
  const moving = new Map([[1, { vx: 48, vy: 0, altitude: 0, heading: 0 }]]);
  try {
    for (let i = 0; i < 30; i++) {
      scene.synchronize(actors);
      scene.step(new Map(), ground);
    }
    const start = player.position.wx;
    for (let i = 0; i < 60; i++) {
      scene.synchronize(actors);
      scene.step(moving, ground);
    }
    expect(train.position.wx).toBeCloseTo(48, 2);
    expect(player.position.wx - start).toBeCloseTo(48, 1);
    expect(player.wz).toBeCloseTo(44, 0);
    scene.step(new Map(), ground);
    expect(player.position.wx - start).toBeCloseTo(48, 1);
    const saved = scene.snapshot();
    scene.step(moving, ground);
    const x = player.position.wx;
    scene.restore(saved);
    scene.step(moving, ground);
    expect(player.position.wx).toBeCloseTo(x, 3);
    expect(scene.diagnostics.worldSteps).toBe(93);
  } finally {
    scene.dispose();
  }
});
it("stops the whole prescribed consist at a static blocker without a second solver", async () => {
  const scene = await PhysicsScene.create(),
    cars = createTrainCarriages(0, 32, [0, 0, 0]);
  cars.forEach((car, i) => {
    car.id = i + 1;
    car.proceduralId = `rail:test:car:${i}`;
    car.physicsGroupId = 2;
  });
  const wall = {
    id: 1,
    type: "wall",
    isProp: true as const,
    position: { wx: 248, wy: 64 },
    sprite: { sheetKey: "wall", frameCol: 0, frameRow: 0, spriteWidth: 0, spriteHeight: 0 },
    collider: { offsetX: 0, offsetY: 0, width: 16, height: 64 },
    walls: null,
  };
  const geometry = {
    ...ground,
    queryProps: () => [wall],
    geometryVersion: () => ({ identity: wall, revision: 0 }),
  };
  try {
    for (let i = 0; i < 120; i++) {
      scene.synchronize(cars);
      scene.step(
        new Map(cars.map((c) => [c.id, { vx: 64, vy: 0, heading: 0, altitude: 0 }])),
        geometry,
      );
    }
    const shift = required(cars[1]).position.wx;
    expect(shift).toBeGreaterThan(0.5);
    expect(shift).toBeLessThan(5);
    for (const [i, car] of cars.entries())
      expect(car.position.wx - required(TRAIN_CARRIAGES[i]).offset).toBeCloseTo(shift, 2);
  } finally {
    scene.dispose();
  }
});
it("recalls the generated station service, travels, persists and rejects an occupied recall", async () => {
  const recipe = cityTrainRecipe();
  recipe.guest = createPlayer(recipe.player.position.wx, recipe.player.position.wy);
  const s = await ScenarioSession.create(recipe);
  try {
    required(s.realm.railways);
    // Other links (e.g. at the default spawn hub) may also be active; use this platform's.
    const nearest = () =>
      required(
        [...required(s.realm.railways).services.values()].find((v) =>
          v.line.stations.some(
            (st) =>
              Math.hypot(
                st.x * 16 - recipe.player.position.wx,
                st.y * 16 - recipe.player.position.wy,
              ) < 640,
          ),
        ),
      );
    const service = nearest();
    const bench = required(
      s.realm.propManager.props.find((p) =>
        p.proceduralId?.startsWith(`${service.line.stations[0]?.id}:bench:`),
      ),
    );
    teleportBody(s.player.player, { wx: bench.position.wx, wy: bench.position.wy + 20, wz: 0 });
    await s.step(idle);
    await s.command({ kind: "call-train", benchId: bench.id });
    expect(service.record.dwell).toBe(8);
    const before = required(service.cars[1]).position.wx;
    for (let i = 0; i < 660; i++) await s.step(idle);
    expect(required(service.cars[1]).position.wx - before).toBeGreaterThan(30);
    const front = required(service.cars[2]);
    const tx = Math.floor(front.position.wx / 16),
      ty = Math.floor(front.position.wy / 16),
      cx = Math.floor(tx / 16),
      cy = Math.floor(ty / 16);
    const chunk = required(s.realm.world.getChunkIfLoaded(cx, cy)),
      road = chunk.getRoad(tx - cx * 16, ty - cy * 16);
    const positions = service.cars.map((c) => ({ ...c.position }));
    chunk.setRoad(tx - cx * 16, ty - cy * 16, 0);
    await s.step(idle);
    service.cars.forEach((c, i) => {
      expect(c.position.wx).toBeCloseTo(required(positions[i]).wx, 2);
    });
    chunk.setRoad(tx - cx * 16, ty - cy * 16, road);
    await s.step(idle);
    const distance = service.record.distance;
    await s.reload();
    const restored = nearest();
    expect(restored.record.distance).toBeCloseTo(distance, 2);
    const car = required(restored.cars[1]);
    teleportBody(s.player.player, { wx: car.position.wx, wy: car.position.wy, wz: 44 });
    await s.step(idle);
    const otherBench = required(
      s.realm.propManager.props.find((p) =>
        p.proceduralId?.startsWith(`${restored.line.stations[0]?.id}:bench:`),
      ),
    );
    const guest = required(s.guest);
    teleportBody(guest.player, {
      wx: otherBench.position.wx,
      wy: otherBench.position.wy + 20,
      wz: 0,
    });
    await expect(
      s.command({ kind: "call-train", benchId: otherBench.id, seat: 1 }),
    ).rejects.toThrow("passengers");
    s.realm.entityManager.remove(car.id, true);
    await s.reload();
    expect(required(s.realm.railways).services.size).toBe(0);
  } finally {
    await s.close();
  }
}, 30000);

it("replicates coherent carriage groups and replays the entire consist without private service metadata", async () => {
  const authority = await PhysicsScene.create(),
    client = await PhysicsScene.create();
  const cars = createTrainCarriages(0, 32, [0, 0, 0]),
    player = createPlayer(-148, 32);
  cars.forEach((c, i) => {
    c.id = i + 1;
    c.physicsGroupId = 2;
    c.proceduralId = `private:car:${i}`;
  });
  player.id = 4;
  player.wz = 44;
  const actors = [...cars, player],
    intents = new Map(cars.map((c) => [c.id, { vx: 48, vy: 0, heading: 0, altitude: 0 }]));
  try {
    for (let i = 0; i < 30; i++) {
      authority.synchronize(actors);
      authority.step(new Map(), ground);
    }
    const baselines = actors.map(serializeEntity);
    const physics = authority.snapshotAround(player.id, new Set(actors.map((e) => e.id)));
    expect(physics.bodies).toHaveLength(4); // Far carriage is beyond the ordinary radius.
    const frame = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 30,
        lastProcessedInputSeq: 0,
        playerEntityId: player.id,
        entityBaselines: baselines,
        physics,
      }),
    );
    if (frame.type !== "frame") throw Error("Missing ordinary frame");
    const copies = required(frame.entityBaselines).map(deserializeEntity);
    expect(
      copies.slice(0, 3).every((c) => c.physicsGroupId === 2 && c.proceduralId === undefined),
    ).toBe(true);
    client.synchronize(copies);
    client.restore(required(frame.physics));
    for (let i = 0; i < 90; i++) {
      authority.step(intents, ground);
      client.step(intents, ground);
      for (const c of actors)
        expect(client.bodyState(c.id)?.x).toBeCloseTo(authority.bodyState(c.id)?.x ?? 0, 3);
    }
    const previous = serializeEntity(required(cars[0]));
    delete required(cars[0]).physicsGroupId;
    const delta = required(diffEntitySnapshots(previous, serializeEntity(required(cars[0]))));
    const changed = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 120,
        lastProcessedInputSeq: 0,
        playerEntityId: 4,
        entityDeltas: [delta],
      }),
    );
    if (changed.type !== "frame") throw Error("Missing delta frame");
    applyEntityDelta(required(copies[0]), required(changed.entityDeltas?.[0]));
    expect(required(copies[0]).physicsGroupId).toBeUndefined();
  } finally {
    authority.dispose();
    client.dispose();
  }
});

it("retains train departure momentum through a jump, steering, wire replay and landing", async () => {
  const scene = await PhysicsScene.create(),
    replay = await PhysicsScene.create();
  const train = createTrain(0, 32),
    player = createPlayer(0, 32);
  train.id = 1;
  player.id = 2;
  player.wz = 44;
  const actors = [train, player];
  const moving = new Map([[1, { vx: 96, vy: 0, altitude: 0, heading: 0 }]]);
  try {
    for (let tick = 0; tick < 30; tick++) {
      scene.synchronize(actors);
      scene.step(moving, ground);
    }
    const relative = player.position.wx - train.position.wx;
    scene.step(
      new Map<number, MotionIntent>([...moving, [2, { vx: 0, vy: 0, jump: true }]]),
      ground,
    );
    const frame = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 31,
        lastProcessedInputSeq: 0,
        playerEntityId: 2,
        entityBaselines: actors.map(serializeEntity),
        physics: scene.snapshot(),
      }),
    );
    if (frame.type !== "frame") throw Error("Missing frame");
    replay.synchronize(required(frame.entityBaselines).map(deserializeEntity));
    replay.restore(required(frame.physics));
    for (let tick = 0; tick < 20; tick++) {
      // Train accelerates after departure; airborne momentum stays at takeoff speed.
      const intents = new Map([
        [1, { vx: 144, vy: 0, altitude: 0, heading: 0 }],
        [2, { vx: 24, vy: 0 }],
      ]);
      scene.step(intents, ground);
      replay.step(intents, ground);
      expect(player.velocity?.vx).toBeCloseTo(120, 2);
      expect(replay.bodyState(2)?.x).toBeCloseTo(player.position.wx, 3);
    }
    expect(player.wz).toBeGreaterThan(50);
    // Match the original support speed, release steering and land back on the roof.
    for (let tick = 0; tick < 60; tick++) scene.step(moving, ground);
    expect(scene.bodyState(2)?.grounded).toBe(true);
    expect(scene.bodyState(2)?.supportId).toBe(1);
    expect(player.position.wx - train.position.wx).toBeCloseTo(relative - 8, 0);
    scene.step(new Map(), ground);
    expect(player.velocity?.vx).toBeCloseTo(0, 2);
    expect(scene.bodyState(2)?.inheritedVx).toBeUndefined();
  } finally {
    scene.dispose();
    replay.dispose();
  }
});

it("consumes inherited flight motion at an elevated wall and clears it on explicit relocation", async () => {
  const scene = await PhysicsScene.create(),
    train = createTrain(0, 32),
    player = createPlayer(0, 32);
  train.id = 1;
  player.id = 2;
  player.wz = 44;
  const actors = [train, player];
  const moving = new Map([[1, { vx: 96, vy: 0, altitude: 0, heading: 0 }]]);
  try {
    for (let tick = 0; tick < 30; tick++) {
      scene.synchronize(actors);
      scene.step(moving, ground);
    }
    scene.step(
      new Map<number, MotionIntent>([...moving, [2, { vx: 0, vy: 0, jump: true }]]),
      ground,
    );
    const wall = surfaceProp(
      { left: player.position.wx + 12, right: player.position.wx + 28, top: 0, bottom: 64 },
      {
        id: "overhead-wall",
        spaceId: "upper",
        z: 100,
        riseX: 0,
        riseY: 0,
        thickness: 44,
        connectsTo: [],
      },
    );
    const geometry = {
      ...ground,
      queryProps: () => [wall],
      geometryVersion: () => ({ identity: wall, revision: 0 }),
    };
    for (let tick = 0; tick < 12; tick++) scene.step(moving, geometry);
    expect(scene.bodyState(2)?.grounded).toBe(false);
    expect(scene.bodyState(2)?.inheritedVx).toBeUndefined();
    expect(player.velocity?.vx).toBeCloseTo(0, 2);
    teleportBody(player, { wx: 1000, wy: 32, wz: 100 });
    scene.synchronize(actors);
    scene.step(moving, ground);
    expect(player.velocity?.vx).toBeCloseTo(0, 2);
    expect(scene.bodyState(2)?.inheritedVx).toBeUndefined();
  } finally {
    scene.dispose();
  }
});

it("freezes and unloads a train outside players' areas and summons it from a far bench", async () => {
  const recipe = cityTrainRecipe();
  const s = await ScenarioSession.create(recipe);
  try {
    const rails = required(s.realm.railways);
    const service = required(
      [...rails.services.values()].find((v) =>
        v.line.stations.some(
          (st) =>
            Math.hypot(
              st.x * 16 - recipe.player.position.wx,
              st.y * 16 - recipe.player.position.wy,
            ) < 640,
        ),
      ),
    );
    const { line } = service,
      far = required(line.stations[1]);
    // Services never add their own terrain demand.
    const owners = () => [
      ...(
        required(s.realm.streaming).interest as unknown as { tickets: Map<string, unknown> }
      ).tickets.keys(),
    ];
    expect(owners().some((o) => o.startsWith("rail-service"))).toBe(false);
    // At the far platform the train is out of every player's area: saved and removed.
    await s.command({ kind: "teleport", position: { wx: far.x * 16, wy: (far.y - 3) * 16 }, z: 0 });
    for (let i = 0; i < 130; i++) await s.step(idle);
    expect(rails.services.has(line.id)).toBe(false);
    expect(service.cars.some((c) => s.realm.entityManager.entities.includes(c))).toBe(false);
    expect(owners().some((o) => o.startsWith("rail-service"))).toBe(false);
    await s.realm.flushAsync();
    const frozen = (await s.realm.saveManager?.store.get("railServices", line.id)) as {
      distance: number;
    };
    expect(frozen.distance).toBeCloseTo(service.record.distance, 3);
    // The bench summons the frozen train straight to this platform.
    const bench = required(
      s.realm.propManager.props.find((p) => p.proceduralId?.startsWith(`${far.id}:bench:`)),
    );
    teleportBody(s.player.player, { wx: bench.position.wx, wy: bench.position.wy + 20, wz: 0 });
    await s.step(idle);
    await s.command({ kind: "call-train", benchId: bench.id });
    const summoned = required(rails.services.get(line.id));
    expect(summoned.record.distance).toBe(required(summoned.path.stops[1]).distance);
    expect(Math.abs(required(summoned.cars[1]).position.wx / 16 - far.x)).toBeLessThan(2);
  } finally {
    await s.close();
  }
}, 30000);
