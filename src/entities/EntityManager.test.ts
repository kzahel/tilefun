import { describe, expect, it } from "vitest";
import { PLAYER_FRAME_DURATION } from "../config/constants.js";
import { EntityManager } from "./EntityManager.js";
import { createPlayer } from "./Player.js";

/** Narrow a nullable to non-null, failing the test if null. */
function assertDefined<T>(val: T | null | undefined): asserts val is T {
	expect(val).not.toBeNull();
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
			em.update(1); // 1 second
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
			em.update(dt);
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
			em.update(1 / 60);
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
			em.update(dt);
			expect(spr.frameCol).toBe(0);
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
