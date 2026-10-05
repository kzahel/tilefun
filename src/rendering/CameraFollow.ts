import { CAMERA_LERP, TICK_RATE } from "../config/constants.js";

/** Opaque identity distinguishes clock restarts, including new predictor instances. */
export interface CameraPresentationTime {
  time: number;
  domain: string | object;
}

export interface CameraFollowState {
  time: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}
// Preserve the ordinary 60Hz follow response independently of server/render Hz.
const DECAY_RATE = -Math.log(1 - CAMERA_LERP) * TICK_RATE;

/** Exact exponential follow of a target moving linearly between observations.
 * It composes across omitted render frames for straight constant-speed motion.
 * A repeated/regressing timestamp cannot advance state. Resets pass null.
 */
export function advanceCameraFollow(
  previous: CameraFollowState | null,
  time: number,
  targetX: number,
  targetY: number,
): CameraFollowState {
  if (!previous) return { time, x: targetX, y: targetY, targetX, targetY };
  const dt = time - previous.time;
  if (dt <= 0) return previous;
  const decay = Math.exp(-DECAY_RATE * dt);
  const gain = -Math.expm1(-DECAY_RATE * dt);
  const axis = (value: number, start: number, end: number) => {
    const velocity = (end - start) / dt;
    return end + (value - start) * decay - (velocity * gain) / DECAY_RATE;
  };
  return {
    time,
    x: axis(previous.x, previous.targetX, targetX),
    y: axis(previous.y, previous.targetY, targetY),
    targetX,
    targetY,
  };
}
