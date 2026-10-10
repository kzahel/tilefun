import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import type { Movement } from "../input/ActionManager.js";
import { World } from "../world/World.js";
import { PlayerPredictor } from "./PlayerPredictor.js";
import { predictInput } from "./predictInput.js";

const DT = 1 / 60;
const right: Movement = { dx: 1, dy: 0, jump: false, sprinting: false };
const left: Movement = { ...right, dx: -1 };
const idle: Movement = { ...right, dx: 0 };
function fixture(mounted = false, clockCost = 0) {
  const world = new World(new FlatStrategy());
  for (let x = -2; x <= 4; x++) world.getChunk(x, 0);
  let now = 0;
  const predictor = new PlayerPredictor(undefined, undefined, () => (now += clockCost));
  const reference = new PlayerPredictor(undefined, undefined, () => (now += clockCost));
  const player = createPlayer(100, 100);
  player.id = 1;
  const mount = createPlayer(100, 100);
  mount.id = 2;
  mount.type = "cow";
  mount.wanderAI = {
    state: "ridden",
    timer: 0,
    dirX: 0,
    dirY: 0,
    idleMin: 1,
    idleMax: 2,
    walkMin: 1,
    walkMax: 2,
    speed: 20,
    directional: false,
    rideSpeed: 60,
  };
  mount.tags = new Set(["rideable"]);
  mount.wz = mount.groundZ = 0;
  if (mounted) {
    player.parentId = 2;
    player.localOffsetX = player.localOffsetY = 0;
    player.wz = player.jumpZ = 10;
  }
  predictor.noclip = reference.noclip = true;
  predictor.reset(player, mounted ? mount : undefined);
  reference.reset(player, mounted ? mount : undefined);
  const entities = mounted ? [mount] : [];
  let seq = 0;
  function input(movement = right, dt = DT) {
    now += dt;
    predictInput(predictor, ++seq, movement, dt, world, [], entities);
    reference.update(dt, movement, world, [], entities);
    expect(predictor.recoveryDiagnostics.replayStepsThisTick).toBeLessThanOrEqual(32);
  }
  function reconcile(ack = 0, entity = player, tick?: number) {
    predictor.reconcile(
      entity,
      ack,
      world,
      [],
      entities,
      mounted ? mount.id : undefined,
      tick === undefined
        ? undefined
        : { serverTick: tick, simulationTime: tick * DT, expectedInputDt: DT },
    );
    expect(predictor.recoveryDiagnostics.replayStepsThisTick).toBeLessThanOrEqual(32);
  }
  function finish(movement = right) {
    let count = 0;
    while (predictor.recoveryDiagnostics.status === "replaying" && count++ < 100) input(movement);
    expect(predictor.recoveryDiagnostics.status).toBe("ready");
    return count;
  }
  return {
    world,
    predictor,
    reference,
    player,
    mount,
    entities,
    input,
    reconcile,
    finish,
    advance: (seconds: number) => {
      now += seconds;
    },
    seq: () => seq,
  };
}
function expectSamePhysics(actual: Entity | null, expected: Entity | null) {
  expect(actual?.position.wx).toBeCloseTo(expected?.position.wx ?? 0, 8);
  expect(actual?.position.wy).toBeCloseTo(expected?.position.wy ?? 0, 8);
  expect(actual?.velocity).toEqual(expected?.velocity);
  expect(actual?.wz).toBeCloseTo(expected?.wz ?? 0, 8);
  expect(actual?.jumpVZ).toEqual(expected?.jumpVZ);
}

