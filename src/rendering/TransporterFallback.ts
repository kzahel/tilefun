import type { Spritesheet } from "../assets/Spritesheet.js";
import type { Camera } from "./Camera.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";

/** Actual GLB cardinal captures, independent of WebGL/model request success.
 * The loaded car keeps its own painted sprite. As with world-grade sprites,
 * an unsecured car's fallback chassis stays level while climbing the ramp.
 */
export function drawTransporterFallback(
  ctx: RasterSurface,
  camera: Camera,
  item: SpriteItem,
  sheets: Map<string, Spritesheet>,
  draw: (
    ctx: RasterSurface,
    camera: Camera,
    item: SpriteItem,
    sheets: Map<string, Spritesheet>,
  ) => void,
) {
  if (item.mesh?.assetId !== "car-transporter-authored-v2") return false;
  const sheet = sheets.get("car-transporter-ramp-v2");
  if (!sheet) return false;
  const size = 384,
    heading = 2 * Math.atan2(item.mesh.orientation[2], item.mesh.orientation[3]);
  // The truck and secured car share cardinal-facing hysteresis. Quantizing yaw
  // again here can turn one sprite before the other at a diagonal boundary.
  const col = item.frameRow;
  const screen = camera.worldToScreen(item.wx - size / 2, item.wy - item.zOffset - size / 2);
  ctx.save();
  ctx.globalAlpha = item.alpha ?? 1;
  ctx.drawImage(
    sheet.image,
    col * size,
    item.mesh.transportRamp ? size : 0,
    size,
    size,
    Math.floor(screen.sx),
    Math.floor(screen.sy),
    size * camera.scale,
    size * camera.scale,
  );
  ctx.restore();
  const child = item.towGroup;
  if (child) {
    const shown = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][col] ?? 0;
    const dx = child.wx - item.wx,
      dy = child.wy - item.wy;
    const x = dx * Math.cos(heading) + dy * Math.sin(heading),
      y = -dx * Math.sin(heading) + dy * Math.cos(heading);
    const sprite = {
      ...child,
      wx: item.wx + x * Math.cos(shown) - y * Math.sin(shown),
      wy: item.wy + x * Math.sin(shown) + y * Math.cos(shown),
    };
    delete sprite.mesh;
    draw(ctx, camera, sprite, sheets);
  }
  return true;
}
