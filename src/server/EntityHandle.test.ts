import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { EntityHandle, PlayerHandle } from "./EntityHandle.js";
import type { GameplaySession } from "./GameplaySimulation.js";

function createTestEntity(overrides?: Partial<Entity>): Entity {
  return {
    id: 0,
    type: "chicken",
    position: { wx: 100, wy: 200 },
    velocity: { vx: 10, vy: 20 },
    sprite: null,
    collider: null,
    wanderAI: {
      state: "idle",
      timer: 2,
      dirX: 0,
      dirY: 0,
      idleMin: 1,
      idleMax: 4,
      walkMin: 1,
      walkMax: 3,
      speed: 20,
      directional: false,
      befriendable: true,
    },
    ...overrides,
  };
}

function spawnAndWrap(
  em: EntityManager,
  overrides?: Partial<Entity>,
): { entity: Entity; handle: EntityHandle } {
  const entity = em.spawn(createTestEntity(overrides));
  return { entity, handle: new EntityHandle(entity, em) };
}

describe("EntityHandle", () => {
  it("reads id, type, position from underlying entity", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    expect(handle.id).toBe(entity.id);
    expect(handle.type).toBe("chicken");
    expect(handle.wx).toBe(100);
    expect(handle.wy).toBe(200);
  });

  it("setPosition updates underlying entity", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    handle.setPosition(300, 400);
    expect(entity.position.wx).toBe(300);
    expect(entity.position.wy).toBe(400);
  });

  it("setPosition is no-op after remove", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    handle.remove();
    handle.setPosition(999, 999);
    expect(entity.position.wx).toBe(100);
    expect(entity.position.wy).toBe(200);
  });

  it("vx/vy return 0 when entity has no velocity", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em, { velocity: null });
    expect(handle.vx).toBe(0);
    expect(handle.vy).toBe(0);
  });

  it("setVelocity creates velocity component if missing", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em, { velocity: null });
    handle.setVelocity(50, 60);
    expect(entity.velocity).toEqual({ vx: 50, vy: 60 });
  });

  it("setVelocity updates existing velocity", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    handle.setVelocity(50, 60);
    expect(entity.velocity).toEqual({ vx: 50, vy: 60 });
  });

  it("tx/ty derive from position and TILE_SIZE (16)", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em, { position: { wx: 33, wy: 49 } });
    expect(handle.tx).toBe(2); // floor(33/16)
    expect(handle.ty).toBe(3); // floor(49/16)
  });

  it("distanceTo computes Euclidean distance", () => {
    const em = new EntityManager();
    const { handle: h1 } = spawnAndWrap(em, { position: { wx: 0, wy: 0 } });
    const { handle: h2 } = spawnAndWrap(em, { position: { wx: 3, wy: 4 } });
    expect(h1.distanceTo(h2)).toBe(5);
  });

  it("addTag creates tags set lazily", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    expect(entity.tags).toBeUndefined();
    handle.addTag("friendly");
    expect(entity.tags).toBeInstanceOf(Set);
    expect(entity.tags?.has("friendly")).toBe(true);
  });

  it("addTag/removeTag/hasTag roundtrip", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    expect(handle.hasTag("x")).toBe(false);
    handle.addTag("x");
    expect(handle.hasTag("x")).toBe(true);
    handle.removeTag("x");
    expect(handle.hasTag("x")).toBe(false);
  });

  it("tags getter returns empty set when no tags", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    expect(handle.tags.size).toBe(0);
  });

  it("setAttribute creates attributes map lazily", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    expect(entity.attributes).toBeUndefined();
    handle.setAttribute("gemValue", 5);
    expect(entity.attributes).toBeInstanceOf(Map);
    expect(entity.attributes?.get("gemValue")).toBe(5);
  });

  it("setAttribute(key, null) deletes attribute", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    handle.setAttribute("x", 1);
    expect(handle.getAttribute("x")).toBe(1);
    handle.setAttribute("x", null);
    expect(handle.getAttribute("x")).toBeUndefined();
  });

  it("getAttribute returns undefined for missing key", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    expect(handle.getAttribute("nope")).toBeUndefined();
  });

  it("getAttributes returns snapshot of all attributes", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    handle.setAttribute("a", 1);
    handle.setAttribute("b", "hello");
    expect(handle.getAttributes()).toEqual({ a: 1, b: "hello" });
  });

  it("aiState returns null when no wanderAI", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em, { wanderAI: null });
    expect(handle.aiState).toBeNull();
  });

  it("aiState reads from wanderAI.state", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    expect(handle.aiState).toBe("idle");
  });

  it("setAIState updates wanderAI.state", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    handle.setAIState("walking");
    expect(entity.wanderAI?.state).toBe("walking");
  });

  it("setFollowing toggles wanderAI.following", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    handle.setFollowing(true);
    expect(entity.wanderAI?.following).toBe(true);
    handle.setFollowing(false);
    expect(entity.wanderAI?.following).toBe(false);
  });

  it("isFollowing returns false by default", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    expect(handle.isFollowing).toBe(false);
  });

  it("remove calls entityManager.remove", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    expect(em.entities).toContain(entity);
    handle.remove();
    expect(em.entities).not.toContain(entity);
  });

  it("alive returns false after remove", () => {
    const em = new EntityManager();
    const { handle } = spawnAndWrap(em);
    expect(handle.alive).toBe(true);
    handle.remove();
    expect(handle.alive).toBe(false);
  });

  it("setFlashing sets flashHidden on entity", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    handle.setFlashing(true);
    expect(entity.flashHidden).toBe(true);
    handle.setFlashing(false);
    expect(entity.flashHidden).toBe(false);
  });

  it("setDeathTimer sets deathTimer on entity", () => {
    const em = new EntityManager();
    const { entity, handle } = spawnAndWrap(em);
    handle.setDeathTimer(0.5);
    expect(entity.deathTimer).toBe(0.5);
  });
});

