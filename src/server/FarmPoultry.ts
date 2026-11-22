import { CHUNK_SIZE_PX } from "../config/constants.js";
import { aabbOverlapsSolid, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip } from "../entities/spriteAnimation.js";
import { EGG_POSE, FARM_EGG, FARM_FACTORIES } from "../farming/FarmActors.js";
import { isFarmFowl, isFarmHen, ROOSTER } from "../farming/FarmFowl.js";
import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";
import { required } from "../shared/required.js";
import { createFauna } from "../wildlife/Fauna.js";
import { dryFarmGround, FARM_BLOCKED_GROUND } from "./FarmGround.js";
import type { Realm } from "./Realm.js";

type PoultryRealm = Pick<Realm, "entityManager" | "propManager" | "world" | "records"> &
  Partial<Pick<Realm, "streaming">>;

export const PEN_BIRDS = 6;
export const PEN_EGGS = 4;
export const FIRST_EGG_MS = 20_000;
export const LAY_AGAIN_MS = 55_000;
export const HATCH_MS = 25_000;
export const GROW_CHICK_MS = 60_000;

/** The sign stands near the south gate. These offsets follow the generated yard. */
function penBounds({ wx, wy }: PositionComponent) {
  return { minX: wx - 56, minY: wy - 96, maxX: wx + 80, maxY: wy + 16 };
}
type PenBounds = ReturnType<typeof penBounds>;

function inPen(bounds: PenBounds, { wx, wy }: PositionComponent): boolean {
  return wx > bounds.minX && wx < bounds.maxX && wy > bounds.minY && wy < bounds.maxY;
}

const NEARBY_POINTS = [
  [0, 0],
  [0, 10],
  [10, 0],
  [-10, 0],
  [0, -10],
] as const;

function placeNear(
  realm: PoultryRealm,
  actor: Entity,
  source: Entity,
  bounds?: PenBounds,
): boolean {
  const { collider } = actor;
  if (!collider) return false;
  const { world, propManager, entityManager } = realm;
  const { wx, wy } = source.position;
  for (const [dx, dy] of NEARBY_POINTS) {
    const point = { wx: wx + dx, wy: wy + dy };
    if (bounds && !inPen(bounds, point)) continue;
    if (
      !world.getChunkIfLoaded(
        Math.floor(point.wx / CHUNK_SIZE_PX),
        Math.floor(point.wy / CHUNK_SIZE_PX),
      )
    )
      continue;
    const z = dryFarmGround(world, point);
    if (z === undefined || Math.abs(z - (source.wz ?? 0)) > 4) continue;
    const box = getEntityAABB(point, collider);
    if (
      aabbOverlapsSolid(box, (x, y) => world.getCollisionIfLoaded(x, y), FARM_BLOCKED_GROUND) ||
      propManager.overlapsAnyProp(box)
    )
      continue;
    const blocked = entityManager.spatialHash
      .queryRadius(point.wx, point.wy, 32)
      .some(
        (other) =>
          other !== source &&
          other.collider &&
          (actor.type === FARM_EGG ? other.type === FARM_EGG : other.collider.solid !== false) &&
          Math.abs(z - (other.wz ?? 0)) <= 4 &&
          aabbsOverlap(box, getEntityAABB(other.position, other.collider)),
      );
    if (blocked) continue;
    actor.position = point;
    actor.wz = z;
    if (actor.fauna) {
      actor.fauna.home = { ...point };
      actor.fauna.shelter = { ...point };
      actor.fauna.target = { ...point };
      if (bounds) actor.fauna.habitatBounds = bounds;
    }
    return true;
  }
  return false;
}

/** Chicks can grow after being led away from the pen. Leave the chick in place if
 * the adult body cannot yet fit. */
