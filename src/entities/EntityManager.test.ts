import { describe, expect, it } from "vitest";
import { PLAYER_FRAME_DURATION } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { createChicken } from "./Chicken.js";
import type { Entity } from "./Entity.js";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";
import { PropManager } from "./PropManager.js";

/** Narrow a nullable to non-null, failing the test if null. */
function assertDefined<T>(val: T | null | undefined): asserts val is T {
  expect(val).not.toBeNull();
}

const noCollision = () => CollisionFlag.None;
const emptyProps = new PropManager();

/** Helper: call update with required player + propManager params. */
function updateWith(
  em: EntityManager,
  dt: number,
  getCollision: (tx: number, ty: number) => number,
  player: Entity,
  propManager?: PropManager,
): void {
  em.update(dt, getCollision, player, propManager ?? emptyProps);
}

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

  describe("update", () => {
    it("applies velocity to position", () => {
      const em = new EntityManager();
      const p = em.spawn(createPlayer(0, 0));
      const vel = p.velocity;
      assertDefined(vel);
      vel.vx = 60;
      vel.vy = 30;
      updateWith(em, 1, noCollision, p); // 1 second
      expect(p.position.wx).toBe(60);
      expect(p.position.wy).toBe(30);
    });

    it("advances walk animation when moving", () => {
      const em = new EntityManager();
      const p = em.spawn(createPlayer(0, 0));
      const spr = p.sprite;
      assertDefined(spr);
      spr.moving = true;

      // Advance past one frame duration
      const dt = (PLAYER_FRAME_DURATION + 1) / 1000;
      updateWith(em, dt, noCollision, p);
      expect(spr.frameCol).toBe(1);
    });

    it("resets to idle frame when not moving", () => {
      const em = new EntityManager();
      const p = em.spawn(createPlayer(0, 0));
      const spr = p.sprite;
      assertDefined(spr);
      spr.moving = true;
      spr.frameCol = 2;
      spr.animTimer = 50;

      // Stop moving
      spr.moving = false;
      updateWith(em, 1 / 60, noCollision, p);
      expect(spr.frameCol).toBe(0);
      expect(spr.animTimer).toBe(0);
    });

    it("wraps animation frame at end of cycle", () => {
      const em = new EntityManager();
      const p = em.spawn(createPlayer(0, 0));
      const spr = p.sprite;
      assertDefined(spr);
      spr.moving = true;
      spr.frameCol = 3; // last frame
      spr.animTimer = PLAYER_FRAME_DURATION - 1;

      const dt = 2 / 1000; // 2ms, enough to wrap
      updateWith(em, dt, noCollision, p);
      expect(spr.frameCol).toBe(0);
    });
  });

  describe("collision integration", () => {
    it("blocks movement into water tiles", () => {
      const em = new EntityManager();
      const p = em.spawn(createPlayer(100, 100));
      const vel = p.velocity;
      assertDefined(vel);
      vel.vx = 10;
      vel.vy = 0;
      // Water wall at tile (7, 5) — player AABB is ~16px above feet
      const getCollision = (tx: number, ty: number) =>
        tx === 7 && ty === 5 ? CollisionFlag.Water : CollisionFlag.None;
      updateWith(em, 1, getCollision, p);
      // X should be blocked (stayed at 100)
      expect(p.position.wx).toBe(100);
    });

    it("applies SlowWalk speed reduction", () => {
      const em = new EntityManager();
      const p = em.spawn(createPlayer(50, 50));
      const vel = p.velocity;
      assertDefined(vel);
      vel.vx = 100;
      vel.vy = 0;
      // Current tile (3, 3) has SlowWalk
      const getCollision = (tx: number, ty: number) =>
        tx === 3 && ty === 3 ? CollisionFlag.SlowWalk : CollisionFlag.None;
      updateWith(em, 1, getCollision, p);
      // Should move at half speed: 100 * 0.5 = 50
      expect(p.position.wx).toBeCloseTo(100, 0);
    });

    it("reverses chicken direction on collision", () => {
      const em = new EntityManager();
      const player = em.spawn(createPlayer(0, 0)); // far away, won't interfere
      const c = em.spawn(createChicken(100, 100));
      assertDefined(c.wanderAI);
      assertDefined(c.velocity);
      c.wanderAI.state = "walking";
      c.wanderAI.dirX = 1;
      c.wanderAI.dirY = 0;
      c.velocity.vx = 20;
      c.velocity.vy = 0;
      // Wall ahead
      const getCollision = (tx: number, ty: number) =>
        tx === 7 && ty === 5 ? CollisionFlag.Water : CollisionFlag.None;
      updateWith(em, 1, getCollision, player);
      // Direction should be reversed
      expect(c.wanderAI.dirX).toBe(-1);
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
