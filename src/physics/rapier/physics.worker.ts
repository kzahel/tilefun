import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { ServerLoop } from "../../server/ServerLoop.js";
import {
  type ChannelEnvelope,
  OrderedWorkerChannel,
} from "../../transport/OrderedWorkerChannel.js";
import type { PhysicsPacket } from "./PhysicsProtocol.js";
import { createRapierRealmSimulation, RapierRealmSimulation } from "./RapierRealmSimulation.js";
import { rapierScenarioRecipe } from "./RapierScenarioRecipe.js";

let session: ScenarioSession | undefined;
let driver: RapierRealmSimulation | undefined;
let realmTickMs = 0;
let epoch = 0,
  ticks = 0,
  failed = false,
  forcePending = false;
let tail: Promise<unknown> = Promise.resolve();
const channel = new OrderedWorkerChannel<PhysicsPacket>((message, transfer) =>
  self.postMessage(message, { transfer }),
);
const fail = (error: unknown) => {
  failed = true;
  loop.stop();
  channel.send({ type: "error", message: String(error) });
};
const engineFrames = (frames: ArrayBuffer[]) => {
  for (const buffer of frames) channel.send({ type: "engine", buffer });
};
const publish = (freshFrames = false) => {
  const backend = driver?.backend;
  if (!backend || !session) return;
  if (!channel.writable) {
    forcePending ||= freshFrames;
    return;
  }
  forcePending = false;
  if (freshFrames) engineFrames(session.frames());
  const packing = performance.now();
  const buffer = backend.poses().buffer as ArrayBuffer;
  const diagnostics = backend.diagnostics();
  diagnostics.realmTickMs = realmTickMs;
  diagnostics.publishMs = performance.now() - packing;
  channel.send({
    type: "frame",
    buffer,
    diagnostics,
    motor: backend.motor(),
    ack: session.player.lastProcessedInputSeq,
  });
};
const loop = new ServerLoop((dt) => {
  if (!session || failed) return;
  const canPublish = ++ticks % 2 === 0 && channel.writable;
  const began = performance.now();
  const frames = session.tick(dt, canPublish);
  realmTickMs = performance.now() - began;
  engineFrames(frames);
  if (canPublish) publish();
}, fail);

async function receive(packet: PhysicsPacket) {
  if (packet.type === "open") {
    const generation = ++epoch;
    loop.stop();
    await session?.close();
    session = undefined;
    const opened = await ScenarioSession.create(rapierScenarioRecipe(packet.sections), () =>
      createRapierRealmSimulation(packet.sections),
    );
    if (generation !== epoch) {
      await opened.close();
      return;
    }
    session = opened;
    if (!(opened.simulationOwner instanceof RapierRealmSimulation))
      throw Error("Missing Rapier owner");
    driver = opened.simulationOwner;
    failed = false;
    ticks = 0;
    driver.sync(opened.realm, opened.player);
    channel.send({ type: "ready" });
    publish(true);
    loop.start();
    return;
  }
  if (!session || failed) return;
  if (packet.type === "input") {
    session.input(packet.buffer);
    return;
  }
  const backend = driver?.backend;
  if (!backend) return;
  if (packet.type === "teleport") {
    loop.stop();
    session.discardInputs();
    backend.teleport(packet.start);
    driver?.sync(session.realm, session.player);
    await session.ready();
    publish(true);
    loop.start();
  } else if (packet.type === "spawn") backend.spawn(Math.max(0, Math.min(100, packet.count)));
  else if (packet.type === "pause" || packet.type === "resync") {
    session.discardInputs();
    backend.fence();
    if (packet.type === "pause" && packet.paused) loop.stop();
    else loop.start();
    publish(true);
  } else if (packet.type === "stall") {
    const until = performance.now() + Math.max(0, Math.min(500, packet.milliseconds));
    while (performance.now() < until) {
      /* Explicit diagnostic stall on authority. */
    }
  }
}
let pumpTimer: ReturnType<typeof setTimeout> | undefined;
function pump() {
  channel.pump((packet) => {
    tail = tail.then(() => receive(packet)).catch(fail);
  });
  if (channel.pending && pumpTimer === undefined)
    pumpTimer = setTimeout(() => {
      pumpTimer = undefined;
      try {
        pump();
      } catch (error) {
        fail(error);
      }
    }, 0);
  if (forcePending && channel.writable) publish(true);
}
self.onmessage = (event: MessageEvent<ChannelEnvelope<PhysicsPacket>>) => {
  try {
    channel.receive(event.data);
    pump();
  } catch (error) {
    fail(error);
  }
};
