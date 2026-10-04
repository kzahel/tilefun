import { CURVE_TRAIN } from "../railway/CurveTrain.js";
import type { Camera } from "./Camera.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";
/** Shared Canvas/GPU schematic rolling stock. No rotated side-view sprite or promoted art. */
export function drawCurveTrain(ctx: RasterSurface, camera: Camera, item: SpriteItem): boolean {
  if (item.sheetKey !== CURVE_TRAIN) return false;
  const origin = camera.worldToScreen(item.wx, item.wy - item.zOffset);
  const angle = (item.frameRow * Math.PI) / 128;
  const rectangle = (x: number, y: number, w: number, h: number, z: number, color: string) => {
    ctx.save();
    ctx.translate(origin.sx, origin.sy - z * camera.scale);
    ctx.scale(camera.scale, camera.scale);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha = item.alpha ?? 1;
  rectangle(-57, -3, 114, 6, 7, "#38454c");
  // Extrude the body in one-pixel horizontal slices; the shared raster sink
  // resolves identical projection and face coverage on both backends.
  for (let z = 2; z <= 40; z++) {
    rectangle(-48, -14, 96, 28, z, z < 9 ? "#37424b" : z < 32 ? "#277ca5" : "#cadfe4");
    if (z >= 19 && z <= 29) {
      for (let x = -38; x < 40; x += 20) rectangle(x, -14, 13, 28, z, "#173f53");
    }
  }
  rectangle(-41, -10, 82, 20, 41, "#eef1e7");
  rectangle(-18, -6, 36, 12, 42, "#92a9ac");
  rectangle(-46, -11, 4, 22, 41, "#ecc36b");
  rectangle(42, -11, 4, 22, 41, "#ecc36b");
  ctx.restore();
  return true;
}
