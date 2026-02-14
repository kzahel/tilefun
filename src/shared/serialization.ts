import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkSnapshot, EntitySnapshot, PropSnapshot } from "./protocol.js";

// ---- Entity ----

function serializeCollider(c: {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  solid?: boolean;
  clientSolid?: boolean;
}) {
  const result: EntitySnapshot["collider"] = {
    offsetX: c.offsetX,
    offsetY: c.offsetY,
    width: c.width,
    height: c.height,
  };
  if (c.solid !== undefined) result.solid = c.solid;
  if (c.clientSolid !== undefined) result.clientSolid = c.clientSolid;
  return result;
}

function serializeWanderAI(
  ai: NonNullable<Entity["wanderAI"]>,
): NonNullable<EntitySnapshot["wanderAI"]> {
  const result: NonNullable<EntitySnapshot["wanderAI"]> = {
    state: ai.state,
    timer: ai.timer,
    dirX: ai.dirX,
    dirY: ai.dirY,
    idleMin: ai.idleMin,
    idleMax: ai.idleMax,
    walkMin: ai.walkMin,
    walkMax: ai.walkMax,
    speed: ai.speed,
    directional: ai.directional,
  };
  if (ai.chaseRange !== undefined) result.chaseRange = ai.chaseRange;
  if (ai.chaseSpeed !== undefined) result.chaseSpeed = ai.chaseSpeed;
  if (ai.hostile !== undefined) result.hostile = ai.hostile;
  if (ai.following !== undefined) result.following = ai.following;
  if (ai.followDistance !== undefined) result.followDistance = ai.followDistance;
  if (ai.followLeash !== undefined) result.followLeash = ai.followLeash;
  if (ai.befriendable !== undefined) result.befriendable = ai.befriendable;
  return result;
}

export function serializeEntity(e: Entity): EntitySnapshot {
  const result: EntitySnapshot = {
    id: e.id,
    type: e.type,
    position: { wx: e.position.wx, wy: e.position.wy },
    velocity: e.velocity ? { vx: e.velocity.vx, vy: e.velocity.vy } : null,
    sprite: e.sprite
      ? {
          sheetKey: e.sprite.sheetKey,
          frameCol: e.sprite.frameCol,
          frameRow: e.sprite.frameRow,
          animTimer: e.sprite.animTimer,
          frameDuration: e.sprite.frameDuration,
          frameCount: e.sprite.frameCount,
          direction: e.sprite.direction,
          moving: e.sprite.moving,
          spriteWidth: e.sprite.spriteWidth,
          spriteHeight: e.sprite.spriteHeight,
        }
      : null,
    collider: e.collider ? serializeCollider(e.collider) : null,
    wanderAI: e.wanderAI ? serializeWanderAI(e.wanderAI) : null,
  };
  if (result.sprite && e.sprite?.flipX !== undefined) result.sprite.flipX = e.sprite.flipX;
  if (e.sortOffsetY !== undefined) result.sortOffsetY = e.sortOffsetY;
  if (e.flashHidden !== undefined) result.flashHidden = e.flashHidden;
  if (e.noShadow !== undefined) result.noShadow = e.noShadow;
  if (e.deathTimer !== undefined) result.deathTimer = e.deathTimer;
  return result;
}

export function deserializeEntity(s: EntitySnapshot): Entity {
  const result: Entity = {
    id: s.id,
    type: s.type,
    position: { wx: s.position.wx, wy: s.position.wy },
    velocity: s.velocity ? { vx: s.velocity.vx, vy: s.velocity.vy } : null,
    sprite: s.sprite
      ? {
          sheetKey: s.sprite.sheetKey,
          frameCol: s.sprite.frameCol,
          frameRow: s.sprite.frameRow,
          animTimer: s.sprite.animTimer,
          frameDuration: s.sprite.frameDuration,
          frameCount: s.sprite.frameCount,
          direction: s.sprite.direction,
          moving: s.sprite.moving,
          spriteWidth: s.sprite.spriteWidth,
          spriteHeight: s.sprite.spriteHeight,
        }
      : null,
    collider: s.collider ? deserializeCollider(s.collider) : null,
    wanderAI: s.wanderAI ? deserializeWanderAI(s.wanderAI) : null,
  };
  if (result.sprite && s.sprite?.flipX !== undefined) result.sprite.flipX = s.sprite.flipX;
  if (s.sortOffsetY !== undefined) result.sortOffsetY = s.sortOffsetY;
  if (s.flashHidden !== undefined) result.flashHidden = s.flashHidden;
  if (s.noShadow !== undefined) result.noShadow = s.noShadow;
  if (s.deathTimer !== undefined) result.deathTimer = s.deathTimer;
  return result;
}