describe("PlayerHandle", () => {
  function createPlayerHandle() {
    const em = new EntityManager();
    const entity = em.spawn(createTestEntity({ type: "player" }));
    const session: GameplaySession = {
      player: entity,
      gemsCollected: 10,
      invincibilityTimer: 0,
      knockbackVx: 0,
      knockbackVy: 0,
    };
    const handle = new PlayerHandle(entity, em, session);
    return { entity, em, session, handle };
  }

  it("gemsCollected reads from session", () => {
    const { handle } = createPlayerHandle();
    expect(handle.gemsCollected).toBe(10);
  });

  it("giveGems adds to session gems", () => {
    const { handle, session } = createPlayerHandle();
    handle.giveGems(5);
    expect(session.gemsCollected).toBe(15);
  });

  it("loseGems subtracts and returns actual lost, caps at 0", () => {
    const { handle, session } = createPlayerHandle();
    const lost = handle.loseGems(3);
    expect(lost).toBe(3);
    expect(session.gemsCollected).toBe(7);

    const lost2 = handle.loseGems(100);
    expect(lost2).toBe(7);
    expect(session.gemsCollected).toBe(0);
  });

  it("isInvincible reflects session timer > 0", () => {
    const { handle, session } = createPlayerHandle();
    expect(handle.isInvincible).toBe(false);
    session.invincibilityTimer = 1.5;
    expect(handle.isInvincible).toBe(true);
  });

  it("setInvincible sets session timer", () => {
    const { handle, session } = createPlayerHandle();
    handle.setInvincible(2.0);
    expect(session.invincibilityTimer).toBe(2.0);
  });

  it("knockback sets knockback velocity away from source", () => {
    const { handle, session, entity } = createPlayerHandle();
    entity.position.wx = 100;
    entity.position.wy = 100;
    handle.knockback(100, 90, 200); // source is directly below → knockback should be up (negative wy)
    expect(session.knockbackVx).toBe(0);
    expect(session.knockbackVy).toBe(200); // player is above source: (100-100, 100-90) = (0, 10) → normalized (0, 1) * 200
  });

  it("mutations are no-op after remove", () => {
    const { handle, session } = createPlayerHandle();
    handle.remove();
    handle.giveGems(100);
    expect(session.gemsCollected).toBe(10); // unchanged
    expect(handle.loseGems(5)).toBe(0);
  });
});
