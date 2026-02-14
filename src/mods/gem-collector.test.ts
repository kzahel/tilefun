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
import { gemCollectorMod } from "./gem-collector.js";

function createTestEnv() {
  const world = new World(new FlatStrategy());
  const em = new EntityManager();
  const pm = new PropManager();
  const bg = new BlendGraph();
  const adj = new TerrainAdjacency(bg);
  const te = new TerrainEditor(world, () => {}, adj);
  const player = em.spawn(createPlayer(50, 50));
  const session = new PlayerSession("test", player);
  const api = new WorldAPIImpl(world, em, pm, te, () => session);
  return { api, em, session };
}

function spawnGem(api: WorldAPIImpl, wx: number, wy: number) {
  const handle = api.entities.spawn("gem", wx, wy);
  if (!handle) throw new Error("Failed to spawn gem");
  return handle;
}

describe("gem-collector mod", () => {
  it("collects gem when player overlaps it", () => {
    const { api, session } = createTestEnv();
    const teardown = gemCollectorMod.register(api);

    // Player at (50,50) has collider offsetY=-16, so AABB spans y=28-34.
    // Place gem at (50,31) so its AABB (y=21-31) overlaps the player's.
    const gem = spawnGem(api, 50, 31);

    expect(session.gameplaySession.gemsCollected).toBe(0);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(1);
    expect(api.entities.find(gem.id)).toBeNull();

    teardown();
  });

  it("does not collect gem when player is invincible", () => {
    const { api, session } = createTestEnv();
    const teardown = gemCollectorMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;

    const gem = spawnGem(api, 50, 31);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(0);
    expect(api.entities.find(gem.id)).not.toBeNull();

    teardown();
  });

  it("uses gemValue attribute when set", () => {
    const { api, session } = createTestEnv();
    const teardown = gemCollectorMod.register(api);

    const gem = spawnGem(api, 50, 31);
    gem.setAttribute("gemValue", 5);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(5);

    teardown();
  });

  it("defaults to 1 gem when no gemValue attribute", () => {
    const { api, session } = createTestEnv();
    const teardown = gemCollectorMod.register(api);

    spawnGem(api, 50, 31);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(1);

    teardown();
  });

  it("emits item-collected event", () => {
    const { api } = createTestEnv();
    const teardown = gemCollectorMod.register(api);

    spawnGem(api, 50, 31);

    let emitted: unknown = null;
    api.events.on("item-collected", (data) => {
      emitted = data;
    });

    api.overlap.tick();

    expect(emitted).not.toBeNull();
    const event = emitted as { value: number };
    expect(event.value).toBe(1);

    teardown();
  });

  it("does not collect gem when player is far away", () => {
    const { api, session } = createTestEnv();
    const teardown = gemCollectorMod.register(api);

    // Spawn gem far from player (player is at 50,50)
    spawnGem(api, 200, 200);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(0);

    teardown();
  });

  it("teardown stops gem collection", () => {
    const { api, session } = createTestEnv();
    const teardown = gemCollectorMod.register(api);

    teardown();

    spawnGem(api, 50, 31);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(0);
  });
});
