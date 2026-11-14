// Deterministic replay forward-progress check; simulated CPU cost, not hardware timing.
import assert from "node:assert/strict";
import { RemoteStateView } from "../src/client/ClientStateView.js";
import { PlayerPredictor } from "../src/client/PlayerPredictor.js";
import { createChicken } from "../src/entities/Chicken.js";
import { devicePacket } from "../src/input/SeatComposer.js";
import { PHYSICS_DT } from "../src/physics/PhysicsDefaults.js";
import type { PhysicsScene } from "../src/physics/PhysicsScene.js";
import { join, start, stopDevices } from "../src/server/test/DeviceHarness.js";
import { DeviceSession } from "../src/session/DeviceSession.js";
import type { BufferedMessage } from "../src/shared/protocol.js";
import { World } from "../src/world/World.js";

const d = await start();
let predictor: PlayerPredictor | undefined;
try {
  const guest = await join(d, 1);
  assert(guest);
  const chicken = createChicken(-80, 60);
  assert(chicken.wanderAI);
  Object.assign(chicken.wanderAI, { state: "walking", timer: 100, dirX: 0, dirY: 1 });
  d.server.entityManager.spawn(chicken);
  d.server.broadcasting = true;
  for (const seat of [0, 1]) {
    const send = (
      message:
        | { type: "set-editor-mode"; enabled: boolean }
        | { type: "visible-range"; minCx: number; minCy: number; maxCx: number; maxCy: number },
    ) => d.transport.send("local", seat ? { type: "seat", seat, message } : message);
    send({ type: "set-editor-mode", enabled: false });
    send({ type: "visible-range", minCx: -2, minCy: -2, maxCx: 2, maxCy: 2 });
  }
  const replica = new RemoteStateView(new World());
  const device = new DeviceSession(replica);
  let clock = 0;
  predictor = new PlayerPredictor(
    () => 1,
    () => clock,
  );
  await predictor.ready;
  device.startPrediction(predictor);
  // Only charge the private scene's ordinary steps to the injected budget clock.
  // Production arithmetic, admission, snapshot delivery and replay policy are unchanged.
  const scene = (predictor as unknown as { scene: PhysicsScene }).scene;
  const step = scene.step.bind(scene);
  let stepCostMs = 0;
  scene.step = (...args) => {
    const result = step(...args);
    clock += stepCostMs / 1000;
    return result;
  };
  const movement = { dx: 1, dy: 0, jump: false, sprinting: false };
  const guestMovement = { ...movement, dx: 0, dy: 1 };
  let seq = 0;
  let inputDelay = 0;
  const pending: { due: number; message: ReturnType<typeof devicePacket>["input"] }[] = [];
  const tick = () => {
    clock += PHYSICS_DT;
    for (const msg of d.transport.received.get("local")?.splice(0) ?? []) {
      if (msg.type === "frame" || msg.type.startsWith("sync-"))
        replica.bufferMessage(msg as BufferedMessage);
    }
    replica.applyPending();
    if (replica.stateAppliedThisTick) device.reconcile(false);
    const packet = devicePacket(++seq, [
      { seat: 0, movement },
      { seat: 1, movement: guestMovement },
    ]);
    pending.push({ due: seq + inputDelay, message: packet.input });
    while (pending[0] && pending[0].due <= seq) {
      const queued = pending.shift();
      if (queued) d.transport.send("local", queued.message);
    }
    device.predict(seq, movement, PHYSICS_DT, packet.coSeats);
    d.server.tick(PHYSICS_DT);
  };
  for (let i = 0; i < 30; i++) tick();
  const sample = () => {
    const player = predictor?.player;
    const guestBody = predictor?.publishedBody(guest.player.id).body;
    assert(player && guestBody);
    replica.beginPresentation(clock, 0.5);
    const npc = replica.entities.find((entity) => entity.id === chicken.id);
    assert(npc);
    const npcPresented = { ...npc.position };
    replica.endPresentation();
    return {
      server: { ...d.host.player.position },
      predicted: { ...player.position },
      guestServer: { ...guest.player.position },
      guestPredicted: { ...guestBody.position },
      npcPresented,
      recovery: predictor?.recoveryDiagnostics,
    };
  };
  const before = sample();
  stepCostMs = 3;
  for (let i = 0; i < 60; i++) tick();
  const slowWithoutDelay = sample();
  assert(slowWithoutDelay.predicted.wx - before.predicted.wx > 60);
  stepCostMs = 0;
  // Four ticks of outbound command delay seed ordinary unacknowledged replay.
  inputDelay = 4;
  for (let i = 0; i < 30; i++) tick();
  const delayWithoutCost = sample();
  assert.equal(delayWithoutCost.recovery?.status, "ready");
  stepCostMs = 3;
  const rows: ReturnType<typeof sample>[] = [];
  for (let i = 0; i < 300; i++) {
    tick();
    rows.push(sample());
  }
  const underLoad = sample();
  stepCostMs = 0;
  for (let i = 0; i < 10; i++) tick();
  const after = sample();
  const slowPositionChanges = rows
    .slice(1)
    .filter(
      (row, i) =>
        row.predicted.wx !== rows[i]?.predicted.wx || row.predicted.wy !== rows[i]?.predicted.wy,
    ).length;
  assert(slowPositionChanges >= 140);
  const firstSlow = rows[0];
  assert(firstSlow);
  assert(underLoad.server.wx - firstSlow.server.wx > 300);
  assert(underLoad.predicted.wx - firstSlow.predicted.wx > 300);
  assert(underLoad.guestPredicted.wy - firstSlow.guestPredicted.wy > 300);
  assert(underLoad.guestServer.wy - firstSlow.guestServer.wy > 300);
  let held = 0,
    maxHeldUpdates = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i],
      previous = rows[i - 1];
    assert(row && previous);
    assert((row.recovery?.replayStepsThisTick ?? 0) <= 1);
    held = row.predicted.wx === previous.predicted.wx ? held + 1 : 0;
    maxHeldUpdates = Math.max(maxHeldUpdates, held);
    assert(Math.abs(row.server.wx - row.predicted.wx) < 4);
    assert(Math.abs(row.guestServer.wy - row.guestPredicted.wy) < 4);
  }
  assert(maxHeldUpdates <= 2);
  const npcPositionChanges = rows
    .slice(1)
    .filter((row, i) => row.npcPresented.wy !== rows[i]?.npcPresented.wy).length;
  assert.equal(npcPositionChanges, 299);
  assert.equal(after.recovery?.status, "ready");
  assert(after.predicted.wx > underLoad.predicted.wx);
  console.log(
    JSON.stringify(
      {
        note: "Simulated 3ms private physics steps exhaust the 2ms replay budget. Both seats must keep advancing with at most one replay step per update. This is a mechanism control, not Chromebook timing.",
        before,
        slowWithoutDelay,
        delayWithoutCost,
        firstSlow,
        underLoad,
        after,
        slowUpdates: rows.length,
        slowPositionChanges,
        maxHeldUpdates,
        npcPositionChanges,
      },
      null,
      2,
    ),
  );
} finally {
  predictor?.clearPredicted();
  await stopDevices();
}
