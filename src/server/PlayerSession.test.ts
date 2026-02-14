import { describe, expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { PlayerSession } from "./PlayerSession.js";

describe("PlayerSession", () => {
  it("has correct default state", () => {
    const player = createPlayer(50, 100);
    const session = new PlayerSession("test-client", player);

    expect(session.clientId).toBe("test-client");
    expect(session.editorEnabled).toBe(true);
    expect(session.inputQueue).toEqual([]);
    expect(session.cameraX).toBe(0);
    expect(session.cameraY).toBe(0);
    expect(session.cameraZoom).toBe(1);
    expect(session.debugPaused).toBe(false);
    expect(session.debugNoclip).toBe(false);
    expect(session.gameplaySession.gemsCollected).toBe(0);
    expect(session.gameplaySession.invincibilityTimer).toBe(0);
    expect(session.gameplaySession.knockbackVx).toBe(0);
    expect(session.gameplaySession.knockbackVy).toBe(0);
  });

  it("gameplaySession.player is same object as constructor param", () => {
    const player = createPlayer(0, 0);
    const session = new PlayerSession("local", player);

    expect(session.gameplaySession.player).toBe(player);
  });

  it("visibleRange defaults to zero", () => {
    const player = createPlayer(0, 0);
    const session = new PlayerSession("local", player);

    expect(session.visibleRange).toEqual({
      minCx: 0,
      minCy: 0,
      maxCx: 0,
      maxCy: 0,
    });
  });
});
