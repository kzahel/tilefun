import { JUMP_VELOCITY } from "../config/constants.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { SavedPlayerData } from "../persistence/SaveManager.js";
import { setVerticalVelocity, teleportBody } from "../physics/PhysicalEdits.js";
import { getSurfaceZ } from "../physics/surfaceHeight.js";
import { setFaunaRidden } from "../wildlife/faunaInteractions.js";
import { startleWildlife } from "../wildlife/WildlifeSpecies.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

type RidingRealm = Pick<Realm, "entityManager" | "records">;

interface PlayerStepOutcome {
  landed: boolean;
  enteredWater: boolean;
  endedGrounded: boolean;
  groundZ: number;
  wildlifeContactId?: number;
}

/**
 * Expanded AABB margin for mount detection. The 3D collision system prevents
 * the player from passing through the cow during jumps (Z-ranges overlap on
 * the ground), so the player lands adjacent to the cow rather than overlapping.
 * Expanding by a few pixels detects nearby rideable entities on landing.
 */
const MOUNT_MARGIN = 4;

/** Dismount the player from their current mount (or vehicle seat). */
export function dismountPlayer(
  realm: Pick<Realm, "vehicles" | "entityManager">,
  session: PlayerSession,
): void {
  if (realm.vehicles.get(session)) {
    realm.vehicles.exit(session);
    return;
  }
  const mountId = session.gameplaySession.mountId;
  if (mountId === null) return;

  const mount = realm.entityManager.entities.find((e) => e.id === mountId);

  // Clear parent relationship
  Reflect.set(session.player, "parentId", undefined);
  Reflect.set(session.player, "localOffsetX", undefined);
  Reflect.set(session.player, "localOffsetY", undefined);
  session.gameplaySession.lastDismountedId = mountId;
  session.gameplaySession.mountId = null;

  // Dismount at current position (player was parented to mount)
  if (mount) releaseMount(mount);

  // Hop off from riding height — wz is already tracked by resolveParentedPositions
  session.player.jumpZ = (session.player.wz ?? 0) - (session.player.groundZ ?? 0);
  setVerticalVelocity(session.player, JUMP_VELOCITY * 0.5);
  delete session.player.noShadow;
}

function releaseMount(mount: Entity): void {
  setFaunaRidden(mount, false);
  // Restore mount AI
  if (mount.wanderAI) {
    mount.wanderAI.state = "idle";
    mount.wanderAI.timer = 1.0;
  }
  if (mount.velocity) {
    mount.velocity.vx = 0;
    mount.velocity.vy = 0;
  }
  if (mount.sprite) mount.sprite.moving = false;
}

/** Reattach a saved rider to its persistent mount when both loaded together. */
export function restoreSavedMount(
  realm: Pick<Realm, "records">,
  session: PlayerSession,
  saved: SavedPlayerData | null | undefined,
): void {
  const mounted = saved?.mount ? realm.records?.byId.get(saved.mount.id) : undefined;
  if (!mounted || "isProp" in mounted || !saved?.mount) return;
  const player = session.player;
  player.parentId = mounted.id;
  player.localOffsetX = saved.mount.offsetX;
  player.localOffsetY = saved.mount.offsetY;
  player.position = {
    wx: mounted.position.wx + saved.mount.offsetX,
    wy: mounted.position.wy + saved.mount.offsetY,
  };
  player.wz = saved.mount.wz;
  player.jumpZ = saved.mount.jumpZ;
  session.gameplaySession.mountId = mounted.id;
  if (mounted.wanderAI) mounted.wanderAI.state = "ridden";
  setFaunaRidden(mounted, true);
  player.noShadow = true;
}

/** Save a supported respawn pose above dry ground or an elevated deck. */
export function updateLastSafePosition(
  session: PlayerSession,
  onWater: (entity: Entity) => boolean,
): void {
  const p = session.player;
  if (p.jumpVZ !== undefined) return;
  if (onWater(p)) return;
  session.gameplaySession.lastSafePosition = {
    wx: p.position.wx,
    wy: p.position.wy,
    wz: p.wz ?? 0,
  };
}

