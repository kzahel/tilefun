import { describe, expect, it } from "vitest";
import { PLAYER_SPEED, PLAYER_SPRITE_SIZE } from "../config/constants.js";
import { Direction } from "./Entity.js";
import { createPlayer, updatePlayerFromInput } from "./Player.js";

describe("createPlayer", () => {
	it("creates entity at given position", () => {
		const p = createPlayer(100, 200);
		expect(p.position.wx).toBe(100);
		expect(p.position.wy).toBe(200);
		expect(p.type).toBe("player");
	});

	it("starts facing down and idle", () => {
		const p = createPlayer(0, 0);
		expect(p.sprite?.direction).toBe(Direction.Down);
		expect(p.sprite?.moving).toBe(false);
		expect(p.sprite?.frameCol).toBe(0);
	});

	it("has a collider for feet area", () => {
		const p = createPlayer(0, 0);
		expect(p.collider).not.toBeNull();
		expect(p.collider?.width).toBeGreaterThan(0);
		expect(p.collider?.height).toBeGreaterThan(0);
	});

	it("has correct sprite dimensions", () => {
		const p = createPlayer(0, 0);
		expect(p.sprite?.spriteWidth).toBe(PLAYER_SPRITE_SIZE);
		expect(p.sprite?.spriteHeight).toBe(PLAYER_SPRITE_SIZE);
	});

	it("has no wanderAI", () => {
		const p = createPlayer(0, 0);
		expect(p.wanderAI).toBeNull();
	});
});

describe("updatePlayerFromInput", () => {
	it("sets velocity from movement input", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: 1, dy: 0 }, 1 / 60);
		expect(p.velocity?.vx).toBe(PLAYER_SPEED);
		expect(p.velocity?.vy).toBe(0);
	});

	it("marks sprite as moving when input is non-zero", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: 0, dy: -1 }, 1 / 60);
		expect(p.sprite?.moving).toBe(true);
	});

	it("marks sprite as not moving when input is zero", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: 1, dy: 0 }, 1 / 60);
		updatePlayerFromInput(p, { dx: 0, dy: 0 }, 1 / 60);
		expect(p.sprite?.moving).toBe(false);
		expect(p.velocity?.vx).toBe(0);
	});

	it("faces right when moving right", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: 1, dy: 0 }, 1 / 60);
		expect(p.sprite?.direction).toBe(Direction.Right);
		expect(p.sprite?.frameRow).toBe(Direction.Right);
	});

	it("faces left when moving left", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: -1, dy: 0 }, 1 / 60);
		expect(p.sprite?.direction).toBe(Direction.Left);
	});

	it("faces up when moving up", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: 0, dy: -1 }, 1 / 60);
		expect(p.sprite?.direction).toBe(Direction.Up);
	});

	it("faces down when moving down", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: 0, dy: 1 }, 1 / 60);
		expect(p.sprite?.direction).toBe(Direction.Down);
	});

	it("prefers horizontal direction on diagonal input", () => {
		const p = createPlayer(0, 0);
		const diag = 1 / Math.sqrt(2);
		updatePlayerFromInput(p, { dx: diag, dy: diag }, 1 / 60);
		expect(p.sprite?.direction).toBe(Direction.Right);
	});

	it("uses vertical direction when vertical component is dominant", () => {
		const p = createPlayer(0, 0);
		updatePlayerFromInput(p, { dx: 0.3, dy: -0.9 }, 1 / 60);
		expect(p.sprite?.direction).toBe(Direction.Up);
	});
});
