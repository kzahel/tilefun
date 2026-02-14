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
import { baseGameMod } from "./base-game.js";

function createTestEnv(playerX = 50, playerY = 50) {
  const world = new World(new FlatStrategy());
  const em = new EntityManager();
  const pm = new PropManager();
  const bg = new BlendGraph();
  const adj = new TerrainAdjacency(bg);
  const te = new TerrainEditor(world, () => {}, adj);
  const player = em.spawn(createPlayer(playerX, playerY));
  player.velocity = { vx: 0, vy: 0 };
  const session = new PlayerSession("test", player);
  const api = new WorldAPIImpl(world, em, pm, te, () => session);
  return { api, em, session, player };
}

function spawnGem(api: WorldAPIImpl, wx: number, wy: number) {
  const handle = api.entities.spawn("gem", wx, wy);
  if (!handle) throw new Error("Failed to spawn gem");
  return handle;
}

// ── Combat: baddie contact ──

describe("baddie contact", () => {
  it("applies knockback and invincibility on hostile overlap", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);

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
    const teardown = baseGameMod.register(api);

    session.gameplaySession.gemsCollected = 5;
    api.entities.spawn("ghost-angry", 50, 31);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(2);
    const gems = api.entities.findByType("gem");
    expect(gems).toHaveLength(3);

    teardown();
  });

  it("does not apply damage during invincibility", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    session.gameplaySession.gemsCollected = 5;
    api.entities.spawn("ghost-angry", 50, 31);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(5);

    teardown();
  });

  it("emits player-hit event", () => {
    const { api } = createTestEnv();
    const teardown = baseGameMod.register(api);

    api.entities.spawn("ghost-angry", 50, 31);

    let emitted: unknown = null;
    api.events.on("player-hit", (data) => {
      emitted = data;
    });
    api.overlap.tick();

    expect(emitted).not.toBeNull();
    const event = emitted as { gemsLost: number };
    expect(event.gemsLost).toBe(0);

    teardown();
  });

  it("does not trigger when hostile entity is far away", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);

    session.gameplaySession.gemsCollected = 3;
    api.entities.spawn("ghost-angry", 200, 200);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(3);
    expect(session.gameplaySession.invincibilityTimer).toBe(0);

    teardown();
  });
});

// ── Combat: invincibility decay ──

describe("invincibility decay", () => {
  it("decrements invincibility timer", () => {
    const { api, session } = createTestEnv(100, 100);
    const teardown = baseGameMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    session.gameplaySession.knockbackVx = 100;
    session.gameplaySession.knockbackVy = 50;

    api.tick.firePost(0.5);

    expect(session.gameplaySession.invincibilityTimer).toBe(0.5);
    expect(Math.abs(session.gameplaySession.knockbackVx)).toBeLessThan(100);

    teardown();
  });

  it("sets flash hidden during invincibility", () => {
    const { api, session, player } = createTestEnv(100, 100);
    const teardown = baseGameMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    api.tick.firePost(0.01);

    expect(player.flashHidden).toBeDefined();

    teardown();
  });

  it("clears flash hidden when invincibility ends", () => {
    const { api, player } = createTestEnv(100, 100);
    const teardown = baseGameMod.register(api);

    player.flashHidden = true;
    api.tick.firePost(1 / 60);

    expect(player.flashHidden).toBe(false);

    teardown();
  });

  it("applies knockback to player velocity", () => {
    const { api, session, player } = createTestEnv(100, 100);
    const teardown = baseGameMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    session.gameplaySession.knockbackVx = 200;
    session.gameplaySession.knockbackVy = 0;
    player.velocity = { vx: 0, vy: 0 };

    api.tick.firePost(0.1);

    expect(player.velocity?.vx).toBeGreaterThan(0);

    teardown();
  });

  it("decays knockback over time", () => {
    const { api, session } = createTestEnv(100, 100);
    const teardown = baseGameMod.register(api);

    session.gameplaySession.invincibilityTimer = 2.0;
    session.gameplaySession.knockbackVx = 200;
    session.gameplaySession.knockbackVy = 100;

    for (let i = 0; i < 120; i++) {
      api.tick.firePost(1 / 60);
    }

    expect(Math.abs(session.gameplaySession.knockbackVx)).toBeLessThan(1);
    expect(Math.abs(session.gameplaySession.knockbackVy)).toBeLessThan(1);

    teardown();
  });
});

// ── Combat: buddy scare ──

