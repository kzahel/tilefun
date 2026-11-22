import { THROW_ANGLE, THROW_MAX_SPEED, THROW_MIN_SPEED } from "../config/constants.js";
import { createBall } from "../entities/Ball.js";
import type { Entity } from "../entities/Entity.js";
import {
  canReachFarmTarget,
  type FarmAction,
  FEED_REACH,
  farmAction,
} from "../farming/FarmInteraction.js";
import { AXE, BALL, CORN, countHandUse, heldItem, STICK } from "../inventory/Inventory.js";
import { applyBallImpact } from "../physics/BallGameplay.js";
import { launchBody, setBodyPose } from "../physics/PhysicalEdits.js";
import type { ClientMessage } from "../shared/protocol.js";
import { freshBallWork } from "../wildlife/ForageResources.js";
import { performFarmAction } from "./FarmPlay.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { RealmCommandContext } from "./RealmCommands.js";

type UseMessage = Extract<ClientMessage, { type: "use-item" }>;

/** Seconds between swings, scatters and waves (throws keep their own charge time). */
const USE_COOLDOWN_MS = 250;
/** The swing's reach: a disc this far ahead of the player, with this radius. */
const SWING_AHEAD = 12;
const SWING_RADIUS = 14;
/** Bodies more than this far above or below the hand are out of a swing's reach. */
const SWING_HEIGHT = 12;
/** A batted ball: horizontal speed from a tap to a full charge, and its lift. */
const BAT_MIN_SPEED = 140;
const BAT_MAX_SPEED = 340;
const BAT_LIFT = 70;

const lastUse = new WeakMap<PlayerSession, number>();

/** A use with finite values, force 0..1 and a unit direction (every client path). */
export function isValidThrow(msg: { dirX: number; dirY: number; force: number }): boolean {
  const length = Math.hypot(msg.dirX, msg.dirY);
  return (
    [msg.dirX, msg.dirY, msg.force].every(Number.isFinite) &&
    msg.force >= 0 &&
    msg.force <= 1 &&
    length >= 0.001 &&
    length <= 1.001
  );
}

/**
 * The use button: the authority resolves what it does from the item in hand.
 * Ball throws, stick swings (batting balls and shooing animals), axe chops a
 * woodlot tree, corn scatters for hens, and empty hands wave. Every use bumps
 * the replicated hand counter so viewers play its pose.
 */
export function useItem(ctx: RealmCommandContext, session: PlayerSession, msg: UseMessage): void {
  const { realm } = ctx;
  const player = session.player;
  if (
    !isValidThrow(msg) ||
    realm.vehicles.get(session) ||
    session.editorEnabled ||
    session.debugPaused ||
    session.transitioning ||
    player.parentId !== undefined
  )
    return;
  const item = heldItem(session.gameplaySession.inventory);
  if (item === BALL) {
    if (throwBall(ctx, session, msg)) countHandUse(player);
    return;
  }
  const now = Date.now();
  if (now - (lastUse.get(session) ?? Number.NEGATIVE_INFINITY) < USE_COOLDOWN_MS) return;
  lastUse.set(session, now);
  const length = Math.hypot(msg.dirX, msg.dirY);
  const aim = { x: msg.dirX / length, y: msg.dirY / length };
  switch (item) {
    case STICK:
      swing(ctx, player, aim, msg.force, true);
      break;
    case AXE:
      swing(ctx, player, aim, msg.force, false);
      farmUse(ctx, session, "chop", aim, now);
      break;
    case CORN:
      // Scattering needs hens nearby; without them the hand stays still.
      if (!farmUse(ctx, session, "feed", aim, now)) return;
      break;
    default:
      break;
  }
  countHandUse(player);
}

/** Bodies inside the swing's disc ahead of the player. */
function swingTargets(ctx: RealmCommandContext, player: Entity, aim: { x: number; y: number }) {
  const cx = player.position.wx + aim.x * SWING_AHEAD;
  const cy = player.position.wy + aim.y * SWING_AHEAD;
  const z = player.wz ?? 0;
  return ctx.realm.entityManager.spatialHash
    .queryRadius(cx, cy, SWING_RADIUS)
    .filter(
      (e) =>
        e !== player &&
        e.type !== "player" &&
        e.parentId === undefined &&
        Math.abs((e.wz ?? 0) - z) <= SWING_HEIGHT &&
        Math.hypot(e.position.wx - cx, e.position.wy - cy) <= SWING_RADIUS,
    );
}

/** A stick bats loose balls; both tools shoo animals (and pop ghosts, as a ball does). */
function swing(
  ctx: RealmCommandContext,
  player: Entity,
  aim: { x: number; y: number },
  force: number,
  bats: boolean,
): void {
  const { entityManager } = ctx.realm;
  for (const target of swingTargets(ctx, player, aim)) {
    if (target.type === "ball") {
      if (bats) batBall(ctx, player, target, aim, force);
      continue;
    }
    applyBallImpact(entityManager, target, player, aim.x, aim.y);
  }
}

