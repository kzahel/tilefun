import { afterEach, expect, it } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import type { Movement } from "../input/ActionManager.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { PlayerSession } from "../server/PlayerSession.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../shared/binaryCodec.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";
import { predictInput } from "./predictInput.js";

const idle: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function setup(recipe?: ScenarioRecipe) {
  const npc = createChicken(60, 32);
  if (npc.wanderAI) npc.wanderAI.timer = 100;
  const s = await ScenarioSession.create(
    recipe ?? {
      version: 1,
      id: "shared-prediction",
      generation: FLAT_SCENARIO,
      player: createPlayer(16, 32),
      props: [],
      actors: [npc],
    },
  );
  cleanup.push(() => s.close());
  await s.step(idle);
  let now = 0;
  const view = new RemoteStateView(new World());
  const predictor = new PlayerPredictor(
    () => 1,
    () => now,
  );
  cleanup.push(() => predictor.clearPredicted());
  await predictor.ready;
  function receive(frames: ArrayBuffer[]) {
    for (const buffer of frames) {
      const msg = decodeServerMessage(buffer);
      if (msg.type === "frame" || msg.type.startsWith("sync-"))
        view.applyMessage(msg as Parameters<typeof view.applyMessage>[0]);
    }
    if (!predictor.player) predictor.reset(view.serverPlayerEntity);
    predictor.reconcile(
      view.serverPlayerEntity,
      view.lastProcessedInputSeq,
      view.world,
      view.props,
      view.serverEntities,
      view.mountEntityId,
      { serverTick: view.serverTick, ...(view.physicsState ? { physics: view.physicsState } : {}) },
    );
  }
  receive(s.frames());
  function input(seq: number, movement: Movement, dt = PHYSICS_DT) {
    now += PHYSICS_DT;
    predictInput(predictor, seq, movement, dt, view.world, view.props, view.serverEntities);
  }
  return { s, view, predictor, receive, input };
}

it("uses the ordinary shared kernel to predict contacts, with a fixed tick independent of command duration", async () => {
  const f = await setup(),
    before = structuredClone(f.view.serverEntities);
  for (let seq = 1; seq <= 90; seq++) f.input(seq, { ...idle, dx: 1 }, 0.1);
  expect(f.predictor.player?.position.wx).toBeGreaterThan(65);
  const shown = f.predictor.presentEntities(1, f.view.serverEntities);
  expect(shown.find((e) => e.type === "chicken")?.position.wx).toBeGreaterThan(65);
  expect(f.predictor.player?.position.wx).toBeLessThan(115);
  expect(f.view.serverEntities).toEqual(before);
  expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
});

it("reconciles delayed ordered input/snapshots through pushing, reversal, jump and release", async () => {
  const f = await setup();
  const inputs: { at: number; buffer: ArrayBuffer }[] = [],
    frames: { at: number; buffers: ArrayBuffer[] }[] = [];
  let lastInput = 0,
    lastFrame = 0,
    maxCorrection = 0,
    maxReplay = 0;
  for (let tick = 1; tick <= 240; tick++) {
    const movement = { ...idle, dx: tick < 80 ? 1 : tick < 130 ? -1 : 0, jump: tick === 150 };
    f.input(tick, movement);
    lastInput = Math.max(lastInput, tick + 4 + (tick % 3));
    inputs.push({
      at: lastInput,
      buffer: encodeClientMessage({ type: "player-input", seq: tick, ...movement }),
    });
    while (inputs[0] && inputs[0].at <= tick) {
      const item = inputs.shift();
      if (item)
        f.s.realm.handleMessage(f.s.player.clientId, f.s.player, decodeClientMessage(item.buffer));
    }
    f.s.tick();
    lastFrame = Math.max(lastFrame, tick + 4 + ((tick + 1) % 3));
    frames.push({ at: lastFrame, buffers: f.s.frames() });
    while (frames[0] && frames[0].at <= tick) {
      const item = frames.shift();
      if (item) f.receive(item.buffers);
    }
    maxCorrection = Math.max(maxCorrection, f.predictor.lastReconcileDiagnostics?.resimPosErr ?? 0);
    maxReplay = Math.max(maxReplay, f.predictor.recoveryDiagnostics.replayStepsThisTick);
  }
  for (let i = 0; i < 30; i++) {
    f.s.tick();
    f.receive(f.s.frames());
    f.predictor.update(PHYSICS_DT, idle, f.view.world, f.view.props, f.view.serverEntities);
  }
  expect(maxReplay).toBeLessThanOrEqual(8);
  expect(maxCorrection).toBeLessThan(16);
  expect(f.predictor.player?.position.wx).toBeCloseTo(f.s.player.player.position.wx, 1);
  expect(f.predictor.player?.wz).toBeCloseTo(f.s.player.player.wz ?? 0, 1);
  expect(f.predictor.recoveryDiagnostics.retainedInputs).toBeLessThan(16);
});

