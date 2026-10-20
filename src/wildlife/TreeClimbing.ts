import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";

export interface ClimbTree {
  id: string;
  wx: number;
  wy: number;
  z: number;
  ground: number;
  gripX: number;
  gripY: number;
}
/** Real ordinary oak/palm trunks, with room for a compact animal outside the bark. */
export function climbTrees(
  props: readonly Prop[],
  surface: (p: PositionComponent) => number,
): ClimbTree[] {
  return props.flatMap((p) => {
    if (!["prop-oak-tree", "prop-palm-tree"].includes(p.type)) return [];
    const crown = p.walls?.find((w) => w.walkableTop && w.passable && w.zHeight !== undefined);
    const trunk = p.walls?.find((w) => !w.passable);
    if (!crown || !trunk) return [];
    const ground = surface(p.position);
    return [
      {
        id: p.proceduralId ?? p.persistentId ?? `${p.type}:${p.position.wx}:${p.position.wy}`,
        wx: p.position.wx + crown.offsetX,
        wy: p.position.wy + crown.offsetY - 1,
        z: ground + (crown.zBase ?? 0) + (crown.zHeight ?? 0),
        ground,
        gripX: p.position.wx + trunk.offsetX + trunk.width / 2 + 9,
        gripY: p.position.wy + trunk.offsetY,
      },
    ];
  });
}
export function sameTree(a: ClimbTree, b: ClimbTree) {
  return (
    a.id === b.id &&
    a.wx === b.wx &&
    a.wy === b.wy &&
    a.z === b.z &&
    a.ground === b.ground &&
    a.gripX === b.gripX &&
    a.gripY === b.gripY
  );
}
/** Continuous vertical grip followed by a short step onto the crown, reversed to descend. */
export function treeClimbPoint(tree: ClimbTree, fraction: number, down: boolean) {
  const t = Math.max(0, Math.min(1, down ? 1 - fraction : fraction));
  const step = Math.max(0, (t - 0.8) / 0.2);
  return {
    wx: tree.gripX + (tree.wx - tree.gripX) * step,
    wy: tree.gripY + (tree.wy - tree.gripY) * step,
    z: tree.ground + (tree.z - tree.ground) * Math.min(1, t / 0.8),
  };
}
export function controlsTreeHeight(a: Entity) {
  return !!a.animalWork?.tree && a.animalWork.climbZ !== undefined;
}
