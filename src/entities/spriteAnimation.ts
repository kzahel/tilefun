import type { Entity } from "./Entity.js";
import { ENTITY_DEFS } from "./EntityDefs.js";

/** Change clips atomically; repeated decisions preserve the local animation phase. */
export function setSpriteClip(entity: Entity, clip: number | undefined): void {
  const sprite = entity.sprite;
  if (!sprite || sprite.clip === clip) return;
  if (clip === undefined) delete sprite.clip;
  else sprite.clip = clip;
  delete sprite.clipElapsedMs;
  sprite.animTimer = 0;
  sprite.frameCol = ENTITY_DEFS[entity.type]?.sprite?.clips?.[clip ?? 0]?.start ?? 0;
}

/** Common server/client clock. Named stationary clips play without moving the actor. */
export function tickSpriteAnimation(entity: Entity, dt: number): void {
  const sprite = entity.sprite;
  if (!sprite) return;
  const clip =
    sprite.clip === undefined ? undefined : ENTITY_DEFS[entity.type]?.sprite?.clips?.[sprite.clip];
  if (clip) {
    if (sprite.clipElapsedMs !== undefined) {
      setSpriteClipElapsed(entity, sprite.clipElapsedMs + dt * 1000);
      return;
    }
    if (sprite.frameCol < clip.start || sprite.frameCol >= clip.start + clip.count)
      sprite.frameCol = clip.start;
    sprite.animTimer += dt * 1000;
    const frames = Math.floor(sprite.animTimer / clip.frameDuration);
    sprite.animTimer %= clip.frameDuration;
    const next = sprite.frameCol - clip.start + frames;
    sprite.frameCol = clip.start + (clip.loop ? next % clip.count : Math.min(next, clip.count - 1));
    return;
  }
  if (sprite.frameCount <= 1) return;
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

/** Restore/synchronize a timed clip from an authority phase, including mid-hop baselines. */
export function setSpriteClipElapsed(entity: Entity, elapsedMs: number | undefined): void {
  const sprite = entity.sprite;
  if (!sprite) return;
  if (elapsedMs === undefined) {
    delete sprite.clipElapsedMs;
    return;
  }
  const clip = ENTITY_DEFS[entity.type]?.sprite?.clips?.[sprite.clip ?? 0];
  if (!clip) return;
  sprite.clipElapsedMs = elapsedMs;
  const next = Math.floor(elapsedMs / clip.frameDuration);
  sprite.frameCol = clip.start + (clip.loop ? next % clip.count : Math.min(next, clip.count - 1));
  sprite.animTimer = elapsedMs % clip.frameDuration;
}
