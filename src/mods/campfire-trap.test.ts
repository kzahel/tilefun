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
import { campfireTrapMod } from "./campfire-trap.js";

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

describe("campfire-trap mod", () => {
  it("starts death timer when hostile entity overlaps campfire", () => {
    const { api } = createTestEnv();
    const teardown = campfireTrapMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 100, 100);

    api.overlap.tick();

    expect(ghost?.deathTimer).toBe(0.4);

    teardown();
  });

  it("removes hostile tag and stops movement", () => {
    const { api } = createTestEnv();
    const teardown = campfireTrapMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 100, 100);

    api.overlap.tick();

    expect(ghost?.hasTag("hostile")).toBe(false);
    expect(ghost?.aiState).toBe("idle");

    teardown();
  });

  it("spawns a reward gem at baddie position", () => {
    const { api } = createTestEnv();
    const teardown = campfireTrapMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    api.entities.spawn("ghost-angry", 100, 100);

    api.overlap.tick();

    const gems = api.entities.findByType("gem");
    expect(gems).toHaveLength(1);

    teardown();
  });

  it("does not affect non-hostile entities", () => {
    const { api } = createTestEnv();
    const teardown = campfireTrapMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const chicken = api.entities.spawn("chicken", 100, 100);

    api.overlap.tick();

    expect(chicken?.deathTimer).toBeUndefined();

    teardown();
  });

  it("does not re-trigger on entity already dying", () => {
    const { api } = createTestEnv();
    const teardown = campfireTrapMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 100, 100);
    ghost?.setDeathTimer(0.2);

    api.overlap.tick();

    // Should keep original timer, not reset to 0.4
    expect(ghost?.deathTimer).toBe(0.2);

    teardown();
  });

  it("does not affect hostile entity far from campfire", () => {
    const { api } = createTestEnv();
    const teardown = campfireTrapMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 200, 200);

    api.overlap.tick();

    expect(ghost?.deathTimer).toBeUndefined();
    expect(ghost?.hasTag("hostile")).toBe(true);

    teardown();
  });

  it("teardown stops campfire trap", () => {
    const { api } = createTestEnv();
    const teardown = campfireTrapMod.register(api);

    teardown();

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 100, 100);

    api.overlap.tick();

    expect(ghost?.deathTimer).toBeUndefined();
  });
});
