import { describe, expect, it } from "vitest";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { baseGameMod } from "../game/base-game.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { PlayerSession } from "../server/PlayerSession.js";
import { WorldAPIImpl } from "../server/WorldAPI.js";
import { World } from "../world/World.js";
import { doubleGemsMod } from "./double-gems.js";

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
  return { api, session };
}

describe("double-gems mod", () => {
  it("doubles gems collected when active", () => {
    const { api, session } = createTestEnv();
    const teardownBase = baseGameMod.register(api);
    const teardownDouble = doubleGemsMod.register(api);

    // Player at (50,50), gem at (50,31) — overlapping
    api.entities.spawn("gem", 50, 31);
    api.overlap.tick();

    // Base game gives 1, double-gems gives another 1 = 2 total
    expect(session.gameplaySession.gemsCollected).toBe(2);

    teardownDouble();
    teardownBase();
  });

  it("does not double gems after teardown", () => {
    const { api, session } = createTestEnv();
    const teardownBase = baseGameMod.register(api);
    const teardownDouble = doubleGemsMod.register(api);
    teardownDouble();

    api.entities.spawn("gem", 50, 31);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(1);

    teardownBase();
  });

  it("respects gemValue attribute", () => {
    const { api, session } = createTestEnv();
    const teardownBase = baseGameMod.register(api);
    const teardownDouble = doubleGemsMod.register(api);

    const gem = api.entities.spawn("gem", 50, 31);
    gem?.setAttribute("gemValue", 5);
    api.overlap.tick();

    // Base game gives 5, double-gems gives another 5 = 10 total
    expect(session.gameplaySession.gemsCollected).toBe(10);

    teardownDouble();
    teardownBase();
  });
});
