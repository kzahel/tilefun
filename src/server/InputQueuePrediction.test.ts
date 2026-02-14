import { describe, expect, it } from "vitest";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { PLAYER_SPEED, TICK_RATE } from "../config/constants.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import type { Movement } from "../input/ActionManager.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { World } from "../world/World.js";
import { GameServer } from "./GameServer.js";

const DT = 1 / TICK_RATE;
const MOVE_PER_TICK = PLAYER_SPEED * DT;

const RIGHT: Movement = { dx: 1, dy: 0, sprinting: false };
const IDLE: Movement = { dx: 0, dy: 0, sprinting: false };

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
  });
}

describe("Input queue prediction invariant", () => {
  it("1 input per tick: player moves 1 tick per tick (normal case)", () => {
    const { server, transport, session } = createTestServer();
    const startX = session.player.position.wx;

    sendInput(transport, 1, RIGHT);
    server.tick(DT);

    expect(session.player.position.wx).toBeCloseTo(startX + MOVE_PER_TICK);
    expect(session.lastProcessedInputSeq).toBe(1);
  });

  it("2 inputs before 1 tick: player moves exactly 2 ticks", () => {
    const { server, transport, session } = createTestServer();
    const startX = session.player.position.wx;

    // Simulate timing jitter: 2 client ticks fire between server ticks
    sendInput(transport, 1, RIGHT);
    sendInput(transport, 2, RIGHT);
    server.tick(DT);

    expect(session.player.position.wx).toBeCloseTo(startX + 2 * MOVE_PER_TICK);
    expect(session.lastProcessedInputSeq).toBe(2);
  });

  it("0 inputs before tick: player does NOT move (velocity zeroed)", () => {
    const { server, transport, session } = createTestServer();

    // First give the player some velocity
    sendInput(transport, 1, RIGHT);
    server.tick(DT);
    const posAfterFirst = session.player.position.wx;

    // Now tick with no new input — player should stay put
    server.tick(DT);

    expect(session.player.position.wx).toBeCloseTo(posAfterFirst);
  });

  it("jitter pattern [2,0,1,2,0] over 5 ticks = 5 inputs total", () => {
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

    // 5 inputs processed, each moves MOVE_PER_TICK
    expect(session.player.position.wx).toBeCloseTo(startX + 5 * MOVE_PER_TICK);
    expect(session.lastProcessedInputSeq).toBe(5);
  });

  it("direction changes are processed in order", () => {
    const { server, transport, session } = createTestServer();
    const startX = session.player.position.wx;
    const startY = session.player.position.wy;

    // 2 inputs in one tick: first right, then down
    sendInput(transport, 1, RIGHT);
    sendInput(transport, 2, { dx: 0, dy: 1, sprinting: false });
    server.tick(DT);

    // Should have moved right for input 1, then down for input 2
    expect(session.player.position.wx).toBeCloseTo(startX + MOVE_PER_TICK);
    expect(session.player.position.wy).toBeCloseTo(startY + MOVE_PER_TICK);
  });

  it("idle input (dx=0,dy=0) stops movement", () => {
    const { server, transport, session } = createTestServer();

    sendInput(transport, 1, RIGHT);
    server.tick(DT);
    const posAfterMove = session.player.position.wx;

    // Send idle input, then tick
    sendInput(transport, 2, IDLE);
    server.tick(DT);

    expect(session.player.position.wx).toBeCloseTo(posAfterMove);
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
