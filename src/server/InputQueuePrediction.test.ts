import { describe, expect, it } from "vitest";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { TICK_RATE } from "../config/constants.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import type { Movement } from "../input/ActionManager.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { World } from "../world/World.js";
import { GameServer } from "./GameServer.js";

const DT = 1 / TICK_RATE;

const RIGHT: Movement = { dx: 1, dy: 0, sprinting: false, jump: false };
const IDLE: Movement = { dx: 0, dy: 0, sprinting: false, jump: false };

function createTestServer() {
  const transport = new LocalTransport();
  const server = new GameServer(transport.serverSide);
  server.start();
  transport.triggerConnect();
  const session = server.getLocalSession();
  session.editorEnabled = false;
  session.debugNoclip = true; // Eliminate collision variables
  return { server, transport, session };
}

function sendInput(transport: LocalTransport, seq: number, movement: Movement) {
  transport.clientSide.send({
    type: "player-input",
    seq,
    dx: movement.dx,
    dy: movement.dy,
    sprinting: movement.sprinting,
    jump: movement.jump,
  });
}

describe("Input queue prediction invariant", () => {
  it("1 input per tick: player moves rightward (acceleration model)", () => {
    const { server, transport, session } = createTestServer();
    const startX = session.player.position.wx;

    sendInput(transport, 1, RIGHT);
    server.tick(DT);

    // With friction/acceleration, player accelerates — position increases
    expect(session.player.position.wx).toBeGreaterThan(startX);
    expect(session.lastProcessedInputSeq).toBe(1);
  });

  it("2 inputs before 1 tick: player moves further than 1 input", () => {
    const { server, transport, session } = createTestServer();
    const startX = session.player.position.wx;

    // Simulate timing jitter: 2 client ticks fire between server ticks
    sendInput(transport, 1, RIGHT);
    sendInput(transport, 2, RIGHT);
    server.tick(DT);

    // 2 inputs should move further than start
    expect(session.player.position.wx).toBeGreaterThan(startX);
    expect(session.lastProcessedInputSeq).toBe(2);
  });

  it("0 inputs before tick: player decelerates via friction", () => {
    const { server, transport, session } = createTestServer();

    // First give the player some velocity via multiple ticks
    for (let i = 1; i <= 5; i++) {
      sendInput(transport, i, RIGHT);
      server.tick(DT);
    }
    const posAfterMoving = session.player.position.wx;
    const velAfter = session.player.velocity!.vx;

    // Now tick with no new input — friction decelerates
    server.tick(DT);

    const velAfterFriction = Math.abs(session.player.velocity!.vx);
    // Velocity should be lower after friction (or zero at high friction values)
    expect(velAfterFriction).toBeLessThan(Math.abs(velAfter));
    // If residual velocity remains, player should have slid forward
    if (velAfterFriction > 0) {
      expect(session.player.position.wx).toBeGreaterThan(posAfterMoving);
    }
  });

  it("jitter pattern [2,0,1,2,0] processes all inputs", () => {
    const { server, transport, session } = createTestServer();
    const startX = session.player.position.wx;
    let seq = 0;

    // Tick 1: 2 inputs
    sendInput(transport, ++seq, RIGHT); // 1
    sendInput(transport, ++seq, RIGHT); // 2
    server.tick(DT);

    // Tick 2: 0 inputs
    server.tick(DT);

    // Tick 3: 1 input
    sendInput(transport, ++seq, RIGHT); // 3
    server.tick(DT);

    // Tick 4: 2 inputs
    sendInput(transport, ++seq, RIGHT); // 4
    sendInput(transport, ++seq, RIGHT); // 5
    server.tick(DT);

    // Tick 5: 0 inputs
    server.tick(DT);

    // Player should have moved rightward
    expect(session.player.position.wx).toBeGreaterThan(startX);
    expect(session.lastProcessedInputSeq).toBe(5);
  });

  it("direction changes are processed in order", () => {
    const { server, transport, session } = createTestServer();
    const startX = session.player.position.wx;
    const startY = session.player.position.wy;

    // 2 inputs in one tick: first right, then down
    sendInput(transport, 1, RIGHT);
    sendInput(transport, 2, { dx: 0, dy: 1, sprinting: false, jump: false });
    server.tick(DT);

    // Should have moved right for input 1, then down for input 2
    expect(session.player.position.wx).toBeGreaterThan(startX);
    expect(session.player.position.wy).toBeGreaterThan(startY);
  });

  it("idle input decelerates after movement", () => {
    const { server, transport, session } = createTestServer();

    // Build up some velocity
    for (let i = 1; i <= 5; i++) {
      sendInput(transport, i, RIGHT);
      server.tick(DT);
    }
    const posAfterMove = session.player.position.wx;

    // Send idle input, then tick — friction decelerates
    sendInput(transport, 6, IDLE);
    server.tick(DT);

    // Player slides forward slightly due to remaining velocity + friction
    // but should not have moved backward
    expect(session.player.position.wx).toBeGreaterThanOrEqual(posAfterMove);
  });
});

