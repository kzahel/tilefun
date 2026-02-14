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
import { buddyScareMod } from "./buddy-scare.js";

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

function spawnFollowingChicken(api: WorldAPIImpl, wx: number, wy: number) {
  const chicken = api.entities.spawn("chicken", wx, wy);
  if (!chicken) throw new Error("Failed to spawn chicken");
  chicken.setFollowing(true);
  return chicken;
}

describe("buddy-scare mod", () => {
  it("scares following buddy away from hostile entity", () => {
    const { api } = createTestEnv();
    const teardown = buddyScareMod.register(api);

    // Ghost and chicken at same position — their AABBs overlap
    api.entities.spawn("ghost-angry", 100, 100);
    const chicken = spawnFollowingChicken(api, 100, 100);

    api.overlap.tick();

    expect(chicken.isFollowing).toBe(false);
    expect(chicken.aiState).toBe("walking");

    teardown();
  });

  it("does not scare non-following buddies", () => {
    const { api } = createTestEnv();
    const teardown = buddyScareMod.register(api);

    api.entities.spawn("ghost-angry", 100, 100);
    const chicken = api.entities.spawn("chicken", 100, 100);

    api.overlap.tick();

    // Chicken was not following, so it shouldn't be affected
    expect(chicken?.aiState).not.toBe("walking");

    teardown();
  });

  it("applies flee velocity to scared buddy", () => {
    const { api, em } = createTestEnv();
    const teardown = buddyScareMod.register(api);

    // Place ghost slightly to the left so chicken flees right
    api.entities.spawn("ghost-angry", 98, 100);
    const chicken = spawnFollowingChicken(api, 102, 100);

    api.overlap.tick();

    const raw = em.entities.find((e) => e.id === chicken.id);
    expect(raw?.velocity?.vx).toBeGreaterThan(0); // fleeing right

    teardown();
  });

  it("does not scare buddy when hostile is far away", () => {
    const { api } = createTestEnv();
    const teardown = buddyScareMod.register(api);

    api.entities.spawn("ghost-angry", 200, 200);
    const chicken = spawnFollowingChicken(api, 100, 100);

    api.overlap.tick();

    expect(chicken.isFollowing).toBe(true);

    teardown();
  });

  it("teardown stops buddy scare", () => {
    const { api } = createTestEnv();
    const teardown = buddyScareMod.register(api);

    teardown();

    api.entities.spawn("ghost-angry", 100, 100);
    const chicken = spawnFollowingChicken(api, 100, 100);

    api.overlap.tick();

    expect(chicken.isFollowing).toBe(true);
  });
});
