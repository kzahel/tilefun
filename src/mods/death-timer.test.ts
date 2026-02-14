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
import { deathTimerMod } from "./death-timer.js";

function createTestEnv() {
  const world = new World(new FlatStrategy());
  const em = new EntityManager();
  const pm = new PropManager();
  const bg = new BlendGraph();
  const adj = new TerrainAdjacency(bg);
  const te = new TerrainEditor(world, () => {}, adj);
  const player = em.spawn(createPlayer(0, 0));
  const session = new PlayerSession("test", player);
  const api = new WorldAPIImpl(world, em, pm, te, () => session);
  return { api, em };
}

function spawnChicken(api: WorldAPIImpl, wx: number, wy: number) {
  const handle = api.entities.spawn("chicken", wx, wy);
  if (!handle) throw new Error("Failed to spawn chicken");
  return handle;
}

describe("death-timer mod", () => {
  it("decrements death timer each tick", () => {
    const { api } = createTestEnv();
    const teardown = deathTimerMod.register(api);

    const chicken = spawnChicken(api, 50, 50);
    chicken.setDeathTimer(1.0);

    api.tick.firePost(0.1);

    const updated = api.entities.find(chicken.id);
    expect(updated?.deathTimer).toBeCloseTo(0.9);

    teardown();
  });

  it("sets flash effect during death countdown", () => {
    const { api, em } = createTestEnv();
    const teardown = deathTimerMod.register(api);

    const chicken = spawnChicken(api, 50, 50);
    chicken.setDeathTimer(0.5);

    api.tick.firePost(0.01);

    const raw = em.entities.find((e) => e.id === chicken.id);
    expect(raw?.flashHidden).toBeDefined();

    teardown();
  });

  it("removes entity when death timer expires", () => {
    const { api } = createTestEnv();
    const teardown = deathTimerMod.register(api);

    const chicken = spawnChicken(api, 50, 50);
    chicken.setDeathTimer(0.1);

    api.tick.firePost(0.2);

    const found = api.entities.find(chicken.id);
    expect(found).toBeNull();

    teardown();
  });

  it("does not affect entities without death timer", () => {
    const { api } = createTestEnv();
    const teardown = deathTimerMod.register(api);

    const chicken = spawnChicken(api, 50, 50);

    api.tick.firePost(1.0);

    const found = api.entities.find(chicken.id);
    expect(found).not.toBeNull();

    teardown();
  });

  it("teardown stops processing death timers", () => {
    const { api } = createTestEnv();
    const teardown = deathTimerMod.register(api);

    const chicken = spawnChicken(api, 50, 50);
    chicken.setDeathTimer(0.1);

    teardown();

    // Tick past the timer — entity should still exist since mod is torn down
    api.tick.firePost(0.2);

    const found = api.entities.find(chicken.id);
    expect(found).not.toBeNull();
  });
});
