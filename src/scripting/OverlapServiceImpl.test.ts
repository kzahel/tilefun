import { describe, expect, it, vi } from "vitest";
import { createCampfire } from "../entities/Campfire.js";
import type { Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createGhostAngry } from "../entities/Ghost.js";
import { OverlapServiceImpl } from "./OverlapServiceImpl.js";

/** Helper: create a minimal entity with position and collider for testing. */
function testEntity(wx: number, wy: number, width = 10, height = 8): Entity {
  return {
    id: 0,
    type: "test",
    position: { wx, wy },
    velocity: null,
    sprite: null,
    collider: { offsetX: 0, offsetY: 0, width, height },
    wanderAI: null,
    tags: new Set<string>(),
  };
}

describe("OverlapServiceImpl", () => {
  it("fires onOverlap when tagged entity overlaps another", () => {
    const em = new EntityManager();
    const fire = createCampfire(100, 100);
    em.spawn(fire);
    const ghost = createGhostAngry(105, 100); // within AABB overlap range
    em.spawn(ghost);

    const service = new OverlapServiceImpl(em);
    const cb = vi.fn();
    service.onOverlap("campfire", cb);

    service.tick();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]?.[0].type).toBe("campfire");
    expect(cb.mock.calls[0]?.[1].type).toBe("ghost-angry");
  });

  it("does not fire onOverlap when entities are far apart", () => {
    const em = new EntityManager();
    const fire = createCampfire(100, 100);
    em.spawn(fire);
    const ghost = createGhostAngry(200, 200);
    em.spawn(ghost);

    const service = new OverlapServiceImpl(em);
    const cb = vi.fn();
    service.onOverlap("campfire", cb);

    service.tick();

    expect(cb).not.toHaveBeenCalled();
  });

  it("fires only once for sustained overlap (enter only)", () => {
    const em = new EntityManager();
    const fire = createCampfire(100, 100);
    em.spawn(fire);
    const ghost = createGhostAngry(105, 100);
    em.spawn(ghost);

    const service = new OverlapServiceImpl(em);
    const cb = vi.fn();
    service.onOverlap("campfire", cb);

    service.tick();
    service.tick();
    service.tick();

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires onOverlapEnd when entities separate", () => {
    const em = new EntityManager();
    const a = testEntity(100, 100);
    a.tags = new Set(["test-tag"]);
    em.spawn(a);
    const b = testEntity(105, 100);
    em.spawn(b);

    const service = new OverlapServiceImpl(em);
    const enterCb = vi.fn();
    const exitCb = vi.fn();
    service.onOverlap("test-tag", enterCb);
    service.onOverlapEnd("test-tag", exitCb);

    // Tick 1: overlap begins
    service.tick();
    expect(enterCb).toHaveBeenCalledTimes(1);
    expect(exitCb).not.toHaveBeenCalled();

    // Move entities apart
    b.position.wx = 300;

    // Tick 2: overlap ends
    service.tick();
    expect(exitCb).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe removes the listener", () => {
    const em = new EntityManager();
    const a = testEntity(100, 100);
    a.tags = new Set(["test-tag"]);
    em.spawn(a);
    const b = testEntity(105, 100);
    em.spawn(b);

    const service = new OverlapServiceImpl(em);
    const cb = vi.fn();
    const unsub = service.onOverlap("test-tag", cb);

    unsub();
    service.tick();

    expect(cb).not.toHaveBeenCalled();
  });

  it("skips entities without colliders", () => {
    const em = new EntityManager();
    const a = testEntity(100, 100);
    a.tags = new Set(["test-tag"]);
    em.spawn(a);
    const b: Entity = {
      id: 0,
      type: "no-collider",
      position: { wx: 100, wy: 100 },
      velocity: null,
      sprite: null,
      collider: null,
      wanderAI: null,
    };
    em.spawn(b);

    const service = new OverlapServiceImpl(em);
    const cb = vi.fn();
    service.onOverlap("test-tag", cb);

    service.tick();

    expect(cb).not.toHaveBeenCalled();
  });

  it("handles errors in callbacks without crashing", () => {
    const em = new EntityManager();
    const a = testEntity(100, 100);
    a.tags = new Set(["test-tag"]);
    em.spawn(a);
    const b = testEntity(105, 100);
    em.spawn(b);

    const service = new OverlapServiceImpl(em);
    const errorCb = vi.fn(() => {
      throw new Error("test error");
    });
    const goodCb = vi.fn();
    service.onOverlap("test-tag", errorCb);
    service.onOverlap("test-tag", goodCb);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    service.tick();
    consoleSpy.mockRestore();

    expect(errorCb).toHaveBeenCalled();
    expect(goodCb).toHaveBeenCalled();
  });

  it("clear removes all state", () => {
    const em = new EntityManager();
    const a = testEntity(100, 100);
    a.tags = new Set(["test-tag"]);
    em.spawn(a);
    const b = testEntity(105, 100);
    em.spawn(b);

    const service = new OverlapServiceImpl(em);
    const cb = vi.fn();
    service.onOverlap("test-tag", cb);

    service.clear();
    service.tick();

    expect(cb).not.toHaveBeenCalled();
  });
});
