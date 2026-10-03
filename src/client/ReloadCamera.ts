export interface ReloadCamera {
  realmId: string;
  profileId: string | null;
  cameraX: number;
  cameraY: number;
  zoom: number;
}

/** Legacy unscoped coordinates must never override an authoritative arrival. */
export function readReloadCamera(
  json: string | null,
  profileId: string | null,
): ReloadCamera | null {
  try {
    const state = JSON.parse(json ?? "null") as ReloadCamera | null;
    return state &&
      typeof state.realmId === "string" &&
      state.profileId === profileId &&
      Number.isFinite(state.cameraX) &&
      Number.isFinite(state.cameraY) &&
      Number.isFinite(state.zoom) &&
      state.zoom > 0
      ? state
      : null;
  } catch {
    return null;
  }
}
