import { PLAYER_FRAME_DURATION, PLAYER_SPEED } from "../config/constants.js";
import type { Movement } from "../input/InputManager.js";
import { Direction, type Entity } from "./Entity.js";

const FRAME_COUNT = 4;

/** Create a player entity at the given world position. */
export function createPlayer(wx: number, wy: number): Entity {
	return {
		id: 0,
		type: "player",
		position: { wx, wy },
		velocity: { vx: 0, vy: 0 },
		sprite: {
			sheetKey: "player",
			frameCol: 0,
			frameRow: Direction.Down,
			animTimer: 0,
			frameDuration: PLAYER_FRAME_DURATION,
			frameCount: FRAME_COUNT,
			direction: Direction.Down,
			moving: false,
		},
		collider: null,
	};
}

/** Update player velocity and sprite state from input movement. */
export function updatePlayerFromInput(entity: Entity, movement: Movement, _dt: number): void {
	const { velocity, sprite } = entity;
	if (!velocity || !sprite) return;

	const moving = movement.dx !== 0 || movement.dy !== 0;
	velocity.vx = movement.dx * PLAYER_SPEED;
	velocity.vy = movement.dy * PLAYER_SPEED;

	sprite.moving = moving;

	if (moving) {
		// Determine facing direction from input
		// Prefer horizontal direction when moving diagonally
		if (Math.abs(movement.dx) >= Math.abs(movement.dy)) {
			sprite.direction = movement.dx > 0 ? Direction.Right : Direction.Left;
		} else {
			sprite.direction = movement.dy > 0 ? Direction.Down : Direction.Up;
		}
		sprite.frameRow = sprite.direction;
	}
}