function batBall(
  ctx: RealmCommandContext,
  player: Entity,
  ball: Entity,
  aim: { x: number; y: number },
  force: number,
): void {
  const speed = BAT_MIN_SPEED + force * (BAT_MAX_SPEED - BAT_MIN_SPEED);
  const angle = Math.atan2(aim.y, aim.x) + (ctx.random() - 0.5) * 0.12;
  const owner = ball.workItem?.owner;
  if (owner) {
    // A batted toy is fair game for fetch again, like a thrown one.
    const order = ball.workItem?.ballOrder;
    ball.workItem = {
      ...freshBallWork(owner, player.position),
      ...(order !== undefined ? { ballOrder: order } : {}),
    };
  }
  delete ball.deathTimer;
  ball.ballThrowerId = player.id;
  launchBody(ball, {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    vz: BAT_LIFT + force * 60,
  });
}

/**
 * A held-item farm verb on the nearest matching actor ahead: the axe chops a
 * woodlot tree and corn scatters beside a hen. The farm rules (reach, timing,
 * cost) stay in `performFarmAction`; a refusal simply does nothing here.
 */
function farmUse(
  ctx: RealmCommandContext,
  session: PlayerSession,
  action: Extract<FarmAction, "chop" | "feed">,
  aim: { x: number; y: number },
  now: number,
): boolean {
  const { realm } = ctx;
  const player = session.player;
  if (realm.interior || now < session.doorArrivalUntil || realm.saveManager?.pressured)
    return false;
  const reach = action === "feed" ? FEED_REACH : undefined;
  let best: Entity | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const target of realm.entityManager.spatialHash.queryRadius(
    player.position.wx,
    player.position.wy,
    (reach ?? 32) + 16,
  )) {
    if (farmAction(target) !== action) continue;
    if (!canReachFarmTarget(player, target, reach)) continue;
    const dx = target.position.wx - player.position.wx;
    const dy = target.position.wy - player.position.wy;
    // Prefer what the player faces: distance, plus a penalty for targets behind.
    const score = Math.hypot(dx, dy) - (dx * aim.x + dy * aim.y) * 0.5;
    if (score < bestScore) {
      best = target;
      bestScore = score;
    }
  }
  if (!best) return false;
  try {
    performFarmAction(realm, session, { type: "farm-action", action, entityId: best.id }, now);
    return true;
  } catch {
    return false;
  }
}

/** Throw (or reuse a returned) owned ball; false when the hand is blocked. */
function throwBall(ctx: RealmCommandContext, session: PlayerSession, msg: UseMessage): boolean {
  const { realm } = ctx;
  const player = session.player;
  const speed = THROW_MIN_SPEED + msg.force * (THROW_MAX_SPEED - THROW_MIN_SPEED);
  // Add random jitter so consecutive throws spread out
  const speedJitter = 1 + (ctx.random() - 0.5) * 0.15; // ±7.5% speed
  const angleJitter = (ctx.random() - 0.5) * 0.18; // ±~5° direction
  const baseAngle = Math.atan2(msg.dirY, msg.dirX) + angleJitter;
  const jitteredSpeed = speed * speedJitter;
  const xySpeed = jitteredSpeed * Math.cos(THROW_ANGLE);
  const zSpeed = jitteredSpeed * Math.sin(THROW_ANGLE);
  const owner = session.persistId;
  const reusable = realm.entityManager.entities.find(
    (e) =>
      e.type === "ball" &&
      e.workItem?.returned &&
      e.workItem.owner === owner &&
      e.parentId === undefined &&
      Math.hypot(e.position.wx - player.position.wx, e.position.wy - player.position.wy) < 36,
  );
  const ball = reusable ?? createBall(player.position.wx, player.position.wy);
  const { x, y, z, radius } = throwOrigin(player, ball, baseAngle);
  if (realm.physicsScene && !realm.physicsScene.canPlaceSphere(x, y, z, radius, reusable?.id))
    return false;
  const position = {
    wx: x - (ball.collider?.offsetX ?? 0),
    wy: y - (ball.collider?.offsetY ?? 0) + (ball.collider?.height ?? 4) / 2,
  };
  setBodyPose(ball, position);
  const order = ball.workItem?.ballOrder;
  ball.workItem = {
    ...freshBallWork(owner, player.position),
    ...(order !== undefined ? { ballOrder: order } : {}),
  };
  if (!realm.ownedBalls.admit(owner, ball)) return false;
  delete ball.deathTimer;
  ball.ballThrowerId = player.id;
  setBodyPose(ball, { wz: z });
  launchBody(ball, {
    vx: Math.cos(baseAngle) * xySpeed,
    vy: Math.sin(baseAngle) * xySpeed,
    vz: zSpeed,
  });
  ball.jumpZ = 8;
  if (!reusable) realm.entityManager.spawn(ball);
  return true;
}

/**
 * Start beyond the fixed player hull instead of spawning a physical
 * projectile inside its thrower. A blocked hand cannot create a body in a wall.
 */
function throwOrigin(player: Entity, ball: Entity, baseAngle: number) {
  const radius = (ball.collider?.width ?? 4) / 2;
  const dx = Math.cos(baseAngle),
    dy = Math.sin(baseAngle),
    c = player.collider;
  const reach = c
    ? Math.min(
        (c.width / 2 + radius + 0.1) / Math.max(1e-6, Math.abs(dx)),
        (c.height / 2 + radius + 0.1) / Math.max(1e-6, Math.abs(dy)),
      )
    : radius + 1;
  const x = player.position.wx + (c?.offsetX ?? 0) + dx * reach;
  const y = player.position.wy + (c?.offsetY ?? 0) - (c?.height ?? 0) / 2 + dy * reach;
  const z = (player.wz ?? 0) + 8;
  return { x, y, z, radius };
}
