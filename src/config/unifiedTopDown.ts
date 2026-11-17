/**
 * Whether this load draws top-down through the unified 3D view (renderer
 * unification). It is the one view players get since 2026-11-17; the classic
 * fixed view is no longer a choice and remains only as a fallback and for
 * development until it is retired.
 *
 * `?view=fixed` (or `2d`) and `?view=topdown3d` choose for one load: specs and
 * probes of the fixed backend, and comparisons. Without either it is the
 * unified view, except where WebGL is a software rasteriser (`softwareWebGl`):
 * there the CPU draws the 3D scene, so the fixed view, much cheaper to draw,
 * stands in. A choice an earlier build saved on the device is ignored.
 */
export function unifiedTopDownChoice(search: string, softwareGraphics = false): boolean {
  const view = new URLSearchParams(search).get("view");
  if (view === "fixed" || view === "2d") return false;
  if (view === "topdown3d") return true;
  return !softwareGraphics;
}
