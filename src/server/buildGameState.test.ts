import { describe, expect, it } from "vitest";
import type { GameStateMessage, ServerMessage } from "../shared/protocol.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { GameServer } from "./GameServer.js";

/** Capture all GameStateMessages sent to the local client. */
function captureMessages(transport: LocalTransport): GameStateMessage[] {
  const messages: GameStateMessage[] = [];
  transport.clientSide.onMessage((msg: ServerMessage) => {
    if (msg.type === "game-state") {
      messages.push(msg);
    }
  });
  return messages;
}

function createBroadcastingServer() {
  const transport = new LocalTransport();
  const messages = captureMessages(transport);
  const server = new GameServer(transport.serverSide);
  server.start();
  server.broadcasting = true;
  transport.triggerConnect();

  // Set visible range so chunks load and entities are visible
  transport.clientSide.send({
    type: "visible-range",
    minCx: -2,
    minCy: -2,
    maxCx: 2,
    maxCy: 2,
  });

  return { server, transport, messages };
}

function tickAndGetMessage(
  server: GameServer,
  messages: GameStateMessage[],
  dt = 1 / 60,
): GameStateMessage {
  const before = messages.length;
  server.tick(dt);
  expect(messages.length).toBeGreaterThan(before);
  const msg = messages[messages.length - 1];
  if (!msg) throw new Error("No message received after tick");
  return msg;
}

describe("buildGameState entity delta protocol", () => {
  it("first tick sends player entity as baseline", () => {
    const { server, messages } = createBroadcastingServer();
    const msg = tickAndGetMessage(server, messages);

    expect(msg.type).toBe("game-state");
    expect(msg.entityBaselines).toBeDefined();
    expect(msg.entityBaselines?.length).toBeGreaterThanOrEqual(1);

    const playerBaseline = msg.entityBaselines?.find((e) => e.type === "player");
    expect(playerBaseline).toBeDefined();
    expect(playerBaseline?.id).toBe(msg.playerEntityId);
  });

  it("second tick with no changes sends no entity data (idle = 0 bytes)", () => {
    const { server, messages } = createBroadcastingServer();

    // First tick — baselines
    tickAndGetMessage(server, messages);

    // Second tick — no changes, no entity data
    const msg2 = tickAndGetMessage(server, messages);
    expect(msg2.entityBaselines).toBeUndefined();
    expect(msg2.entityDeltas).toBeUndefined();
    expect(msg2.entityExits).toBeUndefined();
  });

  it("spawned entity appears as baseline on next tick", () => {
    const { server, transport, messages } = createBroadcastingServer();

    // First tick — initial baselines
    tickAndGetMessage(server, messages);

    // Spawn a chicken
    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 50,
      wy: 50,
    });

    // Second tick — chicken should appear as baseline
    const msg2 = tickAndGetMessage(server, messages);
    expect(msg2.entityBaselines).toBeDefined();
    const chickenBaseline = msg2.entityBaselines?.find((e) => e.type === "chicken");
    expect(chickenBaseline).toBeDefined();
    expect(chickenBaseline?.position.wx).toBe(50);
  });

  it("player input produces entity delta (not baseline) on subsequent tick", () => {
    const { server, transport, messages } = createBroadcastingServer();
    const session = server.getLocalSession();
    session.editorEnabled = false;

    // First tick — baselines
    tickAndGetMessage(server, messages);

    // Send player input to start moving
    transport.clientSide.send({
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    });

    // Tick several frames so physics actually moves the player
    let msg = tickAndGetMessage(server, messages);
    for (let i = 0; i < 5; i++) {
      transport.clientSide.send({
        type: "player-input",
        seq: i + 2,
        dx: 1,
        dy: 0,
        sprinting: false,
        jump: false,
      });
      msg = tickAndGetMessage(server, messages);
    }

    // Player should never reappear as baseline (it was already known)
    const playerBaseline = msg.entityBaselines?.find((e) => e.id === msg.playerEntityId);
    expect(playerBaseline).toBeUndefined();

    // Over several ticks of movement, at least one should have a delta
    const hasPlayerDelta = messages.some((m) =>
      m.entityDeltas?.some((d) => d.id === m.playerEntityId),
    );
    expect(hasPlayerDelta).toBe(true);
  });

  it("deleted entity sends exit", () => {
    const { server, transport, messages } = createBroadcastingServer();

    // Spawn a chicken
    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 50,
      wy: 50,
    });

    // First tick — get baselines including chicken
    const msg1 = tickAndGetMessage(server, messages);
    const chickenBaseline = msg1.entityBaselines?.find((e) => e.type === "chicken");
    expect(chickenBaseline).toBeDefined();
    const chickenId = chickenBaseline?.id ?? -1;
    expect(chickenId).not.toBe(-1);

    // Delete the chicken
    transport.clientSide.send({
      type: "edit-delete-entity",
      entityId: chickenId,
    });

    // Second tick — chicken should appear in exits
    const msg2 = tickAndGetMessage(server, messages);
    expect(msg2.entityExits).toBeDefined();
    expect(msg2.entityExits).toContain(chickenId);
  });

  it("entity baseline includes required snapshot fields", () => {
    const { server, transport, messages } = createBroadcastingServer();

    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 100,
      wy: 150,
    });

    const msg = tickAndGetMessage(server, messages);
    const chicken = msg.entityBaselines?.find((e) => e.type === "chicken");
    expect(chicken).toBeDefined();
    expect(chicken?.id).toBeTypeOf("number");
    expect(chicken?.type).toBe("chicken");
    expect(chicken?.position).toEqual({ wx: 100, wy: 150 });
    // SpriteState has dynamic fields only
    expect(chicken?.spriteState).toBeDefined();
    expect(chicken?.spriteState?.direction).toBeTypeOf("number");
    expect(chicken?.spriteState?.moving).toBeTypeOf("boolean");
    expect(chicken?.spriteState?.frameRow).toBeTypeOf("number");
    // WanderAI state for chicken
    expect(chicken?.wanderAIState).toBeDefined();
    expect(chicken?.wanderAIState?.state).toBeTypeOf("string");
  });
});

