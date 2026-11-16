/**
 * The device's choice between the unified top-down view (the default since
 * 2026-11-16, renderer unification) and the classic fixed view. Device-wide
 * like the debug toggle and `r_topdown3d`, not per player: it is a renderer
 * choice. Options saves "1" (unified) or "0" (classic).
 */
const KEY = "tilefun.unifiedTopDown";

/** The saved choice, or undefined when the device never made one. */
export function savedUnifiedTopDown(
  storage: Pick<Storage, "getItem"> | undefined,
): boolean | undefined {
  try {
    const saved = storage?.getItem(KEY);
    return saved === "1" ? true : saved === "0" ? false : undefined;
  } catch {
    return undefined;
  }
}

export function saveUnifiedTopDown(
  storage: Pick<Storage, "setItem"> | undefined,
  enabled: boolean,
): void {
  storage?.setItem(KEY, enabled ? "1" : "0");
}

/**
 * This load's choice: `?view=fixed` (or `2d`) and `?view=topdown3d` first, then
 * the device's saved one. Without either it is the unified view, except where
 * WebGL is a software rasteriser (`softwareWebGl`): there the CPU draws the 3D
 * scene, so the classic view, much cheaper to draw, stays the default.
 */
export function unifiedTopDownChoice(
  search: string,
  storage: Pick<Storage, "getItem"> | undefined,
  softwareGraphics = false,
): boolean {
  const view = new URLSearchParams(search).get("view");
  if (view === "fixed" || view === "2d") return false;
  if (view === "topdown3d") return true;
  return savedUnifiedTopDown(storage) ?? !softwareGraphics;
}
