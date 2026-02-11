import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import {
	aabbOverlapsSolid,
	getEntityAABB,
	getSpeedMultiplier,
	resolveCollision,
} from "./collision.js";
import type { Entity } from "./Entity.js";
import { createPlayer } from "./Player.js";

function makeCollisionGrid(grid: Record<string, number>): (tx: number, ty: number) => number {
	return (tx, ty) => grid[`${tx},${ty}`] ?? CollisionFlag.None;
}

describe("getEntityAABB", () => {
	it("computes correct AABB from position and collider", () => {
		const aabb = getEntityAABB(
			{ wx: 100, wy: 200 },
			{ offsetX: 0, offsetY: 0, width: 10, height: 6 },
		);
		expect(aabb.left).toBe(95);
		expect(aabb.right).toBe(105);
		expect(aabb.top).toBe(194);
		expect(aabb.bottom).toBe(200);
	});

	it("handles offset collider", () => {
		const aabb = getEntityAABB(
			{ wx: 50, wy: 50 },
			{ offsetX: 4, offsetY: -2, width: 8, height: 4 },
		);
		expect(aabb.left).toBe(50);
		expect(aabb.right).toBe(58);
		expect(aabb.top).toBe(44);
		expect(aabb.bottom).toBe(48);
	});
});

describe("aabbOverlapsSolid", () => {
	it("returns false when all tiles are passable", () => {
		const check = makeCollisionGrid({});
		const result = aabbOverlapsSolid(
			{ left: 10, top: 10, right: 20, bottom: 20 },
			check,
			CollisionFlag.Solid | CollisionFlag.Water,
		);
		expect(result).toBe(false);
	});

	it("returns true when AABB overlaps a solid tile", () => {
		const check = makeCollisionGrid({ "1,1": CollisionFlag.Solid });
		const result = aabbOverlapsSolid(
			{ left: 20, top: 20, right: 28, bottom: 28 },
			check,
			CollisionFlag.Solid,
		);
		expect(result).toBe(true);
	});

	it("returns true when AABB overlaps a water tile with Water mask", () => {
		const check = makeCollisionGrid({ "0,0": CollisionFlag.Water });
		const result = aabbOverlapsSolid(
			{ left: 0, top: 0, right: 10, bottom: 10 },
			check,
			CollisionFlag.Water,
		);
		expect(result).toBe(true);
	});

	it("returns false for SlowWalk tile when mask is Solid|Water", () => {
		const check = makeCollisionGrid({ "0,0": CollisionFlag.SlowWalk });
		const result = aabbOverlapsSolid(
			{ left: 0, top: 0, right: 10, bottom: 10 },
			check,
			CollisionFlag.Solid | CollisionFlag.Water,
		);
		expect(result).toBe(false);
	});

	it("handles AABB spanning multiple tiles", () => {
		// AABB spans tiles (0,0) through (2,2) — only (2,1) is solid
		const check = makeCollisionGrid({ "2,1": CollisionFlag.Solid });
		const result = aabbOverlapsSolid(
			{ left: 0, top: 0, right: 40, bottom: 40 },
			check,
			CollisionFlag.Solid,
		);
		expect(result).toBe(true);
	});

	it("handles negative world coordinates", () => {
		// Tile at (-1, -1) = world coords (-16..-1, -16..-1)
		const check = makeCollisionGrid({ "-1,-1": CollisionFlag.Water });
		const result = aabbOverlapsSolid(
			{ left: -10, top: -10, right: -2, bottom: -2 },
			check,
			CollisionFlag.Water,
		);
		expect(result).toBe(true);
	});
});

describe("resolveCollision", () => {
	function makeEntity(wx: number, wy: number): Entity {
		const e = createPlayer(wx, wy);
		return e;
	}

	it("allows movement when no obstacles", () => {
		const entity = makeEntity(100, 100);
		const check = makeCollisionGrid({});
		const blocked = resolveCollision(
			entity,
			10,
			5,
			check,
			CollisionFlag.Solid | CollisionFlag.Water,
		);
		expect(blocked).toBe(false);
		expect(entity.position.wx).toBe(110);
		expect(entity.position.wy).toBe(105);
	});

	it("blocks X movement and allows Y when X is blocked", () => {
		const entity = makeEntity(100, 100);
		// Place water wall to the right: tile at tx=7 (wx=112..127)
		const check = makeCollisionGrid({ "7,6": CollisionFlag.Water });
		const blocked = resolveCollision(
			entity,
			20,
			-5,
			check,
			CollisionFlag.Solid | CollisionFlag.Water,
		);
		expect(blocked).toBe(true);
		expect(entity.position.wx).toBe(100); // X blocked
		expect(entity.position.wy).toBe(95); // Y allowed
	});

	it("blocks Y movement and allows X when Y is blocked", () => {
		const entity = makeEntity(100, 100);
		// Place water below: tile at ty=7 (wy=112..127)
		const check = makeCollisionGrid({ "6,7": CollisionFlag.Water });
		const blocked = resolveCollision(
			entity,
			5,
			20,
			check,
			CollisionFlag.Solid | CollisionFlag.Water,
		);
		expect(blocked).toBe(true);
		expect(entity.position.wx).toBe(105); // X allowed
		expect(entity.position.wy).toBe(100); // Y blocked
	});

	it("blocks both axes when surrounded", () => {
		const entity = makeEntity(16, 16);
		// Surround with water
		const grid: Record<string, number> = {};
		for (let ty = -1; ty <= 3; ty++) {
			for (let tx = -1; tx <= 3; tx++) {
				if (tx === 1 && ty === 0) continue; // leave current tile clear
				grid[`${tx},${ty}`] = CollisionFlag.Water;
			}
		}
		const check = makeCollisionGrid(grid);
		const blocked = resolveCollision(
			entity,
			20,
			20,
			check,
			CollisionFlag.Solid | CollisionFlag.Water,
		);
		expect(blocked).toBe(true);
	});

	it("passes through when entity has no collider", () => {
		const entity = makeEntity(100, 100);
		entity.collider = null;
		const check = makeCollisionGrid({ "7,6": CollisionFlag.Solid });
		const blocked = resolveCollision(entity, 20, 0, check, CollisionFlag.Solid);
		expect(blocked).toBe(false);
		expect(entity.position.wx).toBe(120);
	});
});

describe("getSpeedMultiplier", () => {
	it("returns 1.0 on normal ground", () => {
		const check = makeCollisionGrid({});
		expect(getSpeedMultiplier({ wx: 50, wy: 50 }, check)).toBe(1.0);
	});

	it("returns 0.5 on SlowWalk tiles", () => {
		const check = makeCollisionGrid({ "3,3": CollisionFlag.SlowWalk });
		expect(getSpeedMultiplier({ wx: 3 * TILE_SIZE + 1, wy: 3 * TILE_SIZE + 1 }, check)).toBe(0.5);
	});
});
