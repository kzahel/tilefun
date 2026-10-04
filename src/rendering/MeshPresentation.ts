/** Data-only optional presentation. SpriteItem remains the complete fallback. */
export interface MeshInstance {
  readonly assetId: string;
  readonly orientation: readonly [number, number, number, number];
  /** Conservative sphere, in world pixels, enclosing every supported pose. */
  readonly radius: number;
}
export const COMPACT_CAR_MESH = "compact-car-proxy-v1";
export function yawOrientation(yaw: number): MeshInstance["orientation"] {
  return [0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2)];
}
export function resolveBody(
  instance: MeshInstance | undefined,
  ready: ReadonlySet<string>,
): "mesh" | "sprite" {
  return instance && ready.has(instance.assetId) ? "mesh" : "sprite";
}

/** Local roll X, pitch Y, then world yaw Z (qZ * qY * qX). Cosmetic inspection only. */
export function poseOrientation(yaw: number, pitch = 0, roll = 0): MeshInstance["orientation"] {
  const cy = Math.cos(yaw / 2),
    sy = Math.sin(yaw / 2),
    cp = Math.cos(pitch / 2),
    sp = Math.sin(pitch / 2),
    cr = Math.cos(roll / 2),
    sr = Math.sin(roll / 2);
  return [
    cy * cp * sr - sy * sp * cr,
    cy * sp * cr + sy * cp * sr,
    sy * cp * cr - cy * sp * sr,
    cy * cp * cr + sy * sp * sr,
  ];
}
