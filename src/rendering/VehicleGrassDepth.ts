import { outdoorRuntimeAsset } from "../assets/outdoor/OutdoorRuntime.js";
import type { GrassItem, SpriteItem } from "./SceneItem.js";

/** Includes parked prop cars as well as the native moving vehicle bank. */
export function isVehicleSprite(type: string): boolean {
  return (
    /(?:^|[-_:])(car|truck|bus|vehicle|train)(?:[-_:]|$)/.test(type) ||
    outdoorRuntimeAsset(type)?.metadata.category === "vehicle"
  );
}

/** Grass may cover feet, but must always draw below an overlapping vehicle.
 * Use the displayed sprite rectangle, not its smaller physical footprint.
 * Ten pixels encloses every rotated 8px blade and projection rounding.
 */
export function grassDepthUnderVehicles(blade: GrassItem, vehicles: readonly SpriteItem[]): void {
  const radius = 10;
  for (const vehicle of vehicles) {
    const bottom = vehicle.wy - vehicle.zOffset + vehicle.drawOffsetY;
    if (
      blade.wx + radius > vehicle.wx - vehicle.spriteWidth / 2 &&
      blade.wx - radius < vehicle.wx + vehicle.spriteWidth / 2 &&
      blade.wy + radius > bottom - vehicle.spriteHeight &&
      blade.wy - radius < bottom
    )
      blade.sortKey = Math.min(blade.sortKey, vehicle.sortKey - 0.001);
  }
}
