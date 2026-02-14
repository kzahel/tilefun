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
import { gemVelocityDecayMod } from "./gem-velocity-decay.js";

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

describe("gem-velocity-decay mod", () => {
  it("decays scattered gem velocity and stops it", () => {
    const { api, em } = createTestEnv();
    const teardown = gemVelocityDecayMod.register(api);

    const gem = spawnGem(api, 200, 200);
    gem.setVelocity(80, 80);

    // Tick many frames to fully decay
    for (let i = 0; i < 180; i++) {
      api.tick.firePost(1 / 60);
    }

    // Velocity should have been cleared
    const entity = em.entities.find((e) => e.id === gem.id);
    expect(entity?.velocity).toBeNull();

    teardown();
  });

  it("moves gem position during decay", () => {
    const { api } = createTestEnv();
    const teardown = gemVelocityDecayMod.register(api);

    const gem = spawnGem(api, 200, 200);
    gem.setVelocity(80, 0);

    api.tick.firePost(1 / 60);

    // Gem should have moved right
    expect(gem.wx).toBeGreaterThan(200);

    teardown();
  });

  it("does not affect gems without velocity", () => {
    const { api } = createTestEnv();
    const teardown = gemVelocityDecayMod.register(api);

    const gem = spawnGem(api, 200, 200);
    // No velocity set

    api.tick.firePost(1 / 60);

    // Position unchanged
    expect(gem.wx).toBe(200);
    expect(gem.wy).toBe(200);

    teardown();
  });

  it("does not affect non-gem entities", () => {
    const { api } = createTestEnv();
    const teardown = gemVelocityDecayMod.register(api);

    const chicken = api.entities.spawn("chicken", 200, 200);
    if (!chicken) throw new Error("Failed to spawn chicken");
    chicken.setVelocity(80, 80);

    api.tick.firePost(1 / 60);

    // Chicken velocity unchanged by this mod
    expect(chicken.vx).toBe(80);
    expect(chicken.vy).toBe(80);

    teardown();
  });

  it("teardown stops gem decay", () => {
    const { api, em } = createTestEnv();
    const teardown = gemVelocityDecayMod.register(api);
    teardown();

    const gem = spawnGem(api, 200, 200);
    gem.setVelocity(80, 80);

    for (let i = 0; i < 180; i++) {
      api.tick.firePost(1 / 60);
    }

    // Velocity should be unchanged
    const entity = em.entities.find((e) => e.id === gem.id);
    expect(entity?.velocity).toEqual({ vx: 80, vy: 80 });

    teardown();
  });
});
