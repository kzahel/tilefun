import type { Entity } from "../entities/Entity.js";
import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import type { Prop } from "../entities/Prop.js";
import { getWallsForPropType } from "../entities/PropFactories.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkSnapshot, EntitySnapshot, PropSnapshot } from "./protocol.js";

// ---- Entity ----

export function serializeEntity(e: Entity): EntitySnapshot {
  const def = ENTITY_DEFS[e.type];

  // Extract only dynamic sprite state (animTimer/frameCol omitted — client-side animation)
  let spriteState: SpriteState | null = null;
  if (e.sprite) {
    spriteState = {
      direction: e.sprite.direction,
      moving: e.sprite.moving,
      frameRow: e.sprite.frameRow,
    };
    if (e.sprite.flipX !== undefined) spriteState.flipX = e.sprite.flipX;
    // Only include frameDuration when it differs from the def
    if (def?.sprite && e.sprite.frameDuration !== def.sprite.frameDuration) {
      spriteState.frameDuration = e.sprite.frameDuration;
    }
  }

  // Extract only dynamic AI state (timer omitted — only needed server-side)
  let wanderAIState: WanderAIState | null = null;
  if (e.wanderAI) {
    wanderAIState = {
      state: e.wanderAI.state,
      dirX: e.wanderAI.dirX,
      dirY: e.wanderAI.dirY,
    };
    if (e.wanderAI.following !== undefined) wanderAIState.following = e.wanderAI.following;
  }

  const result: EntitySnapshot = {
    id: e.id,
    type: e.type,
    position: { ...e.position },
    velocity: e.velocity ? { ...e.velocity } : null,
    spriteState,
    wanderAIState,
  };
  if (e.flashHidden !== undefined) result.flashHidden = e.flashHidden;
  if (e.noShadow !== undefined) result.noShadow = e.noShadow;
  if (e.deathTimer !== undefined) result.deathTimer = e.deathTimer;
  if (e.jumpZ !== undefined) result.jumpZ = e.jumpZ;
  if (e.jumpVZ !== undefined) result.jumpVZ = e.jumpVZ;
  if (e.wz !== undefined) result.wz = e.wz;
  if (e.parentId !== undefined) result.parentId = e.parentId;
  if (e.localOffsetX !== undefined) result.localOffsetX = e.localOffsetX;
  if (e.localOffsetY !== undefined) result.localOffsetY = e.localOffsetY;
  return result;
}

export function deserializeEntity(s: EntitySnapshot): Entity {
  const def = ENTITY_DEFS[s.type];

  // Reconstruct full SpriteComponent by merging def + dynamic state.
  // animTimer/frameCol default to 0 — client-side animation will overwrite.
  let sprite: Entity["sprite"] = null;
  if (s.spriteState && def?.sprite) {
    sprite = {
      sheetKey: def.sprite.sheetKey,
      spriteWidth: def.sprite.spriteWidth,
      spriteHeight: def.sprite.spriteHeight,
      frameCount: def.sprite.frameCount,
      frameDuration: s.spriteState.frameDuration ?? def.sprite.frameDuration,
      frameCol: 0,
      frameRow: s.spriteState.frameRow,
      animTimer: 0,
      direction: s.spriteState.direction,
      moving: s.spriteState.moving,
    };
    if (def.sprite.drawOffsetY !== undefined) sprite.drawOffsetY = def.sprite.drawOffsetY;
    if (s.spriteState.flipX !== undefined) sprite.flipX = s.spriteState.flipX;
  }

  // Reconstruct full WanderAIComponent by merging def + dynamic state.
  // Timer defaults to 0 — only needed server-side.
  let wanderAI: Entity["wanderAI"] = null;
  if (s.wanderAIState && def?.wanderAI) {
    wanderAI = {
      state: s.wanderAIState.state as "idle" | "walking" | "chasing" | "following" | "ridden",
      timer: 0,
      dirX: s.wanderAIState.dirX,
      dirY: s.wanderAIState.dirY,
      idleMin: def.wanderAI.idleMin,
      idleMax: def.wanderAI.idleMax,
      walkMin: def.wanderAI.walkMin,
      walkMax: def.wanderAI.walkMax,
      speed: def.wanderAI.speed,
      directional: def.wanderAI.directional,
    };
    if (s.wanderAIState.following !== undefined) wanderAI.following = s.wanderAIState.following;
    if (def.wanderAI.chaseRange !== undefined) wanderAI.chaseRange = def.wanderAI.chaseRange;
    if (def.wanderAI.chaseSpeed !== undefined) wanderAI.chaseSpeed = def.wanderAI.chaseSpeed;
    if (def.wanderAI.hostile !== undefined) wanderAI.hostile = def.wanderAI.hostile;
    if (def.wanderAI.befriendable !== undefined) wanderAI.befriendable = def.wanderAI.befriendable;
    if (def.wanderAI.followDistance !== undefined)
      wanderAI.followDistance = def.wanderAI.followDistance;
    if (def.wanderAI.followLeash !== undefined) wanderAI.followLeash = def.wanderAI.followLeash;
    if (def.wanderAI.rideSpeed !== undefined) wanderAI.rideSpeed = def.wanderAI.rideSpeed;
  }

  // Reconstruct collider from def (entirely static)
  const collider = def?.collider ? { ...def.collider } : null;

  const result: Entity = {
    id: s.id,
    type: s.type,
    position: { ...s.position },
    velocity: s.velocity ? { ...s.velocity } : null,
    sprite,
    collider,
    wanderAI,
  };
  // Static entity-level fields from def
  if (def?.sortOffsetY !== undefined) result.sortOffsetY = def.sortOffsetY;
  if (def?.weight !== undefined) result.weight = def.weight;
  // Dynamic entity-level fields from snapshot
  if (s.flashHidden !== undefined) result.flashHidden = s.flashHidden;
  if (s.noShadow !== undefined) result.noShadow = s.noShadow;
  if (s.deathTimer !== undefined) result.deathTimer = s.deathTimer;
  if (s.jumpZ !== undefined) result.jumpZ = s.jumpZ;
  if (s.jumpVZ !== undefined) result.jumpVZ = s.jumpVZ;
  if (s.wz !== undefined) result.wz = s.wz;
  if (s.parentId !== undefined) result.parentId = s.parentId;
  if (s.localOffsetX !== undefined) result.localOffsetX = s.localOffsetX;
  if (s.localOffsetY !== undefined) result.localOffsetY = s.localOffsetY;
  return result;
}

// ---- Prop ----

export function serializeProp(p: Prop): PropSnapshot {
  return {
    id: p.id,
    type: p.type,
    position: { ...p.position },
    sprite: { ...p.sprite },
    collider: p.collider ? { ...p.collider } : null,
  };
}

export function deserializeProp(s: PropSnapshot): Prop {
  return {
    id: s.id,
    type: s.type,
    position: { ...s.position },
    sprite: { ...s.sprite },
    collider: s.collider ? { ...s.collider } : null,
    walls: getWallsForPropType(s.type),
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