it("bounds history/replay and resumes from an acknowledged fence instead of inventing missing travel", async () => {
  const f = await setup();
  for (let seq = 1; seq <= 150; seq++) f.input(seq, { ...idle, dx: 1 });
  expect(f.predictor.recoveryDiagnostics.status).toBe("history-gap");
  expect(f.predictor.recoveryDiagnostics.retainedInputs).toBe(120);
  f.s.realm.handleMessage(f.s.player.clientId, f.s.player, {
    type: "player-input",
    seq: 150,
    ...idle,
  });
  f.s.tick();
  f.receive(f.s.frames());
  f.predictor.update(PHYSICS_DT, idle, f.view.world, f.view.props, f.view.serverEntities);
  expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
  expect(f.predictor.recoveryDiagnostics.retainedInputs).toBe(0);
  expect(f.predictor.player?.position.wx).toBeCloseTo(f.s.player.player.position.wx, 2);
});

it("predicts NPC head support and a fresh jump with the normal authority scene", async () => {
  const f = await setup();
  await f.s.command({ kind: "teleport", position: { wx: 60, wy: 32 }, z: 30 });
  f.receive(f.s.frames());
  for (let seq = 2; seq <= 100; seq++) {
    f.input(seq, idle);
    await f.s.step(idle);
    f.receive(f.s.frames());
  }
  expect(f.predictor.player?.wz).toBeCloseTo(8, 0);
  expect(f.predictor.player?.jumpVZ).toBeUndefined();
  const npc = f.s.realm.entityManager.entities.find((e) => e.type === "chicken");
  const start = npc?.position.wx ?? Infinity;
  let peak = 0;
  for (let seq = 101; seq <= 145; seq++) {
    const movement = { ...idle, jump: seq === 101 };
    f.input(seq, movement);
    await f.s.step(movement);
    f.receive(f.s.frames());
    peak = Math.max(peak, f.predictor.player?.wz ?? 0);
  }
  expect(peak).toBeGreaterThan(24);
  expect(Math.abs((npc?.position.wx ?? Infinity) - start)).toBeLessThan(0.2);
});

it("keeps local animation advancing when every update performs replay", async () => {
  const f = await setup(),
    phases = new Set<number>();
  for (let seq = 2; seq < 90; seq++) {
    f.input(seq, { ...idle, dx: 1 });
    if (seq > 6) {
      f.s.realm.handleMessage(f.s.player.clientId, f.s.player, {
        type: "player-input",
        seq: seq - 4,
        ...idle,
        dx: 1,
      });
      f.s.tick();
      f.receive(f.s.frames());
    }
    phases.add(f.predictor.player?.sprite?.frameCol ?? -1);
  }
  expect(phases.size).toBeGreaterThanOrEqual(3);
});

it("holds an overflowed scene and rejects stale state across reload instead of dropping collision bodies", async () => {
  const f = await setup(),
    state = f.view.physicsState;
  if (!state) throw Error("Missing normal physics state");
  f.predictor.reconcile(
    f.view.serverPlayerEntity,
    f.view.lastProcessedInputSeq,
    f.view.world,
    f.view.props,
    f.view.serverEntities,
    undefined,
    { serverTick: f.view.serverTick + 1, physics: { ...state, omitted: 1 } },
  );
  const held = f.predictor.player?.position.wx;
  f.input(2, { ...idle, dx: 1 });
  expect(f.predictor.recoveryDiagnostics.status).toBe("overflow");
  expect(f.predictor.player?.position.wx).toBe(held);
  const old = f.s.frames();
  await f.s.reload();
  await f.s.step(idle);
  f.receive(f.s.frames());
  expect(f.view.physicsState?.epoch).not.toBe(state.epoch);
  const current = f.predictor.player?.position.wx;
  f.receive(old);
  expect(f.view.physicsState?.epoch).not.toBe(state.epoch);
  expect(f.predictor.player?.position.wx).toBe(current);
});

