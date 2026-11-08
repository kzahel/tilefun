import { THROW_ANGLE, THROW_MAX_SPEED, THROW_MIN_SPEED } from "../config/constants.js";
import { createBall } from "../entities/Ball.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createProp, isPropType } from "../entities/PropFactories.js";
import { furnitureAsset, INTERIOR_WALL_TYPE } from "../interiors/GameplayInterior.js";
import { type compileGameplayRoom, validateRoomOccupancy } from "../interiors/GameplayRoom.js";
import { launchBody, setBodyPose, setHorizontalVelocity } from "../physics/PhysicalEdits.js";
import type { ClientMessage } from "../shared/protocol.js";
import { freshBallWork } from "../wildlife/ForageResources.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { dismountPlayer } from "./RealmRiding.js";

/** Realm members and private hooks the realm-scoped client commands use. */
export interface RealmCommandContext {
  readonly realm: Pick<
    Realm,
    | "worldAPI"
    | "vehicles"
    | "entityManager"
    | "physicsScene"
    | "ownedBalls"
    | "terrainEditor"
    | "saveManager"
    | "propManager"
    | "interior"
    | "roomState"
    | "vehicleRegistry"
    | "flush"
    | "invalidateAllChunks"
  >;
  random(): number;
  roomGeometry(): ReturnType<typeof compileGameplayRoom> | null;
  editorCursorsChanged(): void;
}

type RealmCommandType =
  | "player-input"
  | "player-interact"
  | "vehicle-horn"
  | "vehicle-emergency"
  | "throw-ball"
  | "edit-terrain-tile"
  | "edit-terrain-subgrid"
  | "edit-terrain-corner"
  | "edit-road"
  | "edit-elevation"
  | "edit-spawn"
  | "edit-delete-entity"
  | "edit-move-prop"
  | "edit-delete-prop"
  | "edit-clear-terrain"
  | "edit-clear-roads"
  | "set-editor-mode"
  | "editor-cursor"
  | "set-debug"
  | "visible-range"
  | "flush"
  | "invalidate-all-chunks";
type RealmCommandOf<K extends RealmCommandType> = Extract<ClientMessage, { type: K }>;
type RealmCommand = RealmCommandOf<RealmCommandType>;
type RealmCommandHandler<K extends RealmCommandType> = (
  ctx: RealmCommandContext,
  session: PlayerSession,
  msg: RealmCommandOf<K>,
) => void;

/** Outdoor terrain edits that an interior realm ignores. */
const OUTDOOR_TERRAIN_EDITS: ReadonlySet<ClientMessage["type"]> = new Set([
  "edit-terrain-tile",
  "edit-terrain-subgrid",
  "edit-terrain-corner",
  "edit-road",
  "edit-elevation",
  "edit-clear-terrain",
  "edit-clear-roads",
]);

