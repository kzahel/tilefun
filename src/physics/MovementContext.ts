import type { AABB } from "../entities/collision.js";

/**
 * Abstracts world queries for player movement physics (Quake pmove_t pattern).
 * Server and client construct different implementations:
 * - Server: queries SpatialHash + PropManager + live entities (checks `solid`)
 * - Client: iterates flat snapshot arrays (checks `clientSolid`)
 */
export interface MovementContext {
  /** Tile collision flags at the given tile coords. */
  getCollision(tx: number, ty: number): number;
  /** Tile elevation at the given tile coords. */
  getHeight(tx: number, ty: number): number;
  /** Whether the AABB overlaps any blocking entity. */
  isEntityBlocked(aabb: AABB): boolean;
  /** Whether the AABB overlaps any prop wall/collider. Z params enable Z-axis filtering. */
  isPropBlocked(aabb: AABB, entityWz: number, entityHeight: number): boolean;
  /** When true, skip all collision (debug noclip). */
  noclip: boolean;
  /** Computed blendBase TerrainId at tile coords. For surface friction lookup. */
  getTerrainAt?(tx: number, ty: number): number;
  /** Road type at tile coords. For surface friction lookup. */
  getRoadAt?(tx: number, ty: number): number;
}
