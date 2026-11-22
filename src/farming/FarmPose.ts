import type { Entity } from "../entities/Entity.js";
import { setSpriteClip } from "../entities/spriteAnimation.js";
import { EGG_POSE, FARM_EGG, GARDEN_BED, WOODLOT_TREE } from "./FarmActors.js";

export function restoreFarmPose(entity: Entity, now = Date.now()): void {
  if (entity.type === GARDEN_BED) {
    const { ripeAt, watered } = entity.farm ?? {};
    setSpriteClip(entity, ripeAt === undefined ? 0 : now >= ripeAt ? 3 : watered ? 2 : 1);
  } else if (entity.type === WOODLOT_TREE) {
    const { chops = 0, effectUntil = 0 } = entity.farm ?? {};
    setSpriteClip(entity, chops === 3 && now >= effectUntil ? 4 : chops);
  } else if (entity.type === FARM_EGG) {
    const { effectUntil, hatchAt } = entity.farm ?? {};
    setSpriteClip(
      entity,
      effectUntil !== undefined
        ? EGG_POSE.broken
        : hatchAt !== undefined
          ? EGG_POSE.incubating
          : EGG_POSE.plain,
    );
  }
}
