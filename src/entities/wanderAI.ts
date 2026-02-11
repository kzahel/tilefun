import { Direction, type Entity } from "./Entity.js";

/**
 * Update wander AI for an entity. Transitions between idle and walking.
 * Uses a random callback for testability.
 */
export function updateWanderAI(entity: Entity, dt: number, random: () => number): void {
	const ai = entity.wanderAI;
	const vel = entity.velocity;
	if (!ai || !vel) return;

	ai.timer -= dt;

	if (ai.timer <= 0) {
		if (ai.state === "idle") {
			ai.state = "walking";
			ai.timer = ai.walkMin + random() * (ai.walkMax - ai.walkMin);
			const angle = random() * Math.PI * 2;
			ai.dirX = Math.cos(angle);
			ai.dirY = Math.sin(angle);
		} else {
			ai.state = "idle";
			ai.timer = ai.idleMin + random() * (ai.idleMax - ai.idleMin);
			ai.dirX = 0;
			ai.dirY = 0;
		}
	}

	const { sprite } = entity;

	if (ai.state === "walking") {
		vel.vx = ai.dirX * ai.speed;
		vel.vy = ai.dirY * ai.speed;
		if (sprite) {
			sprite.moving = true;
			if (Math.abs(ai.dirX) >= Math.abs(ai.dirY)) {
				sprite.direction = ai.dirX > 0 ? Direction.Right : Direction.Left;
			} else {
				sprite.direction = ai.dirY > 0 ? Direction.Down : Direction.Up;
			}
			// Chicken sprite: row 0 = down/left, row 1 = up/right
			sprite.frameRow =
				sprite.direction === Direction.Up || sprite.direction === Direction.Right ? 1 : 0;
		}
	} else {
		vel.vx = 0;
		vel.vy = 0;
		if (sprite) {
			sprite.moving = false;
		}
	}
}

/** Reverse direction when collision blocks movement. */
export function onWanderBlocked(entity: Entity): void {
	const ai = entity.wanderAI;
	if (!ai) return;
	ai.dirX = -ai.dirX;
	ai.dirY = -ai.dirY;
}
