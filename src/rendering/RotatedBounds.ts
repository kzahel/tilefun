import type { BodyRotation } from "../physics/BodyRotation.js";
import type { Point3 } from "./SurfaceReceivers.js";

/** The same eight corner transforms as rotateBodyVector, without temporary vectors/arrays. */
export function rotatedBounds(
  q: BodyRotation,
  position: Point3,
  min: readonly number[],
  max: readonly number[],
) {
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 4 ? max[0] : min[0]) ?? 0,
      y = (i & 2 ? max[1] : min[1]) ?? 0,
      z = (i & 1 ? max[2] : min[2]) ?? 0;
    const tx = 2 * (q[1] * z - q[2] * y),
      ty = 2 * (q[2] * x - q[0] * z),
      tz = 2 * (q[0] * y - q[1] * x);
    const wx = x + q[3] * tx + q[1] * tz - q[2] * ty + position[0],
      wy = y + q[3] * ty + q[2] * tx - q[0] * tz + position[1],
      wz = z + q[3] * tz + q[0] * ty - q[1] * tx + position[2];
    left = Math.min(left, wx);
    right = Math.max(right, wx);
    top = Math.min(top, wy);
    bottom = Math.max(bottom, wy);
    minZ = Math.min(minZ, wz);
    maxZ = Math.max(maxZ, wz);
  }
  return { bounds: { left, right, top, bottom }, minZ, maxZ };
}
