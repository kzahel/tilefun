/**
 * Production multi-seat prediction (226 slice 5-i), end to end: the real server
 * (`memoryServer`, every message through the binary codec), and on the client one
 * replica, one `DeviceSession` and one predictor replaying seat 0 and a guest from
 * one device tick per frame. Frames arrive one tick late, as from a local Worker.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { SeatSample } from "../input/SeatComposer.js";
import { NEUTRAL_MOVEMENT, neutralSample, type SeatInput } from "../input/SeatInput.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { sessionOf, start, stopDevices } from "../server/test/DeviceHarness.js";
import { DeviceSession } from "../session/DeviceSession.js";
import { composeDeviceTick } from "../session/DeviceTick.js";
import type { Movement } from "../shared/Movement.js";
import type { BufferedMessage, ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { RequestMessage, RequestResponse } from "../shared/requests.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";
import { seatRoute } from "./SeatEnvelope.js";

afterEach(stopDevices);

const BUFFERED = new Set<ServerMessage["type"]>([
  "frame",
  "sync-room",
  "sync-session",
  "sync-invincibility",
  "sync-chunks",
  "sync-props",
  "sync-cvars",
  "sync-player-names",
  "sync-editor-cursors",
]);

/** A guest's scripted devices. */
class ScriptedInput implements SeatInput {
  readonly steering = false;
  movement: Movement = NEUTRAL_MOVEMENT;
  held(): boolean {
    return false;
  }
  sample(locked: boolean): SeatSample {
    if (locked) return neutralSample();
    return { ...neutralSample(), manual: this.movement, steered: this.movement };
  }
  clear(): void {}
  dispose(): void {}
}

const walk = (dx: number, dy = 0): Movement => ({ dx, dy, sprinting: false, jump: false });

async function device(worlds: string[] = []) {
  const server = await start({ worlds });
  const { transport } = server;
  let now = 0;
  const replica = new RemoteStateView(new World());
  const session = new DeviceSession(replica);
  const predictor = new PlayerPredictor(
    () => 1,
    () => now,
  );
  await predictor.ready;
  const replies: ServerMessage[] = [];
  const entered: string[] = [];
  /** The authority's physics poses by tick, from every frame the device received. */
  const truth = new Map<number, Map<number, { x: number; y: number }>>();

  /** The router's handling, reduced to what prediction reads. */
  const handle = (msg: ServerMessage) => {
    if (msg.type === "seat") {
      const route = seatRoute(msg.message);
      if (route.kind === "device") handle(route.message);
      else if (route.kind === "sync") replica.bufferSeatSync(msg.seat, route.message);
      else if (route.kind === "left") session.seats.drop(msg.seat);
      return;
    }
    if (msg.type === "world-loaded" || msg.type === "realm-joined") {
      entered.push(msg.worldId ?? "");
      replica.clear();
      session.clearPresentation();
    }
    if (msg.type === "frame" && msg.physics) {
      const poses = truth.get(msg.physics.tick) ?? new Map();
      for (const b of msg.physics.bodies) poses.set(b.id, { x: b.x, y: b.y });
      truth.set(msg.physics.tick, poses);
    }
    if (BUFFERED.has(msg.type)) replica.bufferMessage(msg as BufferedMessage);
    if ("requestId" in msg) replies.push(msg);
  };
  const deliver = () => {
    for (const msg of transport.received.get("local")?.splice(0) ?? []) handle(msg);
    replica.applyPending();
  };
  const send = (msg: ClientMessage) => transport.send("local", msg);
  let requestId = 100;
  /** A request (in a guest's envelope when `seat` is set) and its reply. */
  const request = async <R extends RequestMessage>(msg: R, seat = 0) => {
    send(seat ? { type: "seat", seat, message: msg } : msg);
    await server.server.settle();
    deliver();
    const reply = replies.find((r) => "requestId" in r && r.requestId === msg.requestId);
    if (!reply || reply.type === "request-error") throw Error(`no reply to ${msg.type}`);
    return reply as RequestResponse<R>;
  };

  server.server.broadcasting = true;
  const { wx, wy } = server.host.player.position;
  const cx = Math.floor(wx / CHUNK_SIZE_PX),
    cy = Math.floor(wy / CHUNK_SIZE_PX);
  send({ type: "visible-range", minCx: cx - 2, minCy: cy - 2, maxCx: cx + 2, maxCy: cy + 2 });
  send({ type: "set-editor-mode", enabled: false });
  await server.server.settle();
  deliver();
  session.startPrediction(predictor);

  let seq = 0;
  /** One client frame: apply last tick's frames, send this tick's device packet,
   * reconcile and predict, then the authority ticks. */
  /** `standingGuest` sends authority a still guest while the predictor replays its
   * own movement: a misprediction to correct. */
  const frame = (host: Movement, standingGuest = false) => {
    now += PHYSICS_DT;
    deliver();
    const seats = session.seats;
    const hostSample = { ...neutralSample(), manual: host, steered: host };
    const situation = { vehicle: undefined, locked: false, steering: false, joystick: false };
    const tick = composeDeviceTick(
      [{ seat: seats.host, sample: hostSample, situation }, ...seats.guestFrames(replica, false)],
      ++seq,
      PHYSICS_DT,
    );
    const input: ClientMessage =
      standingGuest && tick.input.type === "player-input"
        ? { ...tick.input, seats: (tick.input.seats ?? []).map((s) => ({ ...s, dx: 0, dy: 0 })) }
        : tick.input;
    for (const msg of [...tick.before, input, ...tick.after]) send(msg);
    if (replica.stateAppliedThisTick) session.reconcile(false);
    session.predict(seq, tick.host.movement, PHYSICS_DT, tick.coSeats);
    server.server.tick(PHYSICS_DT);
  };
  const nextId = () => ++requestId;
  return { ...server, replica, session, predictor, frame, request, nextId, entered, truth };
}

