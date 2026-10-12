import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { terrainBaseZ } from "../physics/TerrainExcavation.js";
import { isDrivable } from "../traffic/Driving.js";
import {
  hasVehicleLights,
  isWarningVehicle,
  vehicleLightState,
} from "../traffic/EmergencyVehicle.js";
import { hasMovingRoof, roofSupport } from "../traffic/RoofSupport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import { authoredTrainForType } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForType, vehicleMeshHeightScale } from "./AuthoredVehicleMeshes.js";
import type { Camera } from "./Camera.js";
import { interpolatePosition, interpolateWz } from "./EntityInterpolation.js";
import {
  entityFacingHeading,
  entityHeading,
  meshAssetFor,
  trainMeshHeading,
} from "./EntityMeshPose.js";
import { appendGrassBladeItems, GrassFrameBuffer, grassOpacity } from "./GrassBladeRenderer.js";
import { vehicleMeshRadius, yawOrientation } from "./MeshPresentation.js";
import { depthAboveProps, propDepthSurfaces } from "./propDepth.js";
import type { SceneFrame } from "./SceneFrame.js";
import type { ParticleItem, SceneItem, SpriteItem } from "./SceneItem.js";
import { surfaceShadowZ } from "./SurfacePresentation.js";
import type { TerrainPresentation } from "./TerrainPresentation.js";
import { grassDepthUnderVehicles, isVehicleSprite } from "./VehicleGrassDepth.js";

/**
 * Interpolation factor for Z_SORT_FACTOR:
 * Baseline Y+Z ordering. Explicit prop-top overlap below handles long, low
 * surfaces that this heuristic alone cannot order correctly.
 */
const Z_SORT_FACTOR = 1;

interface ExtrapolationGhostItem {
  entityId: number;
  wx: number;
  wy: number;
  wz?: number;
}

export { interpolatePosition } from "./EntityInterpolation.js";

/**
 * Collect, cull, interpolate, and Y-sort all visible scene items.
 * Returns SceneItem[] in draw order. With a frame, the list and grass items are
 * borrowed until its next collection; consume synchronously and release after drawing.
 *
 * This is the "scene graph" step — it computes what needs to be drawn
 * and where in world-space, without any Canvas2D-specific code.
 */
