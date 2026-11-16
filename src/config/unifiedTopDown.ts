/**
 * The device's choice between the unified top-down view (the default since
 * 2026-11-16, renderer unification) and the classic fixed view. Device-wide
 * like the debug toggle and `r_topdown3d`, not per player: it is a renderer
 * choice. Only choosing the classic view is remembered as such ("0"); nothing
 * saved, or the earlier opt-in ("1"), is the unified view.
 */
const KEY = "tilefun.unifiedTopDown";

export function savedUnifiedTopDown(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveUnifiedTopDown(
  storage: Pick<Storage, "setItem"> | undefined,
  enabled: boolean,
): void {
  storage?.setItem(KEY, enabled ? "1" : "0");
}

/** This load's choice: `?view=fixed` (or `2d`) and `?view=topdown3d` override
 * the device's saved one. */
export function unifiedTopDownChoice(
  search: string,
  storage: Pick<Storage, "getItem"> | undefined,
): boolean {
  const view = new URLSearchParams(search).get("view");
  if (view === "fixed" || view === "2d") return false;
  if (view === "topdown3d") return true;
  return savedUnifiedTopDown(storage);
}
