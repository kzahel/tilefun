const KEY = "tilefun-dynamic-shadows";
const PARAMETER = "dynshadows";
export const DEFAULT_DYNAMIC_SHADOWS = true;

export function dynamicShadowsInLink(
  query = new URLSearchParams(globalThis.location?.search),
): boolean | undefined {
  const value = query.get(PARAMETER);
  return value === "1" ? true : value === "0" ? false : undefined;
}

/** Visual preference shared by the game and Workshop on this browser: moving
 * bodies cast the sun's shadows in the 3D scene (266). */
export function loadDynamicShadows(): boolean {
  const linked = dynamicShadowsInLink();
  if (linked !== undefined) return linked;
  try {
    const saved = localStorage.getItem(KEY);
    return saved === null ? DEFAULT_DYNAMIC_SHADOWS : saved === "on";
  } catch {
    return DEFAULT_DYNAMIC_SHADOWS;
  }
}

export function saveDynamicShadows(enabled: boolean): void {
  if (dynamicShadowsInLink() !== undefined) {
    const link = new URL(location.href);
    link.searchParams.set(PARAMETER, enabled ? "1" : "0");
    history.replaceState(history.state, "", link);
  }
  localStorage.setItem(KEY, enabled ? "on" : "off");
}
