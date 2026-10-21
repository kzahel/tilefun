import type { Spritesheet } from "../assets/Spritesheet.js";
import { TOW, towFrontOffset, towProfile } from "../traffic/Towing.js";
import { authoredVehicleForAsset } from "./AuthoredVehicleMeshes.js";
import type { Camera } from "./Camera.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";
import frames from "./towing-fallbacks.json" with { type: "json" };

/** Retained exact posed cardinal captures; every eligible paint keeps its identity.
 * Ordinary sprite heading quantization and static wheel phase remain intentional. */
export function drawTowingFallback(
  ctx: RasterSurface,
  camera: Camera,
  item: SpriteItem,
  sheets: Map<string, Spritesheet>,
  extra?: (ctx: RasterSurface, camera: Camera, item: SpriteItem) => void,
) {
  const mesh = item.mesh;
  if (!mesh) return false;
  const truck = mesh.assetId === "tow-truck-authored-v2";
  if (!truck && !mesh.towPitch) return false;
  const model = authoredVehicleForAsset(mesh.assetId)?.vehicle;
  const row = truck
    ? mesh.towActive
      ? 1
      : 0
    : frames.keys.indexOf(`${model}:${mesh.paintSchemeId ?? ""}`);
  if (row < 0) return false;
  const size = truck ? frames.truckSize : frames.carSize,
    sheet = sheets.get(truck ? "towing-truck-v2" : "towing-cars-v2");
  if (!sheet) return false;
  const heading = 2 * Math.atan2(mesh.orientation[2], mesh.orientation[3]);
  const col =
    Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading))
      ? Math.cos(heading) > 0
        ? 3
        : 2
      : Math.sin(heading) > 0
        ? 0
        : 1;
  const p = camera.worldToScreen(item.wx - size / 2, item.wy - item.zOffset - size / 2);
  ctx.save();
  ctx.globalAlpha = item.alpha ?? 1;
  ctx.drawImage(
    sheet.image,
    col * size,
    row * size,
    size,
    size,
    Math.floor(p.sx),
    Math.floor(p.sy),
    size * camera.scale,
    size * camera.scale,
  );
  ctx.restore();
  const child = item.towGroup;
  if (child?.mesh) {
    const target = authoredVehicleForAsset(child.mesh.assetId),
      profile = target && towProfile({ type: `vehicle-v1:${target.vehicle}` });
    if (profile && target) {
      const truckYaw = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][col] ?? 0,
        raw = 2 * Math.atan2(child.mesh.orientation[2], child.mesh.orientation[3]);
      const carYaw = Math.round(raw / (Math.PI / 2)) * (Math.PI / 2),
        x = towFrontOffset({ type: `vehicle-v1:${target.vehicle}`, towedBy: 1 });
      const shown = {
        ...child,
        wx: item.wx + TOW.hitch * Math.cos(truckYaw) - x * Math.cos(carYaw),
        wy: item.wy + TOW.hitch * Math.sin(truckYaw) - x * Math.sin(carYaw),
      };
      drawTowingFallback(ctx, camera, shown, sheets);
      extra?.(ctx, camera, shown);
    }
  }
  return true;
}