type Device = Awaited<ReturnType<typeof device>>;

/** The guest's controlled body in the replica: its vehicle when driving. */
function guestBody({ replica }: Device): Entity | undefined {
  const id = replica.seats.entities.get(1);
  const entity = replica.serverEntities.find((e) => e.id === id);
  return replica.serverEntities.find((e) => e.id === (entity?.parentId ?? entity?.id));
}

/**
 * Play `frames` frames. `unpredicted` counts frames without a predicted guest body;
 * `error` is the guest body's worst predicted pose against the authority's at the
 * same physics tick, each tick taken the first time the predictor commits it.
 */
function play(d: Device, frames: number, host: Movement) {
  let unpredicted = 0;
  const shown = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < frames; i++) {
    d.frame(host);
    const id = guestBody(d)?.id ?? -1;
    const { tick, body } = d.predictor.publishedBody(id);
    if (!body) unpredicted++;
    const key = `${id}:${tick}`;
    if (body && !shown.has(key)) shown.set(key, { x: body.position.wx, y: body.position.wy });
  }
  d.frame(walk(0)); // the authority's poses for the last predicted ticks
  d.frame(walk(0));
  let error = 0,
    compared = 0;
  for (const [key, pose] of shown) {
    const [id, tick] = key.split(":").map(Number);
    const real = d.truth.get(tick ?? -1)?.get(id ?? -1);
    if (!real) continue;
    compared++;
    error = Math.max(error, Math.hypot(pose.x - real.x, pose.y - real.y));
  }
  return { error, compared, unpredicted };
}

