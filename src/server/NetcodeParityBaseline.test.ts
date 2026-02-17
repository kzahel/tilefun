import { describe, expect, it } from "vitest";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { TICK_RATE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import { quantizeInputDtMs } from "../shared/binaryCodec.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { GameServer } from "./GameServer.js";

const IDLE: Movement = { dx: 0, dy: 0, sprinting: false, jump: false };
const RIGHT: Movement = { dx: 1, dy: 0, sprinting: false, jump: false };
const JUMP_IDLE: Movement = { dx: 0, dy: 0, sprinting: false, jump: true };

interface TraceSample {
  tick: number;
  sentSeq: number;
  ackSeq: number;
  ackGap: number;
  inputsThisTick: number;
  correctionPosErr: number;
  correctionVelErr: number;
  correctionJumpVZErr: number;
  resimPosErr: number;
  resimVelErr: number;
  authoritativeWz: number;
  authoritativeJumpVZ: number;
  causeTags: readonly string[];
}

function createMovement(m: Movement): Movement {
  return {
    dx: m.dx,
    dy: m.dy,
    sprinting: m.sprinting,
    jump: m.jump,
    ...(m.jumpPressed ? { jumpPressed: true } : {}),
  };
}

function repeatMovement(m: Movement, count: number): Movement[] {
  return Array.from({ length: count }, () => createMovement(m));
}

function sendInput(transport: LocalTransport, seq: number, movement: Movement, dt: number): void {
  const dtMs = quantizeInputDtMs(dt * 1000);
  transport.clientSide.send({
    type: "player-input",
    seq,
    dx: movement.dx,
    dy: movement.dy,
    sprinting: movement.sprinting,
    jump: movement.jump,
    jumpPressed: movement.jumpPressed,
    dtMs,
  });
}

function createRig(serverTickHz: number) {
  const transport = new LocalTransport();
  const server = new GameServer(transport.serverSide);
  server.start();
  transport.triggerConnect();

  const session = server.getLocalSession();
  session.editorEnabled = false;
  session.debugNoclip = true;

  server.setTickRate(serverTickHz);

  const world = server.world;
  const predictor = new PlayerPredictor();
  predictor.noclip = true;
  predictor.reset(session.player);

  return { transport, server, session, world, predictor };
}

function runTraceScenario(options: {
  serverTickHz: number;
  commandRateHz: number;
  ticks: number;
  inputsForTick: (tick: number) => Movement[];
}): TraceSample[] {
  const { transport, server, session, world, predictor } = createRig(options.serverTickHz);
  const serverDt = 1 / options.serverTickHz;
  const commandDt = 1 / options.commandRateHz;
  const trace: TraceSample[] = [];
  let seq = 0;

  for (let tick = 0; tick < options.ticks; tick++) {
    const inputs = options.inputsForTick(tick);

    for (const movement of inputs) {
      const commandStepDt = quantizeInputDtMs(commandDt * 1000) / 1000;
      seq++;
      predictor.storeInput(seq, movement, commandStepDt);
      predictor.update(commandStepDt, movement, world, [], []);
      sendInput(transport, seq, movement, commandStepDt);
    }

    server.tick(serverDt);
    predictor.reconcile(session.player, session.lastProcessedInputSeq, world, [], [], undefined, {
      expectedInputDt: serverDt,
      serverTick: tick + 1,
    });

    const diagnostics = predictor.lastReconcileDiagnostics;
    if (!diagnostics) throw new Error("missing reconcile diagnostics");

    trace.push({
      tick: tick + 1,
      sentSeq: seq,
      ackSeq: session.lastProcessedInputSeq,
      ackGap: seq - session.lastProcessedInputSeq,
      inputsThisTick: inputs.length,
      correctionPosErr: diagnostics.correctionPosErr,
      correctionVelErr: diagnostics.correctionVelErr,
      correctionJumpVZErr: Math.abs(
        diagnostics.predictedBefore.jumpVZ - diagnostics.authoritative.jumpVZ,
      ),
      resimPosErr: diagnostics.resimPosErr,
      resimVelErr: diagnostics.resimVelErr,
      authoritativeWz: diagnostics.authoritative.wz,
      authoritativeJumpVZ: diagnostics.authoritative.jumpVZ,
      causeTags: diagnostics.causeTags,
    });
  }

  return trace;
}

function maxMetric(trace: TraceSample[], metric: keyof TraceSample): number {
  return trace.reduce((max, sample) => {
    const value = sample[metric];
    return typeof value === "number" && value > max ? value : max;
  }, 0);
}

function snapshot(entity: Entity) {
  return {
    wx: entity.position.wx,
    wy: entity.position.wy,
    wz: entity.wz ?? 0,
    vx: entity.velocity?.vx ?? 0,
    vy: entity.velocity?.vy ?? 0,
    jumpZ: entity.jumpZ ?? 0,
    jumpVZ: entity.jumpVZ ?? 0,
  };
}

function expectSnapshotsClose(
  actual: ReturnType<typeof snapshot>,
  expected: ReturnType<typeof snapshot>,
  epsilon = 1e-6,
): void {
  expect(actual.wx).toBeCloseTo(expected.wx, 6);
  expect(actual.wy).toBeCloseTo(expected.wy, 6);
  expect(actual.wz).toBeCloseTo(expected.wz, 6);
  expect(actual.vx).toBeCloseTo(expected.vx, 6);
  expect(actual.vy).toBeCloseTo(expected.vy, 6);
  expect(actual.jumpZ).toBeCloseTo(expected.jumpZ, 6);
  expect(actual.jumpVZ).toBeCloseTo(expected.jumpVZ, 6);
  expect(Math.abs(actual.wx - expected.wx)).toBeLessThan(epsilon);
  expect(Math.abs(actual.wy - expected.wy)).toBeLessThan(epsilon);
  expect(Math.abs(actual.wz - expected.wz)).toBeLessThan(epsilon);
  expect(Math.abs(actual.vx - expected.vx)).toBeLessThan(epsilon);
  expect(Math.abs(actual.vy - expected.vy)).toBeLessThan(epsilon);
}

describe("Netcode parity baseline trace harness", () => {
  it("keeps deterministic per-tick server/predictor parity at matched command+tick rates", () => {
    const schedule: Movement[] = [];
    for (let i = 0; i < 48; i++) {
      if (i < 30) schedule.push(createMovement(RIGHT));
      else schedule.push(createMovement(IDLE));
    }

    const trace = runTraceScenario({
      serverTickHz: TICK_RATE,
      commandRateHz: TICK_RATE,
      ticks: schedule.length,
      inputsForTick: (tick) => [schedule[tick]!],
    });

    expect(maxMetric(trace, "correctionPosErr")).toBeLessThan(1e-6);
    expect(maxMetric(trace, "correctionVelErr")).toBeLessThan(1e-6);
    expect(maxMetric(trace, "resimPosErr")).toBeLessThan(1e-6);
    expect(maxMetric(trace, "resimVelErr")).toBeLessThan(1e-6);
    expect(maxMetric(trace, "ackGap")).toBe(0);
  });

  it("keeps low-tick quick-tap jump aligned with predictor", () => {
    const trace = runTraceScenario({
      serverTickHz: 15,
      commandRateHz: 60,
      ticks: 10,
      inputsForTick: (tick) => {
        if (tick === 0) {
          return [createMovement(IDLE), createMovement(JUMP_IDLE), createMovement(IDLE), createMovement(IDLE)];
        }
        return repeatMovement(IDLE, 4);
      },
    });

    const jumpStateSamples = trace.filter((sample) => sample.causeTags.includes("jump_state"));
    expect(jumpStateSamples).toHaveLength(0);
    expect(maxMetric(trace, "correctionJumpVZErr")).toBeLessThan(0.01);
    expect(maxMetric(trace, "correctionPosErr")).toBeLessThan(0.01);
    expect(maxMetric(trace, "resimPosErr")).toBeLessThan(0.01);
  });

  it("applies edge-triggered jumpPressed even when held jump samples are false", () => {
    const trace = runTraceScenario({
      serverTickHz: 15,
      commandRateHz: 60,
      ticks: 10,
      inputsForTick: (tick) => {
        if (tick === 0) {
          return [
            createMovement(IDLE),
            { dx: 0, dy: 0, sprinting: false, jump: false, jumpPressed: true },
            createMovement(IDLE),
            createMovement(IDLE),
          ];
        }
        return repeatMovement(IDLE, 4);
      },
    });

    expect(maxMetric(trace, "authoritativeWz")).toBeGreaterThan(0);
    expect(maxMetric(trace, "correctionPosErr")).toBeLessThan(0.01);
    expect(maxMetric(trace, "correctionJumpVZErr")).toBeLessThan(0.01);
  });
});

describe("Input queue + ack monotonic baseline", () => {
  it("keeps ack sequence monotonic under jittered input batching", () => {
    const jitterBatches = [2, 0, 1, 3, 0, 2, 0, 4, 1, 0, 2];
    const trace = runTraceScenario({
      serverTickHz: 30,
      commandRateHz: 60,
      ticks: jitterBatches.length,
      inputsForTick: (tick) => repeatMovement(RIGHT, jitterBatches[tick] ?? 0),
    });

    for (let i = 1; i < trace.length; i++) {
      const prev = trace[i - 1]!;
      const cur = trace[i]!;

      expect(cur.ackSeq).toBeGreaterThanOrEqual(prev.ackSeq);
      expect(cur.ackSeq).toBeLessThanOrEqual(cur.sentSeq);

      if (cur.inputsThisTick === 0) {
        expect(cur.ackSeq).toBe(prev.ackSeq);
      } else {
        expect(cur.ackSeq).toBe(cur.sentSeq);
      }
    }
  });
});

describe("No-input tick parity baseline", () => {
  it("matches grounded no-input server tick against predictor idle step", () => {
    const { server, session, predictor, world } = createRig(TICK_RATE);
    const dt = 1 / TICK_RATE;

    session.player.velocity = { vx: 210, vy: -95 };
    session.player.wz = 0;
    delete session.player.jumpZ;
    delete session.player.jumpVZ;
    predictor.reset(session.player);

    predictor.update(dt, IDLE, world, [], []);
    server.tick(dt);

    expectSnapshotsClose(snapshot(predictor.player!), snapshot(session.player));
  });

  it("matches airborne no-input server tick against predictor idle step", () => {
    const { server, session, predictor, world } = createRig(TICK_RATE);
    const dt = 1 / TICK_RATE;

    session.player.velocity = { vx: 180, vy: 40 };
    session.player.wz = 8;
    session.player.jumpZ = 8;
    session.player.jumpVZ = 120;
    predictor.reset(session.player);

    predictor.update(dt, IDLE, world, [], []);
    server.tick(dt);

    expectSnapshotsClose(snapshot(predictor.player!), snapshot(session.player));
  });
});
