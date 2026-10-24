import { isBoat } from "../boats/Boat.js";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { terrainBaseZ } from "../physics/TerrainExcavation.js";
import {
  isTransporter,
  supportingTransporter,
  TRANSPORTER,
  transporterWorld,
} from "../traffic/CarTransporter.js";
import { isDrivable } from "../traffic/Driving.js";
import {
  hasVehicleLights,
  isWarningVehicle,
  vehicleLightState,
} from "../traffic/EmergencyVehicle.js";
import { hasMovingRoof, roofSupport } from "../traffic/RoofSupport.js";
import { presentedTowPosition, towMeshOffset, towPitch } from "../traffic/Towing.js";
import {
  bedGateAngle,
  bedHeading,
  bedTilt,
  bedVisualOwner,
  hasDetailedVehicleSurface,
} from "../traffic/VehicleBed.js";
import { gradeRoofOffset, vehicleGroundPose } from "../traffic/VehicleGroundPose.js";
import { faunaProfile } from "../wildlife/Fauna.js";
import { isCarryable } from "../wildlife/ForageResources.js";
import { isRoadkill, ROADKILL_FADE_SECONDS, ROADKILL_SCALE_Y } from "../wildlife/Roadkill.js";
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
import { meshGradePoint } from "./MeshGradePose.js";
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
  const transporters = entities.filter(isTransporter);
  const gradeProps = props.filter((p) =>
    (p.walls ?? (p.collider ? [p.collider] : [])).some((c) => c.surface || c.walkableTop),
  );
  const groundPoses = new Map<number, ReturnType<typeof vehicleGroundPose>>();
  const groundPoseFor = (entity: Entity) => {
    if (supportingTransporter(entity, transporters)) return undefined;
    if (!groundPoses.has(entity.id)) {
      const displayed = {
        ...entity,
        position: interpolatePosition(entity.position, entity.prevPosition, alpha),
        wz: interpolateWz(entity, alpha) ?? 0,
      };
      const height = (x: number, y: number) => world.getHeightAt(x, y);
      let ground = vehicleGroundPose(displayed, height, gradeProps, entityHeading(entity));
      // Traffic can have a continuous displayed heading without a physical yaw.
      // Only grade-supported cars need this early evaluation; flat offscreen cars
      // retain the collector's existing lazy presentation/culling behavior.
      if (ground && frame) {
        const mesh = frame.meshPoses.evaluate(entity, poseTime, displayed.position);
        const heading = mesh
          ? 2 * Math.atan2(mesh.orientation[2], mesh.orientation[3])
          : ground.heading;
        if (Math.abs(heading - ground.heading) > 1e-8)
          ground = vehicleGroundPose(displayed, height, gradeProps, heading);
      }
      groundPoses.set(entity.id, ground);
    }
    return groundPoses.get(entity.id);
  };
  const towSprites = entities.some((e) => e.towTargetId !== undefined || isTransporter(e))
    ? new Map<number, SpriteItem>()
    : undefined;
  const bedSprites = movingRoofs.some(hasDetailedVehicleSurface)
    ? new Map<number, SpriteItem>()
    : undefined;
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
  const insideParents = new Set(
    entities.filter((e) => isDrivable(e) && !isBoat(e)).map((e) => e.id),
  );
  // --- Entities ---
  for (const e of entities) {
    if (!e.sprite || (e.parentId !== undefined && insideParents.has(e.parentId))) continue;
    let pos = interpolatePosition(e.position, e.prevPosition, alpha);
    if (e.towedBy !== undefined) {
      const truck = entities.find((t) => t.id === e.towedBy && t.towTargetId === e.id);
      if (truck)
        pos = presentedTowPosition(
          e,
          truck,
          interpolatePosition(truck.position, truck.prevPosition, alpha),
        );
    }

    if (e.transportedBy !== undefined) {
      const truck = entities.find((t) => t.id === e.transportedBy);
      if (truck)
        pos = transporterWorld(
          { ...truck, position: interpolatePosition(truck.position, truck.prevPosition, alpha) },
          TRANSPORTER.loadX,
        );
    }
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
    const supportId = !hasMovingRoof(e) ? roofSupport(e, movingRoofs)?.id : undefined;
    const support =
      supportId === undefined ? undefined : movingRoofs.find((e) => e.id === supportId);
    const supportMesh = support ? authoredVehicleForType(support.type ?? "") : undefined;
    const supportGround = support ? groundPoseFor(support) : undefined;
    const supportPosition = support
      ? interpolatePosition(support.position, support.prevPosition, alpha)
      : undefined;
    const meshRoofSupport: SpriteItem["meshRoofSupport"] =
      supportMesh && support?.collider
        ? {
            assetId: supportMesh.assetId,
            heightDelta:
              (support.collider.physicalHeight ?? 0) *
                (1 - vehicleMeshHeightScale(supportMesh.vehicle)) -
              (supportGround && supportPosition
                ? gradeRoofOffset(
                    supportGround,
                    supportGround.heading,
                    pos.wx - supportPosition.wx,
                    pos.wy - supportPosition.wy,
                    (support.collider.physicalHeight ?? 0) *
                      vehicleMeshHeightScale(supportMesh.vehicle),
                  )
                : 0),
          }
        : undefined;
    const carrierId =
      support?.towedBy ??
      support?.transportedBy ??
      (support ? supportingTransporter(support, transporters)?.truck.id : undefined);
    const carrier =
      carrierId === undefined ? undefined : movingRoofs.find((e) => e.id === carrierId);
    const carrierGround = carrier ? groundPoseFor(carrier) : undefined;
    const carrierMesh = carrier ? authoredVehicleForType(carrier.type) : undefined;
    if (meshRoofSupport && carrierMesh) meshRoofSupport.ownerAssetId = carrierMesh.assetId;
    if (meshRoofSupport && carrier && carrierGround && carrierMesh) {
      const origin = interpolatePosition(carrier.position, carrier.prevPosition, alpha),
        baseZ = interpolateWz(carrier, alpha) ?? 0;
      const point = meshGradePoint(
        {
          assetId: carrierMesh.assetId,
          radius: 0,
          orientation: yawOrientation(carrierGround.heading),
          gradePitch: carrierGround.pitch,
          gradeRoll: carrierGround.roll,
          gradeOffsetZ: carrierGround.offsetZ,
        },
        pos.wx - origin.wx,
        pos.wy - origin.wy,
        zOffset - meshRoofSupport.heightDelta - baseZ,
      );
      meshRoofSupport.offsetX = origin.wx + point.x - pos.wx;
      meshRoofSupport.offsetY = origin.wy + point.y - pos.wy;
      meshRoofSupport.heightDelta = zOffset - baseZ - point.z;
    }
    const remains = isRoadkill(e.type);
    const scaleY = remains ? ROADKILL_SCALE_Y : 1;
    const drawOffsetY = (e.sprite.drawOffsetY ?? 0) * scaleY;
    const spriteBottom = effectiveWy + drawOffsetY;
    const meshAsset = frame ? frame.meshPoses.assetFor(e) : meshAssetFor(e);
    const ground = meshAsset ? groundPoseFor(e) : undefined;
    const meshRadius = meshAsset
      ? vehicleMeshRadius(meshAsset) + Math.abs(ground?.offsetZ ?? 0)
      : e.type.startsWith("train-curve-proof-v1")
        ? 96
        : 0;
    const halfW =
      Math.max(e.sprite.spriteWidth / 2, meshRadius) + Math.abs(meshRoofSupport?.offsetX ?? 0);
    let top = meshRadius
      ? Math.min(
          spriteBottom - e.sprite.spriteHeight * scaleY,
          effectiveWy - meshRadius * Math.SQRT2,
        )
      : spriteBottom - e.sprite.spriteHeight * scaleY;
    let bottom = meshRadius
      ? Math.max(spriteBottom, effectiveWy + meshRadius * Math.SQRT2)
      : spriteBottom + (meshRoofSupport?.heightDelta ?? 0);
    if (meshRoofSupport) {
      const shift = (meshRoofSupport.offsetY ?? 0) + meshRoofSupport.heightDelta;
      top = Math.min(top, spriteBottom - e.sprite.spriteHeight * scaleY + shift);
      bottom = Math.max(bottom, spriteBottom, spriteBottom + shift);
    }
    if (
      pos.wx + halfW < vpTL.wx - M ||
      pos.wx - halfW > vpBR.wx + M ||
      bottom < vpTL.wy - M ||
      top > vpBR.wy + M
    )
      continue;

    // Shadow parameters
    const boatParent =
      e.parentId === undefined ? undefined : entities.find((p) => p.id === e.parentId && isBoat(p));
    const carryingParent =
      e.parentId === undefined || !isCarryable(e)
        ? undefined
        : entities.find((p) => p.id === e.parentId && faunaProfile(p.type));
    const hasShadow = !boatParent && !e.flashHidden && !e.noShadow;
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
    const sortKey = carryingParent
      ? depthAboveProps(
          interpolatePosition(carryingParent.position, carryingParent.prevPosition, alpha).wy +
            (carryingParent.sortOffsetY ?? 0) +
            (carryingParent.wz ?? 0) * Z_SORT_FACTOR,
          carryingParent.collider
            ? getEntityAABB(carryingParent.position, carryingParent.collider)
            : null,
          interpolateWz(carryingParent, alpha) ?? 0,
          depthSurfaces,
        ) + (carryingParent.sprite?.direction === Direction.Up ? -0.1 : 0.1)
      : boatParent
        ? interpolatePosition(boatParent.position, boatParent.prevPosition, alpha).wy +
          (boatParent.sortOffsetY ?? 0) +
          0.1
        : depthAboveProps(
            pos.wy + (e.sortOffsetY ?? 0) + (e.wz ?? 0) * Z_SORT_FACTOR,
            e.collider ? getEntityAABB(pos, e.collider) : null,
            zOffset,
            depthSurfaces,
          );

    const baseMesh =
      frame?.meshPoses.evaluate(e, poseTime, pos) ??
      (meshAsset
        ? {
            assetId: meshAsset,
            orientation: yawOrientation(
              authoredTrainForType(e.type) ? trainMeshHeading(e) : entityHeading(e),
            ),
            radius: meshRadius,
            bedTilt: bedTilt(e),
            bedGateAngle: bedGateAngle(e),
            towActive: e.towTargetId !== undefined,
            towPitch: towPitch(e),
            towOffsetX: towMeshOffset(e).x,
            towOffsetZ: towMeshOffset(e).z,
          }
        : undefined);
    const grade = supportingTransporter(e, transporters);
    const mesh = baseMesh
      ? {
          ...baseMesh,
          transportRamp: e.vehicleRamp === 1,
          gradePitch: grade?.pitch ?? ground?.pitch ?? 0,
          ...(ground
            ? {
                gradeRoll: ground.roll,
                gradeOffsetZ: ground.offsetZ,
                radius: Math.ceil(baseMesh.radius + Math.abs(ground.offsetZ)),
              }
            : {}),
        }
      : undefined;
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
      ...(remains
        ? {
            scaleY,
            alpha: Math.max(
              0,
              Math.min(1, (e.deathTimer ?? ROADKILL_FADE_SECONDS) / ROADKILL_FADE_SECONDS),
            ),
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
      drawOffsetY,
      hasShadow,
      shadowFeetWy,
      shadowWidth,
      shadowTerrainZ,
      flashHidden: e.flashHidden ?? false,
    } satisfies SpriteItem;
    items.push(spriteItem);
    bedSprites?.set(e.id, spriteItem);
    towSprites?.set(e.id, spriteItem);
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

  if (bedSprites) {
    const grouped = new Set<SpriteItem>();
    for (const actor of entities) {
      if (actor.type !== "player" && !isCarryable(actor)) continue;
      const owner = bedVisualOwner(actor, movingRoofs);
      const body = owner && bedSprites.get(owner.id),
        content = bedSprites.get(actor.id);
      if (!body || !content) continue;
      body.bedGroup ??= {
        heading: bedHeading(owner),
        tilt: bedTilt(owner),
        ...(isTransporter(owner)
          ? { vehicle: "transporter" as const, ramp: owner.vehicleRamp === 1 }
          : {}),
        contents: [],
      };
      if (roofSupport(actor, movingRoofs)?.id === owner.id) {
        content.meshBedSupport = true;
        // Detailed floors/cab roofs use a full mesh-only foot transform below.
        // Their fallback must retain the authoritative, unpitched bed datum.
        delete content.meshRoofSupport;
      }
      content.hasShadow = false;
      body.bedGroup.contents.push(content);
      grouped.add(content);
    }
    for (let i = items.length - 1; i >= 0; i--)
      if (grouped.has(items[i] as SpriteItem)) items.splice(i, 1);
  }
  if (towSprites) {
    const grouped = new Set<SpriteItem>();
    for (const truck of entities) {
      const loadId =
        truck.towTargetId ??
        truck.transportLoadId ??
        (isTransporter(truck)
          ? entities.find((e) => supportingTransporter(e, transporters)?.truck.id === truck.id)?.id
          : undefined);
      if (loadId === undefined) continue;
      const body = towSprites.get(truck.id),
        car = towSprites.get(loadId);
      if (body && car) {
        body.towGroup = car;
        grouped.add(car);
      }
    }
    for (let i = items.length - 1; i >= 0; i--)
      if (grouped.has(items[i] as SpriteItem)) items.splice(i, 1);
  }
  // Sort by pre-computed sort key for correct depth ordering
  items.sort((a, b) => a.sortKey - b.sortKey);

  return items;
}
