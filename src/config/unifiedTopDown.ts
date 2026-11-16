/**
 * The device's saved choice of the unified top-down view (renderer unification:
 * an Options opt-in until the owner makes it the default). Device-wide like the
 * debug toggle and `r_topdown3d`, not per player: it is a renderer choice.
 */
const KEY = "tilefun.unifiedTopDown";

export function savedUnifiedTopDown(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveUnifiedTopDown(
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined,
  enabled: boolean,
): void {
  if (enabled) storage?.setItem(KEY, "1");
  else storage?.removeItem(KEY);
}
