import type { Entity } from "../entities/Entity.js";
import { hasMovingRoof } from "../traffic/RoofSupport.js";

interface Sample {
  time: number;
  entity: Entity;
}
/** Collision-only poses. Never mutate replicas, run AI, or extrapolate a support per command. */
export class PredictionCollisionTimeline {
  private history = new Map<number, Sample[]>();
  private cache:
    | { time: number; entities: readonly Entity[]; excludeId: number; poses: readonly Entity[] }
    | undefined;
  clear(): void {
    this.history.clear();
    this.cache = undefined;
  }
  /** A replay spanning frames must retain the trajectories it started with. */
  fork(): PredictionCollisionTimeline {
    const timeline = new PredictionCollisionTimeline();
    timeline.history = new Map(Array.from(this.history, ([id, samples]) => [id, samples.slice()]));
    return timeline;
  }
  record(time: number, entities: readonly Entity[]): void {
    this.cache = undefined;
    const ids = new Set(entities.map((e) => e.id));
    for (const id of this.history.keys()) if (!ids.has(id)) this.history.delete(id);
    for (const entity of entities) {
      if (!entity.collider || entity.collider.solid === false || hasMovingRoof(entity)) {
        this.history.delete(entity.id);
        continue;
      }
      let samples = this.history.get(entity.id) ?? [];
      const last = samples.at(-1);
      // Teleports, time resets and changing geometry invalidate a trajectory.
      if (
        last &&
        (time <= last.time ||
          Math.hypot(
            entity.position.wx - last.entity.position.wx,
            entity.position.wy - last.entity.position.wy,
          ) > 32 ||
          entity.type !== last.entity.type ||
          entity.collider.width !== last.entity.collider?.width ||
          entity.collider.height !== last.entity.collider?.height)
      )
        samples = [];
      samples.push({
        time,
        entity: {
          ...entity,
          position: { ...entity.position },
          velocity: entity.velocity && { ...entity.velocity },
        },
      });
      if (samples.length > 8) samples.shift();
      this.history.set(entity.id, samples);
    }
  }
  poses(time: number, entities: readonly Entity[], excludeId: number): readonly Entity[] {
    const cache = this.cache;
    if (
      cache &&
      cache.time === time &&
      cache.entities === entities &&
      cache.excludeId === excludeId
    )
      return cache.poses;
    const poses = entities.map((entity) => {
      if (entity.id === excludeId || entity.parentId !== undefined || hasMovingRoof(entity))
        return entity;
      const samples = this.history.get(entity.id),
        last = samples?.at(-1);
      if (!last) return entity;
      const first = samples?.[0];
      if (first && time < first.time) return { ...entity, position: { ...first.entity.position } };
      for (let i = 1; i < (samples?.length ?? 0); i++) {
        const a = samples?.[i - 1],
          b = samples?.[i];
        if (a && b && time >= a.time && time <= b.time) {
          const alpha = (time - a.time) / (b.time - a.time);
          return {
            ...entity,
            position: {
              wx: a.entity.position.wx + (b.entity.position.wx - a.entity.position.wx) * alpha,
              wy: a.entity.position.wy + (b.entity.position.wy - a.entity.position.wy) * alpha,
            },
          };
        }
      }
      // Bounded constant-velocity future. Walls, stops and AI turns remain authority-owned.
      const lead = Math.max(0, Math.min(0.1, time - last.time));
      return {
        ...entity,
        position: {
          wx: last.entity.position.wx + (last.entity.velocity?.vx ?? 0) * lead,
          wy: last.entity.position.wy + (last.entity.velocity?.vy ?? 0) * lead,
        },
      };
    });
    this.cache = { time, entities, excludeId, poses };
    return poses;
  }
}
