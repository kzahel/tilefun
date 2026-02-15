import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { getWallsForPropType } from "../entities/PropFactories.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkSnapshot, EntitySnapshot, PropSnapshot } from "./protocol.js";

// ---- Entity ----

export function serializeEntity(e: Entity): EntitySnapshot {
  const result: EntitySnapshot = {
    id: e.id,
    type: e.type,
    position: { ...e.position },
    velocity: e.velocity ? { ...e.velocity } : null,
    sprite: e.sprite ? { ...e.sprite } : null,
    collider: e.collider ? { ...e.collider } : null,
    wanderAI: e.wanderAI ? { ...e.wanderAI } : null,
  };
  if (e.sortOffsetY !== undefined) result.sortOffsetY = e.sortOffsetY;
  if (e.flashHidden !== undefined) result.flashHidden = e.flashHidden;
  if (e.noShadow !== undefined) result.noShadow = e.noShadow;
  if (e.deathTimer !== undefined) result.deathTimer = e.deathTimer;
  if (e.jumpZ !== undefined) result.jumpZ = e.jumpZ;
  if (e.jumpVZ !== undefined) result.jumpVZ = e.jumpVZ;
  if (e.wz !== undefined) result.wz = e.wz;
  if (e.parentId !== undefined) result.parentId = e.parentId;
  if (e.localOffsetX !== undefined) result.localOffsetX = e.localOffsetX;
  if (e.localOffsetY !== undefined) result.localOffsetY = e.localOffsetY;
  if (e.weight !== undefined) result.weight = e.weight;
  return result;
}

export function deserializeEntity(s: EntitySnapshot): Entity {
  const result: Entity = {
    id: s.id,
    type: s.type,
    position: { ...s.position },
    velocity: s.velocity ? { ...s.velocity } : null,
    sprite: s.sprite ? { ...s.sprite } : null,
    collider: s.collider ? { ...s.collider } : null,
    wanderAI: s.wanderAI ? { ...s.wanderAI } : null,
  };
  if (s.sortOffsetY !== undefined) result.sortOffsetY = s.sortOffsetY;
  if (s.flashHidden !== undefined) result.flashHidden = s.flashHidden;
  if (s.noShadow !== undefined) result.noShadow = s.noShadow;
  if (s.deathTimer !== undefined) result.deathTimer = s.deathTimer;
  if (s.jumpZ !== undefined) result.jumpZ = s.jumpZ;
  if (s.jumpVZ !== undefined) result.jumpVZ = s.jumpVZ;
  if (s.wz !== undefined) result.wz = s.wz;
  if (s.parentId !== undefined) result.parentId = s.parentId;
  if (s.localOffsetX !== undefined) result.localOffsetX = s.localOffsetX;
  if (s.localOffsetY !== undefined) result.localOffsetY = s.localOffsetY;
  if (s.weight !== undefined) result.weight = s.weight;
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
