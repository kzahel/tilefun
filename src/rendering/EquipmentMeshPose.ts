import type { Entity } from "../entities/Entity.js";
import { clampBedTilt, gateAngleForTilt, hasDumpBed } from "../traffic/DumpBed.js";
import { isTowTruck } from "../traffic/Towing.js";
import { isTransporter } from "../traffic/Transporter.js";
import type { MeshInstance } from "./MeshPresentation.js";

/** Articulated rig inputs from replicated equipment state: the dump tub and
 * tailgate, the tow boom/cradle and the transporter ramp. Empty for other models. */
export function equipmentMeshPose(
  entity: Pick<Entity, "type" | "vehicleBedTilt" | "towTargetId" | "vehicleRamp">,
): Partial<Pick<MeshInstance, "bedTilt" | "bedGateAngle" | "towActive" | "transportRamp">> {
  if (hasDumpBed(entity)) {
    const tilt = clampBedTilt(entity.vehicleBedTilt);
    return { bedTilt: tilt, bedGateAngle: gateAngleForTilt(tilt) };
  }
  if (isTowTruck(entity)) return { towActive: entity.towTargetId !== undefined };
  if (isTransporter(entity)) return { transportRamp: entity.vehicleRamp === 1 };
  return {};
}
