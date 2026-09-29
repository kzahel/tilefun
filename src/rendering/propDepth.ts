import { type AABB, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { PropSurface } from "../physics/surfaceHeight.js";

export interface PropDepthSurface {
  bounds: AABB;
  topZ: number;
  depth: number;
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
