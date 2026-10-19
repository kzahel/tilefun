import { required } from "../art/ArtCatalog.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import type { EntityManager } from "../entities/EntityManager.js";
import {
  type ActorRecord,
  decodeActor,
  durableId,
  encodeActor,
} from "../persistence/ActorRecords.js";
import { faunaHabitatAllows } from "./faunaAI.js";
import { syncFaunaWater } from "./faunaInteractions.js";
import type { WildlifeEnvironment } from "./mallardAI.js";
import { predatorHabitatAllows } from "./predatorAI.js";

export const WILDLIFE_RESPAWN_SCOPE = "wildlife-respawns";
export const WILDLIFE_RESPAWN_LIMIT = 128;
export const WILDLIFE_RESPAWN_DELAY = { min: 60, max: 120 } as const;
export const WILDLIFE_RESPAWN_DISTANCE = { min: 512, max: 1024 } as const;
export interface PendingWildlifeRespawn {
  actor: ActorRecord;
  origin: PositionComponent;
  remaining: number;
  randomState: number;
}
function habitat(e: Entity) {
  return e.predator ?? e.fauna ?? e.deer ?? e.rabbit ?? e.mallard ?? e.robin ?? e.frog;
}
const distance = (a: PositionComponent, b: PositionComponent) =>
  Math.hypot(a.wx - b.wx, a.wy - b.wy);

/** A pending birth is an independent durable job, never a hidden live animal. */
export function scheduleWildlifeRespawn(
  manager: EntityManager,
  prey: Entity,
  random: () => number,
): boolean {
  const lineage = prey.naturalSpawnId ?? prey.proceduralId;
  if (!lineage) return true;
  if (manager.wildlifeRespawns.size >= WILDLIFE_RESPAWN_LIMIT) return false;
  const factory = ENTITY_FACTORIES[prey.type];
  if (!factory) return false;
  const fresh = factory(prey.position.wx, prey.position.wy),
    previous = habitat(prey),
    next = habitat(fresh);
  // Keep social identity, but let the new individual establish its own home,
  // shelter and territory at the distant, validated birth location.
  if (previous && next)
    for (const key of ["herdId", "groupId", "packId", "packRole"]) {
      const value = Reflect.get(previous, key);
      if (value !== undefined) Reflect.set(next, key, value);
    }
  fresh.naturalSpawnId = lineage;
  const id = durableId(fresh);
  const job: PendingWildlifeRespawn = {
    actor: encodeActor(fresh),
    origin: { ...prey.position },
    remaining:
      WILDLIFE_RESPAWN_DELAY.min +
      random() * (WILDLIFE_RESPAWN_DELAY.max - WILDLIFE_RESPAWN_DELAY.min),
    randomState: (random() * 4294967296) >>> 0,
  };
  manager.wildlifeRespawns.set(id, job);
  manager.onWildlifeRespawnChanged?.(id, job);
  return true;
}

/** Shared Realm time: pauses stop the countdown; reload restores remaining time. */
export function tickWildlifeRespawns(
  manager: EntityManager,
  dt: number,
  env: WildlifeEnvironment,
  players: readonly PositionComponent[],
): void {
  for (const [id, job] of manager.wildlifeRespawns) {
    job.remaining = Math.max(0, job.remaining - dt);
    manager.onWildlifeRespawnChanged?.(id, job);
  }
  let budget = 4;
  for (const [id, job] of manager.wildlifeRespawns) {
    if (job.remaining > 0 || budget-- <= 0) continue;
    const random = () => {
      job.randomState = (Math.imul(job.randomState, 1664525) + 1013904223) >>> 0;
      return job.randomState / 4294967296;
    };
    let spawned = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = random() * Math.PI * 2,
        r =
          WILDLIFE_RESPAWN_DISTANCE.min +
          random() * (WILDLIFE_RESPAWN_DISTANCE.max - WILDLIFE_RESPAWN_DISTANCE.min);
      const point = {
        wx: job.origin.wx + Math.cos(angle) * r,
        wy: job.origin.wy + Math.sin(angle) * r,
      };
      const candidate = decodeActor(job.actor) as Entity;
      candidate.position = point;
      candidate.wz = env.surfaceZ?.(point) ?? 0;
      const box = getEntityAABB(point, required(candidate.collider));
      const margin = {
        left: box.left - 8,
        right: box.right + 8,
        top: box.top - 8,
        bottom: box.bottom + 8,
      };
      const ground = [
        point,
        { wx: box.left, wy: box.top },
        { wx: box.right, wy: box.top },
        { wx: box.left, wy: box.bottom },
        { wx: box.right, wy: box.bottom },
      ];
      for (let ty = Math.floor(box.top / 16); ty <= Math.floor((box.bottom - 0.001) / 16); ty++)
        for (let tx = Math.floor(box.left / 16); tx <= Math.floor((box.right - 0.001) / 16); tx++)
          ground.push({
            wx: Math.max(box.left, Math.min(box.right - 0.001, tx * 16 + 8)),
            wy: Math.max(box.top, Math.min(box.bottom - 0.001, ty * 16 + 8)),
          });
      if (
        players.some((p) => distance(p, point) < 512) ||
        ground.some(
          (p) =>
            manager.canPlace?.(p.wx, p.wy) === false ||
            (!ENTITY_DEFS[candidate.type]?.amphibious &&
              env.isWater(p) !== (ENTITY_DEFS[candidate.type]?.aquatic === true)) ||
            Math.abs((env.surfaceZ?.(p) ?? 0) - required(candidate.wz)) > 2,
        ) ||
        (candidate.predator && !predatorHabitatAllows(candidate, point, env)) ||
        (candidate.fauna && !faunaHabitatAllows(candidate, point, env)) ||
        !env.canOccupy(candidate, point) ||
        manager.canSpawn?.(candidate) === false ||
        manager.entities.some(
          (e) =>
            e.collider &&
            e.collider.solid !== false &&
            aabbsOverlap(margin, getEntityAABB(e.position, e.collider)),
        )
      )
        continue;
      const home = habitat(candidate);
      if (home) {
        home.home = { ...point };
        if ("shelter" in home) home.shelter = { ...point };
        if ("target" in home) home.target = { ...point };
        home.randomState = (random() * 4294967296) >>> 0;
      }
      if (candidate.predator) candidate.predator.cooldown = 20;
      if (candidate.fauna) syncFaunaWater(candidate, env.isWater(point));
      manager.spawn(candidate);
      manager.wildlifeRespawns.delete(id);
      manager.onWildlifeRespawnChanged?.(id, undefined);
      spawned = true;
      break;
    }
    if (!spawned) {
      job.remaining = 5;
      manager.onWildlifeRespawnChanged?.(id, job);
    }
  }
}