describe("buddy scare", () => {
  function spawnFollowingChicken(api: WorldAPIImpl, wx: number, wy: number) {
    const chicken = api.entities.spawn("chicken", wx, wy);
    if (!chicken) throw new Error("Failed to spawn chicken");
    chicken.setFollowing(true);
    return chicken;
  }

  it("scares following buddy away from hostile entity", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("ghost-angry", 100, 100);
    const chicken = spawnFollowingChicken(api, 100, 100);
    api.overlap.tick();

    expect(chicken.isFollowing).toBe(false);
    expect(chicken.aiState).toBe("walking");

    teardown();
  });

  it("does not scare non-following buddies", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("ghost-angry", 100, 100);
    const chicken = api.entities.spawn("chicken", 100, 100);
    api.overlap.tick();

    expect(chicken?.aiState).not.toBe("walking");

    teardown();
  });

  it("applies flee velocity to scared buddy", () => {
    const { api, em } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("ghost-angry", 98, 100);
    const chicken = spawnFollowingChicken(api, 102, 100);
    api.overlap.tick();

    const raw = em.entities.find((e) => e.id === chicken.id);
    expect(raw?.velocity?.vx).toBeGreaterThan(0);

    teardown();
  });

  it("does not scare buddy when hostile is far away", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("ghost-angry", 200, 200);
    const chicken = spawnFollowingChicken(api, 100, 100);
    api.overlap.tick();

    expect(chicken.isFollowing).toBe(true);

    teardown();
  });
});

// ── Creatures: befriendable ──

describe("befriendable", () => {
  it("toggles following on nearby entity with befriendable tag", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const chicken = api.entities.spawn("chicken", 10, 10);
    expect(chicken).not.toBeNull();

    api.events.emit("player-interact", { wx: 10, wy: 10 });
    expect(chicken?.isFollowing).toBe(true);

    api.events.emit("player-interact", { wx: 10, wy: 10 });
    expect(chicken?.isFollowing).toBe(false);

    teardown();
  });

  it("ignores entities without befriendable tag", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const ghost = api.entities.spawn("ghost-angry", 10, 10);
    expect(ghost).not.toBeNull();

    api.events.emit("player-interact", { wx: 10, wy: 10 });
    expect(ghost?.isFollowing).toBe(false);

    teardown();
  });

  it("ignores entities outside range", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const chicken = api.entities.spawn("chicken", 100, 100);
    expect(chicken).not.toBeNull();

    api.events.emit("player-interact", { wx: 0, wy: 0 });
    expect(chicken?.isFollowing).toBe(false);

    teardown();
  });

  it("only affects the first matching entity", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const c1 = api.entities.spawn("chicken", 10, 10);
    const c2 = api.entities.spawn("chicken", 12, 12);
    expect(c1).not.toBeNull();
    expect(c2).not.toBeNull();

    api.events.emit("player-interact", { wx: 10, wy: 10 });

    const followCount = [c1, c2].filter((c) => c?.isFollowing).length;
    expect(followCount).toBe(1);

    teardown();
  });
});

// ── Creatures: campfire trap ──

describe("campfire trap", () => {
  it("starts death timer when hostile entity overlaps campfire", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 100, 100);
    api.overlap.tick();

    expect(ghost?.deathTimer).toBe(0.4);

    teardown();
  });

  it("removes hostile tag and stops movement", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 100, 100);
    api.overlap.tick();

    expect(ghost?.hasTag("hostile")).toBe(false);
    expect(ghost?.aiState).toBe("idle");

    teardown();
  });

  it("spawns a reward gem at baddie position", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    api.entities.spawn("ghost-angry", 100, 100);
    api.overlap.tick();

    const gems = api.entities.findByType("gem");
    expect(gems).toHaveLength(1);

    teardown();
  });

  it("does not affect non-hostile entities", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const chicken = api.entities.spawn("chicken", 100, 100);
    api.overlap.tick();

    expect(chicken?.deathTimer).toBeUndefined();

    teardown();
  });

  it("does not re-trigger on entity already dying", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 100, 100);
    ghost?.setDeathTimer(0.2);
    api.overlap.tick();

    expect(ghost?.deathTimer).toBe(0.2);

    teardown();
  });

  it("does not affect hostile entity far from campfire", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    api.entities.spawn("campfire", 100, 100);
    const ghost = api.entities.spawn("ghost-angry", 200, 200);
    api.overlap.tick();

    expect(ghost?.deathTimer).toBeUndefined();
    expect(ghost?.hasTag("hostile")).toBe(true);

    teardown();
  });
});

// ── Creatures: death timer ──

