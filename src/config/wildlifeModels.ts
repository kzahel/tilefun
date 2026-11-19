const KEY = "tilefun-3d-animals";
const PARAMETER = "wildlife3d";

export function wildlifeModelsInLink(
  query = new URLSearchParams(globalThis.location?.search),
): boolean | undefined {
  const value = query.get(PARAMETER);
  return value === "1" ? true : value === "0" ? false : undefined;
}

/** Visual preference shared by the game and Workshop on this browser. */
export function loadWildlifeModels(): boolean {
  const linked = wildlifeModelsInLink();
  if (linked !== undefined) return linked;
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveWildlifeModels(enabled: boolean): void {
  if (wildlifeModelsInLink() !== undefined) {
    const link = new URL(location.href);
    link.searchParams.set(PARAMETER, enabled ? "1" : "0");
    history.replaceState(history.state, "", link);
  }
  localStorage.setItem(KEY, enabled ? "on" : "off");
}
