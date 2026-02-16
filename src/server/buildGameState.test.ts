import { describe, expect, it } from "vitest";
import type {
  FrameMessage,
  ServerMessage,
  SyncChunksMessage,
  SyncCVarsMessage,
  SyncPlayerNamesMessage,
  SyncSessionMessage,
} from "../shared/protocol.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { GameServer } from "./GameServer.js";

/** Capture all ServerMessages sent to the local client. */
function captureMessages(transport: LocalTransport): ServerMessage[] {
  const messages: ServerMessage[] = [];
  transport.clientSide.onMessage((msg: ServerMessage) => {
    messages.push(msg);
  });
  return messages;
}

/** Get all frame messages from a list. */
function getFrames(messages: ServerMessage[]): FrameMessage[] {
  return messages.filter((m): m is FrameMessage => m.type === "frame");
}

/** Get all messages of a specific sync type from a list. */
function getSyncOfType<T extends ServerMessage>(messages: ServerMessage[], type: T["type"]): T[] {
  return messages.filter((m): m is T => m.type === type);
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

/** Tick and return all messages produced by that tick (frame + sync events). */
function tickAndGetMessages(
  server: GameServer,
  messages: ServerMessage[],
  dt = 1 / 60,
): ServerMessage[] {
  const before = messages.length;
  server.tick(dt);
  expect(messages.length).toBeGreaterThan(before);
  return messages.slice(before);
}

/** Tick and return the frame message from that tick. */
function tickAndGetFrame(server: GameServer, messages: ServerMessage[], dt = 1 / 60): FrameMessage {
  const tickMsgs = tickAndGetMessages(server, messages, dt);
  const frames = getFrames(tickMsgs);
  expect(frames).toHaveLength(1);
  return frames[0]!;
}

describe("buildMessages entity delta protocol", () => {
  it("first tick sends player entity as baseline", () => {
    const { server, messages } = createBroadcastingServer();
    const frame = tickAndGetFrame(server, messages);

    expect(frame.type).toBe("frame");
    expect(frame.entityBaselines).toBeDefined();
    expect(frame.entityBaselines?.length).toBeGreaterThanOrEqual(1);

    const playerBaseline = frame.entityBaselines?.find((e) => e.type === "player");
    expect(playerBaseline).toBeDefined();
    expect(playerBaseline?.id).toBe(frame.playerEntityId);
  });

  it("second tick with no changes sends no entity data (idle = 0 bytes)", () => {
    const { server, messages } = createBroadcastingServer();

    // First tick — baselines
    tickAndGetFrame(server, messages);

    // Second tick — no changes, no entity data
    const frame2 = tickAndGetFrame(server, messages);
    expect(frame2.entityBaselines).toBeUndefined();
    expect(frame2.entityDeltas).toBeUndefined();
    expect(frame2.entityExits).toBeUndefined();
  });

  it("spawned entity appears as baseline on next tick", () => {
    const { server, transport, messages } = createBroadcastingServer();

    // First tick — initial baselines
    tickAndGetFrame(server, messages);

    // Spawn a chicken
    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 50,
      wy: 50,
    });

    // Second tick — chicken should appear as baseline
    const frame2 = tickAndGetFrame(server, messages);
    expect(frame2.entityBaselines).toBeDefined();
    const chickenBaseline = frame2.entityBaselines?.find((e) => e.type === "chicken");
    expect(chickenBaseline).toBeDefined();
    expect(chickenBaseline?.position.wx).toBe(50);
  });

  it("player input produces entity delta (not baseline) on subsequent tick", () => {
    const { server, transport, messages } = createBroadcastingServer();
    const session = server.getLocalSession();
    session.editorEnabled = false;

    // First tick — baselines
    tickAndGetFrame(server, messages);

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
    let frame = tickAndGetFrame(server, messages);
    for (let i = 0; i < 5; i++) {
      transport.clientSide.send({
        type: "player-input",
        seq: i + 2,
        dx: 1,
        dy: 0,
        sprinting: false,
        jump: false,
      });
      frame = tickAndGetFrame(server, messages);
    }

    // Player should never reappear as baseline (it was already known)
    const playerBaseline = frame.entityBaselines?.find((e) => e.id === frame.playerEntityId);
    expect(playerBaseline).toBeUndefined();

    // Over several ticks of movement, at least one frame should have a player delta
    const allFrames = getFrames(messages);
    const hasPlayerDelta = allFrames.some((f) =>
      f.entityDeltas?.some((d) => d.id === f.playerEntityId),
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
    const frame1 = tickAndGetFrame(server, messages);
    const chickenBaseline = frame1.entityBaselines?.find((e) => e.type === "chicken");
    expect(chickenBaseline).toBeDefined();
    const chickenId = chickenBaseline?.id ?? -1;
    expect(chickenId).not.toBe(-1);

    // Delete the chicken
    transport.clientSide.send({
      type: "edit-delete-entity",
      entityId: chickenId,
    });

    // Second tick — chicken should appear in exits
    const frame2 = tickAndGetFrame(server, messages);
    expect(frame2.entityExits).toBeDefined();
    expect(frame2.entityExits).toContain(chickenId);
  });

  it("entity baseline includes required snapshot fields", () => {
    const { server, transport, messages } = createBroadcastingServer();

    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 100,
      wy: 150,
    });

    const frame = tickAndGetFrame(server, messages);
    const chicken = frame.entityBaselines?.find((e) => e.type === "chicken");
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

describe("buildMessages sync events", () => {
  it("first tick sends all sync events (sentinels force first send)", () => {
    const { server, messages } = createBroadcastingServer();
    const tickMsgs = tickAndGetMessages(server, messages);

    // Session sync should be present
    const sessions = getSyncOfType<SyncSessionMessage>(tickMsgs, "sync-session");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.gemsCollected).toBeDefined();
    expect(sessions[0]!.editorEnabled).toBeDefined();

    // Player names sync
    const names = getSyncOfType<SyncPlayerNamesMessage>(tickMsgs, "sync-player-names");
    expect(names).toHaveLength(1);

    // CVars sync
    const cvars = getSyncOfType<SyncCVarsMessage>(tickMsgs, "sync-cvars");
    expect(cvars).toHaveLength(1);
  });

  it("second tick omits unchanged sync events", () => {
    const { server, messages } = createBroadcastingServer();

    // First tick — all sync events sent
    tickAndGetMessages(server, messages);

    // Second tick — nothing changed, only frame message
    const tickMsgs2 = tickAndGetMessages(server, messages);
    const frames = getFrames(tickMsgs2);
    expect(frames).toHaveLength(1);
    // No sync events on quiet tick
    expect(tickMsgs2).toHaveLength(1);
  });

  it("editor mode change produces sync-session event", () => {
    const { server, transport, messages } = createBroadcastingServer();

    // First tick
    tickAndGetMessages(server, messages);

    // Toggle editor mode
    transport.clientSide.send({ type: "set-editor-mode", enabled: false });

    // Second tick — sync-session should be sent
    const tickMsgs2 = tickAndGetMessages(server, messages);
    const sessions = getSyncOfType<SyncSessionMessage>(tickMsgs2, "sync-session");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.editorEnabled).toBe(false);
  });

  it("editor mode not sent when unchanged", () => {
    const { server, transport, messages } = createBroadcastingServer();

    // First tick
    tickAndGetMessages(server, messages);

    // Toggle off
    transport.clientSide.send({ type: "set-editor-mode", enabled: false });
    tickAndGetMessages(server, messages);

    // Third tick — no change, no sync-session
    const tickMsgs3 = tickAndGetMessages(server, messages);
    const sessions = getSyncOfType<SyncSessionMessage>(tickMsgs3, "sync-session");
    expect(sessions).toHaveLength(0);
  });

  it("frame always-present fields are always sent", () => {
    const { server, messages } = createBroadcastingServer();

    tickAndGetFrame(server, messages);
    const frame2 = tickAndGetFrame(server, messages);

    // These must always be present, even on a quiet tick
    expect(frame2.type).toBe("frame");
    expect(frame2.serverTick).toBeTypeOf("number");
    expect(frame2.lastProcessedInputSeq).toBeTypeOf("number");
    expect(frame2.playerEntityId).toBeTypeOf("number");
  });

  it("serverTick increments each tick", () => {
    const { server, messages } = createBroadcastingServer();

    const frame1 = tickAndGetFrame(server, messages);
    const frame2 = tickAndGetFrame(server, messages);

    expect(frame2.serverTick).toBe(frame1.serverTick + 1);
  });
});

describe("buildMessages chunk deltas", () => {
  it("first tick includes chunk data for visible range", () => {
    const { server, messages } = createBroadcastingServer();
    const tickMsgs = tickAndGetMessages(server, messages);

    const chunks = getSyncOfType<SyncChunksMessage>(tickMsgs, "sync-chunks");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.loadedChunkKeys).toBeDefined();
    expect(chunks[0]!.loadedChunkKeys?.length).toBeGreaterThan(0);
  });

  it("second tick omits chunk data when unchanged", () => {
    const { server, messages } = createBroadcastingServer();

    tickAndGetMessages(server, messages);
    const tickMsgs2 = tickAndGetMessages(server, messages);

    // No chunk sync on quiet tick
    const chunks = getSyncOfType<SyncChunksMessage>(tickMsgs2, "sync-chunks");
    expect(chunks).toHaveLength(0);
  });
});