describe("death timer", () => {
  it("decrements death timer each tick", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const chicken = api.entities.spawn("chicken", 50, 50);
    if (!chicken) throw new Error("Failed to spawn chicken");
    chicken.setDeathTimer(1.0);

    api.tick.firePost(0.1);

    const updated = api.entities.find(chicken.id);
    expect(updated?.deathTimer).toBeCloseTo(0.9);

    teardown();
  });

  it("sets flash effect during death countdown", () => {
    const { api, em } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const chicken = api.entities.spawn("chicken", 50, 50);
    if (!chicken) throw new Error("Failed to spawn chicken");
    chicken.setDeathTimer(0.5);

    api.tick.firePost(0.01);

    const raw = em.entities.find((e) => e.id === chicken.id);
    expect(raw?.flashHidden).toBeDefined();

    teardown();
  });

  it("removes entity when death timer expires", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const chicken = api.entities.spawn("chicken", 50, 50);
    if (!chicken) throw new Error("Failed to spawn chicken");
    chicken.setDeathTimer(0.1);

    api.tick.firePost(0.2);

    const found = api.entities.find(chicken.id);
    expect(found).toBeNull();

    teardown();
  });

  it("does not affect entities without death timer", () => {
    const { api } = createTestEnv(0, 0);
    const teardown = baseGameMod.register(api);

    const chicken = api.entities.spawn("chicken", 50, 50);
    if (!chicken) throw new Error("Failed to spawn chicken");

    api.tick.firePost(1.0);

    const found = api.entities.find(chicken.id);
    expect(found).not.toBeNull();

    teardown();
  });
});

// ── Gems: collector ──

describe("gem collector", () => {
  it("collects gem when player overlaps it", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);

    const gem = spawnGem(api, 50, 31);

    expect(session.gameplaySession.gemsCollected).toBe(0);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(1);
    expect(api.entities.find(gem.id)).toBeNull();

    teardown();
  });

  it("does not collect gem when player is invincible", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);

    session.gameplaySession.invincibilityTimer = 1.0;
    const gem = spawnGem(api, 50, 31);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(0);
    expect(api.entities.find(gem.id)).not.toBeNull();

    teardown();
  });

  it("uses gemValue attribute when set", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);

    const gem = spawnGem(api, 50, 31);
    gem.setAttribute("gemValue", 5);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(5);

    teardown();
  });

  it("defaults to 1 gem when no gemValue attribute", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);

    spawnGem(api, 50, 31);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(1);

    teardown();
  });

  it("emits item-collected event", () => {
    const { api } = createTestEnv();
    const teardown = baseGameMod.register(api);

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
    const teardown = baseGameMod.register(api);

    spawnGem(api, 200, 200);
    api.overlap.tick();

    expect(session.gameplaySession.gemsCollected).toBe(0);

    teardown();
  });
});

// ── Gems: velocity decay ──

describe("gem velocity decay", () => {
  it("decays scattered gem velocity and stops it", () => {
    const { api, em } = createTestEnv();
    const teardown = baseGameMod.register(api);

    const gem = spawnGem(api, 200, 200);
    gem.setVelocity(80, 80);

    for (let i = 0; i < 180; i++) {
      api.tick.firePost(1 / 60);
    }

    const entity = em.entities.find((e) => e.id === gem.id);
    expect(entity?.velocity).toBeNull();

    teardown();
  });

  it("moves gem position during decay", () => {
    const { api } = createTestEnv();
    const teardown = baseGameMod.register(api);

    const gem = spawnGem(api, 200, 200);
    gem.setVelocity(80, 0);

    api.tick.firePost(1 / 60);

    expect(gem.wx).toBeGreaterThan(200);

    teardown();
  });

  it("does not affect gems without velocity", () => {
    const { api } = createTestEnv();
    const teardown = baseGameMod.register(api);

    const gem = spawnGem(api, 200, 200);
    api.tick.firePost(1 / 60);

    expect(gem.wx).toBe(200);
    expect(gem.wy).toBe(200);

    teardown();
  });

  it("does not affect non-gem entities", () => {
    const { api } = createTestEnv();
    const teardown = baseGameMod.register(api);

    const chicken = api.entities.spawn("chicken", 200, 200);
    if (!chicken) throw new Error("Failed to spawn chicken");
    chicken.setVelocity(80, 80);

    api.tick.firePost(1 / 60);

    expect(chicken.vx).toBe(80);
    expect(chicken.vy).toBe(80);

    teardown();
  });
});

// ── Teardown ──

describe("teardown", () => {
  it("stops all behaviors when torn down", () => {
    const { api, session } = createTestEnv();
    const teardown = baseGameMod.register(api);
    teardown();

    // Baddie contact should not trigger
    api.entities.spawn("ghost-angry", 50, 31);
    api.overlap.tick();
    expect(session.gameplaySession.invincibilityTimer).toBe(0);

    // Invincibility decay should not tick
    session.gameplaySession.invincibilityTimer = 1.0;
    api.tick.firePost(0.5);
    expect(session.gameplaySession.invincibilityTimer).toBe(1.0);

    // Gem collection should not trigger
    spawnGem(api, 50, 31);
    api.overlap.tick();
    expect(session.gameplaySession.gemsCollected).toBe(0);
  });
});