export function handlePlayerStepOutcome(
  realm: RidingRealm,
  session: PlayerSession,
  outcome: PlayerStepOutcome,
  getHeight: (tx: number, ty: number) => number,
): void {
  if (!outcome.landed && !outcome.enteredWater) return;
  if (outcome.wildlifeContactId !== undefined) {
    landOnWildlife(realm, session, outcome.wildlifeContactId);
    return;
  }
  if (outcome.enteredWater) {
    respawnFromWater(session, getHeight);
    return;
  }

  if (!outcome.endedGrounded) return;

  if (session.gameplaySession.mountId === null) {
    tryMountOnLanding(realm, session);
  }
}

function landOnWildlife(realm: RidingRealm, session: PlayerSession, contactId: number): void {
  const animal = realm.entityManager.byId.get(contactId);
  if (!animal) return;
  if (session.gameplaySession.mountId === null && animal.tags?.has("rideable")) {
    tryMountOnLanding(realm, session, animal.id);
    if (session.gameplaySession.mountId !== null) {
      realm.records?.changed(animal);
      return;
    }
  }
  // The contact id is only recorded for wildlife supports (see RealmPhysics.finish).
  startleWildlife(animal, session.player.position);
  realm.records?.changed(animal);
}

function respawnFromWater(
  session: PlayerSession,
  getHeight: (tx: number, ty: number) => number,
): void {
  const p = session.player;
  const safe = session.gameplaySession.lastSafePosition;
  if (safe) {
    teleportBody(p, {
      wx: safe.wx,
      wy: safe.wy,
      wz: safe.wz ?? getSurfaceZ(safe.wx, safe.wy, getHeight),
    });
  } else {
    delete p.jumpVZ;
    delete p.jumpZ;
  }
  // Brief invincibility flash so the respawn is visible.
  session.gameplaySession.invincibilityTimer = 0.75;
}

/** Check for rideable entities under the player on landing; mount if found. */
function tryMountOnLanding(realm: RidingRealm, session: PlayerSession, contactId?: number): void {
  const player = session.player;
  if (!player.collider) return;

  const playerBox = getEntityAABB(player.position, player.collider);
  const expandedBox = {
    left: playerBox.left - MOUNT_MARGIN,
    top: playerBox.top - MOUNT_MARGIN,
    right: playerBox.right + MOUNT_MARGIN,
    bottom: playerBox.bottom + MOUNT_MARGIN,
  };

  const skipId = session.gameplaySession.lastDismountedId;
  session.gameplaySession.lastDismountedId = null;

  const mount = realm.entityManager.entities.find(
    (entity) =>
      entity.id !== player.id &&
      entity.id !== skipId && // just dismounted — don't re-mount
      canMount(entity, contactId) &&
      !!entity.collider &&
      aabbsOverlap(expandedBox, getEntityAABB(entity.position, entity.collider)),
  );
  if (mount) mountOn(session, mount);
}

function canMount(entity: Entity, contactId: number | undefined): boolean {
  if (!entity.tags?.has("rideable")) return false;
  // Wildlife mounts require an actual landing on their back, not nearby ground.
  if (entity.fauna && entity.id !== contactId) return false;
  return entity.wanderAI?.state !== "ridden"; // already ridden
}

function mountOn(session: PlayerSession, entity: Entity): void {
  const player = session.player;
  session.gameplaySession.mountId = entity.id;
  player.parentId = entity.id;
  player.localOffsetX = 0;
  player.localOffsetY = 0;
  // Snap player position to mount immediately (don't wait for
  // resolveParentedPositions next tick) — avoids camera jump
  player.position.wx = entity.position.wx;
  player.position.wy = entity.position.wy;
  // Visual lift: set wz above mount so the renderer elevates the
  // player onto the mount's back. Use the mount's wz (not player.groundZ
  // which may include the cow's own walkable surface height, double-counting).
  const rideHeight = entity.collider?.physicalHeight ?? 10;
  player.wz = (entity.wz ?? 0) + rideHeight;
  player.jumpZ = rideHeight;

  Reflect.set(player, "jumpVZ", undefined);
  player.noShadow = true; // cow's shadow is bigger
  if (entity.wanderAI) {
    entity.wanderAI.state = "ridden";
    entity.wanderAI.following = false;
  }
  setFaunaRidden(entity, true);
  if (entity.velocity) {
    entity.velocity.vx = 0;
    entity.velocity.vy = 0;
  }
  if (player.velocity) {
    player.velocity.vx = 0;
    player.velocity.vy = 0;
  }
  // Reset player sprite to idle so the walking animation doesn't persist
  if (player.sprite) {
    player.sprite.moving = false;
    player.sprite.frameCol = 0;
    player.sprite.animTimer = 0;
  }
}
