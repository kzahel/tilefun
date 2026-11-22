import type { Entity } from "../entities/Entity.js";
import { rotateBodyVector, yawRotation } from "../physics/BodyRotation.js";
import { EXCAVATOR_ACTIONS, type ExcavatorAction } from "../shared/ExcavatorInput.js";
import { required } from "../shared/required.js";
import { vehicleNoseHeading } from "./Vehicle.js";

export const EXCAVATOR_TYPE = "vehicle-v1:excavator";
export const isExcavator = (e: Pick<Entity, "type">) => e.type === EXCAVATOR_TYPE;

// A packed pose leaves the wire and saved records with one immutable value.
// Mixed radix fits four 1/64-degree angles and the cargo bit in an exact JS integer.
const UNITS_PER_DEGREE = 64;
const TURN = 360 * UNITS_PER_DEGREE;
const BOOM_AND_STICK = 60 * UNITS_PER_DEGREE + 1;
const BUCKET = 48 * UNITS_PER_DEGREE + 1;
const places = [1, TURN, TURN * BOOM_AND_STICK, TURN * BOOM_AND_STICK ** 2] as const;
const sizes = [TURN, BOOM_AND_STICK, BOOM_AND_STICK, BUCKET] as const;
const FORMAT = 2 ** 32;
const POSE_END = FORMAT + 2 * places[3] * BUCKET;
const DEG = Math.PI / 180;
const OLD_FORMAT = 1 << 28;
const oldShifts = [0, 9, 15, 21] as const;
const coarseShifts = [0, 5, 9, 13] as const;

function jointAt(pose: number, index: number) {
  return Math.floor((pose - FORMAT) / 2 / required(places[index])) % required(sizes[index]);
}

function oldJoint(pose: number, index: number, wholeDegrees: boolean) {
  return wholeDegrees
    ? (pose >> required(oldShifts[index])) & (index === 0 ? 511 : 63)
    : (pose >> required(coarseShifts[index])) & (index === 0 ? 31 : 15);
}

export function validExcavatorPose(pose: unknown): pose is number {
  if (typeof pose !== "number" || !Number.isSafeInteger(pose) || pose < 0) return false;
  if (pose >= FORMAT) return pose < POSE_END;
  if (pose < 1 << 18) return [23, 5, 5, 4].every((max, i) => oldJoint(pose, i, false) <= max);
  return (
    pose >= OLD_FORMAT &&
    pose < OLD_FORMAT * 2 &&
    [359, 60, 60, 48].every((max, i) => oldJoint(pose, i, true) <= max)
  );
}

function packedDegrees(degrees: readonly number[], loaded: boolean) {
  return (
    FORMAT +
    2 * degrees.reduce((sum, angle, i) => sum + angle * UNITS_PER_DEGREE * required(places[i]), 0) +
    (loaded ? 1 : 0)
  );
}

export const EXCAVATOR_REST = packedDegrees([0, 24, 24, 24], false);

/** Upgrade coarse and whole-degree saved poses without shifting the links. */
export function fineExcavatorPose(pose = EXCAVATOR_REST) {
  if (pose >= FORMAT) return pose;
  const wholeDegrees = pose >= OLD_FORMAT;
  const degrees = places.map(
    (_, i) => oldJoint(pose, i, wholeDegrees) * (wholeDegrees ? 1 : i === 0 ? 15 : 12),
  );
  return packedDegrees(degrees, !!(pose & (wholeDegrees ? 1 << 27 : 1 << 17)));
}

export function excavatorAngles(pose?: number) {
  const value = fineExcavatorPose(pose);
  const unit = DEG / UNITS_PER_DEGREE;
  return {
    yaw: jointAt(value, 0) * unit,
    boom: 34 * DEG + jointAt(value, 1) * unit,
    stick: -136 * DEG + jointAt(value, 2) * unit,
    bucket: -59 * DEG + jointAt(value, 3) * unit,
    loaded: value % 2 === 1,
  };
}

function turnUnits(value: number) {
  return (value + TURN) % TURN;
}

function replacedJoint(pose: number, joint: number, value: number) {
  return pose + 2 * (value - jointAt(pose, joint)) * required(places[joint]);
}

export function nextExcavatorPose(pose: number | undefined, action: ExcavatorAction) {
  const value = fineExcavatorPose(pose);
  const index = EXCAVATOR_ACTIONS.indexOf(action);
  const joint = index >> 1;
  const current = jointAt(value, joint);
  const step = (index % 2 === 0 ? -1 : 1) * (joint === 0 ? 15 : 12) * UNITS_PER_DEGREE;
  const next =
    joint === 0
      ? turnUnits(current + step)
      : Math.max(0, Math.min(required(sizes[joint]) - 1, current + step));
  return replacedJoint(value, joint, next);
}

// Angular limits in degrees/s and degrees/s². The boom should gather
// speed more slowly than the dipper and bucket.
const motors = [
  { speed: 58, acceleration: 290 },
  { speed: 46, acceleration: 185 },
  { speed: 70, acceleration: 330 },
  { speed: 90, acceleration: 460 },
] as const;

const winch = { speed: 30, acceleration: 180 };
const forkliftLift = { speed: 28, acceleration: 105 };
export type ArmMotorProfile = "crane" | "forklift";
function armMotor(joint: number, profile?: ArmMotorProfile) {
  if (profile === "crane" && joint === 3) return winch;
  if (profile === "forklift" && joint === 2) return forkliftLift;
  return required(motors[joint]);
}

