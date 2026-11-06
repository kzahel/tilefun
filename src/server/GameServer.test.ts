import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalTransport } from "../transport/LocalTransport.js";
import { GameServer } from "./GameServer.js";
import { browserServerDependencies } from "./hosts/browser.js";

import { memoryServer } from "./test/MemoryServer.js";

const servers: GameServer[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await s.destroy();
});
async function createTestServer() {
  const result = await memoryServer();
  servers.push(result.server);
  return result;
}

describe("GameServer", () => {
  it("construction creates World, EntityManager, PropManager", async () => {
    const transport = new LocalTransport();
    const server = new GameServer(transport.serverSide, browserServerDependencies());

    expect(server.world).toBeDefined();
    expect(server.entityManager).toBeDefined();
    expect(server.propManager).toBeDefined();
  });

  it("triggerConnect creates a PlayerSession", async () => {
    const { server } = await createTestServer();
    const session = server.getLocalSession();

    expect(session).toBeDefined();
    expect(session.clientId).toBe("local");
    expect(session.player).toBeDefined();
    expect(session.player.type).toBe("player");
  });

  it("tick with player-input updates player velocity", async () => {
    const { server, transport } = await createTestServer();

    // Need to be in play mode for input to apply
    const session = server.getLocalSession();
    session.editorEnabled = false;

    transport.clientSide.send({
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    });

    server.tick(1 / 60);

    // updatePlayerFromInput sets velocity based on dx/dy
    const player = session.player;
    expect(player.velocity).not.toBeNull();
    // Player should have rightward velocity
    expect(player.velocity?.vx).toBeGreaterThan(0);
  });

  it("tick with edit-spawn creates an entity", async () => {
    const { server, transport } = await createTestServer();
    const initialCount = server.entityManager.entities.length;

    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 100,
      wy: 100,
    });

    expect(server.entityManager.entities.length).toBe(initialCount + 1);
    const chicken = server.entityManager.entities.find((e) => e.type === "chicken");
    expect(chicken).toBeDefined();
    expect(chicken?.position.wx).toBe(100);
    expect(chicken?.position.wy).toBe(100);
  });

  it("tick with edit-delete-entity removes entity", async () => {
    const { server, transport } = await createTestServer();

    // Spawn and then delete
    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 50,
      wy: 50,
    });

    const chicken = server.entityManager.entities.find((e) => e.type === "chicken");
    expect(chicken).toBeDefined();
    const chickenId = chicken?.id ?? -1;

    transport.clientSide.send({
      type: "edit-delete-entity",
      entityId: chickenId,
    });

    expect(server.entityManager.entities.find((e) => e.type === "chicken")).toBeUndefined();
  });

  it("edit-delete-entity does not remove the player", async () => {
    const { server, transport } = await createTestServer();
    const session = server.getLocalSession();
    const playerId = session.player.id;

    transport.clientSide.send({
      type: "edit-delete-entity",
      entityId: playerId,
    });

    // Player should still exist
    expect(server.entityManager.entities.find((e) => e.id === playerId)).toBeDefined();
  });

  it("player-interact toggles following on nearby befriendable entity", async () => {
    const { server, transport } = await createTestServer();

    // Spawn a chicken near the interact point
    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 10,
      wy: 10,
    });

    const chicken = server.entityManager.entities.find((e) => e.type === "chicken");
    expect(chicken?.wanderAI?.befriendable).toBe(true);
    expect(chicken?.wanderAI?.following).toBeFalsy();

    // Interact near the chicken
    transport.clientSide.send({
      type: "player-interact",
      wx: 10,
      wy: 10,
    });

    expect(chicken?.wanderAI?.following).toBe(true);

    // Interact again to toggle off
    transport.clientSide.send({
      type: "player-interact",
      wx: 10,
      wy: 10,
    });

    expect(chicken?.wanderAI?.following).toBe(false);
  });

  it("set-editor-mode updates session state", async () => {
    const { server, transport } = await createTestServer();
    const session = server.getLocalSession();

    expect(session.editorEnabled).toBe(true);

    transport.clientSide.send({
      type: "set-editor-mode",
      enabled: false,
    });

    expect(session.editorEnabled).toBe(false);
  });
});

