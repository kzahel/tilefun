import type { Entity } from "../entities/Entity.js";

export interface ReplayPose {
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
}
export function replayPose(entity: Entity): ReplayPose {
  return {
    x: entity.position.wx,
    y: entity.position.wy,
    z: entity.wz ?? 0,
    prevX: entity.prevPosition?.wx ?? entity.position.wx,
    prevY: entity.prevPosition?.wy ?? entity.position.wy,
    prevZ: entity.prevWz ?? entity.wz ?? 0,
  };
}
export function clonePredictionEntity(entity: Entity): Entity {
  return {
    ...entity,
    position: { ...entity.position },
    velocity: entity.velocity && { ...entity.velocity },
    collider: entity.collider && { ...entity.collider },
    sprite: entity.sprite && { ...entity.sprite },
    wanderAI: entity.wanderAI && { ...entity.wanderAI },
    ...(entity.tags ? { tags: new Set(entity.tags) } : {}),
  };
}
export function predictionDistance(a: Entity, b: Entity) {
  return Math.hypot(
    a.position.wx - b.position.wx,
    a.position.wy - b.position.wy,
    (a.wz ?? 0) - (b.wz ?? 0),
  );
}
