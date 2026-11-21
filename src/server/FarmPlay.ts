import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { createProp } from "../entities/PropFactories.js";
import {
  EMPTY_BASKET,
  FALL_MS,
  FARM_FACTORIES,
  GARDEN_BED,
  GARDEN_FENCE,
  GROW_MS,
  LOG_BUNDLE,
  SCATTERED_CORN,
  WOODLOT_TREE,
} from "../farming/FarmActors.js";
import { canReachFarmTarget, type FarmRequest, farmAction } from "../farming/FarmInteraction.js";
import { restoreFarmPose } from "../farming/FarmPose.js";
import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";
import { gap } from "../shared/gap.js";
import { required } from "../shared/required.js";
import { faunaType } from "../wildlife/Fauna.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

type FarmRealm = Pick<
  Realm,
  "entityManager" | "propManager" | "world" | "records" | "savePlayerData"
>;
const SEED_LIFE_MS = 25_000;
const CHICKEN = faunaType("chicken");

const UNREACHABLE = "Move closer to use this.";

function nearby(entities: EntityManager, p: PositionComponent, radius: number) {
  return entities.spatialHash.queryRadius(p.wx, p.wy, radius);
}

function farmEntity(type: string, p: PositionComponent, wz?: number): Entity {
  const entity = required(FARM_FACTORIES[type])(p.wx, p.wy);
  if (wz !== undefined) entity.wz = wz;
  return entity;
}

function dryGround(realm: FarmRealm, p: PositionComponent): number | undefined {
  const tx = Math.floor(p.wx / TILE_SIZE),
    ty = Math.floor(p.wy / TILE_SIZE);
  const collision = realm.world.getCollisionIfLoaded(tx, ty);
  return collision & (CollisionFlag.Water | CollisionFlag.Solid)
    ? undefined
    : realm.world.getHeightAt(tx, ty) * ELEVATION_PX;
}

function feedChickens(realm: FarmRealm, feeder: Entity, now: number): void {
  const manager = realm.entityManager;
  const local = nearby(manager, feeder.position, 150);
  if (local.some((e) => e.type === SCATTERED_CORN && (e.workItem?.units ?? 0) > 0))
    throw new Error("The chickens still have corn to eat.");
  const chickens = local.filter((e) => e.type === CHICKEN && e.parentId === undefined);
  const spills = [0, -14, 14].flatMap((dx) => {
    const spot = { wx: feeder.position.wx + dx, wy: feeder.position.wy - 16 };
    const z = dryGround(realm, spot);
    if (z === undefined || !chickens.some((chicken) => gap(spot, chicken.position) <= 155))
      return [];
    return [{ spot, z }];
  });
  if (!spills.length) throw new Error("Bring a Buff hen near the feeder.");
  if (manager.entities.length + spills.length > PERSISTENCE_BUDGET.actors)
    throw new Error("The area is too crowded to scatter corn.");
  for (const { spot, z } of spills) {
    const corn = farmEntity(SCATTERED_CORN, spot, z);
    corn.workItem = required(createForageItem("seed", spot.wx, spot.wy).workItem);
    corn.farm = { effectUntil: now + SEED_LIFE_MS };
    manager.spawn(corn);
  }
}

