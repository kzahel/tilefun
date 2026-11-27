import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { createProp } from "../entities/PropFactories.js";
import {
  CHICKEN_FEEDER,
  FARM_EGG,
  FARM_FACTORIES,
  GARDEN_BED,
  GARDEN_FENCE,
  GROW_MS,
  LOG_BUNDLE,
  SCATTERED_CORN,
  WOODLOT_TREE,
} from "../farming/FarmActors.js";
import { CHICK } from "../farming/FarmFowl.js";
import { FARM_GATE, OPEN_FARM_GATE } from "../farming/FarmGate.js";
import {
  canReachFarmTarget,
  type FarmAction,
  type FarmRequest,
  FEED_REACH,
  farmAction,
} from "../farming/FarmInteraction.js";
import { restoreFarmPose } from "../farming/FarmPose.js";
import { AXE, CORN, changeStack, EMPTY_INVENTORY, heldItem, WOOD } from "../inventory/Inventory.js";
import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";
import { gap } from "../shared/gap.js";
import { required } from "../shared/required.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { dryFarmGround } from "./FarmGround.js";
import { growFarmChick, updateChickenPen } from "./FarmPoultry.js";
import { chopTree } from "./FarmWoodlot.js";
import { setInventory } from "./PlayerInventory.js";
import type { PlayerSession } from "./PlayerSession.js";
import { deliverMail } from "./PostalPlay.js";
import type { Realm } from "./Realm.js";

type FarmRealm = Pick<
  Realm,
  "entityManager" | "propManager" | "world" | "records" | "savePlayerData"
>;
const SEED_LIFE_MS = 25_000;

const UNREACHABLE = "Move closer to use this.";

function nearby(entities: EntityManager, p: PositionComponent, radius: number) {
  return entities.spatialHash.queryRadius(p.wx, p.wy, radius);
}

function farmEntity(type: string, p: PositionComponent, wz?: number): Entity {
  const entity = required(FARM_FACTORIES[type])(p.wx, p.wy);
  if (wz !== undefined) entity.wz = wz;
  return entity;
}

function clearFeedPath(
  realm: FarmRealm,
  from: PositionComponent,
  to: PositionComponent,
  z: number,
): boolean {
  const steps = Math.ceil(gap(from, to) / 4);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wx = from.wx + (to.wx - from.wx) * t,
      wy = from.wy + (to.wy - from.wy) * t;
    const height = dryFarmGround(realm.world, { wx, wy });
    if (
      height === undefined ||
      Math.abs(height - z) > 4 ||
      realm.propManager.overlapsAnyProp({
        left: wx - 1,
        right: wx + 1,
        top: wy - 1,
        bottom: wy + 1,
      })
    )
      return false;
  }
  return true;
}

function feedChickens(realm: FarmRealm, player: Entity, hen: Entity, now: number): void {
  const manager = realm.entityManager;
  const local = nearby(manager, player.position, FEED_REACH);
  if (local.some((e) => e.type === SCATTERED_CORN && (e.workItem?.units ?? 0) > 0))
    throw new Error("The chickens still have corn to eat.");
  const { wx, wy } = player.position;
  const distance = gap(player.position, hen.position);
  const dx = distance > 0 ? (hen.position.wx - wx) / distance : 0;
  const dy = distance > 0 ? (hen.position.wy - wy) / distance : -1;
  const forward = Math.min(20, distance / 2 + 4);
  const spills = [0, -10, 10].flatMap((side) => {
    const spot = { wx: wx + dx * forward - dy * side, wy: wy + dy * forward + dx * side };
    const z = dryFarmGround(realm.world, spot);
    if (z === undefined || Math.abs(z - (player.wz ?? 0)) > 4) return [];
    if (
      !clearFeedPath(realm, player.position, spot, z) ||
      !clearFeedPath(realm, hen.position, spot, z)
    )
      return [];
    return [{ spot, z }];
  });
  if (!spills.length) throw new Error("Find clear ground beside the chickens.");
  if (manager.entities.length + spills.length > PERSISTENCE_BUDGET.actors)
    throw new Error("The area is too crowded to scatter corn.");
  for (const { spot, z } of spills) {
    const corn = farmEntity(SCATTERED_CORN, spot, z);
    corn.workItem = required(createForageItem("seed", spot.wx, spot.wy).workItem);
    corn.farm = { effectUntil: now + SEED_LIFE_MS };
    manager.spawn(corn);
  }
}

