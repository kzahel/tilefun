import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Direction, Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import { gap } from "../shared/gap.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { WorkContext } from "./AnimalWorkSystem.js";
import { restoreFaunaPose } from "./faunaInteractions.js";

/**
 * Plumbing shared by the habitat work classes. Each helper reproduces the
 * former per-class copies exactly (arithmetic, iteration and sort order);
 * decision logic stays in the classes.
 */
export class WorkKit {
  constructor(private readonly manager: EntityManager) {}

  find(id: string | undefined): Entity | undefined {
    return id ? this.manager.entities.find((e) => e.persistentId === id) : undefined;
  }

  /** Spatial-hash members of every chunk overlapping the square `radius` around `p`. */
  around(p: PositionComponent, radius: number): Entity[] {
    return this.manager.spatialHash.queryRange(
      Math.floor((p.wx - radius) / CHUNK_SIZE_PX),
      Math.floor((p.wy - radius) / CHUNK_SIZE_PX),
      Math.floor((p.wx + radius) / CHUNK_SIZE_PX),
      Math.floor((p.wy + radius) / CHUNK_SIZE_PX),
    );
  }

  /** `around` filtered by `keep`, nearest first with a durable-id tiebreak. */
  nearest(p: PositionComponent, radius: number, keep: (e: Entity) => boolean): Entity[] {
    return this.around(p, radius)
      .filter(keep)
      .sort(
        (x, y) =>
          gap(x.position, p) - gap(y.position, p) || durableId(x).localeCompare(durableId(y)),
      );
  }

  /** Drop this actor's own reservation on its target and forget the target. */
  releaseTarget(a: Entity): void {
    const target = this.find(a.animalWork?.targetId);
    if (target?.workItem && target.workItem.claimedBy === a.persistentId)
      delete target.workItem.claimedBy;
    if (a.animalWork) delete a.animalWork.targetId;
  }
}

export const freshWork = (kind: AnimalWork["kind"]): AnimalWork => ({
  kind,
  state: "idle",
  elapsed: 0,
  cooldown: 0,
  deliveries: 0,
  eaten: 0,
  retrieved: 0,
});

/** Stable home identity for an animal's owned sites. */
export const workHomeKey = (a: Entity) => a.naturalSpawnId ?? a.proceduralId ?? durableId(a);

/** Attached, following or ridden actors never run their own work. */
export const protectedActor = (a: Entity) =>
  a.parentId !== undefined || a.wanderAI?.following || a.wanderAI?.state === "ridden";

/** Dry ground within `tolerance` pixels of the surface. */
export function groundSupported(e: Entity, c: WorkContext, tolerance: number): boolean {
  return (
    !c.environment.isWater(e.position) &&
    Math.abs((e.wz ?? 0) - (c.environment.surfaceZ?.(e.position) ?? 0)) <= tolerance
  );
}

/** Turn the sprite (and saved work facing) toward `p`, or to an explicit direction. */
export function faceToward(a: Entity, p: PositionComponent, direction?: Direction): void {
  if (!a.sprite) return;
  const facing = direction ?? directionFromVelocity(p.wx - a.position.wx, p.wy - a.position.wy);
  a.sprite.direction = a.sprite.frameRow = facing;
  if (a.animalWork) a.animalWork.facing = facing;
}

/**
 * Enter a work state for a fauna-brained actor; a resting body stops, idles
 * and restores its native pose. `calmOnly` keeps an alarmed actor's wander state.
 */
export function enterFaunaWork(a: Entity, state: AnimalWork["state"], calmOnly = false): void {
  const t = a.animalWork;
  if (!t) return;
  t.state = state;
  t.elapsed = 0;
  if (!a.fauna?.motion) {
    a.motionIntent = { vx: 0, vy: 0 };
    if (
      a.wanderAI &&
      (!calmOnly ||
        (!a.fauna?.alarmFrom && !["startle", "flee", "recover"].includes(a.fauna?.state ?? "")))
    )
      a.wanderAI.state = "idle";
    restoreFaunaPose(a);
  }
  restoreAnimalWorkPose(a);
}
