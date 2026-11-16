import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { querySurfacePatch, type SurfacePatch, surfaceZAt } from "../physics/SurfacePatch.js";
import { locateSurfaceSpace } from "../physics/TerrainExcavation.js";
import type { Camera } from "./Camera.js";
import { interpolatePosition, interpolateWz } from "./EntityInterpolation.js";
import type { OverlayFrame } from "./OverlayFrame.js";
import { projectWorld } from "./Projection.js";
import { drawRoadDeck, isRoadDeck } from "./RoadDeckPresentation.js";

export type SurfaceVisibility = "auto" | "all" | "lower" | "upper";

/**
 * A walkable surface's look (decks, ramps, motocross jumps), shared by the fixed
 * view and 3D views: its top and edge colours. Road decks draw their own.
 */
export function surfaceColors(type: string, patch: SurfacePatch): { top: string; edge: string } {
  const dirt = type.startsWith("prop-mx-");
  const sloped = !!(patch.riseX || patch.riseY);
  return {
    top: dirt
      ? sloped
        ? "#a8784a"
        : "#b78a5a"
      : sloped
        ? "#d4ad73"
        : patch.excavation
          ? "#c7cbb9"
          : "#98bec6",
    edge: dirt ? "#6f4b2e" : "#547780",
  };
}

/** The tile grid drawn over a surface's top, so its slopes and steps read. */
export const SURFACE_GRID = { spacing: 16, color: "#4e6e73", opacity: 0x55 / 255 } as const;

/** The grid's lines over a surface's top, as world points `[x, y, z]` in pairs:
 * north to south every `spacing` along x, then west to east along y. */
export function surfaceGridLines(patch: SurfacePatch, bounds: AABB): [number, number, number][] {
  const points: [number, number, number][] = [];
  const at = (x: number, y: number): [number, number, number] => [
    x,
    y,
    surfaceZAt(patch, bounds, x, y),
  ];
  for (let x = bounds.left; x <= bounds.right; x += SURFACE_GRID.spacing)
    points.push(at(x, bounds.top), at(x, bounds.bottom));
  for (let y = bounds.top; y <= bounds.bottom; y += SURFACE_GRID.spacing)
    points.push(at(bounds.left, y), at(bounds.right, y));
  return points;
}

const SURFACE_GRID_CSS = `${SURFACE_GRID.color}${Math.round(SURFACE_GRID.opacity * 255)
  .toString(16)
  .padStart(2, "0")}`;

// One presentation tolerance for height comparisons and shadow support.
// Interpolation across a clipped ramp/deck join may put feet just below its top.
const SUPPORT_TOLERANCE = 1;

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
      if (hit && hit.topMax <= feetZ + SUPPORT_TOLERANCE)
        z = Math.max(z, Math.min(hit.topMax, feetZ));
    }
  }
  return z;
}

/** Maximum under the feet, or at the nearest edge before they enter the patch.
 * A sprite can overlap the ramp before its smaller feet collider does. Comparing
 * those feet to the distant high end would briefly misclassify the low entrance.
 */
export function nearbySurfaceTop(patch: SurfacePatch, bounds: AABB, feet: AABB): number {
  const x = Math.max(
    bounds.left,
    Math.min(bounds.right, patch.riseX >= 0 ? feet.right : feet.left),
  );
  const y = Math.max(
    bounds.top,
    Math.min(bounds.bottom, patch.riseY >= 0 ? feet.bottom : feet.top),
  );
  return surfaceZAt(patch, bounds, x, y);
}

/** Read-only observer policy in fixed-projection coordinates (x, y-z). Camera
 * translation and zoom cancel out. Tests use the sprite frame, not its ground
 * collider: a north-side actor may be covered without standing under the slab.
 * This is conservative frame overlap, not an opaque-pixel or general depth test.
 */