const COMMANDS: { [K in RealmCommandType]: RealmCommandHandler<K> } = {
  "player-input": (_ctx, session, msg) => {
    session.doorIntent = { dx: msg.dx, dy: msg.dy, at: Date.now() };
    if (session.editorEnabled) {
      session.lastProcessedInputSeq = msg.seq;
      return;
    }
    session.inputQueue.push({
      dx: msg.dx,
      dy: msg.dy,
      sprinting: msg.sprinting,
      jump: msg.jump,
      ...(msg.reversing === true ? { reversing: true } : {}),
      ...(msg.relativeDriving === true ? { relativeDriving: true } : {}),
      seq: msg.seq,
      ...(msg.jumpPressed !== undefined ? { jumpPressed: msg.jumpPressed } : {}),
    });
  },
  "player-interact": ({ realm }, _session, msg) =>
    realm.worldAPI.events.emit("player-interact", { wx: msg.wx, wy: msg.wy }),
  "vehicle-horn": ({ realm }, session, msg) => realm.vehicles.honk(session, msg.active),
  "vehicle-emergency": ({ realm }, session, msg) => realm.vehicles.emergency(session, msg.action),
  "throw-ball": (ctx, session, msg) => throwBall(ctx, session, msg),
  "edit-terrain-tile": ({ realm }, _session, msg) =>
    realm.terrainEditor.applyTileEdit(
      msg.tx,
      msg.ty,
      msg.terrainId,
      msg.paintMode,
      msg.bridgeDepth,
    ),
  "edit-terrain-subgrid": ({ realm }, _session, msg) =>
    realm.terrainEditor.applySubgridEdit(
      msg.gsx,
      msg.gsy,
      msg.terrainId,
      msg.paintMode,
      msg.bridgeDepth,
      msg.shape,
    ),
  "edit-terrain-corner": ({ realm }, _session, msg) =>
    realm.terrainEditor.applyCornerEdit(
      msg.gsx,
      msg.gsy,
      msg.terrainId,
      msg.paintMode,
      msg.bridgeDepth,
    ),
  "edit-road": ({ realm }, _session, msg) =>
    realm.terrainEditor.applyRoadEdit(msg.tx, msg.ty, msg.roadType, msg.paintMode),
  "edit-elevation": ({ realm }, _session, msg) =>
    realm.terrainEditor.applyElevationEdit(msg.tx, msg.ty, msg.height, msg.gridSize),
  "edit-spawn": (ctx, session, msg) => {
    if (msg.entityType.startsWith("vehicle-v1:") && !session.editorEnabled) return;
    spawn(ctx, msg.entityType, msg.wx, msg.wy, msg.paintSchemeId);
  },
  "edit-delete-entity": ({ realm }, session, msg) => {
    if (msg.entityId !== session.player.id) {
      realm.entityManager.remove(msg.entityId);
      realm.saveManager?.markMetaDirty();
    }
  },
  "edit-move-prop": (ctx, _session, msg) => {
    if (ctx.realm.interior && !interiorMoveAllowed(ctx, msg)) return;
    ctx.realm.propManager.move(msg.propId, msg.wx, msg.wy);
  },
  "edit-delete-prop": ({ realm }, _session, msg) => {
    if (realm.propManager.props.find((p) => p.id === msg.propId)?.type === INTERIOR_WALL_TYPE)
      return;
    realm.propManager.remove(msg.propId);
    realm.saveManager?.markMetaDirty();
  },
  "edit-clear-terrain": ({ realm }, _session, msg) =>
    realm.terrainEditor.clearAllTerrain(msg.terrainId),
  "edit-clear-roads": ({ realm }) => realm.terrainEditor.clearAllRoads(),
  "set-editor-mode": (ctx, session, msg) => {
    session.editorEnabled = msg.enabled;
    if (!msg.enabled) session.editorCursor = null;
    ctx.editorCursorsChanged();
    // Auto-dismount when entering editor mode
    if (msg.enabled && session.gameplaySession.mountId !== null) {
      dismountPlayer(ctx.realm, session);
    }
    if (msg.enabled) {
      session.lastProcessedInputSeq =
        session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
      session.inputQueue.length = 0;

      setHorizontalVelocity(session.player, { vx: 0, vy: 0 });
    }
  },
  "editor-cursor": (ctx, session, msg) => {
    session.editorCursor = {
      tileX: msg.tileX,
      tileY: msg.tileY,
      editorTab: msg.editorTab,
      brushMode: msg.brushMode,
    };
    ctx.editorCursorsChanged();
  },
  "set-debug": (_ctx, session, msg) => {
    session.debugPaused = msg.paused;
  },
  "visible-range": (_ctx, session, msg) => {
    session.visibleRange = {
      minCx: msg.minCx,
      minCy: msg.minCy,
      maxCx: msg.maxCx,
      maxCy: msg.maxCy,
    };
    // Don't call updateVisibleChunks here — it uses a single session's
    // range which unloads chunks that OTHER sessions need, creating
    // invisible collision walls for far-away players. The tick method
    // already computes the union of all sessions' visible ranges and
    // calls updateVisibleChunks with that.
  },
  flush: ({ realm }) => realm.flush(),
  "invalidate-all-chunks": ({ realm }) => realm.invalidateAllChunks(),
};

function isRealmCommand(msg: ClientMessage): msg is RealmCommand {
  return Object.hasOwn(COMMANDS, msg.type);
}

