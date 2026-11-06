import { isBoat } from "../../boats/Boat.js";
import { ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import { getEntityAABB } from "../../entities/collision.js";
import {
  Direction,
  type Entity,
  type PositionComponent,
  type SpriteComponent,
} from "../../entities/Entity.js";
import type { Prop } from "../../entities/Prop.js";
import { rotateBodyVector } from "../../physics/BodyRotation.js";
import { terrainBaseZ } from "../../physics/TerrainExcavation.js";
import {
  hasVehicleLights,
  isWarningVehicle,
  vehicleLightState,
} from "../../traffic/EmergencyVehicle.js";
import { roofSupport } from "../../traffic/RoofSupport.js";
import { isVehicle } from "../../traffic/Vehicle.js";
import { isDrivable } from "../../traffic/VehicleSeats.js";
import { faunaProfile } from "../../wildlife/Fauna.js";
import { isCarryable } from "../../wildlife/ForageResources.js";
import { isRoadkill, ROADKILL_FADE_SECONDS, ROADKILL_SCALE_Y } from "../../wildlife/Roadkill.js";
import type { World } from "../../world/World.js";
import { authoredTrainForType } from "../AuthoredTrainMeshes.js";
import { authoredVehicleForType, vehicleMeshHeightScale } from "../AuthoredVehicleMeshes.js";
import { interpolatePosition, interpolateWz } from "../EntityInterpolation.js";
import {
  entityFacingHeading,
  entityHeading,
  meshAssetFor,
  trainMeshHeading,
} from "../EntityMeshPose.js";
import { vehicleMeshRadius, yawOrientation } from "../MeshPresentation.js";
import { projectShadow, surfaceDecals } from "../ProjectedDecals.js";
import { depthAboveProps, type PropDepthSurface, propDepthSurfaces } from "../propDepth.js";
import type { SceneFrame } from "../SceneFrame.js";
import type { SceneItem, SpriteItem } from "../SceneItem.js";
import { surfaceShadowZ } from "../SurfacePresentation.js";
import type { SurfaceReceivers } from "../SurfaceReceivers.js";
import type { TerrainPresentation } from "../TerrainPresentation.js";
import { isVehicleSprite } from "../VehicleGrassDepth.js";
import { type CullBounds, outsideView } from "./SceneCull.js";

/**
 * Interpolation factor for Z_SORT_FACTOR:
 * Baseline Y+Z ordering. Explicit prop-top overlap below handles long, low
 * surfaces that this heuristic alone cannot order correctly.
 */
const Z_SORT_FACTOR = 1;

/** Per-collection surfaces and supports shared by every actor. */
export interface EntityDepth {
  readonly planarProps: readonly Prop[];
  readonly hasExcavations: boolean;
  readonly movingRoofs: readonly Entity[];
  readonly depthSurfaces: readonly PropDepthSurface[];
}

/** Everything the actor stage reads; it appends sprites and their shadow decals to `items`. */
export interface EntityStage {
  readonly entities: readonly Entity[];
  readonly world: Pick<World, "getHeightAt">;
  readonly alpha: number;
  readonly terrain: TerrainPresentation;
  readonly frame: SceneFrame | undefined;
  readonly receivers: SurfaceReceivers | undefined;
  readonly cull: CullBounds;
  readonly depth: EntityDepth;
  readonly poseTime: number;
  readonly items: SceneItem[];
  /** Vehicle sprites that grass must stay under; absent while grass is hidden. */
  readonly grassVehicles: SpriteItem[] | undefined;
}

/** Lookups built once per collection. Each map keeps the first matching entity
 * for an id, exactly as the linear `find` it replaces. */
interface EntityIndex {
  readonly insideParents: ReadonlySet<number>;
  readonly roofs: ReadonlyMap<number, Entity>;
  readonly boats: ReadonlyMap<number, Entity>;
  readonly fauna: ReadonlyMap<number, Entity>;
}

interface EntityPass extends EntityStage {
  readonly index: EntityIndex;
}

type SpriteEntity = Entity & { sprite: SpriteComponent };

interface EntityParents {
  readonly boat: Entity | undefined;
  readonly carrying: Entity | undefined;
}

interface EntityShadow {
  readonly meshGroundShadow: boolean;
  readonly hasShadow: boolean;
  readonly shadowWidth: number;
  readonly shadowFeetWy: number;
  readonly shadowTerrainZ: number;
}

type EmergencyFields = Pick<
  SpriteItem,
  | "emergencyHeight"
  | "emergencyForward"
  | "emergencyColors"
  | "emergencySide"
  | "emergencyHeading"
  | "emergencyFlash"
>;

export function entityDepth(
  entities: readonly Entity[],
  props: readonly Prop[],
  frame: SceneFrame | undefined,
): EntityDepth {
  const propSurfaces = frame ? frame.propDepth.collect(props) : propDepthSurfaces(props);
  const planarProps = props.filter((p) => p.collider?.surface || p.walls?.some((c) => c.surface));
  const hasExcavations = planarProps.some((p) =>
    (p.walls ?? (p.collider ? [p.collider] : [])).some((c) => c.surface?.excavation),
  );
  const movingRoofs = entities.filter(isVehicle);
  const vehicleSurfaces = movingRoofs.flatMap((e) =>
    e.collider
      ? [
          {
            bounds: getEntityAABB(e.position, e.collider),
            topZ: (e.wz ?? 0) + (e.collider.physicalHeight ?? 0),
            depth: e.position.wy + (e.sortOffsetY ?? 0),
          },
        ]
      : [],
  );
  const depthSurfaces = vehicleSurfaces.length
    ? [...propSurfaces, ...vehicleSurfaces]
    : propSurfaces;
  return { planarProps, hasExcavations, movingRoofs, depthSurfaces };
}

/** Cull, interpolate and append every visible actor in entity order. */
export function collectEntitySprites(stage: EntityStage): void {
  const pass: EntityPass = { ...stage, index: indexEntities(stage) };
  for (const e of stage.entities) {
    if (!hasSprite(e) || (e.parentId !== undefined && pass.index.insideParents.has(e.parentId)))
      continue;
    collectEntity(pass, e);
  }
}

function hasSprite(e: Entity): e is SpriteEntity {
  return !!e.sprite;
}

function firstById(entities: readonly Entity[], match: (e: Entity) => unknown) {
  const byId = new Map<number, Entity>();
  for (const e of entities) if (!byId.has(e.id) && match(e)) byId.set(e.id, e);
  return byId;
}

function indexEntities({ entities, depth }: EntityStage): EntityIndex {
  return {
    insideParents: new Set(entities.filter((e) => isDrivable(e) && !isBoat(e)).map((e) => e.id)),
    roofs: firstById(depth.movingRoofs, () => true),
    boats: firstById(entities, isBoat),
    fauna: firstById(entities, (p) => faunaProfile(p.type)),
  };
}

function collectEntity(pass: EntityPass, e: SpriteEntity): void {
  const { alpha, frame, receivers, poseTime } = pass;
  const pos = interpolatePosition(e.position, e.prevPosition, alpha);
  const zOffset = entityZOffset(pass, e, pos);
  // Match the displayed sprite rectangle, including vehicles whose artwork
  // extends below their ground-center anchor. Preserve conservative mesh
  // bounds as well, so either the mesh or its sprite fallback can enter view.
  const effectiveWy = pos.wy - zOffset;
  const meshRoofSupport = entityRoofSupport(pass, e);
  const remains = isRoadkill(e.type);
  const scaleY = remains ? ROADKILL_SCALE_Y : 1;
  const drawOffsetY = (e.sprite.drawOffsetY ?? 0) * scaleY;
  const spriteBottom = effectiveWy + drawOffsetY;
  const meshAsset = frame ? frame.meshPoses.assetFor(e) : meshAssetFor(e);
  const meshRadius = meshAsset
    ? vehicleMeshRadius(meshAsset)
    : e.type.startsWith("train-curve-proof-v1")
      ? 96
      : 0;
  if (
    entityCulled(
      pass.cull,
      e,
      pos.wx,
      effectiveWy,
      spriteBottom,
      scaleY,
      meshRadius,
      meshRoofSupport,
    )
  )
    return;

  const parents = entityParents(pass.index, e);
  const shadow = entityShadow(pass, e, pos, zOffset, parents);
  const sortKey = entitySortKey(pass, e, pos, zOffset, parents);
  const mesh = entityMesh(pass, e, pos, meshAsset, meshRadius);
  const { meshGroundShadow, hasShadow } = shadow;
  const spriteItem: SpriteItem = {
    ...(mesh ? { mesh } : {}),
    ...(meshGroundShadow ? { meshGroundShadow: true } : {}),
    ...(meshGroundShadow && receivers ? { shadowCasterId: e.id } : {}),
    ...(meshRoofSupport ? { meshRoofSupport } : {}),
    ...emergencyLights(e, poseTime),
    ...(remains ? roadkillFade(e, scaleY) : {}),
    kind: "sprite",
    subpixel: true,
    sortKey,
    wx: pos.wx,
    wy: pos.wy,
    zOffset,
    sheetKey: e.sprite.sheetKey,
    frameCol: e.sprite.frameCol,
    frameRow: e.sprite.frameRow,
    spriteWidth: e.sprite.spriteWidth,
    spriteHeight: e.sprite.spriteHeight,
    flipX: e.sprite.flipX ?? false,
    drawOffsetY,
    hasShadow,
    shadowFeetWy: shadow.shadowFeetWy,
    shadowWidth: shadow.shadowWidth,
    shadowTerrainZ: shadow.shadowTerrainZ,
    flashHidden: e.flashHidden ?? false,
  };
  pass.items.push(spriteItem);
  if (receivers && hasShadow && e.collider && (!meshGroundShadow || spriteItem.mesh))
    pushShadowDecals(pass, receivers, e, spriteItem, pos, zOffset, meshGroundShadow);
  if (pass.grassVehicles && isVehicleSprite(e.type)) pass.grassVehicles.push(spriteItem);
}

function entityMesh(
  pass: EntityPass,
  e: Entity,
  pos: PositionComponent,
  meshAsset: string | undefined,
  meshRadius: number,
): SpriteItem["mesh"] {
  return (
    pass.frame?.meshPoses.evaluate(e, pass.poseTime, pos) ??
    (meshAsset
      ? {
          assetId: meshAsset,
          orientation: yawOrientation(
            authoredTrainForType(e.type) ? trainMeshHeading(e) : entityHeading(e),
          ),
          radius: meshRadius,
        }
      : undefined)
  );
}

/** Z offset in world pixels: displayed height, or terrain plus interpolated jump. */
function entityZOffset(pass: EntityPass, e: Entity, pos: PositionComponent): number {
  const displayedWz = interpolateWz(e, pass.alpha);
  if (displayedWz !== undefined) return displayedWz;
  const tx = Math.floor(pos.wx / TILE_SIZE);
  const ty = Math.floor(pos.wy / TILE_SIZE);
  const elevOffset = pass.world.getHeightAt(tx, ty) * ELEVATION_PX;
  const curJumpZ = e.jumpZ ?? 0;
  const lerpedJumpZ =
    e.prevJumpZ !== undefined ? e.prevJumpZ + (curJumpZ - e.prevJumpZ) * pass.alpha : curJumpZ;
  return elevOffset + lerpedJumpZ;
}

function entityRoofSupport(pass: EntityPass, e: Entity): SpriteItem["meshRoofSupport"] {
  const supportId = !isVehicle(e) ? roofSupport(e, pass.depth.movingRoofs)?.id : undefined;
  const support = supportId === undefined ? undefined : pass.index.roofs.get(supportId);
  const supportMesh = support ? authoredVehicleForType(support.type ?? "") : undefined;
  return supportMesh &&
    support?.collider &&
    (!support.bodyRotation || rotateBodyVector(support.bodyRotation, 0, 0, 1).z > 0.995)
    ? {
        assetId: supportMesh.assetId,
        heightDelta: support.bodyRotation
          ? 0
          : (support.collider.physicalHeight ?? 0) *
            (1 - vehicleMeshHeightScale(supportMesh.vehicle)),
      }
    : undefined;
}

function entityCulled(
  cull: CullBounds,
  e: SpriteEntity,
  wx: number,
  effectiveWy: number,
  spriteBottom: number,
  scaleY: number,
  meshRadius: number,
  meshRoofSupport: SpriteItem["meshRoofSupport"],
): boolean {
  const halfW =
    Math.max(e.sprite.spriteWidth / 2, meshRadius) + Math.abs(meshRoofSupport?.offsetX ?? 0);
  let top = meshRadius
    ? Math.min(spriteBottom - e.sprite.spriteHeight * scaleY, effectiveWy - meshRadius * Math.SQRT2)
    : spriteBottom - e.sprite.spriteHeight * scaleY;
  let bottom = meshRadius
    ? Math.max(spriteBottom, effectiveWy + meshRadius * Math.SQRT2)
    : spriteBottom + (meshRoofSupport?.heightDelta ?? 0);
  if (meshRoofSupport) {
    const shift = (meshRoofSupport.offsetY ?? 0) + meshRoofSupport.heightDelta;
    top = Math.min(top, spriteBottom - e.sprite.spriteHeight * scaleY + shift);
    bottom = Math.max(bottom, spriteBottom, spriteBottom + shift);
  }
  return outsideView(cull, wx, halfW, top, bottom);
}

function entityParents(index: EntityIndex, e: Entity): EntityParents {
  return {
    boat: e.parentId === undefined ? undefined : index.boats.get(e.parentId),
    carrying: e.parentId === undefined || !isCarryable(e) ? undefined : index.fauna.get(e.parentId),
  };
}

function entityShadow(
  pass: EntityPass,
  e: SpriteEntity,
  pos: PositionComponent,
  zOffset: number,
  parents: EntityParents,
): EntityShadow {
  const meshGroundShadow = !!e.bodyRotation && isVehicle(e) && !isBoat(e);
  const col = e.collider;
  return {
    meshGroundShadow,
    hasShadow: !parents.boat && !e.flashHidden && (!e.noShadow || meshGroundShadow),
    shadowWidth: col ? col.width : e.sprite.spriteWidth * 0.6,
    shadowFeetWy:
      pos.wy + (col ? col.offsetY - (meshGroundShadow ? col.height / 2 : 0) : (e.sortOffsetY ?? 0)),
    shadowTerrainZ: shadowTerrainZ(pass, e, pos, zOffset),
  };
}

function shadowTerrainZ(
  pass: EntityPass,
  e: Entity,
  pos: PositionComponent,
  zOffset: number,
): number {
  const { world } = pass;
  const { planarProps, hasExcavations } = pass.depth;
  const col = e.collider;
  const terrainZ =
    col && hasExcavations
      ? terrainBaseZ(getEntityAABB(pos, col), (tx, ty) => world.getHeightAt(tx, ty), planarProps)
      : world.getHeightAt(Math.floor(pos.wx / TILE_SIZE), Math.floor(pos.wy / TILE_SIZE)) *
        ELEVATION_PX;
  return !pass.receivers && col && planarProps.length
    ? surfaceShadowZ(planarProps, getEntityAABB(pos, col), zOffset, terrainZ)
    : terrainZ;
}

function entitySortKey(
  pass: EntityPass,
  e: Entity,
  pos: PositionComponent,
  zOffset: number,
  { boat, carrying }: EntityParents,
): number {
  if (carrying) return carriedSortKey(pass, carrying);
  if (boat)
    return (
      interpolatePosition(boat.position, boat.prevPosition, pass.alpha).wy +
      (boat.sortOffsetY ?? 0) +
      0.1
    );
  return depthAboveProps(
    pos.wy + (e.sortOffsetY ?? 0) + (e.wz ?? 0) * Z_SORT_FACTOR,
    e.collider ? getEntityAABB(pos, e.collider) : null,
    zOffset,
    pass.depth.depthSurfaces,
  );
}

function carriedSortKey(pass: EntityPass, parent: Entity): number {
  return (
    depthAboveProps(
      interpolatePosition(parent.position, parent.prevPosition, pass.alpha).wy +
        (parent.sortOffsetY ?? 0) +
        (parent.wz ?? 0) * Z_SORT_FACTOR,
      parent.collider ? getEntityAABB(parent.position, parent.collider) : null,
      interpolateWz(parent, pass.alpha) ?? 0,
      pass.depth.depthSurfaces,
    ) + (parent.sprite?.direction === Direction.Up ? -0.1 : 0.1)
  );
}

function emergencyLights(e: Entity, poseTime: number): EmergencyFields {
  if (!(hasVehicleLights(e) && vehicleLightState(e) & 1)) return {};
  const ladder = e.type.startsWith("vehicle-v1:fire-truck-ladder-");
  const warning = isWarningVehicle(e);
  const police = e.type === "vehicle-v1:police-car";
  return {
    emergencyHeight: ladder ? 28 : warning ? 42 : police ? 22 : 40,
    emergencyForward: ladder ? 64 : warning ? 44 : 0,
    emergencyColors: warning
      ? (["#ffd37a", "#ffd37a"] as const)
      : police
        ? (["#ff7979", "#79dfff"] as const)
        : (["#79dfff", "#79dfff"] as const),
    ...(warning ? { emergencySide: 0 } : {}),
    emergencyHeading: entityFacingHeading(e),
    emergencyFlash: emergencyFlash(poseTime),
  };
}

function emergencyFlash(poseTime: number): number {
  return poseTime % 1 < 0.12 || (poseTime % 1 >= 0.2 && poseTime % 1 < 0.32)
    ? 1
    : poseTime % 1 >= 0.5 && (poseTime % 1 < 0.62 || (poseTime % 1 >= 0.7 && poseTime % 1 < 0.82))
      ? 2
      : 0;
}

function roadkillFade(e: Entity, scaleY: number): Pick<SpriteItem, "scaleY" | "alpha"> {
  return {
    scaleY,
    alpha: Math.max(
      0,
      Math.min(1, (e.deathTimer ?? ROADKILL_FADE_SECONDS) / ROADKILL_FADE_SECONDS),
    ),
  };
}

function pushShadowDecals(
  pass: EntityPass,
  receivers: SurfaceReceivers,
  e: Entity,
  spriteItem: SpriteItem,
  pos: PositionComponent,
  zOffset: number,
  meshGroundShadow: boolean,
): void {
  spriteItem.hasShadow = false;
  const mesh = spriteItem.mesh
    ? pass.terrain.meshSurfaceGeometry?.(spriteItem.mesh.assetId)
    : undefined;
  pass.items.push(
    ...surfaceDecals(
      projectShadow(receivers, e, pos.wx, pos.wy, zOffset, mesh, spriteItem.mesh?.orientation),
      meshGroundShadow ? "vehicle" : "oval",
      0.28,
      "#000",
      meshGroundShadow ? spriteItem.mesh?.assetId : undefined,
      meshGroundShadow ? e.id : undefined,
    ),
  );
}
