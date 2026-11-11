import { getEntityAABB } from "../entities/collision.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import { rectangle } from "./SurfacePartition.js";
import type { SurfaceFace, SurfaceSource } from "./SurfaceReceivers.js";

interface ColliderShape {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  zBase: number;
  zHeight: number | undefined;
  patchId: string | undefined;
  z: number | undefined;
  riseX: number | undefined;
  riseY: number | undefined;
}
interface CachedCollider {
  shape: ColliderShape;
  source: SurfaceSource;
}
interface CachedProp {
  id: number;
  wx: number;
  wy: number;
  colliders: CachedCollider[];
}
function shape(c: PropCollider): ColliderShape {
  return {
    offsetX: c.offsetX,
    offsetY: c.offsetY,
    width: c.width,
    height: c.height,
    zBase: c.zBase ?? 0,
    zHeight: c.zHeight,
    patchId: c.surface?.id,
    z: c.surface?.z,
    riseX: c.surface?.riseX,
    riseY: c.surface?.riseY,
  };
}
function matches(a: ColliderShape, c: PropCollider) {
  return (
    Object.is(a.offsetX, c.offsetX) &&
    Object.is(a.offsetY, c.offsetY) &&
    Object.is(a.width, c.width) &&
    Object.is(a.height, c.height) &&
    Object.is(a.zBase, c.zBase ?? 0) &&
    Object.is(a.zHeight, c.zHeight) &&
    a.patchId === c.surface?.id &&
    Object.is(a.z, c.surface?.z) &&
    Object.is(a.riseX, c.surface?.riseX) &&
    Object.is(a.riseY, c.surface?.riseY)
  );
}
const count = (p: Prop) => (p.walls ? p.walls.length : p.collider ? 1 : 0);
const collider = (p: Prop, i: number) => (p.walls ? p.walls[i] : p.collider);
function matchesProp(entry: CachedProp, p: Prop) {
  if (
    entry.id !== p.id ||
    !Object.is(entry.wx, p.position.wx) ||
    !Object.is(entry.wy, p.position.wy) ||
    entry.colliders.length !== count(p)
  )
    return false;
  for (let i = 0; i < entry.colliders.length; i++) {
    const a = entry.colliders[i],
      b = collider(p, i);
    if (!a || !b || !matches(a.shape, b)) return false;
  }
  return true;
}

/** Per-client, weak prop identity. Faces are immutable borrows; edits replace them.
 * Visibility/excavation/eligibility are still evaluated from current colliders per view. */
export class PropReceiverCache {
  private props = new WeakMap<Prop, CachedProp>();
  get(prop: Prop): readonly CachedCollider[] {
    let entry = this.props.get(prop);
    if (entry && matchesProp(entry, prop)) return entry.colliders;
    const colliders: CachedCollider[] = [];
    for (let i = 0; i < count(prop); i++) {
      const c = collider(prop, i);
      if (!c) continue;
      const bounds = getEntityAABB(prop.position, c),
        patch = c.surface;
      const face: SurfaceFace = {
        id: patch?.id ?? `prop:${prop.id}:${i}`,
        bounds,
        polygon: rectangle(bounds),
        plane: patch
          ? [
              patch.riseX / c.width,
              patch.riseY / c.height,
              patch.z -
                (patch.riseX / c.width) * bounds.left -
                (patch.riseY / c.height) * bounds.top,
            ]
          : [0, 0, (c.zBase ?? 0) + (c.zHeight ?? 0)],
      };
      const faces = [face];
      colliders.push({ shape: shape(c), source: { bounds, faces: () => faces } });
    }
    entry = { id: prop.id, wx: prop.position.wx, wy: prop.position.wy, colliders };
    this.props.set(prop, entry);
    return colliders;
  }
  clear() {
    this.props = new WeakMap();
  }
}
