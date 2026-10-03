import { type AABB, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { PropCollider } from "../entities/Prop.js";
import type { PropSurface } from "../physics/surfaceHeight.js";

export interface PropDepthSurface {
  readonly bounds: Readonly<AABB>;
  readonly topZ: number;
  readonly depth: number;
}
/** Build once per scene collection, rather than recomputing prop boxes for every actor. */
export function propDepthSurfaces(props: readonly PropSurface[]): PropDepthSurface[] {
  return props.flatMap((p) =>
    (p.walls ?? (p.collider ? [p.collider] : [])).flatMap((c) =>
      c.zHeight !== undefined && Number.isFinite(c.zHeight) && c.zHeight > 0
        ? [
            {
              bounds: getEntityAABB(p.position, c),
              topZ: (c.zBase ?? 0) + c.zHeight,
              depth: p.position.wy,
            },
          ]
        : [],
    ),
  );
}
// Scalar snapshots detect in-place editor changes as well as replicated replacements.
type DepthCollider = Pick<PropCollider, "offsetX" | "offsetY" | "width" | "height"> & {
  zBase: number;
  zHeight: number | undefined;
};
interface CachedPropDepth {
  wx: number;
  wy: number;
  colliders: DepthCollider[];
  surfaces: PropDepthSurface[];
  visited: boolean;
}

function matchesCollider(a: DepthCollider, b: PropCollider): boolean {
  return (
    Object.is(a.offsetX, b.offsetX) &&
    Object.is(a.offsetY, b.offsetY) &&
    Object.is(a.width, b.width) &&
    Object.is(a.height, b.height) &&
    Object.is(a.zBase, b.zBase ?? 0) &&
    Object.is(a.zHeight, b.zHeight)
  );
}

function matchesProp(entry: CachedPropDepth, prop: PropSurface): boolean {
  if (!Object.is(entry.wx, prop.position.wx) || !Object.is(entry.wy, prop.position.wy))
    return false;
  const count = prop.walls ? prop.walls.length : prop.collider ? 1 : 0;
  if (entry.colliders.length !== count) return false;
  for (let i = 0; i < count; i++) {
    const current = prop.walls ? prop.walls[i] : prop.collider;
    const previous = entry.colliders[i];
    if (!current || !previous || !matchesCollider(previous, current)) return false;
  }
  return true;
}

/** Per-client presentation metadata. Only props in the latest collection remain resident.
 * Results and surface records are read-only borrows; release the list after drawing.
 * Geometry is checked each collection because editor/preview props can mutate in place.
 */
export class PropDepthCache {
  private readonly resident = new Map<PropSurface, CachedPropDepth>();
  private readonly output: PropDepthSurface[] = [];
  private visitStamp = false;
  private builds = 0;
  private createdSurfaces = 0;

  collect(props: readonly PropSurface[]): readonly PropDepthSurface[] {
    this.release();
    const visited = !this.visitStamp;
    this.visitStamp = visited;
    try {
      for (const prop of props) {
        let entry = this.resident.get(prop);
        if (!entry || !matchesProp(entry, prop)) {
          const colliders: DepthCollider[] = [];
          const count = prop.walls ? prop.walls.length : prop.collider ? 1 : 0;
          for (let i = 0; i < count; i++) {
            const c = prop.walls ? prop.walls[i] : prop.collider;
            if (c)
              colliders.push({
                offsetX: c.offsetX,
                offsetY: c.offsetY,
                width: c.width,
                height: c.height,
                zBase: c.zBase ?? 0,
                zHeight: c.zHeight,
              });
          }
          const surfaces = propDepthSurfaces([prop]);
          entry = { wx: prop.position.wx, wy: prop.position.wy, colliders, surfaces, visited };
          this.resident.set(prop, entry);
          this.builds++;
          this.createdSurfaces += surfaces.length;
        }
        entry.visited = visited;
        for (const surface of entry.surfaces) this.output.push(surface);
      }
      for (const prop of this.resident.keys()) {
        if (this.resident.get(prop)?.visited !== visited) this.resident.delete(prop);
      }
      return this.output;
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  release(): void {
    this.output.length = 0;
  }

  clear(): void {
    this.release();
    this.resident.clear();
  }

  getDiagnostics() {
    return {
      residentProps: this.resident.size,
      builds: this.builds,
      createdSurfaces: this.createdSurfaces,
      borrowedSurfaces: this.output.length,
    };
  }
}

/** Y+Z is insufficient for long, low props. Above an overlapping top, draw after its sprite. */
export function depthAboveProps(
  baseDepth: number,
  footprint: AABB | null,
  feetZ: number,
  surfaces: readonly PropDepthSurface[],
): number {
  if (!footprint) return baseDepth;
  let depth = baseDepth;
  for (const surface of surfaces)
    if (feetZ >= surface.topZ && aabbsOverlap(footprint, surface.bounds))
      depth = Math.max(depth, surface.depth + 0.001);
  return depth;
}
