import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import { creatureSpecies } from "./FoodWeb.js";

/** Gameplay class, independent of sprite size, collision bounds and pushing weight. */
export const SMALL_ANIMAL_SPECIES: ReadonlySet<string> = new Set([
  "frog",
  "rabbit",
  "robin",
  "mallard-duck",
  "chicken",
  "pigeon",
  "crow",
  "seagull",
  "ant",
]);
export const ROADKILL_LIFETIME = 30;
export const ROADKILL_FADE_SECONDS = 5;
export const ROADKILL_SCALE_Y = 0.3;
const PREFIX = "roadkill:";
export const isRoadkill = (type: string): boolean => type.startsWith(PREFIX);
export const roadkillType = (type: string): string => `${PREFIX}${type}`;
export const isSmallAnimal = (type: string): boolean =>
  SMALL_ANIMAL_SPECIES.has(creatureSpecies({ type }) ?? "");

export function canBecomeRoadkill(entity: Entity): boolean {
  return (
    isSmallAnimal(entity.type) &&
    entity.deathTimer === undefined &&
    entity.parentId === undefined &&
    !entity.wanderAI?.following &&
    entity.wanderAI?.state !== "ridden"
  );
}

/** Separate inert actors let ordinary removal persist the original animal's death.
 * They reuse the source sheet, with a fixed first pose and no AI/body/support. */
export function roadkillDefinition(def: EntityDef): EntityDef {
  const sprite = def.sprite ? { ...def.sprite, frameCount: 1 } : null;
  if (sprite) delete sprite.clips;
  return {
    sprite,
    collider: null,
    wanderAI: null,
    hasVelocity: false,
    noShadow: true,
  };
}
export function createRoadkill(animal: Entity): Entity {
  const sprite = animal.sprite ? { ...animal.sprite } : null;
  if (sprite) {
    delete sprite.clip;
    delete sprite.clipElapsedMs;
    Object.assign(sprite, {
      frameCount: 1,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      moving: false,
      flipX: false,
      direction: Direction.Down,
    });
  }
  return {
    id: 0,
    type: roadkillType(animal.type),
    position: { ...animal.position },
    wz: animal.groundZ ?? (animal.wz ?? 0) - (animal.jumpZ ?? 0),
    groundZ: animal.groundZ ?? (animal.wz ?? 0) - (animal.jumpZ ?? 0),
    velocity: null,
    collider: null,
    wanderAI: null,
    noShadow: true,
    deathTimer: ROADKILL_LIFETIME,
    sprite,
  };
}
