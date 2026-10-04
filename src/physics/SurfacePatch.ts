import type { AABB } from "../entities/collision.js";

/** Bounded planar floor with a solid underside. Heights are absolute world pixels.
 * Stored on a prop collider for this first slice; independent of sprites/terrain storage.
 */
export interface SurfacePatch {
  id: string;
  spaceId: string;
  /** Top at the footprint's north-west corner. */
  z: number;
  riseX: number;
  riseY: number;
  thickness: number;
  /** Neighboring patch identities, for inspection/connectivity metadata. */
  connectsTo: string[];
}

export function surfaceZAt(patch: SurfacePatch, bounds: AABB, x: number, y: number): number {
  return (
    patch.z +
    patch.riseX * ((x - bounds.left) / (bounds.right - bounds.left)) +
    patch.riseY * ((y - bounds.top) / (bounds.bottom - bounds.top))
  );
}

/** Exact extrema of a plane over the intersecting rectangle. Undefined outside. */
export function querySurfacePatch(patch: SurfacePatch, bounds: AABB, footprint: AABB) {
  const left = Math.max(bounds.left, footprint.left),
    right = Math.min(bounds.right, footprint.right);
  const top = Math.max(bounds.top, footprint.top),
    bottom = Math.min(bounds.bottom, footprint.bottom);
  if (left >= right || top >= bottom) return undefined;
  const a = surfaceZAt(patch, bounds, left, top),
    b = surfaceZAt(patch, bounds, right, bottom);
  const c = surfaceZAt(patch, bounds, right, top),
    d = surfaceZAt(patch, bounds, left, bottom);
  const topMin = Math.min(a, b, c, d),
    topMax = Math.max(a, b, c, d);
  return {
    id: patch.id,
    spaceId: patch.spaceId,
    topMin,
    topMax,
    bottomMin: topMin - patch.thickness,
    bottomMax: topMax - patch.thickness,
  };
}

export function validateSurfacePatch(p: SurfacePatch, width: number, height: number): void {
  if (
    !p.id ||
    !p.spaceId ||
    ![p.z, p.riseX, p.riseY, p.thickness, width, height].every(Number.isFinite) ||
    p.thickness <= 0 ||
    width <= 0 ||
    height <= 0 ||
    Math.abs(p.riseX / width) > 1 ||
    Math.abs(p.riseY / height) > 1 ||
    !Array.isArray(p.connectsTo) ||
    p.connectsTo.some((id) => typeof id !== "string" || !id)
  )
    throw new Error("Invalid surface patch");
}
