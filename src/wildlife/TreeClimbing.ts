import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { gap } from "../shared/gap.js";
import type { AnimalWork } from "./AnimalWork.js";
import type { WildlifeEnvironment } from "./WildlifeEnvironment.js";

export interface ClimbTree {
  id: string;
  wx: number;
  wy: number;
  z: number;
  ground: number;
  gripX: number;
  gripY: number;
  crownEdgeX?: number;
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
        crownEdgeX: p.position.wx + crown.offsetX + crown.width / 2,
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
/** Visible near edge, within the ordinary oak/palm crown's actual width and depth. */
export function canopyLeafPoint(tree: ClimbTree) {
  return { wx: tree.wx + 8, wy: tree.wy - 4 };
}

export function catClimbGrip(tree: ClimbTree, halfWidth: number) {
  return {
    wx: Math.max(tree.gripX, (tree.crownEdgeX ?? tree.gripX) + halfWidth + 2),
    wy: tree.gripY,
  };
}

/** Climb outside the solid canopy, step over its lip, then settle onto it. */
export function catClimbPoint(tree: ClimbTree, fraction: number, down: boolean, halfWidth: number) {
  const t = down ? 1 - fraction : fraction;
  const grip = catClimbGrip(tree, halfWidth);
  const step = Math.max(0, Math.min(1, (t - 0.72) / 0.22));
  const lift = Math.min(1, t / 0.72);
  const settle = Math.max(0, (t - 0.94) / 0.06);
  return {
    wx: grip.wx + (tree.wx - grip.wx) * step,
    wy: grip.wy + (tree.wy - grip.wy) * step,
    z: tree.ground + (tree.z + 2 - tree.ground) * lift - 2 * settle,
  };
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

export function advanceTreeClimb(
  animal: Entity,
  task: AnimalWork,
  tree: ClimbTree,
  aroundCanopy: boolean,
  dt: number,
  environment: WildlifeEnvironment,
): "blocked" | "stalled" | "moving" | "arrived" {
  const down = task.state === "descend";
  const duration = Math.max(1.5, (tree.z - tree.ground) / 8);
  const fraction = Math.min(1, task.elapsed / duration);
  const halfWidth = (animal.collider?.width ?? 14) / 2;
  const grip = aroundCanopy ? catClimbGrip(tree, halfWidth) : { wx: tree.gripX, wy: tree.gripY };
  const from = task.climbFrom;
  const point =
    down && from && from.z < tree.z - 0.1
      ? {
          wx: from.wx + (grip.wx - from.wx) * fraction,
          wy: from.wy + (grip.wy - from.wy) * fraction,
          z: from.z + (tree.ground - from.z) * fraction,
        }
      : aroundCanopy
        ? catClimbPoint(tree, fraction, down, halfWidth)
        : treeClimbPoint(tree, fraction, down);
  if (
    !environment.canOccupy({ collider: animal.collider, wz: point.z }, point) ||
    environment.isWater(point)
  )
    return "blocked";

  const distance = gap(animal.position, point);
  const heightError = Math.abs((animal.wz ?? 0) - point.z);
  // A real canopy or wall can block a prescribed climb. Release a stalled motor.
  if (task.elapsed > duration + 1 && (heightError > 3 || distance > 3)) return "stalled";
  task.climbZ = point.z;
  animal.motionIntent ??= { vx: 0, vy: 0 };
  animal.motionIntent.altitude = point.z;
  const tick = Math.max(dt, 0.001);
  animal.motionIntent.vx = (point.wx - animal.position.wx) / tick;
  animal.motionIntent.vy = (point.wy - animal.position.wy) / tick;
  return fraction === 1 && distance < 1 && (!aroundCanopy || heightError < 2)
    ? "arrived"
    : "moving";
}
