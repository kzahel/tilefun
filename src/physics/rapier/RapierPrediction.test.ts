import { beforeAll, describe, expect, it } from "vitest";
import { RemoteStateView } from "../../client/ClientStateView.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { decodeServerMessage, encodeClientMessage } from "../../shared/binaryCodec.js";
import type { BufferedMessage } from "../../shared/protocol.js";
import { World } from "../../world/World.js";
import type { PhysicsStart } from "./BridgeFixture.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import { type RapierAuthorityState, RapierPredictor } from "./RapierPredictor.js";
import { createRapierRealmSimulation, RapierRealmSimulation } from "./RapierRealmSimulation.js";
import { rapierScenarioRecipe } from "./RapierScenarioRecipe.js";
import { initRapier, type PhysicsInput, RapierWorld } from "./RapierWorld.js";

beforeAll(initRapier);
const idle = { x: 0, z: 0, jump: false };
const snapshot = (world: RapierWorld, ack: number): RapierAuthorityState => ({
  ack,
  motor: world.motor(),
  poses: world.poses(),
});
const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("Rapier command replay", () => {
  for (const start of ["ramp", "platform"] as PhysicsStart[])
    it(`replays delayed ramp/support movement, jump and landing (${start})`, () => {
      const authority = new RapierWorld(8, 0),
        predictor = new RapierPredictor(8);
      try {
        authority.teleport(start);
        for (let i = 0; i < 30; i++) authority.step(idle);
        predictor.receive(snapshot(authority, 0), 0);
        const delivery: { at: number; state: RapierAuthorityState }[] = [];
        for (let seq = 1; seq <= 300; seq++) {
          const input: PhysicsInput = {
            x: start === "ramp" ? 1 : 0,
            z: start === "platform" && seq > 220 ? 1 : 0,
            jump: seq >= 85 && seq < 91,
          };
          predictor.submit(seq, input, seq * 17);
          authority.step(input);
          if (seq % 3 === 0)
            delivery.push({ at: seq + 9 + (seq % 4), state: snapshot(authority, seq) });
          while (delivery[0] && delivery[0].at <= seq) {
            const packet = delivery.shift();
            if (packet) predictor.receive(packet.state, seq * 17);
          }
          predictor.drain(32, 100);
          expect(distance(predictor.motor ?? authority.motor(), authority.motor())).toBeLessThan(
            0.001,
          );
        }
        expect(predictor.diagnostics.ackAgeMs).toBeGreaterThan(100);
        expect(predictor.diagnostics.pending).toBeLessThan(20);
      } finally {
        predictor.dispose();
        authority.dispose();
      }
    });

  it("keeps scratch replay invisible until all commands finish, including new input", () => {
    const authority = new RapierWorld(8, 0),
      predictor = new RapierPredictor(8);
    try {
      predictor.receive(snapshot(authority, 0), 0);
      let state: RapierAuthorityState | undefined;
      for (let seq = 1; seq <= 8; seq++) {
        predictor.submit(seq, { ...idle, x: 1 }, seq * 17);
        authority.step({ ...idle, x: 1 });
        if (seq === 2) state = snapshot(authority, seq);
      }
      if (!state) throw Error("Missing snapshot");
      state.motor.x += 0.2;
      const before = predictor.motor;
      predictor.receive(state, 150);
      predictor.drain(1, 100);
      expect(predictor.diagnostics.status).toBe("replaying");
      expect(predictor.motor).toEqual(before);
      predictor.submit(9, idle, 160);
      for (let i = 0; i < 10; i++) predictor.drain(1, 100);
      expect(predictor.diagnostics.status).toBe("ready");
      expect(predictor.diagnostics.correctionMetres).toBeGreaterThan(0.15);
    } finally {
      predictor.dispose();
      authority.dispose();
    }
  });

  it("rejects stale epochs/acks and clears history at teleport fences", () => {
    const world = new RapierWorld(256, 0),
      predictor = new RapierPredictor(256);
    try {
      const old = snapshot(world, 0);
      predictor.receive(old, 0);
      predictor.submit(1, idle, 17);
      world.step(idle);
      world.teleport("far");
      predictor.receive(snapshot(world, 1), 34);
      expect(predictor.diagnostics.pending).toBe(0);
      expect(predictor.motor?.x).toBeGreaterThan(1030);
      predictor.receive({ ...old, ack: 999, motor: { ...old.motor, tick: 999 } }, 50);
      expect(predictor.motor?.x).toBeGreaterThan(1030);
      expect(predictor.diagnostics.staleFrames).toBe(1);
      expect(predictor.diagnostics.collisionCount).toBeLessThan(100);
    } finally {
      predictor.dispose();
      world.dispose();
    }
  });

  it("bounds lost input history and recovers after authority acknowledges the gap", () => {
    const world = new RapierWorld(8, 0),
      predictor = new RapierPredictor(8);
    try {
      predictor.receive(snapshot(world, 0), 0);
      for (let seq = 1; seq <= 510; seq++) {
        predictor.submit(seq, idle, seq * 17);
        world.step(idle);
      }
      expect(predictor.diagnostics.pending).toBeLessThanOrEqual(480);
      expect(predictor.diagnostics.status).toBe("history-gap");
      predictor.receive(snapshot(world, 510), 9000);
      predictor.drain(32, 100);
      expect(predictor.diagnostics.status).toBe("ready");
      expect(predictor.diagnostics.pending).toBe(0);
    } finally {
      predictor.dispose();
      world.dispose();
    }
  });

  it("bounds nearby dynamic proxies independently of total bridge length and body count", () => {
    const world = new RapierWorld(256, 0),
      predictor = new RapierPredictor(256);
    try {
      world.teleport("deck");
      world.spawn(512);
      predictor.receive(snapshot(world, 0), 0);
      expect((predictor.poses?.length ?? 0) / POSE_STRIDE).toBeLessThanOrEqual(130);
      expect(predictor.motor?.x).toBeCloseTo(world.motor().x);
      expect(predictor.diagnostics.collisionCount).toBeLessThan(200);
    } finally {
      predictor.dispose();
      world.dispose();
    }
  });
});

it("a real Realm consumes game input once, acknowledges and replicates the Rapier pose", async () => {
  const session = await ScenarioSession.create(rapierScenarioRecipe(8), () =>
    createRapierRealmSimulation(8),
  );
  try {
    await session.step({ dx: 1, dy: 0, jump: false, sprinting: false });
    for (let seq = 2; seq <= 180; seq++) {
      session.input(
        encodeClientMessage({
          type: "player-input",
          seq,
          dx: 1,
          dy: 0,
          jump: false,
          sprinting: false,
          dtMs: 17,
        }),
      );
      session.tick(1 / 60);
    }
    const backend =
      session.simulationOwner instanceof RapierRealmSimulation
        ? session.simulationOwner.backend
        : undefined;
    if (!backend) throw Error("Missing experimental owner");
    expect(backend.motor().tick).toBe(180);
    expect(session.player.lastProcessedInputSeq).toBe(180);
    expect(session.player.player.position.wx).toBeCloseTo(backend.motor().x * 16, 4);
    const replica = new RemoteStateView(new World());
    for (const buffer of session.frames())
      replica.applyMessage(decodeServerMessage(buffer) as BufferedMessage);
    expect(replica.lastProcessedInputSeq).toBe(180);
    expect(replica.serverPlayerEntity.wz).toBeCloseTo(session.player.player.wz ?? 0, 1);
    expect(replica.serverPlayerEntity.position.wx).toBeCloseTo(
      session.player.player.position.wx,
      1,
    );
  } finally {
    await session.close();
  }
});
