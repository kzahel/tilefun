import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import { resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { boardingDistance } from "../traffic/Driving.js";
import { bedWorldPoint, DUMP_BED, hasVehicleBed, vehicleBedBlocks } from "../traffic/VehicleBed.js";
import {
  bedContents,
  bedSlots,
  nearbyCargo,
  onBedFloor,
  type VehicleBedAction,
} from "../traffic/VehicleCargo.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

/** Ordinary authority actions shared by game and embedded hosts. No lab teleport. */
export function controlVehicleBed(
  realm: Realm,
  session: PlayerSession,
  id: number,
  action: VehicleBedAction,
) {
  const player = session.player,
    truck = realm.entityManager.byId.get(id);
  if (
    !truck ||
    !hasVehicleBed(truck) ||
    !realm.traffic?.states.has(id) ||
    !["board", "leave", "load", "unload"].includes(action)
  )
    throw Error("Truck bed unavailable.");
  if (
    session.editorEnabled ||
    session.transitioning ||
    session.retired ||
    player.parentId !== undefined ||
    realm.vehicles.get(session) ||
    session.debugPaused ||
    realm.saveManager?.pressured
  )
    throw Error("Truck bed control is unavailable right now.");
  if (
    boardingDistance(player, truck) > 32 ||
    player.jumpVZ !== undefined ||
    Math.abs((player.wz ?? 0) - (truck.wz ?? 0)) > 52
  )
    throw Error("Stand beside or inside the truck bed.");
  if (Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0) > 0.5)
    throw Error("Wait for the truck to stop.");

  const contents = bedContents(truck, realm.entityManager.entities);
  const actor =
    action === "load"
      ? nearbyCargo(player, truck, realm.entityManager.entities)[0]
      : action === "unload"
        ? contents[0]
        : player;
  if (!actor)
    throw Error(
      action === "load"
        ? "Bring a loose ball, fruit, nut, root or twig beside the truck."
        : "The bed has no loose cargo.",
    );
  if (action === "board" && onBedFloor(player, truck)) throw Error("You are already in the bed.");
  if (action === "leave" && !onBedFloor(player, truck))
    throw Error("Stand on the bed floor to climb out.");

  const inside = action === "board" || action === "load";
  const placements = inside
    ? bedSlots(actor).map((slot) => {
        const p = bedWorldPoint(truck, slot.x, slot.y);
        return {
          position: { wx: p.wx - slot.centerX, wy: p.wy - slot.centerY },
          wz: (truck.wz ?? 0) + DUMP_BED.floorZ,
        };
      })
    : [-1, 1].flatMap((side) =>
        [40, 52, 64].map((y) => {
          const p = bedWorldPoint(truck, DUMP_BED.center.x, side * y);
          return { position: p, wz: truck.wz ?? 0 };
        }),
      );
  const collider = actor.collider;
  if (!collider) throw Error("Actor has no physical body.");
  const placement = placements.find((candidate) => {
    const box = getEntityAABB(candidate.position, collider);
    const range = {
      minCx: Math.floor(box.left / 256),
      maxCx: Math.floor(box.right / 256),
      minCy: Math.floor(box.top / 256),
      maxCy: Math.floor(box.bottom / 256),
    };
    for (let cy = range.minCy; cy <= range.maxCy; cy++)
      for (let cx = range.minCx; cx <= range.maxCx; cx++)
        if (!realm.world.getChunkIfLoaded(cx, cy)) return false;
    if (realm.streaming && !realm.streaming.rangeReady(range)) return false;
    if (
      aabbOverlapsSolid(
        box,
        (x, y) => realm.world.getCollisionIfLoaded(x, y),
        CollisionFlag.Solid | CollisionFlag.Water,
      )
    )
      return false;
    const props = realm.propManager.getPropsInChunkRange(
      range.minCx,
      range.minCy,
      range.maxCx,
      range.maxCy,
    );
    const z = resolveGroundZForTracking(
      { ...actor, position: candidate.position, wz: candidate.wz },
      (x, y) => realm.world.getHeightAt(x, y),
      props,
      inside ? [truck] : [],
    );
    if (inside ? Math.abs(z - candidate.wz) > 0.1 : Math.abs(z - (truck.wz ?? 0)) > 4) return false;
    candidate.wz = z;
    const height = collider.physicalHeight ?? 12;
    if (
      vehicleBedBlocks(truck, box, z, height) ||
      props.some((p) => aabbOverlapsPropWalls(box, p.position, p, z, height))
    )
      return false;
    // Loading/climbing crosses the rim. A clear final foot position alone would
    // allow the action through a wall or underneath a ceiling too low to climb.
    const start = getEntityAABB(actor.position, collider);
    const sweep = {
      left: Math.min(start.left, box.left),
      right: Math.max(start.right, box.right),
      top: Math.min(start.top, box.top),
      bottom: Math.max(start.bottom, box.bottom),
    };
    const low = Math.min(actor.wz ?? 0, z);
    const top =
      (truck.wz ?? 0) +
      Math.max(...DUMP_BED.parts.filter((part) => part.name !== "cab").map((part) => part.z1)) +
      height;
    const sweepProps = realm.propManager.getPropsInChunkRange(
      Math.floor(sweep.left / 256),
      Math.floor(sweep.top / 256),
      Math.floor(sweep.right / 256),
      Math.floor(sweep.bottom / 256),
    );
    if (sweepProps.some((p) => aabbOverlapsPropWalls(sweep, p.position, p, low, top - low)))
      return false;
    return !realm.entityManager.entities.some(
      (e) =>
        e.id !== actor.id &&
        e.id !== truck.id &&
        e.parentId === undefined &&
        e.collider &&
        (e.collider.solid !== false || contents.includes(e)) &&
        (e.wz ?? 0) < z + height &&
        (e.wz ?? 0) + (e.collider.physicalHeight ?? 12) > z &&
        aabbsOverlap(box, getEntityAABB(e.position, e.collider)),
    );
  });
  if (!placement)
    throw Error(inside ? "No clear space in the truck bed." : "No clear place beside the truck.");
  actor.position = placement.position;
  actor.wz = actor.groundZ = placement.wz;
  actor.velocity &&= { vx: 0, vy: 0 };
  delete actor.jumpZ;
  delete actor.jumpVZ;
  delete actor.airMomentumX;
  delete actor.airMomentumY;
  if (inside) delete actor.deathTimer;
  if (actor.workItem) delete actor.workItem.returned;
  realm.entityManager.spatialHash.update(actor);
  realm.records?.changed(actor);
  if (actor === player) {
    session.inputQueue = [];
    realm.savePlayerData(session);
  }
}