export function surfacePresentationState(
  patch: SurfacePatch,
  bounds: AABB,
  observer: Entity,
  mode: SurfaceVisibility,
  alpha = 1,
): { visible: boolean; above: boolean } {
  const position = interpolatePosition(observer.position, observer.prevPosition, alpha);
  const feetZ = interpolateWz(observer, alpha) ?? 0;
  const feet = observer.collider
    ? getEntityAABB(position, observer.collider)
    : { left: position.wx, right: position.wx, top: position.wy, bottom: position.wy };
  const top = nearbySurfaceTop(patch, bounds, feet);
  const above = feetZ < top - SUPPORT_TOLERANCE;
  if (mode === "lower") return { visible: !!patch.excavation, above };
  if (mode === "upper" && patch.excavation) return { visible: false, above };
  if (mode !== "auto" || !above || !observer.sprite) return { visible: true, above };

  const sprite = observer.sprite;
  // Approaching a connected deck is not entering a lower space. Keep the slab
  // while the head can peek above its local top, even if the feet are lower.
  // Ordering still uses feet; this gate affects automatic visibility only.
  const headZ =
    feetZ +
    Math.max(
      0,
      observer.collider?.physicalHeight ?? sprite.spriteHeight - (sprite.drawOffsetY ?? 0),
    );
  if (headZ >= top - SUPPORT_TOLERANCE) return { visible: true, above };
  const left = Math.max(bounds.left, position.wx - sprite.spriteWidth / 2);
  const right = Math.min(bounds.right, position.wx + sprite.spriteWidth / 2);
  if (left >= right) return { visible: true, above };

  // Clip the slab silhouette to the sprite's X interval before comparing Y.
  // The planar top plus the drawn south fascia form one continuous convex band;
  // using the whole ramp's bounding box would hide its uncovered low end too.
  const northLeft = bounds.top - surfaceZAt(patch, bounds, left, bounds.top);
  const northRight = bounds.top - surfaceZAt(patch, bounds, right, bounds.top);
  const southLeft = bounds.bottom - surfaceZAt(patch, bounds, left, bounds.bottom);
  const southRight = bounds.bottom - surfaceZAt(patch, bounds, right, bounds.bottom);
  const surfaceTop = Math.min(northLeft, northRight);
  const surfaceBottom = Math.max(southLeft, southRight) + patch.thickness;
  const spriteBottom = position.wy - feetZ + (sprite.drawOffsetY ?? 0);
  const spriteTop = spriteBottom - sprite.spriteHeight;
  const occluded = spriteTop < surfaceBottom && spriteBottom > surfaceTop;
  return { visible: !occluded, above };
}

/** False when the slab would cover the observer (auto) or a manual view hides it. */
export function surfaceVisibility(
  patch: SurfacePatch,
  bounds: AABB,
  observer: Entity,
  mode: SurfaceVisibility,
  alpha = 1,
): boolean {
  return surfacePresentationState(patch, bounds, observer, mode, alpha).visible;
}

/** "reveal" is the automatic cutaway: the slab stays in painter order and is
 * drawn translucent over the observer. Only manual level views hide a slab. */
export type SurfaceDisplay = "opaque" | "reveal" | "hidden";

export function surfaceDisplay(
  patch: SurfacePatch,
  bounds: AABB,
  observer: Entity,
  mode: SurfaceVisibility,
  alpha = 1,
): SurfaceDisplay {
  if (surfaceVisibility(patch, bounds, observer, mode, alpha)) return "opaque";
  return mode === "auto" ? "reveal" : "hidden";
}

/** Opacity of a revealed slab: enough to read the road above, light enough to see actors. */
export const REVEAL_OPACITY = 0.45;
/** Full opaque↔reveal transition time, so the cutaway eases instead of popping. */
export const REVEAL_FADE_SECONDS = 0.15;

/** Advance one slab's fade toward its target. Entries are dropped once opaque again.
 * Large or backward clock steps (pause, reload, new clock) settle immediately. */
