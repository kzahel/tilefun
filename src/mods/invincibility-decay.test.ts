import { describe, expect, it } from "vitest";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { PlayerSession } from "../server/PlayerSession.js";
import { WorldAPIImpl } from "../server/WorldAPI.js";
import { World } from "../world/World.js";
import { invincibilityDecayMod } from "./invincibility-decay.js";

function createTestEnv() {
  const world = new World(new FlatStrategy());
  const em = new EntityManager();
  const pm = new PropManager();
  const bg = new BlendGraph();
  const adj = new TerrainAdjacency(bg);
  const te = new TerrainEditor(world, () => {}, adj);
  const player = em.spawn(createPlayer(100, 100));
  player.velocity = { vx: 0, vy: 0 };
  const session = new PlayerSession("test", player);
  const api = new WorldAPIImpl(world, em, pm, te, () => session);
  return { api, em, session, player };
}

describe("invincibility-decay mod", () => {
  it("decrements invincibility timer", () => {
    const { api, session } = createTestEnv();
    const teardown = invincibilityDecayMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    session.gameplaySession.knockbackVx = 100;
    session.gameplaySession.knockbackVy = 50;

    api.tick.firePost(0.5);

    expect(session.gameplaySession.invincibilityTimer).toBe(0.5);
    expect(Math.abs(session.gameplaySession.knockbackVx)).toBeLessThan(100);

    teardown();
  });

  it("sets flash hidden during invincibility", () => {
    const { api, session, player } = createTestEnv();
    const teardown = invincibilityDecayMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;

    api.tick.firePost(0.01);

    expect(player.flashHidden).toBeDefined();

    teardown();
  });

  it("clears flash hidden when invincibility ends", () => {
    const { api, player } = createTestEnv();
    const teardown = invincibilityDecayMod.register(api);

    player.flashHidden = true;

    api.tick.firePost(1 / 60);

    expect(player.flashHidden).toBe(false);

    teardown();
  });

  it("applies knockback to player velocity", () => {
    const { api, session, player } = createTestEnv();
    const teardown = invincibilityDecayMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    session.gameplaySession.knockbackVx = 200;
    session.gameplaySession.knockbackVy = 0;
    player.velocity = { vx: 0, vy: 0 };

    api.tick.firePost(0.1);

    // Knockback should have been applied to velocity
    expect(player.velocity?.vx).toBeGreaterThan(0);

    teardown();
  });

  it("decays knockback over time", () => {
    const { api, session } = createTestEnv();
    const teardown = invincibilityDecayMod.register(api);

    session.gameplaySession.invincibilityTimer = 2.0;
    session.gameplaySession.knockbackVx = 200;
    session.gameplaySession.knockbackVy = 100;

    // Tick many frames (need ~63+ at decay rate (11/12)/frame to get below 1)
    for (let i = 0; i < 120; i++) {
      api.tick.firePost(1 / 60);
    }

    expect(Math.abs(session.gameplaySession.knockbackVx)).toBeLessThan(1);
    expect(Math.abs(session.gameplaySession.knockbackVy)).toBeLessThan(1);

    teardown();
  });

  it("teardown stops invincibility decay", () => {
    const { api, session } = createTestEnv();
    const teardown = invincibilityDecayMod.register(api);
    teardown();

    session.gameplaySession.invincibilityTimer = 1.0;

    api.tick.firePost(0.5);

    // Timer should be unchanged
    expect(session.gameplaySession.invincibilityTimer).toBe(1.0);
  });
});