describe("request failures", () => {
  it("answers failed world requests with request-error instead of leaving them pending", async () => {
    const { server, transport } = await createTestServer();
    const messages: import("../shared/protocol.js").ServerMessage[] = [];
    transport.clientSide.onMessage((m) => messages.push(m));
    vi.spyOn(server, "listWorlds").mockRejectedValue(new Error("list failed"));
    vi.spyOn(server, "renameWorld").mockRejectedValue(new Error("rename failed"));

    transport.clientSide.send({ type: "list-worlds", requestId: 41 });
    transport.clientSide.send({ type: "rename-world", requestId: 42, worldId: "w", name: "n" });
    await server.settle();

    expect(messages).toContainEqual({
      type: "request-error",
      requestId: 41,
      message: "list failed",
    });
    expect(messages).toContainEqual({
      type: "request-error",
      requestId: 42,
      message: "rename failed",
    });
  });
});

describe("pattern commands", () => {
  it("returns validation and history status on the real transport and requires editor mode", async () => {
    const { server, transport } = await createTestServer();
    const messages: import("../shared/protocol.js").ServerMessage[] = [];
    transport.clientSide.onMessage((m) => messages.push(m));
    transport.clientSide.send({
      type: "edit-pattern",
      start: { x: 100, y: 100 },
      end: { x: 110, y: 102 },
      erase: false,
    });
    await server.settle();
    expect(server.propManager.props.filter((p) => p.type.startsWith("pattern:"))).toHaveLength(1);
    expect(messages.at(-1)).toEqual({
      type: "pattern-edit-status",
      error: "",
      canUndo: true,
      canRedo: false,
    });
    transport.clientSide.send({ type: "edit-pattern-history", direction: "undo" });
    await server.settle();
    expect(server.propManager.props.filter((p) => p.type.startsWith("pattern:"))).toHaveLength(0);
    transport.clientSide.send({ type: "edit-pattern-history", direction: "redo" });
    await server.settle();
    await server.settle();
    expect(server.propManager.props.filter((p) => p.type.startsWith("pattern:"))).toHaveLength(1);
    transport.clientSide.send({ type: "set-editor-mode", enabled: false });
    transport.clientSide.send({
      type: "edit-pattern",
      start: { x: 100, y: 101 },
      end: { x: 110, y: 101 },
      erase: false,
    });
    expect(messages.at(-1)).toMatchObject({
      type: "pattern-edit-status",
      error: expect.stringContaining("editor"),
    });
    await server.settle();
    expect(server.propManager.props.filter((p) => p.type.startsWith("pattern:"))).toHaveLength(1);
    server.destroy();
  });
});

it.each(["global", "recipient"])(
  "continues simulation under %s replication backpressure and preserves the next baseline",
  async (scope) => {
    const { server, transport } = await createTestServer();
    await server.settle();
    const session = server.getLocalSession();
    session.editorEnabled = false;
    server.broadcasting = true;
    let writable = false;
    transport.serverSide.canSend = (id) =>
      scope === "recipient" && id === undefined ? true : writable;
    const messages: import("../shared/protocol.js").ServerMessage[] = [];
    transport.clientSide.onMessage((message) => messages.push(message));
    const before = session.player.position.wx;
    transport.clientSide.send({
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    });
    server.tick(1 / 60);
    expect(session.player.position.wx).toBeGreaterThan(before);
    expect(messages).toEqual([]);
    writable = true;
    server.tick(1 / 60);
    const frame = messages.find((message) => message.type === "frame");
    expect(
      frame?.type === "frame" &&
        frame.entityBaselines?.some((entity) => entity.id === session.player.id),
    ).toBe(true);
    expect(server.completedTicks).toBe(2);
    server.destroy();
  },
);
