import * as THREE from "three";
import { authoredTrainForAsset } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForAsset, vehicleMeshHeightScale } from "./AuthoredVehicleMeshes.js";
import { type CarMeshAsset, loadCarMesh } from "./CarMeshAsset.js";
import type { MeshInstance } from "./MeshPresentation.js";

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const turn = new THREE.Quaternion();

/** Gameplay loading options for one registered vehicle or train asset, shared by
 * every view that draws authored bodies. Unregistered IDs return undefined. */
export function loadAuthoredMesh(assetId: string): Promise<CarMeshAsset> | undefined {
  const vehicle = authoredVehicleForAsset(assetId);
  const definition = vehicle ?? authoredTrainForAsset(assetId);
  if (!definition) return undefined;
  return loadCarMesh(definition.path, definition.lateralScale, {
    batch: !!vehicle,
    heightScale: vehicle ? vehicleMeshHeightScale(vehicle.vehicle) : 1,
    contactShadow: !!vehicle,
    preserveParts: vehicle?.batchPreserveParts ?? [],
  });
}

/**
 * Absolute pose per draw for one body: orientation, mesh-only grade/tow offsets
 * about the pivot and every rig part. The fixed-view body target and the
 * first-person scene (229) both call this. Grouped composition (a towed car posed
 * relative to its truck, bed contents) stays in GpuMeshBodies; first person draws
 * group members as separate bodies. A shared asset never carries another
 * instance's phase.
 */
export function applyMeshInstance(asset: CarMeshAsset, mesh: MeshInstance): void {
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
  asset.setDumpBed(mesh.bedTilt ?? 0, mesh.bedGateAngle ?? 0);
  asset.setEmergency(mesh.emergencyEnabled ?? false, mesh.presentationTime ?? 0);
}
