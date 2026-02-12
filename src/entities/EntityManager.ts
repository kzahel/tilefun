import { CollisionFlag } from "../world/TileRegistry.js";
import { getSpeedMultiplier, resolveCollision } from "./collision.js";
import type { Entity } from "./Entity.js";
import { onWanderBlocked } from "./wanderAI.js";

export class EntityManager {
  readonly entities: Entity[] = [];
  private nextId = 1;

  getNextId(): number {
    return this.nextId;
  }

  setNextId(n: number): void {
    this.nextId = n;
  }

  /** Add an entity to the world. Assigns a unique id. */
  spawn(entity: Entity): Entity {
    entity.id = this.nextId++;
    this.entities.push(entity);
    return entity;
  }

  /** Update all entities: apply velocity with collision, tick animation. */
  update(dt: number, getCollision?: (tx: number, ty: number) => number): void {
    const blockMask = CollisionFlag.Solid | CollisionFlag.Water;

    for (const entity of this.entities) {
      // Apply velocity to position
      if (entity.velocity) {
        const speedMult =
          entity.collider && getCollision ? getSpeedMultiplier(entity.position, getCollision) : 1.0;
        const dx = entity.velocity.vx * dt * speedMult;
        const dy = entity.velocity.vy * dt * speedMult;

        if (entity.collider && getCollision) {
          const blocked = resolveCollision(entity, dx, dy, getCollision, blockMask);
          if (blocked && entity.wanderAI) {
            onWanderBlocked(entity);
          }
        } else {
          entity.position.wx += dx;
          entity.position.wy += dy;
        }
      }

      // Tick sprite animation
      const sprite = entity.sprite;
      if (sprite) {
        if (sprite.moving) {
          sprite.animTimer += dt * 1000;
          if (sprite.animTimer >= sprite.frameDuration) {
            sprite.animTimer -= sprite.frameDuration;
            sprite.frameCol = (sprite.frameCol + 1) % sprite.frameCount;
          }
        } else {
          sprite.frameCol = 0;
          sprite.animTimer = 0;
        }
      }
    }
  }

  /** Remove an entity by id. Returns true if found and removed. */
  remove(id: number): boolean {
    const idx = this.entities.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    this.entities.splice(idx, 1);
    return true;
  }

  /** Return entities sorted by Y position for depth ordering. */
  getYSorted(): Entity[] {
    return [...this.entities].sort((a, b) => a.position.wy - b.position.wy);
  }
}