/** A held pitch joint heads for its hard stop. The cab can swing all the way
 * around, so give it a target one quarter turn ahead on each tick. */
export function excavatorHoldTarget(pose: number, action: ExcavatorAction) {
  const index = EXCAVATOR_ACTIONS.indexOf(action);
  const joint = index >> 1;
  const direction = index % 2 === 0 ? -1 : 1;
  const limit =
    joint === 0
      ? turnUnits(jointAt(pose, joint) + (direction * TURN) / 4)
      : direction > 0
        ? required(sizes[joint]) - 1
        : 0;
  return replacedJoint(pose, joint, limit);
}

function jointDifference(joint: number, angle: number, goal: number) {
  const difference = goal - angle;
  return joint === 0 && Math.abs(difference) > TURN / 2
    ? difference - Math.sign(difference) * TURN
    : difference;
}

/** Put a new target at the stopping distance when the operator lets go. */
export function excavatorBrakeTarget(
  pose: number,
  target: number,
  rate: number,
  profile?: ArmMotorProfile,
) {
  for (const joint of motors.keys()) {
    const { acceleration } = armMotor(joint, profile);
    const angle = jointAt(pose, joint);
    const remaining = jointDifference(joint, angle, jointAt(target, joint));
    if (remaining === 0) continue;
    const braking = Math.ceil(((rate * rate) / (2 * acceleration)) * UNITS_PER_DEGREE);
    const stop = angle + Math.sign(remaining) * Math.min(Math.abs(remaining), braking);
    return replacedJoint(pose, joint, joint === 0 ? turnUnits(stop) : stop);
  }
  return pose;
}

/** Limit angular acceleration and reserve travel to brake before the target. */
export function advanceExcavatorPose(
  pose: number,
  target: number,
  rate: number,
  dt: number,
  profile?: ArmMotorProfile,
) {
  for (const joint of motors.keys()) {
    const motor = armMotor(joint, profile);
    const angle = jointAt(pose, joint);
    const goal = jointAt(target, joint);
    const remaining = jointDifference(joint, angle, goal);
    if (remaining === 0) continue;
    const direction = Math.sign(remaining);
    const distance = Math.abs(remaining) / UNITS_PER_DEGREE;
    const speedChange = motor.acceleration * dt;
    // Travel this tick at the average speed, then reserve enough arc to
    // brake from the next speed. Solve both distances together for that speed.
    const brakingSpeed = Math.max(
      0,
      Math.sqrt(
        Math.max(
          0,
          2 * motor.acceleration * distance - speedChange * Math.abs(rate) + (speedChange / 2) ** 2,
        ),
      ) -
        speedChange / 2,
    );
    const desired = direction * Math.min(motor.speed, brakingSpeed);
    const nextRate = Math.fround(
      rate + Math.max(-speedChange, Math.min(speedChange, desired - rate)),
    );
    const travelled = Math.floor(Math.abs((rate + nextRate) * 0.5 * dt) * UNITS_PER_DEGREE);
    if (
      travelled >= Math.abs(remaining) ||
      (Math.abs(remaining) === 1 && Math.abs(rate) <= speedChange)
    ) {
      const next = replacedJoint(pose, joint, goal);
      return { pose: next, rate: 0 };
    }
    const step = travelled * direction;
    const next = joint === 0 ? turnUnits(angle + step) : angle + step;
    return { pose: replacedJoint(pose, joint, next), rate: nextRate };
  }
  return { pose: target, rate: 0 };
}

export function excavatorLoad(pose: number, loaded: boolean) {
  const value = fineExcavatorPose(pose);
  return value - (value % 2) + Number(loaded);
}

export interface ExcavatorPoint {
  x: number;
  y: number;
  z: number;
}

/** Authored ground-centred linkage for collision, visuals and work requests. */
export function excavatorLinkage(pose: number | undefined) {
  const { yaw, boom, stick, bucket } = excavatorAngles(pose);
  let reach = 10;
  let height = 24;
  const point = (): ExcavatorPoint => ({
    x: reach * Math.cos(yaw),
    y: reach * Math.sin(yaw),
    z: height,
  });
  const hinge = point();
  reach += 43 * Math.cos(boom);
  height += 43 * Math.sin(boom);
  const elbow = point();
  reach += 32 * Math.cos(boom + stick);
  height += 32 * Math.sin(boom + stick);
  const wrist = point();
  reach += 16 * Math.cos(boom + stick + bucket);
  height += 16 * Math.sin(boom + stick + bucket);
  return {
    yaw,
    pitches: [boom, boom + stick, boom + stick + bucket] as const,
    points: [hinge, elbow, wrist, point()] as const,
  };
}

/** Match the retained GLB pivots in world pixels, including an inclined chassis. */
export function excavatorArm(e: Entity, pose: number | undefined) {
  const q = e.bodyRotation ?? yawRotation(vehicleNoseHeading(e));
  return excavatorLinkage(pose).points.map(({ x, y, z }) => {
    const offset = rotateBodyVector(q, x, y, z);
    return {
      wx: e.position.wx + offset.x,
      wy: e.position.wy + offset.y,
      wz: (e.wz ?? 0) + offset.z,
    };
  });
}
