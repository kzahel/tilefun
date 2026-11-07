import type { AngularVelocity, BodyRotation } from "./BodyRotation.js";
export interface MotionIntent {
  vx: number;
  vy: number;
  jump?: boolean;
  jumpPressed?: boolean;
  /** Prescribed flight/platform altitude; still integrated in the shared scene. */
  altitude?: number;
  heading?: number;
  driveSpeed?: number;
  steering?: number;
  controlUntil?: number;
}
/** Bounded numerical replay state; no WASM world or gameplay objects on the wire. */
export const MAX_PREDICTION_BODIES = 128;
export const PREDICTION_RADIUS = 160;

export type PhysicsBodyKind = "character" | "vehicle" | "loose" | "fixed";
export interface PhysicsBodyState {
  id: number;
  kind: PhysicsBodyKind;
  x: number;
  y: number;
  z: number;
  /** Previous fixed-tick pose, including through zero-replay acknowledgements. */
  prevX: number;
  prevY: number;
  prevZ: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  prevHeading: number;
  rotation?: BodyRotation;
  prevRotation?: BodyRotation;
  angularVelocity?: AngularVelocity;
  sleeping?: boolean;
  jumpHeld: boolean;
  /** One airborne press, consumed by the next grounded jump while still held. */
  jumpQueued?: boolean;
  grounded: boolean;
  groundZ: number;
  desiredVx: number;
  desiredVy: number;
  altitude?: number;
  desiredHeading?: number;
  desiredDriveSpeed?: number;
  desiredSteering?: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  supportId?: number;
  /** Horizontal support velocity captured at departure, independent of later carrier motion. */
  inheritedVx?: number;
  inheritedVy?: number;
  /** Dump-bed angle and requested target (radians); advanced only by the shared step. */
  bedTilt?: number;
  bedTarget?: number;
  /** Exclusive physics tick deadline for a network-controlled motor. */
  controlUntil?: number;
}
export interface PhysicsState {
  epoch: number;
  tick: number;
  /** Bodies excluded by the bounded local snapshot. Prediction must not ignore overflow. */
  omitted: number;
  bodies: PhysicsBodyState[];
  /** Solved body pairs at this tick, restricted to the captured body set. */
  contacts: [number, number][];
}
