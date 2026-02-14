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
import { baddieContactMod } from "./baddie-contact.js";

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

describe("baddie-contact mod", () => {
  it("applies knockback and invincibility on hostile overlap", () => {
    const { api, session } = createTestEnv();
    const teardown = baddieContactMod.register(api);

    // Player at (50,50) AABB: y=28-34. Ghost at (50,31) AABB: y=23-31. Overlaps.
    api.entities.spawn("ghost-angry", 50, 31);

    api.overlap.tick();

    expect(session.gameplaySession.invincibilityTimer).toBe(1.5);
    expect(
      session.gameplaySession.knockbackVx !== 0 || session.gameplaySession.knockbackVy !== 0,
    ).toBe(true);

    teardown();
  });

  it("scatters gems on hit", () => {
    const { api, session } = createTestEnv();
    const teardown = baddieContactMod.register(api);

    session.gameplaySession.gemsCollected = 5;
    api.entities.spawn("ghost-angry", 50, 31);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(2); // lost min(3, 5) = 3
    // 3 scattered gems spawned
    const gems = api.entities.findByType("gem");
    expect(gems).toHaveLength(3);

    teardown();
  });

  it("does not apply damage during invincibility", () => {
    const { api, session } = createTestEnv();
    const teardown = baddieContactMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    session.gameplaySession.gemsCollected = 5;
    api.entities.spawn("ghost-angry", 50, 31);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(5);

    teardown();
  });

  it("emits player-hit event", () => {
    const { api } = createTestEnv();
    const teardown = baddieContactMod.register(api);

    api.entities.spawn("ghost-angry", 50, 31);

    let emitted: unknown = null;
    api.events.on("player-hit", (data) => {
      emitted = data;
    });

    api.overlap.tick();

    expect(emitted).not.toBeNull();
    const event = emitted as { gemsLost: number };
    expect(event.gemsLost).toBe(0); // no gems to lose

    teardown();
  });

  it("does not trigger when hostile entity is far away", () => {
    const { api, session } = createTestEnv();
    const teardown = baddieContactMod.register(api);

    session.gameplaySession.gemsCollected = 3;
    api.entities.spawn("ghost-angry", 200, 200);

    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(3);
    expect(session.gameplaySession.invincibilityTimer).toBe(0);

    teardown();
  });

  it("teardown stops baddie contact detection", () => {
    const { api, session } = createTestEnv();
    const teardown = baddieContactMod.register(api);

    teardown();

    api.entities.spawn("ghost-angry", 50, 31);

    api.overlap.tick();

    expect(session.gameplaySession.invincibilityTimer).toBe(0);
  });
});
