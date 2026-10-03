import type { Entity } from "./Entity.js";

/** Shared gameplay animation clock; idle returns to the first pose. */
export function tickSpriteAnimation(entity: Entity, dt: number): void {
  const sprite = entity.sprite;
  if (!sprite || sprite.frameCount <= 1) return;
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