it("caps replay slices and accepts a snapshot that covers the pending suffix", async () => {
  const f = await setup();
  for (let seq = 2; seq <= 80; seq++) f.input(seq, { ...idle, dx: 1 });
  f.s.tick();
  f.receive(f.s.frames());
  expect(f.predictor.recoveryDiagnostics.status).toBe("replaying");
  f.predictor.update(PHYSICS_DT, idle, f.view.world, f.view.props, f.view.serverEntities);
  expect(f.predictor.recoveryDiagnostics.replayStepsThisTick).toBeLessThanOrEqual(8);
  f.s.realm.handleMessage(f.s.player.clientId, f.s.player, {
    type: "player-input",
    seq: 80,
    ...idle,
  });
  f.s.tick();
  f.receive(f.s.frames());
  expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
  expect(f.predictor.recoveryDiagnostics.retainedInputs).toBe(0);
  expect(f.predictor.player?.position.wx).toBeCloseTo(f.s.player.player.position.wx, 2);
});

it("buffers an idle observer's whole scene and gives an active contact component one rigid display transform", async () => {
  const f = await setup(),
    buffered = structuredClone(f.view.serverEntities);
  const remote = buffered.find((e) => e.type === "chicken");
  if (!remote) throw Error("Missing NPC");
  remote.position.wx -= 10;
  expect(f.predictor.presentEntities(0.5, buffered)).toEqual(buffered);
  for (let seq = 2; seq < 65; seq++) f.input(seq, { ...idle, dx: 1 });
  const shown = f.predictor.presentEntities(1, buffered);
  const player = shown.find((e) => e.type === "player"),
    npc = shown.find((e) => e.type === "chicken");
  expect(player).toBeDefined();
  expect(npc).toBeDefined();
  expect((npc?.position.wx ?? 0) - (player?.position.wx ?? 0)).toBeGreaterThan(9.5);
  expect((npc?.position.wx ?? 0) - (player?.position.wx ?? 0)).toBeLessThan(11);
});

it("does not transfer a player's display correction to a nearby car or NPC before contact", async () => {
  const npc = createChicken(48, 116);
  if (npc.wanderAI) npc.wanderAI.timer = 100;
  const f = await setup({
    version: 1,
    id: "nearby-car-correction",
    generation: FLAT_SCENARIO,
    player: createPlayer(48, 100),
    props: [],
    actors: [npc],
    parkedVehicles: [{ model: "compact-1", wx: 100, wy: 100, facing: 3 }],
  });
  const car = f.view.serverEntities.find((e) => e.type === "vehicle-v1:compact-1");
  if (!car) throw Error("Missing car");
  // Several controls arrive together: authority admits the latest walking
  // control while the client has already predicted the earlier jump.
  for (let seq = 2; seq <= 9; seq++) {
    const movement = { ...idle, dx: 1, jump: seq === 2 };
    f.input(seq, movement);
    f.s.realm.handleMessage(f.s.player.clientId, f.s.player, {
      type: "player-input",
      seq,
      ...movement,
    });
  }
  expect(f.predictor.player?.wz).toBeGreaterThan(5);
  f.s.tick();
  f.receive(f.s.frames());
  expect(f.predictor.lastReconcileDiagnostics?.resimPosErr).toBeGreaterThan(5);
  const shown = f.predictor.presentEntities(1, f.view.serverEntities);
  for (const type of [car.type, "chicken"]) {
    const displayed = shown.find((e) => e.type === type);
    const actual = f.view.serverEntities.find((e) => e.type === type);
    expect(displayed?.position.wx).toBeCloseTo(actual?.position.wx ?? Infinity, 2);
    expect(displayed?.position.wy).toBeCloseTo(actual?.position.wy ?? Infinity, 2);
    expect(displayed?.wz).toBeCloseTo(actual?.wz ?? Infinity, 2);
  }
});