/** The authority rechecks the displayed verb so simultaneous harvests/watering stay single-use. */
export function performFarmAction(
  realm: FarmRealm,
  session: PlayerSession,
  request: FarmRequest,
  now = Date.now(),
): void {
  const { entityManager } = realm;
  const player = session.player;
  const target = entityManager.byId.get(request.entityId);
  if (
    !target ||
    session.editorEnabled ||
    session.debugPaused ||
    session.gameplaySession.mountId !== null ||
    !canReachFarmTarget(player, target) ||
    dryGround(realm, target.position) === undefined
  )
    throw new Error(UNREACHABLE);
  restoreFarmPose(target, now);
  const action = farmAction(target);
  if (action === undefined || action !== request.action)
    throw new Error("This has already changed.");

  const basket = session.gameplaySession.farmBasket ?? EMPTY_BASKET;
  switch (request.action) {
    case "plant":
      target.farm = { ripeAt: now + GROW_MS };
      break;
    case "water":
      target.farm = {
        ripeAt: Math.min(target.farm?.ripeAt ?? now + GROW_MS, now + 15_000),
        watered: true,
      };
      break;
    case "harvest":
      delete target.farm;
      session.gameplaySession.farmBasket = { ...basket, corn: basket.corn + 1 };
      break;
    case "feed":
      if (basket.corn < 1) throw new Error("Harvest some corn first.");
      feedChickens(realm, target, now);
      session.gameplaySession.farmBasket = { ...basket, corn: basket.corn - 1 };
      break;
    case "chop": {
      if ((target.farm?.effectUntil ?? 0) > now) throw new Error("Wait for the tree to settle.");
      const chops = (target.farm?.chops ?? 0) + 1;
      if (chops === 3) {
        const bundle = farmEntity(LOG_BUNDLE, player.position, player.wz);
        bundle.farm = { effectUntil: now + FALL_MS };
        entityManager.spawn(bundle);
      }
      target.farm = { chops, effectUntil: now + (chops === 3 ? FALL_MS : 350) };
      break;
    }
    case "replant":
      if (nearby(entityManager, target.position, 32).some((e) => e.type === LOG_BUNDLE))
        throw new Error("Pick up the logs first.");
      delete target.farm;
      break;
    case "fence": {
      if (basket.wood < 1) throw new Error("Chop a tree for wood first.");
      const { wx, wy } = target.position;
      const fence = createProp(GARDEN_FENCE, wx, wy);
      const bounds = getEntityAABB(fence.position, required(fence.collider));
      if (realm.propManager.overlapsAnyProp(bounds))
        throw new Error("The fence needs a clear spot.");
      if (
        nearby(entityManager, target.position, 24).some(
          (e) =>
            e !== target &&
            e.collider &&
            e.collider.solid !== false &&
            Math.abs((e.wz ?? 0) - (target.wz ?? 0)) < 12 &&
            aabbsOverlap(bounds, getEntityAABB(e.position, e.collider)),
        )
      )
        throw new Error("Take a step back to build the fence.");
      realm.propManager.add(fence);
      entityManager.remove(target.id);
      session.gameplaySession.farmBasket = { ...basket, wood: basket.wood - 1 };
      break;
    }
  }
  if (action !== "fence") {
    restoreFarmPose(target, now);
    if (action !== "feed") realm.records?.changed(target);
  }
  if (session.gameplaySession.farmBasket !== basket) realm.savePlayerData(session);
}

/** Absolute deadlines catch up when a chunk returns. Only query occupied neighborhoods. */
export function updateFarm(
  realm: Pick<FarmRealm, "entityManager">,
  sessions: readonly PlayerSession[],
  now = Date.now(),
): void {
  const manager = realm.entityManager;
  for (const session of sessions) {
    const player = session.player;
    for (const target of nearby(manager, player.position, 190)) {
      if (target.type === GARDEN_BED || target.type === WOODLOT_TREE) restoreFarmPose(target, now);
      else if (
        target.type === SCATTERED_CORN &&
        !target.workItem?.claimedBy &&
        (!(target.workItem?.units ?? 0) || (target.farm?.effectUntil ?? 0) <= now)
      )
        manager.remove(target.id);
      else if (
        target.type === LOG_BUNDLE &&
        !session.editorEnabled &&
        session.gameplaySession.mountId === null &&
        (target.farm?.effectUntil ?? 0) <= now &&
        canReachFarmTarget(player, target, 13) &&
        manager.remove(target.id)
      ) {
        const basket = session.gameplaySession.farmBasket ?? EMPTY_BASKET;
        session.gameplaySession.farmBasket = { ...basket, wood: basket.wood + 1 };
      }
    }
  }
}
