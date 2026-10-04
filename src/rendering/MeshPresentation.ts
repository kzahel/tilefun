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