function toggleGate(
  realm: FarmRealm,
  player: Entity,
  request: Extract<FarmRequest, { propId: number }>,
): void {
  const gate = realm.propManager.props.find((p) => p.id === request.propId);
  const closing = request.action === "close-gate";
  if (!gate || gate.type !== (closing ? OPEN_FARM_GATE : FARM_GATE))
    throw new Error("This gate has already changed.");
  const z = dryFarmGround(realm.world, gate.position);
  if (z === undefined || !canReachFarmTarget(player, { position: gate.position, wz: z }))
    throw new Error(UNREACHABLE);
  const { wx, wy } = gate.position;
  const replacement = createProp(closing ? FARM_GATE : OPEN_FARM_GATE, wx, wy);
  if (closing && replacement.collider) {
    const bounds = getEntityAABB(gate.position, replacement.collider);
    if (
      nearby(realm.entityManager, gate.position, 80).some(
        (entity) =>
          entity.collider &&
          entity.collider.solid !== false &&
          Math.abs((entity.wz ?? 0) - z) < 14 &&
          aabbsOverlap(bounds, getEntityAABB(entity.position, entity.collider)),
      )
    )
      throw new Error("Clear the gateway first.");
  }
  realm.propManager.replace(gate.id, replacement);
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
  if (
    session.editorEnabled ||
    session.debugPaused ||
    session.gameplaySession.mountId !== null ||
    player.parentId !== undefined
  )
    throw new Error(UNREACHABLE);
  if ("propId" in request) {
    if (request.action === "collect-parcel" || request.action === "deliver-parcel")
      return deliverMail(realm, session, { propId: request.propId, action: request.action });
    if (request.action !== "open-gate" && request.action !== "close-gate")
      throw new Error(UNREACHABLE);
    toggleGate(realm, player, request);
    return;
  }
  const target = entityManager.byId.get(request.entityId);
  if (
    !target ||
    !canReachFarmTarget(player, target, request.action === "feed" ? FEED_REACH : undefined) ||
    dryFarmGround(realm.world, target.position) === undefined
  )
    throw new Error(UNREACHABLE);
  restoreFarmPose(target, now);
  const available = farmAction(target);
  if (!available || available !== request.action) throw new Error("This has already changed.");

  const action: FarmAction = request.action;
  const inventory = session.gameplaySession.inventory ?? EMPTY_INVENTORY;
  switch (action) {
    case "plant":
      target.farm = { ripeAt: now + GROW_MS };
      break;
    case "water":
      target.farm = {
        ripeAt: Math.min(target.farm?.ripeAt ?? now + GROW_MS, now + 15_000),
        watered: true,
      };
      break;
    case "harvest": {
      const updated = changeStack(inventory, CORN, 1);
      if (!updated) throw new Error("Your inventory is full.");
      delete target.farm;
      setInventory(session, updated);
      break;
    }
    case "break-egg":
      target.farm = { effectUntil: now + 4000 };
      break;
    case "feed": {
      if (heldItem(inventory) !== CORN) throw new Error("Hold corn first.");
      const updated = changeStack(inventory, CORN, -1);
      if (!updated) throw new Error("Harvest some corn first.");
      feedChickens(realm, player, target, now);
      setInventory(session, updated);
      break;
    }
    case "chop":
      chopTree(entityManager, player, target, heldItem(inventory) === AXE, now);
      break;
    case "replant":
      if (nearby(entityManager, target.position, 32).some((e) => e.type === LOG_BUNDLE))
        throw new Error("Pick up the logs first.");
      delete target.farm;
      break;
    case "fence": {
      const updated = changeStack(inventory, WOOD, -1);
      if (!updated) throw new Error("Chop a tree for wood first.");
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
      setInventory(session, updated);
      break;
    }
  }
  if (action !== "fence") {
    restoreFarmPose(target, now);
    if (action !== "feed") realm.records?.changed(target);
  }
  if (session.gameplaySession.inventory !== inventory) realm.savePlayerData(session);
}

/** Absolute deadlines catch up when a chunk returns. Only query occupied neighborhoods. */
export function updateFarm(
  realm: Omit<FarmRealm, "savePlayerData"> & Partial<Pick<Realm, "streaming">>,
  sessions: readonly PlayerSession[],
  now = Date.now(),
): void {
  const manager = realm.entityManager;
  const poultry = new Set<Entity>();
  for (const session of sessions) {
    for (const target of nearby(manager, session.player.position, 190)) {
      if (target.type === CHICKEN_FEEDER || target.type === CHICK) poultry.add(target);
      else updateFarmActor(manager, session, target, now);
    }
  }
  for (const actor of poultry) {
    if (actor.type === CHICKEN_FEEDER) updateChickenPen(realm, actor, now);
    else growFarmChick(realm, actor, now);
  }
}

function updateFarmActor(
  manager: EntityManager,
  session: PlayerSession,
  target: Entity,
  now: number,
) {
  const expires = target.farm?.effectUntil ?? Infinity;
  switch (target.type) {
    case GARDEN_BED:
    case WOODLOT_TREE:
      restoreFarmPose(target, now);
      break;
    case FARM_EGG:
      if (expires <= now) manager.remove(target.id);
      break;
    case SCATTERED_CORN:
      if (
        !target.workItem?.claimedBy &&
        (!target.workItem?.units || (target.farm?.effectUntil ?? 0) <= now)
      )
        manager.remove(target.id);
      break;
    case LOG_BUNDLE: {
      if (
        session.editorEnabled ||
        session.gameplaySession.mountId !== null ||
        (target.farm?.effectUntil ?? 0) > now ||
        !canReachFarmTarget(session.player, target, 13)
      )
        return;
      const updated = changeStack(session.gameplaySession.inventory ?? EMPTY_INVENTORY, WOOD, 1);
      if (updated && manager.remove(target.id)) setInventory(session, updated);
      break;
    }
  }
}