function runCommand<K extends RealmCommandType>(
  ctx: RealmCommandContext,
  session: PlayerSession,
  type: K,
  msg: RealmCommandOf<K>,
): void {
  COMMANDS[type](ctx, session, msg);
}

/** Handle a realm-scoped client message; GameServer handles the other types first. */
export function handleRealmCommand(
  ctx: RealmCommandContext,
  session: PlayerSession,
  msg: ClientMessage,
): void {
  if (ctx.realm.interior && OUTDOOR_TERRAIN_EDITS.has(msg.type)) return;
  if (isRealmCommand(msg)) runCommand(ctx, session, msg.type, msg);
}

function roomOccupants(ctx: RealmCommandContext): Entity[] {
  return ctx.realm.entityManager.entities.filter((e) => e.type === "player" || e.resident);
}

function interiorMoveAllowed(
  ctx: RealmCommandContext,
  msg: RealmCommandOf<"edit-move-prop">,
): boolean {
  const { propManager } = ctx.realm;
  const prop = propManager.props.find((p) => p.id === msg.propId);
  if (!prop || prop.type === INTERIOR_WALL_TYPE) return false;
  if (!ctx.realm.roomState) return false;
  const room = ctx.roomGeometry();
  if (!room) return false;
  try {
    const proposed = propManager.props.map((p) =>
      p.id === msg.propId ? { ...p, position: { wx: msg.wx, wy: msg.wy } } : p,
    );
    validateRoomOccupancy(room, proposed, roomOccupants(ctx));
  } catch {
    return false;
  }
  return true;
}

/** A throw with finite values, force 0..1 and a unit direction (every client path). */
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

function throwBall(
  ctx: RealmCommandContext,
  session: PlayerSession,
  msg: RealmCommandOf<"throw-ball">,
): void {
  const { realm } = ctx;
  if (!isValidThrow(msg) || realm.vehicles.get(session)) return;
  const player = session.player;
  const speed = THROW_MIN_SPEED + msg.force * (THROW_MAX_SPEED - THROW_MIN_SPEED);
  // Add random jitter so consecutive throws spread out
  const speedJitter = 1 + (ctx.random() - 0.5) * 0.15; // ±7.5% speed
  const angleJitter = (ctx.random() - 0.5) * 0.18; // ±~5° direction
  const baseAngle = Math.atan2(msg.dirY, msg.dirX) + angleJitter;
  const jitteredSpeed = speed * speedJitter;
  const xySpeed = jitteredSpeed * Math.cos(THROW_ANGLE);
  const zSpeed = jitteredSpeed * Math.sin(THROW_ANGLE);
  const owner = session.profileId || session.clientId;
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
    return;
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
  if (!realm.ownedBalls.admit(owner, ball)) return;
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

function spawn(
  ctx: RealmCommandContext,
  entityType: string,
  wx: number,
  wy: number,
  paintSchemeId?: string,
): void {
  const { realm } = ctx;
  let changed = false;
  if (realm.interior && (!furnitureAsset(entityType) || !realm.roomState)) return;
  if (entityType.startsWith("vehicle-v1:")) {
    changed = !!realm.vehicleRegistry?.place(
      entityType.slice(11),
      wx,
      wy,
      undefined,
      paintSchemeId,
    );
  } else if (isPropType(entityType)) {
    changed = spawnProp(ctx, entityType, wx, wy);
  } else {
    const factory = ENTITY_FACTORIES[entityType];
    if (factory) {
      realm.entityManager.spawn(factory(wx, wy));
      changed = true;
    }
  }
  if (changed) {
    realm.saveManager?.markMetaDirty();
  }
}

function spawnProp(ctx: RealmCommandContext, entityType: string, wx: number, wy: number): boolean {
  const { realm } = ctx;
  const prop = createProp(entityType, wx, wy);
  const room = ctx.roomGeometry();
  if (realm.interior && room) {
    try {
      validateRoomOccupancy(room, [...realm.propManager.props, prop], roomOccupants(ctx));
    } catch {
      return false;
    }
  }
  // Skip if the new prop's collider would overlap an existing prop
  if (
    prop.collider &&
    realm.propManager.overlapsAnyProp(getEntityAABB(prop.position, prop.collider))
  )
    return false;
  realm.propManager.add(prop);
  return true;
}
