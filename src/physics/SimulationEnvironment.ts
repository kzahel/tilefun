import { DEFAULT_PHYSICAL_HEIGHT } from "../config/constants.js";
import {
  type AABB,
  aabbOverlapsPropWalls,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { zRangesOverlap } from "./AABB3D.js";
import type { MovementContext } from "./MovementContext.js";
import { querySurfacePatch } from "./SurfacePatch.js";
import type { EntitySurface, PropSurface } from "./surfaceHeight.js";
import { terrainBaseZ } from "./TerrainExcavation.js";

export interface SimulationQuerySource {
  queryEntities: (aabb: AABB) => readonly Entity[];
  queryProps: (aabb: AABB) => readonly Prop[];
}

export interface CreateMovementContextOptions extends SimulationQuerySource {
  getCollision: (tx: number, ty: number) => number;
  getHeight: (tx: number, ty: number) => number;
  getTerrainAt?: (tx: number, ty: number) => number;
  getRoadAt?: (tx: number, ty: number) => number;
  movingEntity: Entity;
  excludeIds: ReadonlySet<number>;
  noclip: boolean;
  deferRoofCarry?: boolean;
  takeAirMomentumDt?: MovementContext["takeAirMomentumDt"];
  shouldEntityBlock?: (other: Entity) => boolean;
}

function defaultShouldEntityBlock(other: Entity): boolean {
  return other.collider?.solid !== false;
}

/**
 * Build shared movement context for both server simulation and client prediction.
 * World query strategy (spatial hash vs snapshots) is provided by callers.
 */
export function createMovementContext(options: CreateMovementContextOptions): MovementContext {
  const shouldEntityBlock = options.shouldEntityBlock ?? defaultShouldEntityBlock;
  const ctx: MovementContext = {
    getCollision: options.getCollision,
    getHeight: options.getHeight,
    getTerrainZ: (aabb) => terrainBaseZ(aabb, options.getHeight, options.queryProps(aabb)),
    isEntityBlocked: (aabb) => {
      const selfWz = options.movingEntity.wz ?? 0;
      const selfHeight = options.movingEntity.collider?.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
      for (const other of options.queryEntities(aabb)) {
        if (options.excludeIds.has(other.id) || !other.collider || !shouldEntityBlock(other))
          continue;
        const otherWz = other.wz ?? 0;
        const otherHeight = other.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
        if (!zRangesOverlap(selfWz, selfHeight, otherWz, otherHeight)) continue;
        if (aabbsOverlap(aabb, getEntityAABB(other.position, other.collider))) return true;
      }
      return false;
    },
    isPropBlocked: (aabb, entityWz, entityHeight, stepUp = 0) => {
      const props = options.queryProps(aabb);
      let supportZ = entityWz;
      // Resolve the proposed foot height before testing overhead clearance. This
      // permits a small continuous climb without passing through a low ceiling.
      for (const prop of props)
        for (const c of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
          if (!c.surface) continue;
          const hit = querySurfacePatch(c.surface, getEntityAABB(prop.position, c), aabb);
          if (hit && hit.topMax <= entityWz + stepUp + 0.001)
            supportZ = Math.max(supportZ, hit.topMax);
        }
      for (const prop of props) {
        if (aabbOverlapsPropWalls(aabb, prop.position, prop, supportZ, entityHeight)) return true;
      }
      return false;
    },
    noclip: options.noclip,
    ...(options.deferRoofCarry ? { deferRoofCarry: true } : {}),
  };
  if (options.takeAirMomentumDt) ctx.takeAirMomentumDt = options.takeAirMomentumDt;
  if (options.getTerrainAt) ctx.getTerrainAt = options.getTerrainAt;
  if (options.getRoadAt) ctx.getRoadAt = options.getRoadAt;
  return ctx;
}

/**
 * Build shared prop/entity neighborhood sampling for terrain surface queries.
 */
export function createSurfaceSampler(options: SimulationQuerySource) {
  return (
    entity: Entity,
  ): {
    props: readonly PropSurface[];
    entities: readonly EntitySurface[];
  } => {
    if (!entity.collider) {
      return { props: [] as const, entities: [] as const };
    }
    const footprint = getEntityAABB(entity.position, entity.collider);
    return {
      props: options.queryProps(footprint),
      entities: options.queryEntities(footprint),
    };
  };
}
