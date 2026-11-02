import { describe, expect, it } from "vitest";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";

/** Narrow a nullable to non-null, failing the test if null. */

/** Helper: call update with required player + propManager params. */

describe("EntityManager", () => {
  describe("spawn", () => {
    it("assigns unique ids", () => {
      const em = new EntityManager();
      const a = em.spawn(createPlayer(0, 0));
      const b = em.spawn(createPlayer(0, 0));
      expect(a.id).toBeGreaterThan(0);
      expect(b.id).toBeGreaterThan(a.id);
    });

    it("adds entity to entities array", () => {
      const em = new EntityManager();
      em.spawn(createPlayer(0, 0));
      expect(em.entities).toHaveLength(1);
    });
  });

  describe("resolveParentedPositions", () => {
    it("derives child XY from parent position + local offsets", () => {
      const em = new EntityManager();
      const parent = em.spawn(createPlayer(100, 200));
      const child = em.spawn(createPlayer(0, 0));
      child.parentId = parent.id;
      child.localOffsetX = 5;
      child.localOffsetY = -3;

      em.resolveParentedPositions([]);

      expect(child.position.wx).toBe(105);
      expect(child.position.wy).toBe(197);
    });

    it("derives child wz from parent wz + child jumpZ", () => {
      const em = new EntityManager();
      const parent = em.spawn(createPlayer(100, 100));
      parent.wz = 16;
      const child = em.spawn(createPlayer(0, 0));
      child.parentId = parent.id;
      child.jumpZ = 10; // ride offset

      em.resolveParentedPositions([]);

      expect(child.wz).toBe(26); // parent.wz + child.jumpZ
    });

    it("derives child groundZ from parent groundZ", () => {
      const em = new EntityManager();
      const parent = em.spawn(createPlayer(100, 100));
      parent.groundZ = 8;
      const child = em.spawn(createPlayer(0, 0));
      child.parentId = parent.id;

      em.resolveParentedPositions([]);

      expect(child.groundZ).toBe(8);
    });

    it("child wz tracks parent wz changes", () => {
      const em = new EntityManager();
      const parent = em.spawn(createPlayer(100, 100));
      parent.wz = 0;
      const child = em.spawn(createPlayer(0, 0));
      child.parentId = parent.id;
      child.jumpZ = 10;

      em.resolveParentedPositions([]);
      expect(child.wz).toBe(10);

      // Parent walks onto elevated surface
      parent.wz = 8;
      em.resolveParentedPositions([]);
      expect(child.wz).toBe(18);
    });

    it("auto-detaches child when parent is removed", () => {
      const em = new EntityManager();
      const parent = em.spawn(createPlayer(100, 100));
      const child = em.spawn(createPlayer(50, 50));
      child.parentId = parent.id;

      em.remove(parent.id);
      em.resolveParentedPositions([]);

      expect(child.parentId).toBeUndefined();
      expect(child.localOffsetX).toBeUndefined();
      // Position unchanged (stays at last set value)
      expect(child.position.wx).toBe(50);
    });

    it("works with player entities passed separately", () => {
      const em = new EntityManager();
      const mount = em.spawn(createPlayer(200, 300));
      mount.wz = 12;
      const player = createPlayer(0, 0); // not in em.entities
      player.id = 999;
      player.parentId = mount.id;
      player.localOffsetX = 0;
      player.localOffsetY = 0;
      player.jumpZ = 10;

      em.resolveParentedPositions([player]);

      expect(player.position.wx).toBe(200);
      expect(player.position.wy).toBe(300);
      expect(player.wz).toBe(22);
    });

    it("uses zero offset when localOffset is undefined", () => {
      const em = new EntityManager();
      const parent = em.spawn(createPlayer(50, 75));
      const child = em.spawn(createPlayer(0, 0));
      child.parentId = parent.id;
      // localOffsetX/Y not set

      em.resolveParentedPositions([]);

      expect(child.position.wx).toBe(50);
      expect(child.position.wy).toBe(75);
    });
  });

  describe("getYSorted", () => {
    it("returns entities sorted by Y position", () => {
      const em = new EntityManager();
      const high = em.spawn(createPlayer(0, 100));
      const low = em.spawn(createPlayer(0, 10));
      const mid = em.spawn(createPlayer(0, 50));

      const sorted = em.getYSorted();
      expect(sorted[0]?.id).toBe(low.id);
      expect(sorted[1]?.id).toBe(mid.id);
      expect(sorted[2]?.id).toBe(high.id);
    });

    it("does not mutate original array", () => {
      const em = new EntityManager();
      em.spawn(createPlayer(0, 100));
      em.spawn(createPlayer(0, 10));
      const original0 = em.entities[0];
      em.getYSorted();
      expect(em.entities[0]).toBe(original0);
    });
  });
});

it("retains live service-owned parents outside the normal actor tick set", () => {
  const em = new EntityManager();
  const body = em.spawn(createPlayer(100, 200));
  const child = em.spawn(createPlayer(0, 0));
  child.parentId = body.id;
  child.localOffsetX = 3;
  child.localOffsetY = -4;
  em.resolveParentedPositions([child], [child]);
  expect(child.parentId).toBe(body.id);
  expect(child.position).toEqual({ wx: 103, wy: 196 });
  expect(body.position).toEqual({ wx: 100, wy: 200 });
  em.remove(body.id);
  em.resolveParentedPositions([child], [child]);
  expect(child.parentId).toBeUndefined();
});
