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
  surfaceVisibility,
} from "./SurfacePresentation.js";

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
    if (!surfaceVisibility(patch, bounds, observer, mode, alpha)) continue;
    for (const [i, item] of items.entries()) {
      if (item.kind !== "sprite") continue;
      const left = Math.max(bounds.left, item.wx - item.spriteWidth / 2);
      const right = Math.min(bounds.right, item.wx + item.spriteWidth / 2);
      if (left >= right) continue;
      const north = Math.min(
        ...[left, right].map((x) => bounds.top - surfaceZAt(patch, bounds, x, bounds.top)),
      );
      const south =
        Math.max(
          ...[left, right].map((x) => bounds.bottom - surfaceZAt(patch, bounds, x, bounds.bottom)),
        ) + patch.thickness;
      const bottom = item.wy - item.zOffset + item.drawOffsetY;
      if (bottom <= north || bottom - item.spriteHeight >= south) continue;
      const top = nearbySurfaceTop(patch, bounds, {
        left: item.wx,
        right: item.wx,
        top: item.wy,
        bottom: item.wy,
      });
      const slab = items.length + j;
      const [from, to] = item.zOffset < top - 1 ? [i, slab] : [slab, i];
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
) {
  if (!props.some((p) => p.collider?.surface || p.walls?.some((c) => c.surface))) {
    renderer.submit(camera, {
      kind: "scene",
      items,
      order: collectSceneOrder(items, frame.drawOrder),
      pixelExactShadows,
    });
    return;
  }
  for (const node of surfaceSceneOrder(items, props, observer, mode, alpha)) {
    if (typeof node === "string") {
      frame.overlays.begin();
      collectSurfacePresentation(frame.overlays, camera, props, observer, mode, "all", alpha, node);
      renderer.submit(camera, { kind: "overlay", items: frame.overlays.items });
    } else {
      const item = items[node];
      renderer.submit(camera, {
        kind: "scene",
        items,
        order:
          item?.kind === "sprite" && item.hasShadow && !item.flashHidden
            ? [-node - 1, node]
            : [node],
        pixelExactShadows,
      });
    }
  }
}
