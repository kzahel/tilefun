import { vehicleTurningRadius } from "../traffic/Vehicle.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import { PHYSICS_DT } from "./PhysicsDefaults.js";
import type { MotionIntent } from "./PhysicsState.js";

export const angleDifference = (target: number, current: number) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));
const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));

/** A bounded traction motor, not an integrator. Rapier solves the supplied
 * velocity/rolling yaw together with every other body in the single world step. */
export function vehicleMotor(
  type: string,
  heading: number,
  vx: number,
  vy: number,
  grounded: boolean,
  input: MotionIntent,
): { vx: number; vy: number; yawRate?: number } {
  if (!grounded) return { vx, vy };
  const c = Math.cos(heading),
    s = Math.sin(heading);
  const rolling = vx * c + vy * s;
  const lateral = (-vx * s + vy * c) * Math.exp(-30 * PHYSICS_DT);
  const target = input.driveSpeed ?? 0;
  const braking = target === 0 || rolling * target < 0 || Math.abs(target) < Math.abs(rolling);
  const acceleration = vehiclePerformance(type).acceleration * (braking ? 2 : 1);
  let speed = rolling + clamp(target - rolling, acceleration * PHYSICS_DT);
  if (rolling * target < 0 && speed * rolling < 0) speed = 0;
  const error = input.heading === undefined ? undefined : angleDifference(input.heading, heading);
  const steer =
    error === undefined
      ? clamp(input.steering ?? 0, 1)
      : clamp((error / 0.7) * Math.sign(rolling || target), 1);
  // Use solved travel, not demanded speed: a stationary or pinned car cannot pivot.
  let yawRate = Math.abs(rolling) < 0.5 ? 0 : (rolling / vehicleTurningRadius(type)) * steer;
  if (error !== undefined) yawRate = clamp(yawRate, Math.abs(error) / PHYSICS_DT);
  return { vx: c * speed - s * lateral, vy: s * speed + c * lateral, yawRate };
}
