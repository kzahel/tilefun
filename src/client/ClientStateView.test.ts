import { describe, expect, it } from "vitest";
import { GameServer } from "../server/GameServer.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { LocalStateView } from "./ClientStateView.js";

function createTestSetup() {
  const transport = new LocalTransport();
  const server = new GameServer(transport.serverSide);
  server.start();
  transport.triggerConnect();
  const view = new LocalStateView(server);
  return { server, transport, view };
}

describe("LocalStateView", () => {
  it("world returns server.world", () => {
    const { server, view } = createTestSetup();
    expect(view.world).toBe(server.world);
  });

  it("entities returns server entityManager.entities", () => {
    const { server, view } = createTestSetup();
    expect(view.entities).toBe(server.entityManager.entities);
  });

  it("entities reflects spawn changes", () => {
    const { transport, view } = createTestSetup();
    const before = view.entities.length;

    transport.clientSide.send({
      type: "edit-spawn",
      entityType: "chicken",
      wx: 0,
      wy: 0,
    });

    expect(view.entities.length).toBe(before + 1);
  });

  it("props returns server propManager.props", () => {
    const { server, view } = createTestSetup();
    expect(view.props).toBe(server.propManager.props);
  });

  it("playerEntity returns session player", () => {
    const { server, view } = createTestSetup();
    const session = server.getLocalSession();
    expect(view.playerEntity).toBe(session.player);
  });

  it("gemsCollected returns session gameplay state", () => {
    const { server, view } = createTestSetup();
    const session = server.getLocalSession();
    session.gameplaySession.gemsCollected = 42;
    expect(view.gemsCollected).toBe(42);
  });

  it("editorEnabled returns session state", () => {
    const { server, view } = createTestSetup();
    const session = server.getLocalSession();
    expect(view.editorEnabled).toBe(true);
    session.editorEnabled = false;
    expect(view.editorEnabled).toBe(false);
  });
});
