/**
 * Spike 1a of tactical 226: can one predictor replay several local seats?
 *
 * Each co-op case runs the same authority twice with identical, deterministic
 * delivery delays:
 * - "two": today's shape, one predictor per seat fed by that seat's own stream;
 * - "one": one predictor fed only by seat 0's stream, with seat 1's movement
 *   carried in the same input under the same sequence number.
 * Truth is the authority's physics pose at each tick. The predicted pose of
 * every seat is sampled from each view (seat 0's predictor and seat 1's
 * predictor; the same predictor in "one" mode) the first time it is committed.
 */
import { afterEach, describe, expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import {
  COOP_CASES,
  COOP_IDLE,
  type CoopCase,
  coopRecipe,
  coopScript,
} from "../scenarios/CoopRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import type { Movement } from "../shared/Movement.js";
import type { ServerMessage } from "../shared/protocol.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

/** "anchored": as "one", but seat 0's stream snapshot is anchored on both seats (4b-ii). */
type Mode = "two" | "one" | "anchored";
type Pose = { x: number; y: number; z: number };
interface Delays {
  input: (tick: number) => number;
  frame: (tick: number) => number;
}
/** Remote-style schedule from the delayed second player test (SharedPrediction). */
const REMOTE: Delays = { input: (t) => 4 + (t % 3), frame: (t) => 5 + ((t + 1) % 3) };
/** Local Worker: one tick each way. */
const LOCAL: Delays = { input: () => 1, frame: () => 1 };
const TICKS = 260;

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

/** Seat 1 also walks in the vehicle case (one seat drives while the other walks,
 * pauses while the car pulls away, then catches up) and jumps after the opposed
 * push, exercising co-seat jump edges. */
function script(scene: CoopCase, tick: number, seat: 0 | 1): Movement {
  const t = tick % 360;
  if (scene === "vehicle" && seat === 1)
    return { ...COOP_IDLE, dx: (t > 20 && t < 100) || (t > 170 && t < 240) ? 1 : 0 };
  if (scene === "opposed" && seat === 1 && t >= 180 && t < 190) return { ...COOP_IDLE, jump: true };
  return coopScript(scene, tick, seat);
}

interface Client {
  view: RemoteStateView;
  predictor: PlayerPredictor;
}
async function client(clock: () => number): Promise<Client> {
  const predictor = new PlayerPredictor(() => 1, clock);
  cleanup.push(() => predictor.clearPredicted());
  await predictor.ready;
  return { view: new RemoteStateView(new World()), predictor };
}
/** The guest's seat list entry: the lab guest is its own connection, so the stream
 * carries no seat list and the harness names seat 1's entity itself. */
function receive(
  { view, predictor }: Client,
  packets: readonly ArrayBuffer[],
  now: number,
  seats?: ReadonlyMap<number, number>,
) {
  for (const packet of packets) {
    const m = decodeServerMessage(packet);
    if (m.type === "frame") view.applyFrame(m, now);
    else if (m.type.startsWith("sync-"))
      view.applyMessage(m as Parameters<typeof view.applyMessage>[0]);
  }
  if (!predictor.player && view.serverPlayerEntity.id !== -1)
    predictor.reset(view.serverPlayerEntity);
  predictor.reconcile(
    view.serverPlayerEntity,
    view.lastProcessedInputSeq,
    view.world,
    view.props,
    view.serverEntityMap,
    view.mountEntityId,
    {
      serverTick: view.serverTick,
      ...(view.physicsState ? { physics: view.physicsState } : {}),
      ...(seats ? { seats } : {}),
    },
  );
}

interface SeatResult {
  /** Largest correction applied to this seat's body by its own predictor. */
  correction: number;
  /** Predicted pose vs authority at the same physics tick, in the seat's own view. */
  ownView: number;
  /** The same, in the other seat's view (what split screen shows of this player). */
  otherView: number;
  /** Ticks where this seat had no predicted body in its own view (outside the
   * predicting snapshot); one predictor needs multi-anchor snapshots for this. */
  unpredicted: number;
}
interface RunResult {
  seats: [SeatResult, SeatResult];
  /** Largest disagreement between the two views about either seat at one tick. */
  crossView: number;
  /** Deepest presented overlap of the two seats' colliders at render alpha 0.5. */
  overlap: number;
  statuses: Set<string>;
  replaySteps: number;
  ms: number;
  acksEqual: boolean;
  guestInHostSnapshot: boolean;
  /** Host frames whose snapshot omitted seat 1's body. */
  guestAbsentFrames: number;
}

/** "unheld" (a control): as "anchored", but seat 1's movement never reaches the predictor. */
async function run(scene: CoopCase, mode: Mode | "unheld", delays: Delays, guestOffset = 0) {
  const recipe = coopRecipe(scene);
  if (recipe.guest && guestOffset) recipe.guest.position.wx += guestOffset;
  const s = await ScenarioSession.create(recipe);
  cleanup.push(() => s.close());
  const guest = s.guest;
  if (!guest) throw Error("Missing guest");
  await s.ready();
  if (scene === "vehicle") {
    const car = s.handles.car;
    if (car === undefined) throw Error("Missing car");
    await s.command({ kind: "enter-vehicle", entityId: car, seat: 0 });
  }
  s.tick();
  // The lab guest is its own connection, so only the two-anchor snapshot is borrowed
  // from a device stream here; its seat list (two seat 0s) stays off the wire.
  const unseated = (m: ServerMessage): ServerMessage => {
    if (m.type !== "frame") return m;
    const { seats: _seats, ...frame } = m;
    return frame;
  };
  const hostFrames = () =>
    mode === "anchored" || mode === "unheld"
      ? s.realm.replicate(s.player.clientId, [guest]).map((m) => encodeServerMessage(unseated(m)))
      : s.frames();
  let now = 0;
  const clock = () => now;
  const host = await client(clock);
  const second = mode === "two" ? await client(clock) : undefined;
  const seats = mode === "two" ? undefined : new Map([[1, guest.player.id]]);
  receive(host, hostFrames(), now, seats);
  if (second) receive(second, s.takeGuestFrames(), now);
  else s.takeGuestFrames();

  const seatBody = (seat: 0 | 1) =>
    seat === 0 ? (s.player.player.parentId ?? s.player.player.id) : guest.player.id;
  const ids = [seatBody(0), seatBody(1)] as const;
  const truth = new Map<number, Map<number, Pose>>();
  const shown = [new Map<string, Pose>(), new Map<string, Pose>()];
  const result: RunResult = {
    seats: [
      { correction: 0, ownView: 0, otherView: 0, unpredicted: 0 },
      { correction: 0, ownView: 0, otherView: 0, unpredicted: 0 },
    ],
    crossView: 0,
    overlap: 0,
    statuses: new Set(),
    replaySteps: 0,
    ms: 0,
    acksEqual: true,
    guestInHostSnapshot: true,
    guestAbsentFrames: 0,
  };
  const recordTruth = (packets: readonly ArrayBuffer[]) => {
    for (const packet of packets) {
      const m = decodeServerMessage(packet);
      if (m.type !== "frame" || !m.physics) continue;
      const poses = truth.get(m.physics.tick) ?? new Map<number, Pose>();
      for (const b of m.physics.bodies) poses.set(b.id, { x: b.x, y: b.y, z: b.z });
      truth.set(m.physics.tick, poses);
    }
  };
  const sample = (view: 0 | 1, c: Client) => {
    for (const [seat, id] of ids.entries()) {
      const { tick, body } = c.predictor.publishedBody(id);
      if (view === seat && tick !== undefined && !body) result.seats[seat].unpredicted++;
      const key = `${id}:${tick}`;
      if (tick === undefined || !body || shown[view]?.has(key)) continue;
      shown[view]?.set(key, { x: body.position.wx, y: body.position.wy, z: body.wz ?? 0 });
    }
  };
  const observe = (c: Client, owner: 0 | 1 | "both") => {
    const d = c.predictor.lastReconcileDiagnostics;
    if (!d) return;
    if (d.status === "overflow" || d.status === "history-gap") result.statuses.add(d.status);
    if (owner === 0 || owner === "both")
      result.seats[0].correction = Math.max(result.seats[0].correction, d.resimPosErr);
    if (owner === 1)
      result.seats[1].correction = Math.max(result.seats[1].correction, d.resimPosErr);
    if (owner === "both")
      result.seats[1].correction = Math.max(
        result.seats[1].correction,
        d.seatCorrections?.get(ids[1]) ?? 0,
      );
  };
  const presentedOverlap = (c: Client) => {
    const presented = c.predictor.presentEntities(0.5, c.view.serverEntities);
    const [a, b] = ids.map((id) => presented.find((e) => e.id === id));
    if (!a?.collider || !b?.collider) return;
    const p = getEntityAABB(a.position, a.collider),
      q = getEntityAABB(b.position, b.collider);
    const az = a.wz ?? 0,
      bz = b.wz ?? 0,
      vertical =
        Math.min(az + (a.collider.physicalHeight ?? 0), bz + (b.collider.physicalHeight ?? 0)) -
        Math.max(az, bz);
    if (vertical <= 0) return; // stacked, e.g. standing on the other seat's head
    const depth = Math.min(p.right - q.left, q.right - p.left, p.bottom - q.top, q.bottom - p.top);
    result.overlap = Math.max(result.overlap, depth);
  };

  const inputs: { at: number; seq: number; moves: [Movement, Movement] }[] = [];
  const deliveries: { at: number; host: ArrayBuffer[]; guest: ArrayBuffer[] }[] = [];
  let inputAt = 0,
    frameAt = 0;
  for (let tick = 1; tick <= TICKS; tick++) {
    now += PHYSICS_DT;
    const moves: [Movement, Movement] = [script(scene, tick, 0), script(scene, tick, 1)];
    const started = performance.now();
    if (mode !== "two") {
      const coSeats = mode === "unheld" ? undefined : new Map([[1, moves[1]]]);
      host.predictor.storeInput(tick, moves[0], PHYSICS_DT, coSeats);
      host.predictor.update(PHYSICS_DT, moves[0], host.view.world, host.view.props, []);
    } else if (second) {
      for (const [seat, c] of [host, second].entries()) {
        const movement = moves[seat] ?? COOP_IDLE;
        c.predictor.storeInput(tick, movement, PHYSICS_DT);
        c.predictor.update(PHYSICS_DT, movement, c.view.world, c.view.props, []);
      }
    }
    result.ms += performance.now() - started;
    result.replaySteps += host.predictor.recoveryDiagnostics.replayStepsThisTick;
    result.replaySteps += second?.predictor.recoveryDiagnostics.replayStepsThisTick ?? 0;

    inputAt = Math.max(inputAt, tick + delays.input(tick));
    inputs.push({ at: inputAt, seq: tick, moves });
    while (inputs[0] && inputs[0].at <= tick) {
      const input = inputs.shift();
      if (!input) break;
      // One device packet: both seats' commands arrive together.
      s.realm.handleMessage(s.player.clientId, s.player, {
        type: "player-input",
        seq: input.seq,
        ...input.moves[0],
      });
      s.realm.handleMessage(guest.clientId, guest, {
        type: "player-input",
        seq: input.seq,
        ...input.moves[1],
      });
    }
    s.tick();
    const fromHost = hostFrames(),
      guestFrames = s.takeGuestFrames();
    recordTruth(fromHost);
    recordTruth(guestFrames);
    result.acksEqual &&= s.player.lastProcessedInputSeq === guest.lastProcessedInputSeq;
    frameAt = Math.max(frameAt, tick + delays.frame(tick));
    deliveries.push({ at: frameAt, host: fromHost, guest: guestFrames });
    while (deliveries[0] && deliveries[0].at <= tick) {
      const item = deliveries.shift();
      if (!item) break;
      const t0 = performance.now();
      receive(host, item.host, now, seats);
      if (second) receive(second, item.guest, now);
      result.ms += performance.now() - t0;
      const bodies = host.view.physicsState?.bodies;
      if (bodies && !bodies.some((b) => b.id === ids[1])) {
        result.guestInHostSnapshot = false;
        result.guestAbsentFrames++;
      }
      observe(host, mode === "two" ? 0 : "both");
      if (second) observe(second, 1);
    }
    sample(0, host);
    sample(1, second ?? host);
    presentedOverlap(host);
    if (second) presentedOverlap(second);
  }

  // Matched-tick accuracy and cross-view agreement over every sampled tick.
  for (const [seat, id] of ids.entries()) {
    const own = shown[seat],
      other = shown[seat === 0 ? 1 : 0];
    for (const [view, poses] of [
      ["own", own],
      ["other", other],
    ] as const)
      for (const [key, pose] of poses ?? []) {
        const [bodyId, tick] = key.split(":").map(Number);
        if (bodyId !== id || tick === undefined) continue;
        const real = truth.get(tick)?.get(id);
        if (!real) continue;
        const error = Math.hypot(pose.x - real.x, pose.y - real.y, pose.z - real.z);
        const target = result.seats[seat as 0 | 1];
        if (view === "own") target.ownView = Math.max(target.ownView, error);
        else target.otherView = Math.max(target.otherView, error);
      }
    for (const [key, a] of shown[0] ?? []) {
      const b = shown[1]?.get(key);
      if (!b || !key.startsWith(`${id}:`)) continue;
      result.crossView = Math.max(result.crossView, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
    }
  }
  return result;
}

const round = (n: number) => Math.round(n * 100) / 100;
function row(scene: string, mode: Mode | "unheld", delay: string, r: RunResult) {
  return {
    scene,
    delay,
    mode,
    corr0: round(r.seats[0].correction),
    corr1: round(r.seats[1].correction),
    own0: round(r.seats[0].ownView),
    own1: round(r.seats[1].ownView),
    other0: round(r.seats[0].otherView),
    other1: round(r.seats[1].otherView),
    crossView: round(r.crossView),
    overlap: round(r.overlap),
    replaySteps: r.replaySteps,
    ms: round(r.ms),
    statuses: [...r.statuses].join(",") || "ok",
    snapshot: r.guestInHostSnapshot ? "both" : "split",
    unpredicted1: r.seats[1].unpredicted,
  };
}

describe("multi-seat prediction spike (226 slice 1a)", () => {
  it.each(COOP_CASES)("one predictor replays both local seats: %s", async (scene) => {
    const rows = [];
    for (const [delay, delays] of [
      ["remote", REMOTE],
      ["local", LOCAL],
    ] as const) {
      const two = await run(scene, "two", delays);
      const one = await run(scene, "one", delays);
      rows.push(row(scene, "two", delay, two), row(scene, "one", delay, one));
      expect(one.acksEqual).toBe(true);
      // The driven car outruns the walking seat, leaving seat 0's snapshot radius.
      expect(one.guestInHostSnapshot).toBe(scene !== "vehicle");
      expect([...one.statuses]).toEqual([]);
      // The comparisons below only sample predicted ticks, so pin how many
      // are missing: none, except while the car carries seat 0 out of range.
      expect(two.seats.map((s) => s.unpredicted)).toEqual([0, 0]);
      expect(one.seats[0].unpredicted).toBe(0);
      // Seat 1 goes unpredicted only for the frames its body was out of the host
      // snapshot (within a tick of delivery); how far the car rolls sets that count.
      if (scene === "vehicle") {
        // Loose cap from today's 70–72 absent frames: the car pulls away briefly, not all run.
        expect(one.guestAbsentFrames).toBeGreaterThan(0);
        expect(one.guestAbsentFrames).toBeLessThan(TICKS / 3);
        expect(one.seats[1].unpredicted).toBeLessThanOrEqual(one.guestAbsentFrames + 1);
      } else expect(one.seats[1].unpredicted).toBe(0);
      // One predictor shows each local player identically in every view, and
      // no seat is corrected more than by its own dedicated predictor.
      expect(one.crossView).toBe(0);
      expect(one.seats[0].correction).toBeLessThanOrEqual(two.seats[0].correction + 0.01);
      expect(one.seats[1].correction).toBeLessThanOrEqual(two.seats[1].correction + 0.01);
      expect(one.overlap).toBeLessThanOrEqual(two.overlap + 0.01);
      // One replay serves both seats (by construction: both modes share acks).
      expect(one.replaySteps).toBeLessThanOrEqual(two.replaySteps * 0.55);
    }
    console.table(rows);
  });

  it("predicts every seat on every tick from one snapshot anchored on both seats (4b-ii)", async () => {
    const rows = [];
    for (const [scene, offset] of [
      ...COOP_CASES.map((c) => [c, 0] as const),
      ["push", 400] as const,
    ])
      for (const [delay, delays] of [
        ["remote", REMOTE],
        ["local", LOCAL],
      ] as const) {
        const label = offset ? `${scene}+${offset}px` : scene;
        const two = await run(scene, "two", delays, offset);
        const anchored = await run(scene, "anchored", delays, offset);
        rows.push(row(label, "two", delay, two), row(label, "anchored", delay, anchored));
        expect(anchored.acksEqual).toBe(true);
        expect(anchored.guestInHostSnapshot).toBe(true);
        expect([...anchored.statuses]).toEqual([]);
        expect(anchored.seats.map((seat) => seat.unpredicted)).toEqual([0, 0]);
        expect(anchored.crossView).toBe(0);
        expect(anchored.replaySteps).toBeLessThanOrEqual(two.replaySteps * 0.55);
      }
    console.table(rows);
  });

  it("replays seat 1's own movement, keyed by seat: without it seat 1 is further off", async () => {
    const rows = [];
    for (const scene of ["opposed", "vehicle"] as const)
      for (const [delay, delays] of [
        ["remote", REMOTE],
        ["local", LOCAL],
      ] as const) {
        const anchored = await run(scene, "anchored", delays);
        const unheld = await run(scene, "unheld", delays);
        rows.push(row(scene, "anchored", delay, anchored), row(scene, "unheld", delay, unheld));
        // Matched-tick error in seat 1's own view (its correction is not measured
        // unheld: only seats in the input are co-seats). Measured 1.3-2x.
        expect(unheld.seats[1].ownView).toBeGreaterThan(anchored.seats[1].ownView * 1.25);
      }
    console.table(rows);
  });

  it("records why multi-seat needs a multi-anchor snapshot: a distant seat is omitted", async () => {
    const far = await run("push", "one", LOCAL, 400);
    const separate = await run("push", "two", LOCAL, 400);
    expect(far.guestInHostSnapshot).toBe(false);
    expect(far.seats[1].unpredicted).toBeGreaterThan(200);
    expect(separate.seats[1].unpredicted).toBe(0);
  });
});