export function surfaceFadeOpacity(
  fades: Map<string, { opacity: number; time: number }>,
  id: string,
  display: SurfaceDisplay,
  time: number,
): number {
  const target = display === "reveal" ? REVEAL_OPACITY : 1;
  const entry = fades.get(id);
  if (!entry) {
    if (target === 1) return 1;
    fades.set(id, { opacity: 1, time });
    return 1;
  }
  const dt = time - entry.time;
  entry.time = time;
  const step = dt < 0 || dt > 0.5 ? 1 : (dt / REVEAL_FADE_SECONDS) * (1 - REVEAL_OPACITY);
  entry.opacity =
    entry.opacity < target
      ? Math.min(target, entry.opacity + step)
      : Math.max(target, entry.opacity - step);
  if (entry.opacity < 1 - 1e-6) return entry.opacity;
  fades.delete(id);
  return 1;
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
  phase: "below" | "above" | "all",
  alpha = 1,
  onlyId?: string,
) {
  for (const prop of props) {
    if (!prop.collider?.surface && !prop.walls?.some((c) => c.surface)) continue;
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
      const patch = c.surface;
      if (!patch || (onlyId && patch.id !== onlyId)) continue;
      const bounds = getEntityAABB(prop.position, c);
      if (mode === "auto" && patch.excavation?.ceilingId) {
        const roofProp = props.find((p) =>
          (p.walls ?? (p.collider ? [p.collider] : [])).some(
            (wall) => wall.surface?.id === patch.excavation?.ceilingId,
          ),
        );
        const roof = (roofProp?.walls ?? (roofProp?.collider ? [roofProp.collider] : [])).find(
          (wall) => wall.surface?.id === patch.excavation?.ceilingId,
        );
        // A revealed (translucent) roof shows the floor beneath it.
        if (
          roofProp &&
          roof?.surface &&
          surfaceDisplay(
            roof.surface,
            getEntityAABB(roofProp.position, roof),
            observer,
            mode,
            alpha,
          ) === "opaque" &&
          locateSurfaceSpace(props, {
            ...observer,
            position: interpolatePosition(observer.position, observer.prevPosition, alpha),
            wz: interpolateWz(observer, alpha) ?? 0,
          }) !== patch.spaceId
        )
          continue;
      }
      const { visible: opaque, above } = surfacePresentationState(
        patch,
        bounds,
        observer,
        mode,
        alpha,
      );
      // Auto reveal keeps the slab; its opacity is applied by the pass, not here.
      const visible = opaque || mode === "auto";
      if (phase !== "all" && (phase === "above") !== (visible && above)) continue;
      const { sx, sy } = projectWorld(camera, bounds.left, bounds.top);
      if (!visible) {
        frame.rect(sx, sy, c.width * camera.scale, c.height * camera.scale, "", "#748b8d");
        continue;
      }
      if (isRoadDeck(prop.type)) {
        drawRoadDeck(frame, camera, prop.type, patch, bounds);
        continue;
      }
      // Thin strips approximate a projected plane without introducing a separate
      // GPU renderer. All collision queries use the exact plane, not these strips.
      const colors = surfaceColors(prop.type, patch);
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
        frame.rect(north.sx, north.sy, width * camera.scale + 0.5, south.sy - north.sy, colors.top);
        frame.rect(
          south.sx,
          south.sy,
          width * camera.scale + 0.5,
          patch.thickness * camera.scale,
          colors.edge,
        );
      }
      const grid = surfaceGridLines(patch, bounds);
      for (let i = 0; i + 1 < grid.length; i += 2) {
        const [ax, ay, az] = grid[i] ?? [0, 0, 0];
        const [bx, by, bz] = grid[i + 1] ?? [0, 0, 0];
        const a = projectWorld(camera, ax, ay, az);
        const b = projectWorld(camera, bx, by, bz);
        frame.line(a.sx, a.sy, b.sx, b.sy, SURFACE_GRID_CSS);
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
