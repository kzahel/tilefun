import type { AABB } from "../entities/collision.js";
import type { ColliderComponent, PositionComponent } from "../entities/Entity.js";

export interface AABB3D {
  left: number;
  top: number;
  right: number;
  bottom: number;
  zMin: number;
  zMax: number;
}

/** Check if two 3D AABBs overlap (strict inequality — touching edges don't count). */
export function aabb3DOverlap(a: AABB3D, b: AABB3D): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top &&
    a.zMin < b.zMax &&
    a.zMax > b.zMin
  );
}

/** Convert entity position + collider + Z info into a 3D AABB. */
export function entityToAABB3D(
  pos: PositionComponent,
  collider: ColliderComponent,
  wz: number,
  physicalHeight: number,
): AABB3D {
  return {
    left: pos.wx + collider.offsetX - collider.width / 2,
    top: pos.wy + collider.offsetY - collider.height,
    right: pos.wx + collider.offsetX + collider.width / 2,
    bottom: pos.wy + collider.offsetY,
    zMin: wz,
    zMax: wz + physicalHeight,
  };
}

/** Check if two entities overlap in the Z axis. */
export function zRangesOverlap(
  aWz: number,
  aHeight: number,
  bWz: number,
  bHeight: number,
): boolean {
  return aWz < bWz + bHeight && aWz + aHeight > bWz;
}

/** Extract the XY AABB from a 3D AABB (for use with existing 2D functions). */
export function toAABB(box: AABB3D): AABB {
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
}