describe("prediction backlog recovery", () => {
  it.each([150, 420, 480])(
    "retains %i commands and commits a complete replay without a backwards jump",
    (commands) => {
      const f = fixture();
      for (let i = 0; i < commands; i++) f.input();
      const before = { ...required(f.predictor.player).position };
      f.reconcile();
      expect(f.predictor.player?.position).toEqual(before);
      expect(f.predictor.recoveryDiagnostics.status).toBe("replaying");
      f.finish();
      expectSamePhysics(f.predictor.player, f.reference.player);
      expect(f.predictor.lastReconcileDiagnostics?.resimPosErr).toBeLessThan(1e-8);
    },
  );

  it("replays direction and jump edges in order, including new input during recovery", () => {
    const f = fixture();
    for (let i = 0; i < 150; i++)
      f.input(i === 110 ? { ...left, jump: true, jumpPressed: true } : i > 90 ? left : right);
    f.reconcile();
    f.input({ ...right, jump: true, jumpPressed: true });
    f.finish(left);
    expectSamePhysics(f.predictor.player, f.reference.player);
    expect(f.predictor.player?.sprite?.frameCol).toBe(f.reference.player?.sprite?.frameCol);
    expect(f.predictor.player?.sprite?.animTimer).toBeCloseTo(
      f.reference.player?.sprite?.animTimer ?? 0,
      8,
    );
  });

  it("applies a real authoritative correction after the complete replay", () => {
    const f = fixture();
    const corrected = { ...f.player, position: { wx: 102, wy: 100 } };
    f.reference.reset(corrected);
    for (let i = 0; i < 150; i++) f.input();
    const before = required(f.predictor.player).position.wx;
    f.reconcile(0, corrected);
    expect(f.predictor.player?.position.wx).toBe(before);
    f.finish();
    expectSamePhysics(f.predictor.player, f.reference.player);
    expect(f.predictor.lastReconcileDiagnostics?.resimPosErr).toBeCloseTo(2, 8);
    expect(f.predictor.lastReconcileDiagnostics?.predictedBefore.wx).toBeCloseTo(
      required(f.predictor.player).position.wx - 2,
      8,
    );
  });

  it("does not restart long replays on every newer snapshot", () => {
    const f = fixture();
    for (let i = 0; i < 150; i++) f.input();
    f.reconcile(0, f.player, 1);
    for (let tick = 2; tick < 8 && f.predictor.recoveryDiagnostics.status === "replaying"; tick++) {
      f.reconcile(0, f.player, tick);
      f.input();
    }
    expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
    expectSamePhysics(f.predictor.player, f.reference.player);
    // A newer small replay supersedes the queued old baseline permanently.
    const newest = {
      ...required(f.predictor.player),
      position: { ...required(f.predictor.player).position },
    };
    f.reconcile(f.seq(), newest, 10);
    f.input();
    expectSamePhysics(f.predictor.player, f.reference.player);
  });

  it("a fresh acknowledgement supersedes unfinished scratch work", () => {
    const f = fixture();
    for (let i = 0; i < 150; i++) f.input();
    f.reconcile();
    f.input(left);
    const newest = {
      ...required(f.predictor.player),
      position: { ...required(f.predictor.player).position },
      velocity: { ...required(required(f.predictor.player).velocity) },
    };
    f.reconcile(f.seq(), newest);
    expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
    for (let i = 0; i < 10; i++) f.input(left);
    expectSamePhysics(f.predictor.player, f.reference.player);
  });

  it("replays actual blocking contact and jumping with collision enabled", () => {
    const f = fixture();
    f.predictor.noclip = f.reference.noclip = false;
    const blocker = createPlayer(180, 100);
    blocker.id = 100;
    f.entities.push(blocker);
    for (let i = 0; i < 150; i++)
      f.input(i === 140 ? { ...right, jump: true, jumpPressed: true } : right);
    expect(required(f.predictor.player).position.wx).toBeLessThan(blocker.position.wx);
    f.reconcile();
    f.finish();
    expectSamePhysics(f.predictor.player, f.reference.player);
  });

  it("counts physics subdivisions, and shares a budget across snapshots and update", () => {
    const f = fixture();
    for (let i = 0; i < 40; i++) f.input(right, 0.15);
    f.reconcile();
    f.reconcile();
    f.finish();
    expectSamePhysics(f.predictor.player, f.reference.player);
  });

  it("yields at the elapsed-time target even when the step allowance remains", () => {
    const f = fixture(false, 0.0004);
    for (let i = 0; i < 150; i++) f.input();
    f.reconcile();
    expect(f.predictor.recoveryDiagnostics.replayStepsThisTick).toBeLessThan(32);
    f.finish();
    expectSamePhysics(f.predictor.player, f.reference.player);
  });

  it("continues mount movement and animation while recovering", () => {
    const f = fixture(true);
    for (let i = 0; i < 150; i++) f.input();
    f.reconcile();
    f.finish(left);
    expectSamePhysics(f.predictor.mount, f.reference.mount);
    expectSamePhysics(f.predictor.player, f.reference.player);
    expect(f.predictor.mount?.sprite?.frameCol).toBe(f.reference.mount?.sprite?.frameCol);
  });

  it("holds an incomplete-history snapshot, then resumes when ack covers the lost prefix", () => {
    const f = fixture();
    for (let i = 0; i < 500; i++) f.input();
    const dropped = required(f.predictor.recoveryDiagnostics.discardedThroughSeq);
    const before = { ...required(f.predictor.player).position };
    f.reconcile();
    expect(f.predictor.recoveryDiagnostics.status).toBe("history-gap");
    expect(f.predictor.player?.position).toEqual(before);
    const prefix = new PlayerPredictor();
    prefix.noclip = true;
    prefix.reset(f.player);
    for (let i = 0; i < dropped; i++) prefix.update(DT, right, f.world, [], []);
    f.reconcile(dropped, required(prefix.player));
    f.finish();
    expectSamePhysics(f.predictor.player, f.reference.player);
  });

  it("bounds zero-duration history by count as well as duration", () => {
    const f = fixture();
    for (let i = 0; i < 1200; i++) f.input(idle, 0);
    expect(f.predictor.recoveryDiagnostics.retainedInputs).toBe(1024);
    f.reconcile();
    expect(f.predictor.recoveryDiagnostics.status).toBe("history-gap");
  });

  it("explicitly resyncs after the gap grace, and never replays a missing prefix", () => {
    const f = fixture();
    for (let i = 0; i < 500; i++) f.input();
    f.reconcile();
    f.advance(0.3);
    f.reconcile();
    expect(f.predictor.recoveryDiagnostics.status).toBe("resync");
    expect(f.predictor.player?.position).toEqual(f.player.position);
    expect(f.predictor.recoveryDiagnostics.retainedInputs).toBe(0);
    f.reconcile(10);
    expect(f.predictor.recoveryDiagnostics.status).toBe("resync");
    f.reconcile(f.seq(), required(f.reference.player));
    expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
    expectSamePhysics(f.predictor.player, f.reference.player);
  });

  it("ignores old acknowledgements and old server ticks", () => {
    const f = fixture();
    f.input();
    f.reconcile(1, required(f.reference.player), 10);
    const before = { ...required(f.predictor.player).position };
    f.reconcile(0, f.player, 11);
    expect(f.predictor.recoveryDiagnostics.status).toBe("stale");
    f.reconcile(1, f.player, 9);
    expect(f.predictor.recoveryDiagnostics.status).toBe("stale");
    expect(f.predictor.player?.position).toEqual(before);
  });

  it("retains the acknowledgement fence across a relocation reset", () => {
    const f = fixture();
    for (let i = 0; i < 150; i++) f.input();
    f.reconcile(10, f.player, 100);
    const relocated = { ...f.player, position: { wx: 1000, wy: 100 } };
    f.reconcile(10, relocated, 101);
    expect(f.predictor.player?.position).toEqual(relocated.position);
    f.reconcile(9, f.player, 102);
    expect(f.predictor.recoveryDiagnostics.status).toBe("stale");
    expect(f.predictor.player?.position).toEqual(relocated.position);
  });

  it.each(["teleport", "mount", "world"])("cancels backlog work on %s reset", (kind) => {
    const f = fixture();
    f.reconcile(); // previous authority pose/ack for same-ack discontinuity
    for (let i = 0; i < 150; i++) f.input();
    f.reconcile();
    const relocated = { ...f.player, position: { wx: 1000, wy: 100 } };
    if (kind === "teleport") f.reconcile(0, relocated);
    else if (kind === "mount")
      f.predictor.reconcile({ ...relocated, parentId: 2 }, 0, f.world, [], [f.mount], 2);
    else {
      f.predictor.clearPredicted();
      f.predictor.reset(relocated);
    }
    expect(f.predictor.player?.position).toEqual(relocated.position);
    expect(f.predictor.recoveryDiagnostics.status).toBe("ready");
    expect(f.predictor.recoveryDiagnostics.retainedInputs).toBe(0);
  });
});