it("keeps a touching player and car coherent without lifting them off solved support", async () => {
  const f = await setup({
    version: 1,
    id: "supported-car-correction",
    generation: FLAT_SCENARIO,
    player: createPlayer(65.5, 100),
    props: [],
    parkedVehicles: [{ model: "compact-1", wx: 100, wy: 100, facing: 3 }],
  });
  for (let seq = 2; seq <= 9; seq++) {
    const movement = { ...idle, dx: 1, jump: seq === 2 };
    f.input(seq, movement);
    f.s.realm.handleMessage(f.s.player.clientId, f.s.player, {
      type: "player-input",
      seq,
      ...movement,
    });
  }
  f.s.tick();
  f.receive(f.s.frames());
  const shown = f.predictor.presentEntities(1, f.view.serverEntities);
  const player = shown.find((e) => e.id === f.s.player.player.id);
  const car = shown.find((e) => e.type === "vehicle-v1:compact-1");
  expect(f.predictor.lastReconcileDiagnostics?.resimPosErr).toBeGreaterThan(5);
  expect((car?.position.wx ?? 0) - (player?.position.wx ?? 0)).toBeCloseTo(34.5, 0);
  expect(player?.wz).toBeCloseTo(f.s.player.player.wz ?? Infinity, 2);
  const actualCar = f.view.serverEntities.find((e) => e.id === car?.id);
  expect(car?.wz).toBeCloseTo(actualCar?.wz ?? Infinity, 2);
});

it("keeps a delayed second player's contact component coherent at render fractions while the host reverses", async () => {
  const f = await setup();
  for (const e of [...f.s.realm.entityManager.entities])
    if (e.type === "chicken") f.s.realm.entityManager.remove(e.id);
  const guest = new PlayerSession("guest");
  guest.editorEnabled = false;
  await f.s.realm.addPlayer(guest);
  guest.visibleRange = { ...f.s.player.visibleRange };
  guest.player.position = { wx: 42, wy: 32 };
  f.s.tick();
  f.receive(f.s.frames());
  let now = 0;
  const view = new RemoteStateView(new World()),
    predictor = new PlayerPredictor(
      () => 1,
      () => now,
    );
  cleanup.push(() => predictor.clearPredicted());
  await predictor.ready;
  view.setPredictor(predictor);
  const receive = (packets: ArrayBuffer[]) => {
    for (const packet of packets) {
      const m = decodeServerMessage(packet);
      if (m.type === "frame") view.applyFrame(m, now);
      else if (m.type.startsWith("sync-"))
        view.applyMessage(m as Parameters<typeof view.applyMessage>[0]);
    }
    if (!predictor.player) predictor.reset(view.serverPlayerEntity);
    predictor.reconcile(
      view.serverPlayerEntity,
      view.lastProcessedInputSeq,
      view.world,
      view.props,
      view.serverEntities,
      view.mountEntityId,
      { serverTick: view.serverTick, ...(view.physicsState ? { physics: view.physicsState } : {}) },
    );
  };
  receive(f.s.realm.replicate(guest.clientId).map(encodeServerMessage));
  const deliveries: { at: number; frames: ArrayBuffer[] }[] = [],
    inputs: { at: number; seq: number }[] = [];
  let inputAt = 0,
    frameAt = 0,
    contactSamples = 0,
    maxCorrection = 0;
  for (let tick = 1; tick <= 180; tick++) {
    now += PHYSICS_DT;
    const movement = { ...idle, dx: tick < 80 ? 1 : tick < 110 ? -1 : 0 };
    f.input(tick + 1, movement);
    predictInput(predictor, tick, idle, PHYSICS_DT, view.world, view.props, view.serverEntities);
    f.s.realm.handleMessage(f.s.player.clientId, f.s.player, {
      type: "player-input",
      seq: tick + 1,
      ...movement,
    });
    inputAt = Math.max(inputAt, tick + 4 + (tick % 3));
    inputs.push({ at: inputAt, seq: tick });
    while (inputs[0] && inputs[0].at <= tick) {
      const input = inputs.shift();
      if (input)
        f.s.realm.handleMessage(guest.clientId, guest, {
          type: "player-input",
          seq: input.seq,
          ...idle,
        });
    }
    f.s.tick();
    f.receive(f.s.frames());
    frameAt = Math.max(frameAt, tick + 5 + ((tick + 1) % 3));
    deliveries.push({
      at: frameAt,
      frames: f.s.realm.replicate(guest.clientId).map(encodeServerMessage),
    });
    while (deliveries[0] && deliveries[0].at <= tick) {
      const item = deliveries.shift();
      if (item) receive(item.frames);
    }
    maxCorrection = Math.max(maxCorrection, predictor.lastReconcileDiagnostics?.resimPosErr ?? 0);
    if (tick > 40 && tick < 75) {
      const shown = predictor.presentEntities(0.5, view.serverEntities);
      const host = shown.find((e) => e.id === f.s.player.player.id),
        self = shown.find((e) => e.id === guest.player.id);
      const gap = (self?.position.wx ?? 0) - (host?.position.wx ?? 0);
      expect(gap).toBeGreaterThan(9.5);
      expect(gap).toBeLessThan(10.5);
      contactSamples++;
    }
  }
  expect(contactSamples).toBeGreaterThan(20);
  expect(maxCorrection).toBeLessThan(16);
  expect(guest.player.position.wx).toBeGreaterThan(55);
  expect(Math.abs(guest.player.velocity?.vx ?? Infinity)).toBeLessThan(0.1);
});

