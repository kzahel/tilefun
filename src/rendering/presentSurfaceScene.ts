import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { surfaceZAt } from "../physics/SurfacePatch.js";
import type { Camera } from "./Camera.js";
import { collectSceneOrder, type RenderBackend } from "./RenderFrame.js";
import type { SceneFrame } from "./SceneFrame.js";
import type { SceneItem } from "./SceneItem.js";
import {
  collectSurfacePresentation,
  nearbySurfaceTop,
  type SurfaceVisibility,
  surfaceDisplay,
  surfaceFadeOpacity,
} from "./SurfacePresentation.js";
import { planeZ } from "./SurfaceReceivers.js";
import { surfaceWorldDepth } from "./WorldDepth.js";

/** Stable painter constraints for bounded planar slabs. Each actor is ordered
 * against the slab at its own height; only visibility is observer-dependent.
 * This avoids drawing a lower train over a bridge just because the player is on it.
 * Arbitrarily intersecting surfaces/meshes still require a general depth solution.
 */
export function surfaceSceneOrder(
  items: readonly SceneItem[],
  props: readonly Prop[],
  observer: Entity,
  mode: SurfaceVisibility,
  alpha: number,
): (number | string)[] {
  const patches = props.flatMap((p) =>
    (p.walls ?? (p.collider ? [p.collider] : [])).flatMap((c) =>
      c.surface ? [{ patch: c.surface, bounds: getEntityAABB(p.position, c) }] : [],
    ),
  );
  const nodes: (number | string)[] = [...items.map((_, i) => i), ...patches.map((s) => s.patch.id)];
  const edges = nodes.map(() => new Set<number>()),
    degree = nodes.map(() => 0);
  for (const [j, { patch, bounds }] of patches.entries()) {
    // A revealed slab keeps its order so it is drawn translucent over the observer.
    if (surfaceDisplay(patch, bounds, observer, mode, alpha) === "hidden") continue;
    for (const [i, item] of items.entries()) {
      if (item.kind !== "sprite" && item.kind !== "decal" && item.kind !== "particle") continue;
      const vertices = item.kind === "decal" ? item.polygons.flat() : undefined;
      const halfWidth =
        item.kind === "sprite" ? item.spriteWidth / 2 : item.kind === "particle" ? item.size : 0;
      const left = Math.max(
        bounds.left,
        vertices ? Math.min(...vertices.map((v) => v.x)) : item.wx - halfWidth,
      );
      const right = Math.min(
        bounds.right,
        vertices ? Math.max(...vertices.map((v) => v.x)) : item.wx + halfWidth,
      );
      if (left >= right) continue;
      const north = Math.min(
        ...[left, right].map((x) => bounds.top - surfaceZAt(patch, bounds, x, bounds.top)),
      );
      const south =
        Math.max(
          ...[left, right].map((x) => bounds.bottom - surfaceZAt(patch, bounds, x, bounds.bottom)),
        ) + patch.thickness;
      const z = item.kind === "sprite" ? item.zOffset : item.z;
      const bottom =
        vertices && item.kind === "decal"
          ? Math.max(...vertices.map((v) => v.y - planeZ(item.plane, v.x, v.y)))
          : item.wy -
            z +
            (item.kind === "sprite" ? item.drawOffsetY : item.kind === "particle" ? item.size : 0);
      const highest =
        vertices && item.kind === "decal"
          ? Math.min(...vertices.map((v) => v.y - planeZ(item.plane, v.x, v.y)))
          : bottom -
            (item.kind === "sprite"
              ? item.spriteHeight * (item.scaleY ?? 1)
              : item.kind === "particle"
                ? item.size * 2
                : 0);
      if (bottom <= north || highest >= south) continue;
      const top = nearbySurfaceTop(patch, bounds, {
        left: item.wx,
        right: item.wx,
        top: item.wy,
        bottom: item.wy,
      });
      const slab = items.length + j;
      const [from, to] = z < top - 1 ? [i, slab] : [slab, i];
      edges[from]?.add(to);
      degree[to] = (degree[to] ?? 0) + 1;
    }
  }
  const result: (number | string)[] = [],
    emitted = new Set<number>();
  while (result.length < nodes.length) {
    let index = nodes.findIndex((_, i) => !emitted.has(i) && degree[i] === 0);
    // Deterministic fallback for unsupported cyclic/intersecting arrangements.
    if (index < 0) index = nodes.findIndex((_, i) => !emitted.has(i));
    emitted.add(index);
    const node = nodes[index];
    if (node !== undefined) result.push(node);
    for (const to of edges[index] ?? []) degree[to] = (degree[to] ?? 1) - 1;
  }
  return result;
}

export function presentSurfaceScene(
  renderer: RenderBackend,
  camera: Camera,
  frame: SceneFrame,
  items: readonly SceneItem[],
  props: readonly Prop[],
  observer: Entity,
  mode: SurfaceVisibility,
  alpha: number,
  pixelExactShadows = false,
  fades = frame.surfaceFades, // Observer-local: each view of a split frame passes its own.
) {
  if (!props.some((p) => p.collider?.surface || p.walls?.some((c) => c.surface))) {
    renderer.submit(camera, {
      kind: "scene",
      items,
      order: collectSceneOrder(items, frame.drawOrder),
      pixelExactShadows,
    });
    fades.clear();
    return;
  }
  const order = frame.drawOrder;
  const presented = new Set<string>();
  // Manual level views are inspection tools: they switch instantly, never fade.
  if (mode !== "auto") fades.clear();
  order.length = 0;
  const submitRun = () => {
    if (!order.length) return;
    renderer.submit(camera, { kind: "scene", items, order, pixelExactShadows });
    order.length = 0;
  };
  for (const node of surfaceSceneOrder(items, props, observer, mode, alpha)) {
    if (typeof node === "string") {
      presented.add(node);
      submitRun();
      frame.overlays.begin();
      collectSurfacePresentation(frame.overlays, camera, props, observer, mode, "all", alpha, node);
      const surface = props
        .flatMap((p) => (p.walls ?? (p.collider ? [p.collider] : [])).map((c) => ({ p, c })))
        .find(({ c }) => c.surface?.id === node);
      const worldDepth = surface?.c.surface
        ? surfaceWorldDepth(camera, surface.p.position, surface.c)
        : undefined;
      const opacity =
        mode === "auto" && surface?.c.surface
          ? surfaceFadeOpacity(
              fades,
              node,
              surfaceDisplay(
                surface.c.surface,
                getEntityAABB(surface.p.position, surface.c),
                observer,
                mode,
                alpha,
              ),
              frame.fadeSeconds,
            )
          : 1;
      renderer.submit(camera, {
        kind: "overlay",
        items: frame.overlays.items,
        cacheKey: node,
        ...(worldDepth ? { worldDepth } : {}),
        ...(opacity < 1 ? { opacity } : {}),
      });
    } else {
      const item = items[node];
      if (item?.kind === "sprite" && item.hasShadow && !item.flashHidden) order.push(-node - 1);
      order.push(node);
    }
  }
  submitRun();
  for (const id of fades.keys()) if (!presented.has(id)) fades.delete(id);
}