export function growFarmChick(realm: PoultryRealm, chick: Entity, now: number): void {
  chick.farm ??= {};
  if (chick.farm.growAt === undefined) {
    chick.farm.growAt = now + GROW_CHICK_MS;
    realm.records?.changed(chick);
  }
  if (now < chick.farm.growAt) return;
  const hen = createFauna("chicken", chick.position.wx, chick.position.wy);
  if (!placeNear(realm, hen, chick, chick.fauna?.habitatBounds)) return;
  if (realm.entityManager.remove(chick.id)) realm.entityManager.spawn(hen);
}

function hatchEgg(
  realm: PoultryRealm,
  egg: Entity,
  bounds: PenBounds,
  birds: number,
  rooster: boolean,
  now: number,
): boolean {
  const hatchAt = egg.farm?.hatchAt;
  if (egg.farm?.effectUntil !== undefined || hatchAt === undefined) return false;
  const pose = !rooster
    ? EGG_POSE.missingRooster
    : birds >= PEN_BIRDS
      ? EGG_POSE.crowded
      : EGG_POSE.incubating;
  setSpriteClip(egg, pose);
  if (pose !== EGG_POSE.incubating || now < hatchAt) return false;
  const chick = createFauna("chick", egg.position.wx, egg.position.wy);
  chick.farm = { growAt: now + GROW_CHICK_MS };
  if (!placeNear(realm, chick, egg, bounds)) {
    setSpriteClip(egg, EGG_POSE.crowded);
    return false;
  }
  if (!realm.entityManager.remove(egg.id)) return false;
  realm.entityManager.spawn(chick);
  return true;
}

/** Each visited, fully loaded pen is updated once per farm tick, including in co-op. */
export function updateChickenPen(realm: PoultryRealm, sign: Entity, now: number): void {
  const bounds = penBounds(sign.position);
  const range = {
    minCx: Math.floor(bounds.minX / CHUNK_SIZE_PX),
    minCy: Math.floor(bounds.minY / CHUNK_SIZE_PX),
    maxCx: Math.floor(bounds.maxX / CHUNK_SIZE_PX),
    maxCy: Math.floor(bounds.maxY / CHUNK_SIZE_PX),
  };
  if (realm.streaming && !realm.streaming.rangeReady(range)) return;
  const ground = dryFarmGround(realm.world, sign.position);
  if (ground === undefined) return;
  const { entityManager } = realm;
  const residents = entityManager.spatialHash
    .queryRange(range.minCx, range.minCy, range.maxCx, range.maxCy)
    .filter((e) => inPen(bounds, e.position) && Math.abs((e.wz ?? 0) - ground) < 8);
  let birds = residents.filter((e) => isFarmFowl(e.type) && e.deathTimer === undefined).length;
  const rooster = residents.some((e) => e.type === ROOSTER && e.deathTimer === undefined);
  const eggs = residents.filter((e) => e.type === FARM_EGG && e.farm?.effectUntil === undefined);
  let eggCount = eggs.length;
  for (const egg of eggs)
    if (hatchEgg(realm, egg, bounds, birds, rooster, now)) {
      birds++;
      eggCount--;
    }
  for (const hen of residents) {
    if (!isFarmHen(hen.type) || hen.deathTimer !== undefined || hen.parentId !== undefined)
      continue;
    hen.farm ??= {};
    if (hen.farm.layAt === undefined) {
      hen.farm.layAt = now + FIRST_EGG_MS;
      realm.records?.changed(hen);
    }
    if (
      hen.farm.layAt > now ||
      eggCount >= PEN_EGGS ||
      entityManager.entities.length >= PERSISTENCE_BUDGET.actors
    )
      continue;
    const egg = required(FARM_FACTORIES[FARM_EGG])(hen.position.wx, hen.position.wy);
    if (!placeNear(realm, egg, hen, bounds)) continue;
    if (rooster) {
      egg.farm = { hatchAt: now + HATCH_MS };
      setSpriteClip(egg, EGG_POSE.incubating);
    }
    entityManager.spawn(egg);
    hen.farm.layAt = now + LAY_AGAIN_MS;
    realm.records?.changed(hen);
    eggCount++;
  }
}