it("predicts normalized basic car steering and derives its seat from the same body", async () => {
  const f = await setup({
    version: 1,
    id: "predicted-car",
    generation: FLAT_SCENARIO,
    player: createPlayer(-64, 64),
    props: [],
    parkedVehicles: [{ model: "compact-1", wx: 64, wy: 64, facing: 3 }],
  });
  const car = f.s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:compact-1");
  if (!car?.collider) throw Error("Missing car");
  const box = getEntityAABB(car.position, car.collider);
  await f.s.command({ kind: "teleport", position: { wx: box.left - 12, wy: 64 } });
  await f.s.command({ kind: "enter-vehicle", entityId: car.id });
  await f.s.step(idle);
  f.receive(f.s.frames());
  const firstSeq = f.s.player.lastProcessedInputSeq + 1;
  for (let i = 0; i < 50; i++) {
    const movement = { ...idle, dx: 1, dy: i < 30 ? 1 : 0 };
    f.input(firstSeq + i, movement);
    await f.s.step(movement);
    expect(f.predictor.mount?.position.wx).toBeCloseTo(car.position.wx, 1);
    expect(f.predictor.mount?.position.wy).toBeCloseTo(car.position.wy, 1);
    expect(f.predictor.player?.position.wx).toBeCloseTo(
      f.predictor.mount?.position.wx ?? Infinity,
      2,
    );
    f.receive(f.s.frames());
  }
  expect(car.position.wx).toBeGreaterThan(120);
});

it("publishes coherent seat membership without advancing a manual physics tick", async () => {
  const f = await setup({
    version: 1,
    id: "seat-publication",
    generation: FLAT_SCENARIO,
    player: createPlayer(80, -28),
    props: [],
    parkedVehicles: [{ name: "car", model: "compact-1", wx: 80, wy: 0, facing: 3 }],
  });
  const before = f.s.realm.collisionDiagnostics?.worldSteps;
  await f.s.command({ kind: "enter-vehicle", entityId: f.s.handles.car ?? -1 });
  expect(() => f.receive(f.s.frames())).not.toThrow();
  expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
  expect(f.view.physicsState?.bodies.some((b) => b.id === f.view.serverPlayerEntity.id)).toBe(
    false,
  );
  f.input(1, { ...idle, dx: 1 });
  await f.s.command({ kind: "exit-vehicle" });
  expect(() => f.receive(f.s.frames())).not.toThrow();
  expect(f.view.physicsState?.bodies.some((b) => b.id === f.view.serverPlayerEntity.id)).toBe(true);
  expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
  expect(f.s.realm.collisionDiagnostics?.worldSteps).toBe(before);
});
