import * as THREE from "three";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { authoredCargoForAsset, WRECKING_BALL_MESH } from "./AuthoredCargoMeshes.js";
import { authoredTrainForAsset } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForAsset, vehicleMeshHeightScale } from "./AuthoredVehicleMeshes.js";
import { type CarMeshAsset, loadCarMesh } from "./CarMeshAsset.js";
import type { MeshInstance } from "./MeshPresentation.js";
import { WRECKING_BALL_CENTER_Z, WRECKING_BALL_SHEAR } from "./WreckingBallProjection.js";

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const turn = new THREE.Quaternion();

export function hasAuthoredMesh(assetId: string): boolean {
  return !!(
    authoredVehicleForAsset(assetId) ??
    authoredTrainForAsset(assetId) ??
    authoredCargoForAsset(assetId)
  );
}

/** Gameplay loading options for retained rigid models, shared by
 * every view that draws authored bodies. Unregistered IDs return undefined. */
export function loadAuthoredMesh(assetId: string): Promise<CarMeshAsset> | undefined {
  const vehicle = authoredVehicleForAsset(assetId);
  const cargo = authoredCargoForAsset(assetId);
  const definition = vehicle ?? authoredTrainForAsset(assetId) ?? cargo;
  if (!definition) return undefined;
  const load = loadCarMesh(definition.path, definition.lateralScale, {
    batch: !!vehicle || !!cargo,
    cargo: !!cargo,
    heightScale: vehicle ? vehicleMeshHeightScale(vehicle.vehicle) : 1,
    contactShadow: !!vehicle,
    preserveParts: vehicle?.batchPreserveParts ?? [],
  });
  return vehicle?.vehicle === "forklift"
    ? load.catch(async () => (await import("./ForkliftFallback.js")).forkliftFallback())
    : load;
}

/** View-specific fitting happens after rigid-body rotation, in game axes. */
export function fitMeshHolder(
  holder: THREE.Group,
  asset: CarMeshAsset,
  mesh: MeshInstance,
  topDown: boolean,
): void {
  const roundBall = topDown && mesh.assetId === WRECKING_BALL_MESH;
  holder.matrixAutoUpdate = !roundBall;
  holder.scale.z = topDown && mesh.physical ? asset.spriteHeightScale : 1;
  if (!roundBall) return;
  const { x, y, z } = holder.position;
  const center = rotateBodyVector(mesh.orientation, 0, 0, WRECKING_BALL_CENTER_Z);
  const shear = WRECKING_BALL_SHEAR;
  const offset = shear * (center.y - center.z);
  holder.matrix.set(
    1,
    0,
    0,
    x,
    0,
    1 - shear,
    shear,
    y + offset,
    0,
    shear,
    1 - shear,
    z - offset,
    0,
    0,
    0,
    1,
  );
  holder.matrixWorldNeedsUpdate = true;
}

/**
 * Absolute pose per draw for one body: orientation, mesh-only grade/tow offsets
 * about the pivot and every rig part. The fixed-view body target and the
 * first-person scene (229) both call this. Grouped composition (a towed car posed
 * relative to its truck, bed contents) stays in GpuMeshBodies; first person draws
 * group members as separate bodies. A shared asset never carries another
 * instance's phase.
 */
export function applyMeshInstance(asset: CarMeshAsset, mesh: MeshInstance, topDown = false): void {
  const object = asset.object;
  asset.setPhysical(!!mesh.physical);
  object.quaternion.set(...mesh.orientation);
  const yaw = 2 * Math.atan2(mesh.orientation[2], mesh.orientation[3]);
  if (mesh.towPitch || mesh.gradePitch)
    object.quaternion.multiply(
      turn.setFromAxisAngle(Y_AXIS, -(mesh.towPitch || mesh.gradePitch || 0)),
    );
  if (mesh.gradeRoll) object.quaternion.multiply(turn.setFromAxisAngle(X_AXIS, mesh.gradeRoll));
  object.position.set(
    (mesh.towOffsetX ?? 0) * Math.cos(yaw),
    (mesh.towOffsetX ?? 0) * Math.sin(yaw),
    (mesh.towOffsetZ ?? 0) + (mesh.gradeOffsetZ ?? 0),
  );
  asset.setTransportRamp(mesh.transportRamp ?? false);
  asset.setTowLift(mesh.towActive ?? false);
  asset.setTravel(mesh.wheelTravel ?? 0, !!mesh.towPitch);
  const cable = mesh.craneCableEnd;
  asset.setExcavator(
    mesh.excavatorPose,
    topDown && cable?.topDown ? { ...cable, ...cable.topDown } : cable,
  );
  asset.setDumpBed(mesh.bedTilt ?? 0, mesh.bedGateAngle ?? 0);
  asset.setEmergency(mesh.emergencyEnabled ?? false, mesh.presentationTime ?? 0);
}
