import type { Spritesheet } from "../assets/Spritesheet.js";
import { curveTrainView } from "../railway/CurveTrain.js";
import type { Camera } from "./Camera.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";
/** Native atlas crops at their original scale. Cardinal poses intentionally snap
 * at 45-degree boundaries, just as directional road-vehicle sprites do. */
export function drawCurveTrain(
  ctx: RasterSurface,
  camera: Camera,
  item: SpriteItem,
  sheets: Map<string, Spritesheet>,
): boolean {
  const view = curveTrainView(item.sheetKey, item.frameRow);
  if (!view) return false;
  const sheet = sheets.get("railway-review-v1");
  if (!sheet) return true;
  const p = camera.worldToScreen(
    item.wx - view.width / 2,
    item.wy - item.zOffset + (view.vertical ? -view.height / 2 : -view.height + 15),
  );
  ctx.save();
  ctx.globalAlpha = item.alpha ?? 1;
  ctx.drawImage(
    sheet.image,
    view.x,
    view.y,
    view.width,
    view.height,
    Math.floor(p.sx),
    Math.floor(p.sy),
    view.width * camera.scale,
    view.height * camera.scale,
  );
  ctx.restore();
  return true;
}
