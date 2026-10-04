import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { querySurfacePatch, type SurfacePatch, surfaceZAt } from "../physics/SurfacePatch.js";
import type { Camera } from "./Camera.js";
import type { OverlayFrame } from "./OverlayFrame.js";
import { projectWorld } from "./Projection.js";

export type SurfaceVisibility = "auto" | "all" | "lower" | "upper";

/** Project a shadow onto the highest new surface below the actor, never the ceiling. */
export function surfaceShadowZ(
  props: readonly Prop[],
  footprint: AABB,
  feetZ: number,
  terrainZ: number,
): number {
  let z = terrainZ;
  for (const prop of props) {
    if (!prop.collider?.surface && !prop.walls?.some((c) => c.surface)) continue;
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
      if (!c.surface) continue;
      const hit = querySurfacePatch(c.surface, getEntityAABB(prop.position, c), footprint);
      if (hit && hit.topMax <= feetZ + 0.001) z = Math.max(z, hit.topMax);
    }
  }
  return z;
}

/** Read-only, observer-local reveal policy. Never removes collision or changes residency. */
export function surfaceVisibility(
  patch: SurfacePatch,
  bounds: AABB,
  observer: Entity,
  mode: SurfaceVisibility,
) {
  if (mode === "lower") return false;
  if (mode !== "auto" || !observer.collider) return true;
  const hit = querySurfacePatch(patch, bounds, getEntityAABB(observer.position, observer.collider));
  return !hit || (observer.wz ?? 0) >= hit.topMax - 1;
}

/** Diagnostic surfaces, using the same fixed projection and backend-neutral overlays
 * as the game. This is deliberately schematic, not promoted building artwork.
 */
export function collectSurfacePresentation(
  frame: OverlayFrame,
  camera: Camera,
  props: readonly Prop[],
  observer: Entity,
  mode: SurfaceVisibility,
  phase: "below" | "above",
) {
  for (const prop of props) {
    if (!prop.collider?.surface && !prop.walls?.some((c) => c.surface)) continue;
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
      const patch = c.surface;
      if (!patch) continue;
      const bounds = getEntityAABB(prop.position, c);
      const visible = surfaceVisibility(patch, bounds, observer, mode);
      const hit = querySurfacePatch(
        patch,
        bounds,
        observer.collider ? getEntityAABB(observer.position, observer.collider) : bounds,
      );
      const above =
        (observer.wz ?? 0) <
        (hit?.topMax ?? Math.max(patch.z, patch.z + patch.riseX, patch.z + patch.riseY));
      if ((phase === "above") !== (visible && above)) continue;
      const { sx, sy } = projectWorld(camera, bounds.left, bounds.top);
      if (!visible) {
        frame.rect(sx, sy, c.width * camera.scale, c.height * camera.scale, "", "#748b8d");
        continue;
      }
      // Thin strips approximate a projected plane without introducing a separate
      // GPU renderer. All collision queries use the exact plane, not these strips.
      const step = 2;
      for (let x = bounds.left; x < bounds.right; x += step) {
        const width = Math.min(step, bounds.right - x);
        const north = projectWorld(camera, x, bounds.top, surfaceZAt(patch, bounds, x, bounds.top));
        const south = projectWorld(
          camera,
          x,
          bounds.bottom,
          surfaceZAt(patch, bounds, x, bounds.bottom),
        );
        frame.rect(
          north.sx,
          north.sy,
          width * camera.scale + 0.5,
          south.sy - north.sy,
          patch.riseX || patch.riseY ? "#d4ad73" : "#98bec6",
        );
        frame.rect(
          south.sx,
          south.sy,
          width * camera.scale + 0.5,
          patch.thickness * camera.scale,
          "#547780",
        );
      }
      for (let x = bounds.left; x <= bounds.right; x += 16) {
        const a = projectWorld(camera, x, bounds.top, surfaceZAt(patch, bounds, x, bounds.top));
        const b = projectWorld(
          camera,
          x,
          bounds.bottom,
          surfaceZAt(patch, bounds, x, bounds.bottom),
        );
        frame.line(a.sx, a.sy, b.sx, b.sy, "#4e6e7355");
      }
      for (let y = bounds.top; y <= bounds.bottom; y += 16) {
        const a = projectWorld(camera, bounds.left, y, surfaceZAt(patch, bounds, bounds.left, y));
        const b = projectWorld(camera, bounds.right, y, surfaceZAt(patch, bounds, bounds.right, y));
        frame.line(a.sx, a.sy, b.sx, b.sy, "#4e6e7355");
      }
    }
  }
}

export function describeSurfaceSupport(props: readonly Prop[], observer: Entity): string {
  if (!observer.collider) return "ground";
  for (const prop of props)
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
      if (!c.surface) continue;
      const hit = querySurfacePatch(
        c.surface,
        getEntityAABB(prop.position, c),
        getEntityAABB(observer.position, observer.collider),
      );
      if (hit && Math.abs(hit.topMax - (observer.wz ?? 0)) < 1) return c.surface.id;
    }
  return observer.jumpVZ === undefined ? "ground" : "air";
}