describe("buildGameState scalar delta fields", () => {
  it("first tick sends all delta fields (sentinels force first send)", () => {
    const { server, messages } = createBroadcastingServer();
    const msg = tickAndGetMessage(server, messages);

    // Scalars should be sent on first tick (sentinel mismatch)
    expect(msg.gemsCollected).toBeDefined();
    expect(msg.editorEnabled).toBeDefined();
    expect(msg.playerNames).toBeDefined();
    expect(msg.cvars).toBeDefined();
  });

  it("second tick omits unchanged scalar fields", () => {
    const { server, messages } = createBroadcastingServer();

    // First tick — all fields sent
    tickAndGetMessage(server, messages);

    // Second tick — nothing changed, fields should be absent
    const msg2 = tickAndGetMessage(server, messages);
    expect(msg2.gemsCollected).toBeUndefined();
    expect(msg2.editorEnabled).toBeUndefined();
    expect(msg2.playerNames).toBeUndefined();
    expect(msg2.cvars).toBeUndefined();
  });

  it("editor mode change is sent as delta", () => {
    const { server, transport, messages } = createBroadcastingServer();

    // First tick
    tickAndGetMessage(server, messages);

    // Toggle editor mode
    transport.clientSide.send({ type: "set-editor-mode", enabled: false });

    // Second tick — editorEnabled should be sent
    const msg2 = tickAndGetMessage(server, messages);
    expect(msg2.editorEnabled).toBe(false);
  });

  it("editor mode not sent when unchanged", () => {
    const { server, transport, messages } = createBroadcastingServer();

    // First tick
    tickAndGetMessage(server, messages);

    // Toggle off
    transport.clientSide.send({ type: "set-editor-mode", enabled: false });
    tickAndGetMessage(server, messages);

    // Third tick — no change, should be absent
    const msg3 = tickAndGetMessage(server, messages);
    expect(msg3.editorEnabled).toBeUndefined();
  });

  it("always-present fields are always sent", () => {
    const { server, messages } = createBroadcastingServer();

    tickAndGetMessage(server, messages);
    const msg2 = tickAndGetMessage(server, messages);

    // These must always be present, even on a quiet tick
    expect(msg2.type).toBe("game-state");
    expect(msg2.serverTick).toBeTypeOf("number");
    expect(msg2.lastProcessedInputSeq).toBeTypeOf("number");
    expect(msg2.playerEntityId).toBeTypeOf("number");
  });

  it("serverTick increments each tick", () => {
    const { server, messages } = createBroadcastingServer();

    const msg1 = tickAndGetMessage(server, messages);
    const msg2 = tickAndGetMessage(server, messages);

    expect(msg2.serverTick).toBe(msg1.serverTick + 1);
  });
});

describe("buildGameState chunk deltas", () => {
  it("first tick includes chunk data for visible range", () => {
    const { server, messages } = createBroadcastingServer();
    const msg = tickAndGetMessage(server, messages);

    // Loaded chunks within visible range should be sent
    expect(msg.loadedChunkKeys).toBeDefined();
    expect(msg.loadedChunkKeys?.length).toBeGreaterThan(0);
  });

  it("second tick omits chunk data when unchanged", () => {
    const { server, messages } = createBroadcastingServer();

    tickAndGetMessage(server, messages);
    const msg2 = tickAndGetMessage(server, messages);

    // No chunk changes, should be absent
    expect(msg2.chunkUpdates).toBeUndefined();
    expect(msg2.loadedChunkKeys).toBeUndefined();
  });
});
