import type { MeshInstance } from "./MeshPresentation.js";
import type { SpriteItem } from "./SceneItem.js";

/** A world-axis offset about the vehicle pivot, transformed by its mesh-only grade.
 * Upright occupants move their feet with the platform; their sprite stays vertical.
 */
export function meshGradePoint(mesh: MeshInstance, x: number, y: number, z: number) {
  const pitch = mesh.gradePitch ?? 0,
    roll = mesh.gradeRoll ?? 0;
  if (!pitch && !roll) return { x, y, z: z + (mesh.gradeOffsetZ ?? 0) };
  const yaw = 2 * Math.atan2(mesh.orientation[2], mesh.orientation[3]),
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll),
    lx = c * x + s * y,
    ly = -s * x + c * y,
    tx = cp * lx - sp * (sr * ly + cr * z),
    ty = cr * ly - sr * z;
  return {
    x: c * tx - s * ty,
    y: s * tx + c * ty,
    z: sp * lx + cp * (sr * ly + cr * z) + (mesh.gradeOffsetZ ?? 0),
  };
}

export function meshBedFoot(owner: SpriteItem, item: SpriteItem) {
  const x = item.wx - owner.wx,
    y = item.wy - owner.wy,
    z = item.zOffset - owner.zOffset;
  if (item.meshBedSupport && owner.mesh) return meshGradePoint(owner.mesh, x, y, z);
  const support = item.meshRoofSupport;
  if (support?.ownerAssetId && support.ownerAssetId === owner.mesh?.assetId)
    return {
      x: x + (support.offsetX ?? 0),
      y: y + (support.offsetY ?? 0),
      z: z - support.heightDelta,
    };
  return { x, y, z };
}

/** Same transformed child pivot for target bounds and the actual compound draw. */
export function meshChildPoint(owner: SpriteItem, child: SpriteItem) {
  const mesh = child.mesh;
  const yaw = mesh ? 2 * Math.atan2(mesh.orientation[2], mesh.orientation[3]) : 0;
  const x = child.wx - owner.wx + (mesh?.towOffsetX ?? 0) * Math.cos(yaw),
    y = child.wy - owner.wy + (mesh?.towOffsetX ?? 0) * Math.sin(yaw),
    z = child.zOffset - owner.zOffset + (mesh?.towOffsetZ ?? 0) + (mesh?.gradeOffsetZ ?? 0);
  return owner.mesh ? meshGradePoint(owner.mesh, x, y, z) : { x, y, z };
}