export function collectScene(
  entities: readonly Entity[],
  props: readonly Prop[],
  world: Pick<World, "getHeightAt" | "getChunkIfLoaded" | "getRoadAt">,
  camera: Camera,
  visible: ChunkRange,
  alpha: number,
  terrain: TerrainPresentation,
  particles: ParticleItem[],
  hasGrass: boolean,
  extrapolationGhosts?: readonly ExtrapolationGhostItem[],
  drawProps?: ReadonlySet<number>,
  frame?: SceneFrame,
): SceneItem[] {
  const grassAlpha = hasGrass ? grassOpacity(camera.zoom) : 0;
  const visibleGrass = grassAlpha > 0;
  const items = frame ? frame.begin(visibleGrass) : [];
  const grassVehicles: SpriteItem[] = [];
  const ghostByEntityId =
    extrapolationGhosts && extrapolationGhosts.length > 0
      ? new Map(extrapolationGhosts.map((g) => [g.entityId, g]))
      : undefined;

  // Viewport bounds in world coordinates for culling
  const vpTL = camera.screenToWorld(0, 0);
  const vpBR = camera.screenToWorld(camera.viewportWidth, camera.viewportHeight);
  // Small margin for rendering effects not captured by sprite bounds
  const M = 16;

  const propSurfaces = frame ? frame.propDepth.collect(props) : propDepthSurfaces(props);
  const planarProps = props.filter((p) => p.collider?.surface || p.walls?.some((c) => c.surface));
  const hasExcavations = planarProps.some((p) =>
    (p.walls ?? (p.collider ? [p.collider] : [])).some((c) => c.surface?.excavation),
  );
  const movingRoofs = entities.filter(hasMovingRoof);
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

  const poseTime = frame?.presentationTime ?? 0;
  frame?.meshPoses.retain(entities);
  const insideParents = new Set(entities.filter(isDrivable).map((e) => e.id));
  // --- Entities ---
  for (const e of entities) {
    if (!e.sprite || (e.parentId !== undefined && insideParents.has(e.parentId))) continue;
    const pos = interpolatePosition(e.position, e.prevPosition, alpha);

    // Compute Z offset in world pixels
    let zOffset: number;
    const displayedWz = interpolateWz(e, alpha);
    if (displayedWz !== undefined) {
      zOffset = displayedWz;
    } else {
      const tx = Math.floor(pos.wx / TILE_SIZE);
      const ty = Math.floor(pos.wy / TILE_SIZE);
      const elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX;
      const curJumpZ = e.jumpZ ?? 0;
      const lerpedJumpZ =
        e.prevJumpZ !== undefined ? e.prevJumpZ + (curJumpZ - e.prevJumpZ) * alpha : curJumpZ;
      zOffset = elevOffset + lerpedJumpZ;
    }

    // Match the displayed sprite rectangle, including vehicles whose artwork
    // extends below their ground-center anchor. Preserve conservative mesh
    // bounds as well, so either the mesh or its sprite fallback can enter view.
    const effectiveWy = pos.wy - zOffset;
    const support = !hasMovingRoof(e) ? roofSupport(e, movingRoofs) : undefined;
    const supportMesh = support ? authoredVehicleForType(support.type ?? "") : undefined;
    const meshRoofSupport =
      supportMesh && support?.collider
        ? {
            assetId: supportMesh.assetId,
            heightDelta:
              (support.collider.physicalHeight ?? 0) *
              (1 - vehicleMeshHeightScale(supportMesh.vehicle)),
          }
        : undefined;
    const spriteBottom = effectiveWy + (e.sprite.drawOffsetY ?? 0);
    const meshAsset = frame ? frame.meshPoses.assetFor(e) : meshAssetFor(e);
    const meshRadius = meshAsset
      ? vehicleMeshRadius(meshAsset)
      : e.type.startsWith("train-curve-proof-v1")
        ? 96
        : 0;
    const halfW = Math.max(e.sprite.spriteWidth / 2, meshRadius);
    const top = meshRadius
      ? Math.min(spriteBottom - e.sprite.spriteHeight, effectiveWy - meshRadius * Math.SQRT2)
      : spriteBottom - e.sprite.spriteHeight;
    const bottom = meshRadius
      ? Math.max(spriteBottom, effectiveWy + meshRadius * Math.SQRT2)
      : spriteBottom + (meshRoofSupport?.heightDelta ?? 0);
    if (
      pos.wx + halfW < vpTL.wx - M ||
      pos.wx - halfW > vpBR.wx + M ||
      bottom < vpTL.wy - M ||
      top > vpBR.wy + M
    )
      continue;

    // Shadow parameters
    const hasShadow = !e.flashHidden && !e.noShadow;
    const col = e.collider;
    const shadowWidth = col ? col.width : e.sprite.spriteWidth * 0.6;
    const shadowFeetWy = pos.wy + (col ? col.offsetY : (e.sortOffsetY ?? 0));
    const shadowTx = Math.floor(pos.wx / TILE_SIZE);
    const shadowTy = Math.floor(pos.wy / TILE_SIZE);
    const terrainZ =
      col && hasExcavations
        ? terrainBaseZ(getEntityAABB(pos, col), (tx, ty) => world.getHeightAt(tx, ty), planarProps)
        : world.getHeightAt(shadowTx, shadowTy) * ELEVATION_PX;
    const shadowTerrainZ =
      col && planarProps.length
        ? surfaceShadowZ(planarProps, getEntityAABB(pos, col), zOffset, terrainZ)
        : terrainZ;

    // Sort key
    const sortKey = depthAboveProps(
      pos.wy + (e.sortOffsetY ?? 0) + (e.wz ?? 0) * Z_SORT_FACTOR,
      e.collider ? getEntityAABB(pos, e.collider) : null,
      zOffset,
      depthSurfaces,
    );

    const mesh =
      frame?.meshPoses.evaluate(e, poseTime, pos) ??
      (meshAsset
        ? {
            assetId: meshAsset,
            orientation: yawOrientation(
              authoredTrainForType(e.type) ? trainMeshHeading(e) : entityHeading(e),
            ),
            radius: meshRadius,
          }
        : undefined);
    const spriteItem = {
      ...(mesh ? { mesh } : {}),
      ...(meshRoofSupport ? { meshRoofSupport } : {}),
      ...(hasVehicleLights(e) && vehicleLightState(e) & 1
        ? {
            emergencyHeight: e.type.startsWith("vehicle-v1:fire-truck-ladder-")
              ? 28
              : isWarningVehicle(e)
                ? 42
                : e.type === "vehicle-v1:police-car"
                  ? 22
                  : 40,
            emergencyForward: e.type.startsWith("vehicle-v1:fire-truck-ladder-")
              ? 64
              : isWarningVehicle(e)
                ? 44
                : 0,
            emergencyColors: isWarningVehicle(e)
              ? (["#ffd37a", "#ffd37a"] as const)
              : e.type === "vehicle-v1:police-car"
                ? (["#ff7979", "#79dfff"] as const)
                : (["#79dfff", "#79dfff"] as const),
            ...(isWarningVehicle(e) ? { emergencySide: 0 } : {}),
            emergencyHeading: entityFacingHeading(e),
            emergencyFlash:
              poseTime % 1 < 0.12 || (poseTime % 1 >= 0.2 && poseTime % 1 < 0.32)
                ? 1
                : poseTime % 1 >= 0.5 &&
                    (poseTime % 1 < 0.62 || (poseTime % 1 >= 0.7 && poseTime % 1 < 0.82))
                  ? 2
                  : 0,
          }
        : {}),
      kind: "sprite",
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
      drawOffsetY: e.sprite.drawOffsetY ?? 0,
      hasShadow,
      shadowFeetWy,
      shadowWidth,
      shadowTerrainZ,
      flashHidden: e.flashHidden ?? false,
    } satisfies SpriteItem;
    items.push(spriteItem);
    if (visibleGrass && isVehicleSprite(e.type)) grassVehicles.push(spriteItem);

    const ghost = ghostByEntityId?.get(e.id);
    if (ghost && Math.hypot(ghost.wx - pos.wx, ghost.wy - pos.wy) >= 0.25) {
      let ghostZOffset: number;
      if (ghost.wz !== undefined) {
        ghostZOffset = ghost.wz;
      } else if (e.wz !== undefined) {
        ghostZOffset = e.wz;
      } else {
        const ghostTx = Math.floor(ghost.wx / TILE_SIZE);
        const ghostTy = Math.floor(ghost.wy / TILE_SIZE);
        const ghostElevOffset = world.getHeightAt(ghostTx, ghostTy) * ELEVATION_PX;
        ghostZOffset = ghostElevOffset + (e.jumpZ ?? 0);
      }

      items.push({
        kind: "sprite",
        sortKey: depthAboveProps(
          ghost.wy + (e.sortOffsetY ?? 0) + (ghost.wz ?? e.wz ?? 0) * Z_SORT_FACTOR,
          e.collider ? getEntityAABB({ wx: ghost.wx, wy: ghost.wy }, e.collider) : null,
          ghostZOffset,
          depthSurfaces,
        ),
        wx: ghost.wx,
        wy: ghost.wy,
        zOffset: ghostZOffset,
        sheetKey: e.sprite.sheetKey,
        frameCol: e.sprite.frameCol,
        frameRow: e.sprite.frameRow,
        spriteWidth: e.sprite.spriteWidth,
        spriteHeight: e.sprite.spriteHeight,
        flipX: e.sprite.flipX ?? false,
        drawOffsetY: e.sprite.drawOffsetY ?? 0,
        hasShadow: false,
        shadowFeetWy: 0,
        shadowWidth: 0,
        shadowTerrainZ: 0,
        flashHidden: false,
        alpha: 0.35,
      } satisfies SpriteItem);
    }
  }

  // --- Props ---
  for (const p of props) {
    if (drawProps && !drawProps.has(p.id)) continue;
    const sw = p.sprite.spriteWidth;
    const sh = p.sprite.spriteHeight;
    const halfW = sw / 2;
    if (
      p.position.wx + halfW < vpTL.wx - M ||
      p.position.wx - halfW > vpBR.wx + M ||
      p.position.wy < vpTL.wy - M ||
      p.position.wy - sh > vpBR.wy + M
    )
      continue;

    // Props have no interpolation, no Z, no shadows
    const tx = Math.floor(p.position.wx / TILE_SIZE);
    const ty = Math.floor(p.position.wy / TILE_SIZE);
    const elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX;

    const baseItem = {
      kind: "sprite",
      sortKey: p.position.wy + (p.sortOffsetY ?? 0),
      wx: p.position.wx,
      wy: p.position.wy,
      zOffset: elevOffset,
      sheetKey: p.sprite.sheetKey,
      frameCol: p.sprite.frameCol,
      frameRow: p.sprite.frameRow,
      spriteWidth: sw,
      spriteHeight: sh,
      flipX: false,
      drawOffsetY: 0,
      hasShadow: false,
      shadowFeetWy: 0,
      shadowWidth: 0,
      shadowTerrainZ: 0,
      flashHidden: false,
    } satisfies SpriteItem;
    if (p.sprite.parts) {
      for (const part of p.sprite.parts) {
        const partItem = {
          ...baseItem,
          ...part,
          wx: p.position.wx + part.dx,
          wy: p.position.wy + part.dy,
        };
        items.push(partItem);
        if (visibleGrass && isVehicleSprite(p.type)) grassVehicles.push(partItem);
      }
    } else {
      items.push(baseItem);
      if (visibleGrass && isVehicleSprite(p.type)) grassVehicles.push(baseItem);
    }
  }

  // --- Grass blades ---
  if (visibleGrass) {
    const viewport = {
      minWx: vpTL.wx,
      minWy: vpTL.wy,
      maxWx: vpBR.wx,
      maxWy: vpBR.wy,
    };
    const nowSec = performance.now() / 1000;
    const grassStart = items.length;
    appendGrassBladeItems(
      world,
      entities,
      visible,
      viewport,
      nowSec,
      frame?.grass ?? new GrassFrameBuffer(),
      items,
      grassAlpha === 1 ? undefined : grassAlpha,
    );
    if (grassVehicles.length)
      for (let i = grassStart; i < items.length; i++) {
        const item = items[i];
        if (item?.kind === "grass") grassDepthUnderVehicles(item, grassVehicles);
      }
  }

  // --- Elevation tiles ---
  const elevItems = terrain.collectElevationItems(world, visible);
  for (const elev of elevItems) {
    items.push(elev);
  }

  // --- Particles ---
  for (const p of particles) {
    items.push(p);
  }

  // Sort by pre-computed sort key for correct depth ordering
  items.sort((a, b) => a.sortKey - b.sortKey);

  return items;
}
