import type { Entity } from "./Entity.js";

export class EntityManager {
	readonly entities: Entity[] = [];
	private nextId = 1;

	/** Add an entity to the world. Assigns a unique id. */
	spawn(entity: Entity): Entity {
		entity.id = this.nextId++;
		this.entities.push(entity);
		return entity;
	}

	/** Update all entities: apply velocity, tick animation. */
	update(dt: number): void {
		for (const entity of this.entities) {
			// Apply velocity to position
			if (entity.velocity) {
				entity.position.wx += entity.velocity.vx * dt;
				entity.position.wy += entity.velocity.vy * dt;
			}

			// Tick sprite animation
			const sprite = entity.sprite;
			if (sprite) {
				if (sprite.moving) {
					sprite.animTimer += dt * 1000; // convert seconds to ms
					if (sprite.animTimer >= sprite.frameDuration) {
						sprite.animTimer -= sprite.frameDuration;
						sprite.frameCol = (sprite.frameCol + 1) % sprite.frameCount;
					}
				} else {
					// Reset to idle frame
					sprite.frameCol = 0;
					sprite.animTimer = 0;
				}
			}
		}
	}

	/** Return entities sorted by Y position for depth ordering. */
	getYSorted(): Entity[] {
		return [...this.entities].sort((a, b) => a.position.wy - b.position.wy);
	}
}
