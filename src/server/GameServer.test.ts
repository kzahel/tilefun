import { describe, expect, it } from "vitest";
import { LocalTransport } from "../transport/LocalTransport.js";
import { GameServer } from "./GameServer.js";

function createTestServer() {
  const transport = new LocalTransport();
  const server = new GameServer(transport.serverSide);
  server.start();

  // Manually create a session by triggering connect
  transport.triggerConnect();

  return { server, transport };
}

describe("GameServer", () => {
  it("construction creates World, EntityManager, PropManager", () => {
    const transport = new LocalTransport();
    const server = new GameServer(transport.serverSide);

    expect(server.world).toBeDefined();
    expect(server.entityManager).toBeDefined();
    expect(server.propManager).toBeDefined();
  });

  it("triggerConnect creates a PlayerSession", () => {
    const { server } = createTestServer();
    const session = server.getLocalSession();

    expect(session).toBeDefined();
    expect(session.clientId).toBe("local");
    expect(session.player).toBeDefined();
    expect(session.player.type).toBe("player");
  });

  it("tick with player-input updates player velocity", () => {
    const { server, transport } = createTestServer();

    // Need to be in play mode for input to apply
    const session = server.getLocalSession();
    session.editorEnabled = false;

    transport.clientSide.send({
      type: "player-input",
      dx: 1,
      dy: 0,
      sprinting: false,
    });

    server.tick(1 / 60);

    // updatePlayerFromInput sets velocity based on dx/dy
    const player = session.player;
    expect(player.velocity).not.toBeNull();
    // Player should have rightward velocity
    expect(player.velocity?.vx).toBeGreaterThan(0);
  });

  it("tick with edit-spawn creates an entity", () => {
    const { server, transport } = createTestServer();
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

  it("tick with edit-delete-entity removes entity", () => {
    const { server, transport } = createTestServer();

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

  it("edit-delete-entity does not remove the player", () => {
    const { server, transport } = createTestServer();
    const session = server.getLocalSession();
    const playerId = session.player.id;

    transport.clientSide.send({
      type: "edit-delete-entity",
      entityId: playerId,
    });

    // Player should still exist
    expect(server.entityManager.entities.find((e) => e.id === playerId)).toBeDefined();
  });

  it("player-interact toggles following on nearby befriendable entity", () => {
    const { server, transport } = createTestServer();

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

  it("set-editor-mode updates session state", () => {
    const { server, transport } = createTestServer();
    const session = server.getLocalSession();

    expect(session.editorEnabled).toBe(true);

    transport.clientSide.send({
      type: "set-editor-mode",
      enabled: false,
    });

    expect(session.editorEnabled).toBe(false);
  });
});
