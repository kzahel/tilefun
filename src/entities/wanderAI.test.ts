import { describe, expect, it } from "vitest";
import { createChicken } from "./Chicken.js";
import { Direction } from "./Entity.js";
import { createPlayer } from "./Player.js";
import { onWanderBlocked, updateWanderAI } from "./wanderAI.js";

/** Deterministic "random" that returns fixed values in sequence. */
function makeRandom(values: number[]): () => number {
	let i = 0;
	return () => values[i++ % values.length] ?? 0;
}

describe("updateWanderAI", () => {
	it("starts in idle state with zero velocity", () => {
		const c = createChicken(0, 0);
		updateWanderAI(c, 0.1, Math.random);
		// Still idle, timer was 2.0 so 0.1 won't expire it
		expect(c.wanderAI?.state).toBe("idle");
		expect(c.velocity?.vx).toBe(0);
		expect(c.velocity?.vy).toBe(0);
	});

	it("transitions to walking after idle timer expires", () => {
		const c = createChicken(0, 0);
		// random(0.5) for walk duration, random(0.25) for angle
		const rng = makeRandom([0.5, 0.25]);
		// Expire the initial 2s idle timer
		updateWanderAI(c, 2.1, rng);
		expect(c.wanderAI?.state).toBe("walking");
	});

	it("transitions to idle after walk timer expires", () => {
		const c = createChicken(0, 0);
		const rng = makeRandom([0.5, 0.25, 0.5, 0.25]);
		// Expire idle (2s)
		updateWanderAI(c, 2.1, rng);
		expect(c.wanderAI?.state).toBe("walking");
		// Expire walk timer (walkMin + 0.5 * (walkMax - walkMin) = 1 + 0.5*2 = 2s)
		updateWanderAI(c, 2.5, rng);
		expect(c.wanderAI?.state).toBe("idle");
	});

	it("sets velocity during walking state", () => {
		const c = createChicken(0, 0);
		const rng = makeRandom([0.5, 0.0]); // angle = 0 → dirX=1, dirY=0
		updateWanderAI(c, 2.1, rng);
		expect(c.velocity?.vx).not.toBe(0);
		expect(c.wanderAI?.state).toBe("walking");
	});

	it("clears velocity during idle state", () => {
		const c = createChicken(0, 0);
		updateWanderAI(c, 0.5, Math.random);
		expect(c.velocity?.vx).toBe(0);
		expect(c.velocity?.vy).toBe(0);
	});

	it("updates sprite moving flag", () => {
		const c = createChicken(0, 0);
		const rng = makeRandom([0.5, 0.25]);
		// Idle → moving should be false
		updateWanderAI(c, 0.5, rng);
		expect(c.sprite?.moving).toBe(false);
		// Expire idle → walking
		updateWanderAI(c, 2.0, rng);
		expect(c.sprite?.moving).toBe(true);
	});

	it("sets sprite direction based on walk direction", () => {
		const c = createChicken(0, 0);
		// angle = 0 → cos(0)=1, sin(0)=0 → dirX=1 → Right
		const rng = makeRandom([0.5, 0.0]);
		updateWanderAI(c, 2.1, rng);
		expect(c.sprite?.direction).toBe(Direction.Right);
	});

	it("does nothing if entity has no wanderAI component", () => {
		const p = createPlayer(0, 0);
		expect(p.wanderAI).toBeNull();
		// Should not throw
		updateWanderAI(p, 1.0, Math.random);
		expect(p.velocity?.vx).toBe(0);
	});
});

describe("onWanderBlocked", () => {
	it("reverses direction", () => {
		const c = createChicken(0, 0);
		const rng = makeRandom([0.5, 0.0]);
		updateWanderAI(c, 2.1, rng);
		const oldDirX = c.wanderAI?.dirX ?? 0;
		const oldDirY = c.wanderAI?.dirY ?? 0;
		onWanderBlocked(c);
		expect(c.wanderAI?.dirX).toBe(-oldDirX);
		expect(c.wanderAI?.dirY).toBe(-oldDirY);
	});

	it("does nothing if entity has no wanderAI", () => {
		const p = createPlayer(0, 0);
		// Should not throw
		onWanderBlocked(p);
	});
});
