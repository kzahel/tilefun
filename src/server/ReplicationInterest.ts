import { RENDER_DISTANCE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
import type { ChunkSnapshot } from "../shared/protocol.js";
import { serializeChunk } from "../shared/serialization.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import type { PlayerSession } from "./PlayerSession.js";

const BROADCAST_BUFFER_CHUNKS = 2;
// Collision context must cover the same interest as actors/props. A narrow
// viewport can include a whole train whose leading carriage is outside the
// render buffer; unknown terrain there would falsely block private replay.
const TERRAIN_BUFFER_CHUNKS = Math.max(RENDER_DISTANCE, BROADCAST_BUFFER_CHUNKS);

const grow = (r: ChunkRange, by: number): ChunkRange => ({
  minCx: r.minCx - by,
  minCy: r.minCy - by,
  maxCx: r.maxCx + by,
  maxCy: r.maxCy + by,
});
const inside = (r: ChunkRange, cx: number, cy: number) =>
  cx >= r.minCx && cx <= r.maxCx && cy >= r.minCy && cy <= r.maxCy;

function chunkCoords(key: string): [number, number] {
  const comma = key.indexOf(",");
  return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
}

/**
 * A replication stream's interest (226): its seats' visible ranges as a list of
 * rectangles, never their bounding box, so nothing between two distant seats is sent.
 */
export class StreamInterest {
  /** Actor and prop interest: each range with the broadcast buffer. */
  readonly actors: readonly ChunkRange[];
  /** Terrain interest: each range with the wider collision buffer. */
  private readonly terrain: readonly ChunkRange[];

  constructor(ranges: readonly ChunkRange[]) {
    this.actors = ranges.map((r) => grow(r, BROADCAST_BUFFER_CHUNKS));
    this.terrain = ranges.map((r) => grow(r, TERRAIN_BUFFER_CHUNKS));
  }

  coversTerrain(cx: number, cy: number): boolean {
    return this.terrain.some((r) => inside(r, cx, cy));
  }

  /** Changes whenever any seat's actor rectangle does. */
  get key(): string {
    return this.actors.map((r) => `${r.minCx},${r.minCy},${r.maxCx},${r.maxCy}`).join(";");
  }
}

/**
 * Ready terrain in the interest, and the chunks changed since `revisions` (which this
 * advances and prunes to the interest). Only sends already-ready terrain; never loads.
 */
export function interestChunks(
  world: World,
  interest: StreamInterest,
  revisions: Map<string, number>,
): { loadedChunkKeys: string[]; chunkUpdates: ChunkSnapshot[] } {
  const loadedChunkKeys: string[] = [];
  const chunkUpdates: ChunkSnapshot[] = [];
  for (const [key, chunk] of world.chunks.entries()) {
    const [cx, cy] = chunkCoords(key);
    if (!interest.coversTerrain(cx, cy)) continue;
    loadedChunkKeys.push(key);
    if (chunk.revision > (revisions.get(key) ?? -1)) {
      chunkUpdates.push(serializeChunk(cx, cy, chunk));
      revisions.set(key, chunk.revision);
    }
  }
  for (const key of revisions.keys()) {
    const [cx, cy] = chunkCoords(key);
    if (!interest.coversTerrain(cx, cy)) revisions.delete(key);
  }
  return { loadedChunkKeys, chunkUpdates };
}

/** Actors in the interest, every player in the realm, and each seat's body and mount, once each. */
export function interestEntities(
  entityManager: EntityManager,
  interest: StreamInterest,
  sessions: Iterable<PlayerSession>,
  seats: readonly PlayerSession[],
): Entity[] {
  const nearby: Entity[] = [];
  const seen = new Set<Entity>();
  const add = (entity: Entity | undefined) => {
    if (!entity || seen.has(entity)) return;
    seen.add(entity);
    nearby.push(entity);
  };
  for (const r of interest.actors)
    for (const entity of entityManager.spatialHash.queryRange(r.minCx, r.minCy, r.maxCx, r.maxCy))
      add(entity);
  // Co-op location markers need live players even outside viewport interest.
  // Sessions are realm-local, so players in other realms remain private.
  for (const other of sessions) add(other.player);
  for (const seat of seats) {
    add(seat.player);
    const mountId = seat.gameplaySession.mountId;
    if (mountId !== null) add(entityManager.entities.find((e) => e.id === mountId));
  }
  return nearby;
}

/** Props in the interest's actor rectangles, once each. */
export function interestProps(propManager: PropManager, interest: StreamInterest): Prop[] {
  const props = new Set<Prop>();
  for (const r of interest.actors)
    for (const prop of propManager.getPropsInChunkRange(r.minCx, r.minCy, r.maxCx, r.maxCy))
      props.add(prop);
  return [...props];
}
