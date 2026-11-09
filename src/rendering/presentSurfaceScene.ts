import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { Camera } from "./Camera.js";
import { collectSceneOrder, type RenderBackend } from "./RenderFrame.js";
import type { SceneFrame, SurfaceFades } from "./SceneFrame.js";
import type { SceneItem } from "./SceneItem.js";
import {
  collectSurfacePresentation,
  type SurfaceVisibility,
  surfaceDisplay,
  surfaceFadeOpacity,
} from "./SurfacePresentation.js";
import { slabLookup, slabSceneOrder, surfaceSlabs } from "./SurfaceSceneOrder.js";
import { surfaceWorldDepth } from "./WorldDepth.js";

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
  fades: SurfaceFades = new Map(), // A view's own; one-off callers keep no fades.
) {
  const slabs = surfaceSlabs(props);
  if (!slabs.length) {
    renderer.submit(camera, {
      kind: "scene",
      items,
      order: collectSceneOrder(items, frame.drawOrder),
      pixelExactShadows,
    });
    fades.clear();
    return;
  }
  // Slab presentation only consults surface-bearing props, in their original order.
  const { planarProps, byId } = slabLookup(slabs);
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
  for (const node of slabSceneOrder(items, slabs, observer, mode, alpha)) {
    if (typeof node === "string") {
      presented.add(node);
      submitRun();
      frame.overlays.begin();
      collectSurfacePresentation(
        frame.overlays,
        camera,
        planarProps,
        observer,
        mode,
        "all",
        alpha,
        node,
      );
      const surface = byId.get(node);
      const worldDepth = surface
        ? surfaceWorldDepth(camera, surface.prop.position, surface.collider)
        : undefined;
      const opacity =
        mode === "auto" && surface
          ? surfaceFadeOpacity(
              fades,
              node,
              surfaceDisplay(surface.patch, surface.bounds, observer, mode, alpha),
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
