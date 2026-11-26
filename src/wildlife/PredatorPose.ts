import type { Entity } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { type PredatorProfile, predatorProfile } from "./Predator.js";

type Behavior = NonNullable<Entity["predator"]>;
const MOVING = new Set<Behavior["state"]>([
  "patrol",
  "stalk",
  "chase",
  "pounce",
  "evade",
  "flight",
]);
const CLIPS: Partial<Record<Behavior["state"], number>> = {
  feed: 2,
  display: 3,
  scared: 3,
  chase: 4,
  evade: 4,
};

function animationClip(ai: Behavior, profile: PredatorProfile | undefined, moving: boolean) {
  if (ai.flight) return 6;
  if (ai.state === "pounce") return profile?.fierce || profile?.art ? 4 : 3;
  if (ai.state === "sleep" || ai.state === "ambush") return profile?.fierce ? 5 : 0;
  if (
    ai.state === "perch" &&
    profile?.fierce?.kind === "griffin" &&
    ai.cooldown > 0 &&
    ai.meals > 0
  )
    return 5;
  return CLIPS[ai.state] ?? Number(moving);
}

export function restorePredatorPose(entity: Entity): void {
  const ai = entity.predator;
  if (!ai || !entity.sprite) return;
  if (ai.facing !== undefined) entity.sprite.frameRow = entity.sprite.direction = ai.facing;
  const moving = MOVING.has(ai.state);
  entity.sprite.moving = moving;
  if (entity.wanderAI)
    entity.wanderAI.state =
      ai.state === "scared"
        ? "scared"
        : ai.state === "chase" || ai.state === "pounce"
          ? "chasing"
          : moving
            ? "walking"
            : "idle";
  setSpriteClip(entity, animationClip(ai, predatorProfile(entity.type), moving));
  setSpriteClipElapsed(entity, Math.round((ai.flight?.elapsed ?? ai.elapsed) * 1000));
}
