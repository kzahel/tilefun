import { describe, expect, it, vi } from "vitest";
import { CollisionFlag } from "../world/TileRegistry.js";
import { createChicken } from "./Chicken.js";
import { separateOverlappingEntities } from "./collision.js";
import type { Entity } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";
import { PropManager } from "./PropManager.js";

const dt = 1 / 60;
const mask = CollisionFlag.Solid | CollisionFlag.Water;
const noCollision = () => CollisionFlag.None;

function pair() {
  const manager = new EntityManager();
  const a = manager.spawn(createChicken(100, 100));
  const b = manager.spawn(createChicken(100, 100));
  return { manager, a, b };
}

describe("tick-aware entity separation", () => {
  it("does no collision work for a sleeping overlapping crowd", () => {
    const manager = new EntityManager();
    for (let i = 0; i < 200; i++) manager.spawn(createChicken(100, 100));
    const collision = vi.fn(noCollision);
    separateOverlappingEntities(manager.entities, new Set(), dt, collision, mask, new Map());
    expect(collision).not.toHaveBeenCalled();
    for (const entity of manager.entities) {
      expect(entity.position).toEqual({ wx: 100, wy: 100 });
    }
  });

  it("excludes sleeping neighbors even when they overlap an active NPC", () => {
    const { manager, a, b } = pair();
    const collision = vi.fn(noCollision);
    separateOverlappingEntities(
      manager.entities,
      new Set(),
      dt,
      collision,
      mask,
      new Map([[a, dt]]),
    );
    expect(collision).not.toHaveBeenCalled();
    expect(a.position).toEqual({ wx: 100, wy: 100 });
    expect(b.position).toEqual({ wx: 100, wy: 100 });
  });

  it("uses each participant's own elapsed time at a tier boundary", () => {
    const { manager, a, b } = pair();
    separateOverlappingEntities(
      manager.entities,
      new Set(),
      dt,
      noCollision,
      mask,
      new Map([
        [a, dt],
        [b, 4 * dt],
      ]),
    );
    expect(100 - a.position.wx).toBeCloseTo(20 * dt);
    expect(b.position.wx - 100).toBeCloseTo(20 * 4 * dt);
  });

  it("preserves full-rate behavior when all entities are selected", () => {
    const original = pair();
    const selected = pair();
    separateOverlappingEntities(original.manager.entities, new Set(), dt, noCollision, mask);
    separateOverlappingEntities(
      selected.manager.entities,
      new Set(),
      dt,
      noCollision,
      mask,
      new Map(selected.manager.entities.map((entity) => [entity, dt])),
    );
    expect(selected.a.position).toEqual(original.a.position);
    expect(selected.b.position).toEqual(original.b.position);
  });

  it("keeps wall and height constraints with accumulated time", () => {
    const { manager, a, b } = pair();
    const ticks = new Map([
      [a, dt * 4],
      [b, dt * 4],
    ]);
    separateOverlappingEntities(
      manager.entities,
      new Set(),
      dt,
      () => CollisionFlag.Solid,
      mask,
      ticks,
    );
    expect(a.position.wx).toBe(100);
    expect(b.position.wx).toBe(100);
    b.wz = 100;
    separateOverlappingEntities(manager.entities, new Set(), dt, noCollision, mask, ticks);
    expect(a.position.wx).toBe(100);
    expect(b.position.wx).toBe(100);
  });

  it("keeps player correction penetration-based and skips the player's mount", () => {
    const { manager, a, b } = pair();
    manager.remove(b.id);
    const player = manager.spawn(createPlayer(100, 100));
    const ticks = new Map([
      [a, dt * 4],
      [player, dt],
    ]);
    player.parentId = a.id;
    separateOverlappingEntities(manager.entities, new Set([player]), dt, noCollision, mask, ticks);
    expect(a.position).toEqual({ wx: 100, wy: 100 });
    delete player.parentId;
    separateOverlappingEntities(manager.entities, new Set([player]), dt, noCollision, mask, ticks);
    expect(a.position).not.toEqual({ wx: 100, wy: 100 });
    expect(player.position).toEqual({ wx: 100, wy: 100 });
  });

  it("passes tick selection through EntityManager and preserves pre-stepped exclusions", () => {
    const { manager, a, b } = pair();
    const props = new PropManager();
    manager.update(dt, noCollision, [], props, new Map());
    expect(a.position.wx).toBe(100);
    expect(b.position.wx).toBe(100);
    const ticks = new Map<Entity, number>([
      [a, dt],
      [b, dt],
    ]);
    manager.update(dt, noCollision, [], props, ticks, undefined, new Set([a.id]));
    expect(a.position.wx).toBe(100);
    expect(b.position.wx).toBe(100);
    manager.update(dt, noCollision, [], props, ticks);
    expect(a.position.wx).toBeLessThan(100);
    expect(b.position.wx).toBeGreaterThan(100);
  });
});