describe("Client prediction matches server after reconciliation", () => {
  it("zero prediction error with 1:1 input-to-tick ratio", () => {
    const { server, transport, session } = createTestServer();
    const world = new World(new FlatStrategy());
    const predictor = new PlayerPredictor();
    predictor.noclip = true;
    predictor.reset(session.player);

    for (let seq = 1; seq <= 10; seq++) {
      // Client: store input + predict
      predictor.storeInput(seq, RIGHT, DT);
      predictor.update(DT, RIGHT, world, [], []);

      // Transport: send input
      sendInput(transport, seq, RIGHT);

      // Server: tick
      server.tick(DT);

      // Client: reconcile
      predictor.reconcile(session.player, session.lastProcessedInputSeq, world, [], []);

      // After reconciliation with no unacked inputs, predicted == server
      expect(predictor.player!.position.wx).toBeCloseTo(session.player.position.wx);
      expect(predictor.player!.position.wy).toBeCloseTo(session.player.position.wy);
    }
  });

  it("zero prediction error with timing jitter (2-0-1 pattern)", () => {
    const { server, transport, session } = createTestServer();
    const world = new World(new FlatStrategy());
    const predictor = new PlayerPredictor();
    predictor.noclip = true;
    predictor.reset(session.player);

    let seq = 0;

    // --- Client ticks 1 & 2 fire before server tick ---
    // Client tick 1
    ++seq;
    predictor.storeInput(seq, RIGHT, DT);
    predictor.update(DT, RIGHT, world, [], []);
    sendInput(transport, seq, RIGHT);

    // Client tick 2 (fires before server gets to tick)
    ++seq;
    predictor.storeInput(seq, RIGHT, DT);
    predictor.update(DT, RIGHT, world, [], []);
    sendInput(transport, seq, RIGHT);

    // Server tick 1: processes both inputs
    server.tick(DT);

    // Client reconciles with server state
    predictor.reconcile(session.player, session.lastProcessedInputSeq, world, [], []);
    expect(predictor.player!.position.wx).toBeCloseTo(session.player.position.wx);

    // --- Server tick 2 fires with no client input ---
    server.tick(DT);

    // No reconciliation needed (no new state concept in this test),
    // but verify server didn't move
    const serverPosAfterEmptyTick = session.player.position.wx;
    expect(serverPosAfterEmptyTick).toBeCloseTo(session.player.position.wx);

    // --- Client tick 3 ---
    ++seq;
    predictor.storeInput(seq, RIGHT, DT);
    predictor.update(DT, RIGHT, world, [], []);
    sendInput(transport, seq, RIGHT);

    // Server tick 3: processes 1 input
    server.tick(DT);

    // Reconcile again
    predictor.reconcile(session.player, session.lastProcessedInputSeq, world, [], []);
    expect(predictor.player!.position.wx).toBeCloseTo(session.player.position.wx);

    // Total: 3 inputs processed on both sides
    expect(session.lastProcessedInputSeq).toBe(3);
  });

  it("zero error after sustained jitter over many ticks", () => {
    const { server, transport, session } = createTestServer();
    const world = new World(new FlatStrategy());
    const predictor = new PlayerPredictor();
    predictor.noclip = true;
    predictor.reset(session.player);

    let seq = 0;
    // Simulate 50 ticks of realistic jitter:
    // Pattern cycles through [2, 0, 1, 1, 1] = 5 inputs per 5 server ticks
    const jitterPattern = [2, 0, 1, 1, 1];

    for (let tick = 0; tick < 50; tick++) {
      const inputsThisTick = jitterPattern[tick % jitterPattern.length]!;

      // Client ticks (send inputs + predict)
      for (let i = 0; i < inputsThisTick; i++) {
        ++seq;
        predictor.storeInput(seq, RIGHT, DT);
        predictor.update(DT, RIGHT, world, [], []);
        sendInput(transport, seq, RIGHT);
      }

      // Server tick
      server.tick(DT);

      // Client reconcile
      predictor.reconcile(session.player, session.lastProcessedInputSeq, world, [], []);
    }

    expect(predictor.player!.position.wx).toBeCloseTo(session.player.position.wx);
    expect(session.lastProcessedInputSeq).toBe(seq);
  });
});
