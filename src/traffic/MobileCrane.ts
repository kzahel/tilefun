import type { Entity } from "../entities/Entity.js";
import { rotateBodyVector, yawRotation } from "../physics/BodyRotation.js";
import { EXCAVATOR_REST, excavatorAngles, excavatorHoldTarget } from "./Excavator.js";
import { vehicleNoseHeading } from "./Vehicle.js";

export const MOBILE_CRANE_TYPE = "vehicle-v1:mobile-crane";
export const isMobileCrane = (e: Pick<Entity, "type">) => e.type === MOBILE_CRANE_TYPE;
export const CRANE_REST = excavatorHoldTarget(
  excavatorHoldTarget(excavatorHoldTarget(EXCAVATOR_REST, "boom-down"), "stick-in"),
  "bucket-open",
);

// Authored pivots and telescoping travel in the retained Blender master.
export const CRANE_SCALE = 400 / 23;
const DEG = Math.PI / 180;
const PIVOT = { x: -2.1 * CRANE_SCALE, y: -0.35 * CRANE_SCALE, z: 2 * CRANE_SCALE };

export function craneRig(pose = CRANE_REST) {
  const joints = excavatorAngles(pose);
  return {
    yaw: joints.yaw,
    pitch: joints.boom - 34 * DEG,
    extension: ((joints.stick + 136 * DEG) / (60 * DEG)) * (2 * CRANE_SCALE),
    cable: 8 + ((joints.bucket + 59 * DEG) / (48 * DEG)) * 136,
  };
}

/** Local ground-centred boom root and sheave, in world pixels. */
export function craneLinkage(pose?: number) {
  const { yaw, pitch, extension } = craneRig(pose);
  const length = 5.65 * CRANE_SCALE + extension;
  const rise = 0.04 * CRANE_SCALE;
  const reach = length * Math.cos(pitch) - rise * Math.sin(pitch);
  return {
    start: PIVOT,
    tip: {
      x: PIVOT.x + reach * Math.cos(yaw),
      y: PIVOT.y + reach * Math.sin(yaw),
      z: PIVOT.z + length * Math.sin(pitch) + rise * Math.cos(pitch),
    },
    yaw,
    pitch: pitch + Math.atan2(rise, length),
    length: Math.hypot(length, rise),
  };
}

/** The eye moves with the load's local up axis as the pallet pitches and rolls. */
export function craneCargoHook(cargo: Entity) {
  const height = cargo.collider?.physicalHeight ?? 0;
  const eye = rotateBodyVector(cargo.bodyRotation ?? yawRotation(0), 0, 0, height);
  return {
    wx: cargo.position.wx + eye.x,
    wy: cargo.position.wy + eye.y,
    wz: (cargo.wz ?? 0) + eye.z,
  };
}

export function craneTip(crane: Entity) {
  const { x, y, z } = craneLinkage(crane.vehicleExcavator).tip;
  const offset = rotateBodyVector(
    crane.bodyRotation ?? yawRotation(vehicleNoseHeading(crane)),
    x,
    y,
    z,
  );
  return {
    wx: crane.position.wx + offset.x,
    wy: crane.position.wy + offset.y,
    wz: (crane.wz ?? 0) + offset.z,
  };
}
