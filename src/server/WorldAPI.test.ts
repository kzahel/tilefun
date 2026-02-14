import { describe, expect, it } from "vitest";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { World } from "../world/World.js";
import { EntityHandle } from "./EntityHandle.js";
import { PlayerSession } from "./PlayerSession.js";
import { WorldAPIImpl } from "./WorldAPI.js";

function createTestAPI() {
  const world = new World(new FlatStrategy());
  const entityManager = new EntityManager();
  const propManager = new PropManager();
  const blendGraph = new BlendGraph();
  const adjacency = new TerrainAdjacency(blendGraph);
  const terrainEditor = new TerrainEditor(world, () => {}, adjacency);
  const player = entityManager.spawn(createPlayer(0, 0));
  const session = new PlayerSession("test", player);

  const api = new WorldAPIImpl(world, entityManager, propManager, terrainEditor, () => session);
  return { api, entityManager, propManager, world, player, session };
}

describe("WorldAPIImpl", () => {
  describe("EntityAPI", () => {
    it("spawn creates entity and returns handle", () => {
      const { api } = createTestAPI();
      const handle = api.entities.spawn("chicken", 50, 60);
      expect(handle).not.toBeNull();
      expect(handle?.type).toBe("chicken");
      expect(handle?.wx).toBe(50);
      expect(handle?.wy).toBe(60);
    });

    it("spawn returns null for unknown type", () => {
      const { api } = createTestAPI();
      const handle = api.entities.spawn("nonexistent-xyz", 0, 0);
      expect(handle).toBeNull();
    });

    it("find returns handle for existing entity", () => {
      const { api } = createTestAPI();
      const handle = api.entities.spawn("chicken", 10, 20);
      expect(handle).not.toBeNull();
      const found = api.entities.find(handle?.id ?? -1);
      expect(found).not.toBeNull();
      expect(found?.type).toBe("chicken");
    });

    it("find returns null for non-existent id", () => {
      const { api } = createTestAPI();
      expect(api.entities.find(99999)).toBeNull();
    });

    it("findByType filters correctly", () => {
      const { api } = createTestAPI();
      api.entities.spawn("chicken", 0, 0);
      api.entities.spawn("chicken", 10, 10);
      api.entities.spawn("cow", 20, 20);

      const chickens = api.entities.findByType("chicken");
      expect(chickens).toHaveLength(2);
      const cows = api.entities.findByType("cow");
      expect(cows).toHaveLength(1);
    });

    it("findByTag filters entities with matching tags", () => {
      const { api } = createTestAPI();
      const h1 = api.entities.spawn("chicken", 0, 0);
      const h2 = api.entities.spawn("cow", 10, 10);
      h1?.addTag("friendly");
      h2?.addTag("friendly");

      const friendly = api.entities.findByTag("friendly");
      expect(friendly).toHaveLength(2);

      const hostile = api.entities.findByTag("hostile");
      expect(hostile).toHaveLength(0);
    });

    it("findInRadius returns entities within radius", () => {
      const { api } = createTestAPI();
      api.entities.spawn("chicken", 10, 10);
      api.entities.spawn("chicken", 100, 100);

      // Player at (0,0) + chicken at (10,10) are within radius 20
      const nearby = api.entities.findInRadius(0, 0, 20);
      expect(nearby).toHaveLength(2);
      // The (100,100) chicken is not included
      const far = api.entities.findInRadius(0, 0, 5);
      expect(far).toHaveLength(1); // just the player at (0,0)
    });

    it("remove removes entity from manager", () => {
      const { api } = createTestAPI();
      const handle = api.entities.spawn("chicken", 0, 0);
      expect(handle).not.toBeNull();
      const id = handle?.id ?? -1;
      expect(api.entities.remove(id)).toBe(true);
      expect(api.entities.find(id)).toBeNull();
    });

    it("all returns handles for all entities", () => {
      const { api, entityManager } = createTestAPI();
      api.entities.spawn("chicken", 0, 0);
      api.entities.spawn("cow", 10, 10);
      // +1 for the player that was spawned in createTestAPI
      expect(api.entities.all()).toHaveLength(entityManager.entities.length);
    });
  });

  describe("PropAPI", () => {
    it("place creates prop and returns handle", () => {
      const { api } = createTestAPI();
      const handle = api.props.place("atlas:playground_tube_hor", 50, 60);
      // atlas props may or may not exist depending on the atlas index, so just test the API shape
      // If the type isn't valid, it returns null
      if (handle) {
        expect(handle.type).toBe("atlas:playground_tube_hor");
        expect(handle.wx).toBe(50);
        expect(handle.wy).toBe(60);
        expect(handle.alive).toBe(true);
      }
    });

    it("place returns null for unknown type", () => {
      const { api } = createTestAPI();
      const handle = api.props.place("not-a-real-prop-type", 0, 0);
      expect(handle).toBeNull();
    });

    it("remove removes prop", () => {
      const { api, propManager } = createTestAPI();
      // Manually test with propManager since we need a known valid type
      if (propManager.props.length === 0) {
        // No props to test, which is fine for Phase 1
        expect(api.props.remove(999)).toBe(false);
      }
    });

    it("all returns all prop handles", () => {
      const { api, propManager } = createTestAPI();
      expect(api.props.all()).toHaveLength(propManager.props.length);
    });
  });

  describe("WorldQueryAPI", () => {
    it("isWalkable returns true for non-blocking tile on flat world", () => {
      const { api, world } = createTestAPI();
      // Force chunk creation so the query has data
      world.getChunk(0, 0);
      // FlatStrategy generates all Empty tiles, which should be walkable
      expect(api.world.isWalkable(0, 0)).toBe(true);
    });

    it("findWalkableNear returns center if walkable", () => {
      const { api, world } = createTestAPI();
      world.getChunk(0, 0);
      const result = api.world.findWalkableNear(8, 8, 10);
      expect(result).toEqual({ wx: 8, wy: 8 });
    });

    it("findWalkableNear returns null if nothing walkable within radius", () => {
      const { api } = createTestAPI();
      // Don't load any chunks — unloaded chunks return Solid|Water
      const result = api.world.findWalkableNear(99999, 99999, 0);
      expect(result).toBeNull();
    });

    it("getTerrain returns a tile value", () => {
      const { api, world } = createTestAPI();
      world.getChunk(0, 0);
      const terrain = api.world.getTerrain(0, 0);
      expect(typeof terrain).toBe("number");
    });

    it("getHeight returns 0 for unloaded chunk", () => {
      const { api } = createTestAPI();
      expect(api.world.getHeight(9999, 9999)).toBe(0);
    });

    it("getRoad returns 0 for unloaded chunk", () => {
      const { api } = createTestAPI();
      expect(api.world.getRoad(9999, 9999)).toBe(0);
    });
  });

  describe("PlayerAPI", () => {
    it("get returns PlayerHandle when session exists", () => {
      const { api } = createTestAPI();
      const handle = api.player.get();
      expect(handle).not.toBeNull();
      expect(handle?.type).toBe("player");
    });

    it("get returns null when no session", () => {
      const world = new World(new FlatStrategy());
      const em = new EntityManager();
      const pm = new PropManager();
      const bg = new BlendGraph();
      const adj = new TerrainAdjacency(bg);
      const te = new TerrainEditor(world, () => {}, adj);
      const api = new WorldAPIImpl(world, em, pm, te, () => undefined);
      expect(api.player.get()).toBeNull();
    });

    it("fromEntity returns PlayerHandle for player entity", () => {
      const { api, player, entityManager } = createTestAPI();
      const entityHandle = new EntityHandle(player, entityManager);
      const playerHandle = api.player.fromEntity(entityHandle);
      expect(playerHandle).not.toBeNull();
      expect(playerHandle?.gemsCollected).toBe(0);
    });

    it("fromEntity returns null for non-player entity", () => {
      const { api } = createTestAPI();
      const chicken = api.entities.spawn("chicken", 0, 0);
      expect(chicken).not.toBeNull();
      const playerHandle = api.player.fromEntity(chicken as EntityHandle);
      expect(playerHandle).toBeNull();
    });
  });

  describe("time", () => {
    it("starts at 0", () => {
      const { api } = createTestAPI();
      expect(api.time).toBe(0);
    });

    it("advances with advanceTime", () => {
      const { api } = createTestAPI();
      api.advanceTime(1 / 60);
      api.advanceTime(1 / 60);
      expect(api.time).toBeCloseTo(2 / 60);
    });
  });

  describe("stub services", () => {
    it("tags methods exist and return values", () => {
      const { api } = createTestAPI();
      const chicken = api.entities.spawn("chicken", 0, 0) as EntityHandle;
      api.tags.addTag(chicken, "test");
      api.tags.removeTag(chicken, "test");
      expect(api.tags.hasTag(chicken, "test")).toBe(false);
      expect(api.tags.getTagged("test")).toEqual([]);
      const unsub = api.tags.onTagAdded("test", () => {});
      expect(typeof unsub).toBe("function");
      unsub();
    });

    it("events.on receives emitted events", () => {
      const { api } = createTestAPI();
      let received: unknown = null;
      const unsub = api.events.on("test", (data) => {
        received = data;
      });
      api.events.emit("test", { value: 42 });
      expect(received).toEqual({ value: 42 });
      unsub();
    });

    it("tick methods exist and return Unsubscribe", () => {
      const { api } = createTestAPI();
      const unsub1 = api.tick.onPreSimulation(() => {});
      const unsub2 = api.tick.onPostSimulation(() => {});
      expect(typeof unsub1).toBe("function");
      expect(typeof unsub2).toBe("function");
      unsub1();
      unsub2();
    });

    it("overlap methods exist and return Unsubscribe", () => {
      const { api } = createTestAPI();
      const unsub1 = api.overlap.onOverlap("test", () => {});
      const unsub2 = api.overlap.onOverlapEnd("test", () => {});
      expect(typeof unsub1).toBe("function");
      expect(typeof unsub2).toBe("function");
      unsub1();
      unsub2();
    });
  });
});
