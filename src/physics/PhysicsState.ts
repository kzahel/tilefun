export interface MotionIntent {
  vx: number;
  vy: number;
  jump?: boolean;
  jumpPressed?: boolean;
  /** Prescribed flight/platform altitude; still integrated in the shared scene. */
  altitude?: number;
  heading?: number;
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
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  jumpHeld: boolean;
  grounded: boolean;
  groundZ: number;
  desiredVx: number;
  desiredVy: number;
  altitude?: number;
  desiredHeading?: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  supportId?: number;
  /** Exclusive physics tick deadline for a network-controlled motor. */
  controlUntil?: number;
}
export interface PhysicsState {
  epoch: number;
  tick: number;
  /** Bodies excluded by the bounded local snapshot. Prediction must not ignore overflow. */
  omitted: number;
  bodies: PhysicsBodyState[];
}
