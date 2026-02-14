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
import { befriendableMod } from "./befriendable.js";

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
  return { api };
}

describe("befriendable mod", () => {
  it("toggles following on nearby entity with befriendable tag", () => {
    const { api } = createTestEnv();
    const teardown = befriendableMod.register(api);

    const chicken = api.entities.spawn("chicken", 10, 10);
    expect(chicken).not.toBeNull();
    // chicken factory already sets befriendable tag

    api.events.emit("player-interact", { wx: 10, wy: 10 });
    expect(chicken?.isFollowing).toBe(true);

    api.events.emit("player-interact", { wx: 10, wy: 10 });
    expect(chicken?.isFollowing).toBe(false);

    teardown();
  });

  it("ignores entities without befriendable tag", () => {
    const { api } = createTestEnv();
    const teardown = befriendableMod.register(api);

    const ghost = api.entities.spawn("ghost-angry", 10, 10);
    expect(ghost).not.toBeNull();

    api.events.emit("player-interact", { wx: 10, wy: 10 });
    expect(ghost?.isFollowing).toBe(false);

    teardown();
  });

  it("ignores entities outside range", () => {
    const { api } = createTestEnv();
    const teardown = befriendableMod.register(api);

    const chicken = api.entities.spawn("chicken", 100, 100);
    expect(chicken).not.toBeNull();

    api.events.emit("player-interact", { wx: 0, wy: 0 });
    expect(chicken?.isFollowing).toBe(false);

    teardown();
  });

  it("only affects the first matching entity", () => {
    const { api } = createTestEnv();
    const teardown = befriendableMod.register(api);

    const c1 = api.entities.spawn("chicken", 10, 10);
    const c2 = api.entities.spawn("chicken", 12, 12);
    expect(c1).not.toBeNull();
    expect(c2).not.toBeNull();

    api.events.emit("player-interact", { wx: 10, wy: 10 });

    const followCount = [c1, c2].filter((c) => c?.isFollowing).length;
    expect(followCount).toBe(1);

    teardown();
  });

  it("teardown removes the listener", () => {
    const { api } = createTestEnv();
    const teardown = befriendableMod.register(api);

    const chicken = api.entities.spawn("chicken", 10, 10);
    expect(chicken).not.toBeNull();

    teardown();

    api.events.emit("player-interact", { wx: 10, wy: 10 });
    expect(chicken?.isFollowing).toBe(false);
  });
});
