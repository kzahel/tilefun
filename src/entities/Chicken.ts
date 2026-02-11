import { CHICKEN_SPRITE_SIZE } from "../config/constants.js";
import { Direction, type Entity } from "./Entity.js";

const CHICKEN_SPEED = 20;
const CHICKEN_FRAME_DURATION = 200;
const CHICKEN_FRAME_COUNT = 4;

/** Create a chicken NPC at the given world position. */
export function createChicken(wx: number, wy: number): Entity {
	return {
		id: 0,
		type: "chicken",
		position: { wx, wy },
		velocity: { vx: 0, vy: 0 },
		sprite: {
			sheetKey: "chicken",
			frameCol: 0,
			frameRow: 0,
			animTimer: 0,
			frameDuration: CHICKEN_FRAME_DURATION,
			frameCount: CHICKEN_FRAME_COUNT,
			direction: Direction.Down,
			moving: false,
			spriteWidth: CHICKEN_SPRITE_SIZE,
			spriteHeight: CHICKEN_SPRITE_SIZE,
		},
		collider: {
			offsetX: 0,
			offsetY: 0,
			width: 10,
			height: 6,
		},
		wanderAI: {
			state: "idle",
			timer: 2.0,
			dirX: 0,
			dirY: 0,
			idleMin: 1.0,
			idleMax: 4.0,
			walkMin: 1.0,
			walkMax: 3.0,
			speed: CHICKEN_SPEED,
		},
	};
}