function deserializeCollider(
  c: NonNullable<EntitySnapshot["collider"]>,
): NonNullable<Entity["collider"]> {
  const result: NonNullable<Entity["collider"]> = {
    offsetX: c.offsetX,
    offsetY: c.offsetY,
    width: c.width,
    height: c.height,
  };
  if (c.solid !== undefined) result.solid = c.solid;
  if (c.clientSolid !== undefined) result.clientSolid = c.clientSolid;
  return result;
}

function deserializeWanderAI(
  ai: NonNullable<EntitySnapshot["wanderAI"]>,
): NonNullable<Entity["wanderAI"]> {
  const result: NonNullable<Entity["wanderAI"]> = {
    state: ai.state as "idle" | "walking" | "chasing" | "following",
    timer: ai.timer,
    dirX: ai.dirX,
    dirY: ai.dirY,
    idleMin: ai.idleMin,
    idleMax: ai.idleMax,
    walkMin: ai.walkMin,
    walkMax: ai.walkMax,
    speed: ai.speed,
    directional: ai.directional,
  };
  if (ai.chaseRange !== undefined) result.chaseRange = ai.chaseRange;
  if (ai.chaseSpeed !== undefined) result.chaseSpeed = ai.chaseSpeed;
  if (ai.hostile !== undefined) result.hostile = ai.hostile;
  if (ai.following !== undefined) result.following = ai.following;
  if (ai.followDistance !== undefined) result.followDistance = ai.followDistance;
  if (ai.followLeash !== undefined) result.followLeash = ai.followLeash;
  if (ai.befriendable !== undefined) result.befriendable = ai.befriendable;
  return result;
}

// ---- Prop ----

export function serializeProp(p: Prop): PropSnapshot {
  return {
    id: p.id,
    type: p.type,
    position: { wx: p.position.wx, wy: p.position.wy },
    sprite: {
      sheetKey: p.sprite.sheetKey,
      frameCol: p.sprite.frameCol,
      frameRow: p.sprite.frameRow,
      spriteWidth: p.sprite.spriteWidth,
      spriteHeight: p.sprite.spriteHeight,
    },
    collider: p.collider
      ? {
          offsetX: p.collider.offsetX,
          offsetY: p.collider.offsetY,
          width: p.collider.width,
          height: p.collider.height,
        }
      : null,
    walls: p.walls
      ? p.walls.map((w) => ({
          offsetX: w.offsetX,
          offsetY: w.offsetY,
          width: w.width,
          height: w.height,
        }))
      : null,
  };
}

export function deserializeProp(s: PropSnapshot): Prop {
  return {
    id: s.id,
    type: s.type,
    position: { wx: s.position.wx, wy: s.position.wy },
    sprite: {
      sheetKey: s.sprite.sheetKey,
      frameCol: s.sprite.frameCol,
      frameRow: s.sprite.frameRow,
      spriteWidth: s.sprite.spriteWidth,
      spriteHeight: s.sprite.spriteHeight,
    },
    collider: s.collider
      ? {
          offsetX: s.collider.offsetX,
          offsetY: s.collider.offsetY,
          width: s.collider.width,
          height: s.collider.height,
        }
      : null,
    walls: s.walls
      ? s.walls.map((w) => ({
          offsetX: w.offsetX,
          offsetY: w.offsetY,
          width: w.width,
          height: w.height,
        }))
      : null,
    isProp: true,
  };
}

// ---- Chunk ----

export function serializeChunk(cx: number, cy: number, chunk: Chunk): ChunkSnapshot {
  return {
    cx,
    cy,
    revision: chunk.revision,
    subgrid: Array.from(chunk.subgrid),
    roadGrid: Array.from(chunk.roadGrid),
    heightGrid: Array.from(chunk.heightGrid),
    terrain: Array.from(chunk.terrain),
    detail: Array.from(chunk.detail),
    blendBase: Array.from(chunk.blendBase),
    blendLayers: Array.from(chunk.blendLayers),
    collision: Array.from(chunk.collision),
  };
}

export function applyChunkSnapshot(chunk: Chunk, s: ChunkSnapshot): void {
  chunk.subgrid.set(s.subgrid);
  chunk.roadGrid.set(s.roadGrid);
  chunk.heightGrid.set(s.heightGrid);
  chunk.terrain.set(s.terrain);
  chunk.detail.set(s.detail);
  chunk.blendBase.set(s.blendBase);
  chunk.blendLayers.set(s.blendLayers);
  chunk.collision.set(s.collision);
  chunk.revision = s.revision;
  chunk.dirty = true;
  chunk.autotileComputed = true;
}