describe("multi-seat prediction on the device session (226 slice 5-i)", () => {
  it("predicts a guest with seat 0 from one device tick and one acknowledgement", async () => {
    const d = await device();
    const input = new ScriptedInput();
    const seat = await d.session.seats.join(d.request, d.nextId(), 1, input);
    expect(seat.seat).toBe(1);
    const guest = sessionOf(d.server, "local#1");
    if (!guest) throw Error("no guest");
    play(d, 10, walk(0)); // the seat list and the guest's body arrive

    const start = { ...guest.player.position };
    input.movement = walk(0, 1);
    const run = play(d, 60, walk(1));
    expect(d.host.lastProcessedInputSeq).toBe(guest.lastProcessedInputSeq);
    expect(guest.player.position.wy - start.wy).toBeGreaterThan(40);
    expect(run.unpredicted).toBe(0);
    // The guest's own movement is replayed: each predicted tick matches the authority.
    expect(run.compared).toBeGreaterThan(50);
    expect(run.error).toBeLessThan(0.02); // measured 0; without its movement 1.07 / 0.07
    const body = d.predictor.publishedBody(guest.player.id).body;
    expect(Math.abs((body?.position.wy ?? 0) - guest.player.position.wy)).toBeLessThan(3);
    expect(d.predictor.lastReconcileDiagnostics?.status).toBe("ready");
  });

  it("predicts a guest driving: its vehicle is its controlled body", async () => {
    const d = await device();
    const input = new ScriptedInput();
    await d.session.seats.join(d.request, d.nextId(), 1, input);
    const guest = sessionOf(d.server, "local#1");
    if (!guest) throw Error("no guest");
    const { wx, wy } = guest.player.position;
    d.transport.send("local", { type: "set-editor-mode", enabled: true });
    d.transport.send("local", {
      type: "edit-spawn",
      entityType: "vehicle-v1:compact-1",
      wx: wx + 40,
      wy,
    });
    await d.server.settle();
    d.transport.send("local", { type: "set-editor-mode", enabled: false });
    const car = d.server.entityManager.entities.find((e) => e.type === "vehicle-v1:compact-1");
    if (!car) throw Error("no car");
    play(d, 10, walk(0));
    // The guest boards from its own envelope, and the answer resolves from there.
    await d.request({ type: "enter-vehicle", requestId: d.nextId(), entityId: car.id }, 1);
    expect(guest.player.parentId).toBe(car.id);
    play(d, 10, walk(0));
    expect(guestBody(d)?.id).toBe(car.id);

    const start = { ...car.position };
    input.movement = walk(1);
    const run = play(d, 90, walk(0));
    expect(car.position.wx - start.wx).toBeGreaterThan(20);
    expect(run.unpredicted).toBe(0);
    expect(run.compared).toBeGreaterThan(80);
    expect(run.error).toBeLessThan(0.02); // measured 0; without its movement 1.07 / 0.07
    const predicted = d.predictor.publishedBody(car.id).body;
    expect(Math.abs((predicted?.position.wx ?? 0) - car.position.wx)).toBeLessThan(8);
  });

  it("presents a guest from prediction while seat 0 stands, easing the guest's own correction", async () => {
    const d = await device();
    const input = new ScriptedInput();
    await d.session.seats.join(d.request, d.nextId(), 1, input);
    const guest = sessionOf(d.server, "local#1");
    if (!guest) throw Error("no guest");
    const id = guest.player.id;
    play(d, 10, walk(0));
    const presented = () =>
      d.predictor.presentEntities(1, d.replica.serverEntities).find((e) => e.id === id);
    const published = () => d.predictor.publishedBody(id).body;

    // Walking away from seat 0, beyond its contact group: shown at its predicted pose,
    // ahead of the replica's buffered one.
    input.movement = walk(0, 1);
    play(d, 40, walk(0));
    const buffered = d.replica.serverEntities.find((e) => e.id === id);
    expect((published()?.position.wy ?? 0) - (buffered?.position.wy ?? 0)).toBeGreaterThan(0.5);
    expect(presented()?.position.wy).toBeCloseTo(published()?.position.wy ?? Number.NaN, 3);
    // A rider on the guest's body (as on an animal it rides) is drawn at the body's
    // presented pose plus its seat offset and lift, not at its buffered pose (5-ii).
    const body = d.replica.serverEntities.find((e) => e.id === id);
    const rider = {
      ...(body as Entity),
      id: 9_999,
      parentId: id,
      localOffsetX: 2,
      localOffsetY: -6,
      wz: (body?.wz ?? 0) + 10,
    };
    const shown = d.predictor.presentEntities(1, [...d.replica.serverEntities, rider]);
    const shownBody = shown.find((e) => e.id === id);
    const shownRider = shown.find((e) => e.id === rider.id);
    expect(shownRider?.position.wx).toBeCloseTo((shownBody?.position.wx ?? 0) + 2, 3);
    expect(shownRider?.position.wy).toBeCloseTo((shownBody?.position.wy ?? 0) - 6, 3);
    expect(shownRider?.wz).toBeCloseTo((shownBody?.wz ?? 0) + 10, 3);

    // Mispredicted: the guest walks in prediction but stands for authority. It eases
    // its own correction rather than snapping to the replayed pose.
    for (let i = 0; i < 20; i++) d.frame(walk(0), true);
    const offset = Math.abs((presented()?.position.wy ?? 0) - (published()?.position.wy ?? 0));
    expect(offset).toBeGreaterThan(0.05);
    expect(offset).toBeLessThan(8);

    // Standing on seat 0's head with nobody pressing anything: carried, so still
    // presented from prediction long after input stopped.
    input.movement = walk(0);
    play(d, 10, walk(0));
    const top = (d.host.player.wz ?? 0) + (d.host.player.collider?.physicalHeight ?? 0) + 1;
    teleportBody(guest.player, { ...d.host.player.position, wz: top });
    play(d, 40, walk(0));
    expect(d.predictor.lastReconcileDiagnostics?.status).toBe("ready");
    expect(d.predictor.presentationClock(1)).not.toBeNull();
  });

  it("follows a guest-led trip from its envelope and stops predicting a guest that leaves", async () => {
    const d = await device(["other"]);
    const input = new ScriptedInput();
    await d.session.seats.join(d.request, d.nextId(), 1, input);
    play(d, 10, walk(0));
    const before = d.replica.seats.entities;

    await d.request({ type: "join-realm", requestId: d.nextId(), worldId: "other" }, 1);
    expect(d.entered.at(-1)).toBe("other");
    const guest = sessionOf(d.server, "local#1");
    expect([d.host.realmId, guest?.realmId]).toEqual(["other", "other"]);
    // The cleared replica restarts prediction; its physics scene loads asynchronously.
    play(d, 3, walk(0));
    await d.predictor.ready;
    play(d, 10, walk(0));
    // Both seats predicted again with their new bodies from the frame seat list.
    const seats = d.replica.seats.entities;
    expect(seats).toEqual(
      new Map([
        [0, d.host.player.id],
        [1, guest?.player.id],
      ]),
    );
    expect(seats).not.toEqual(before);
    input.movement = walk(-1);
    const run = play(d, 30, walk(1));
    expect(run.unpredicted).toBe(0);
    expect(run.compared).toBeGreaterThan(20);
    expect(run.error).toBeLessThan(0.02);
    expect(d.predictor.player?.id).toBe(d.host.player.id);

    // The guest leaves: the packet carries seat 0 alone and its body is no co-seat.
    await d.session.seats.leave(d.request, d.nextId(), 1);
    expect(d.session.seats.list().map((s) => s.seat)).toEqual([0]);
    play(d, 5, walk(1));
    expect(d.replica.seats.entities).toEqual(new Map([[0, d.host.player.id]]));
    expect(d.predictor.lastReconcileDiagnostics?.seatCorrections?.size).toBe(0);
  });
});
