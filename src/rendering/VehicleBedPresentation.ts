import type { Spritesheet } from "../assets/Spritesheet.js";
import { bedOccludesPoint } from "../traffic/VehicleBed.js";
import type { Camera } from "./Camera.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";

export function bedItemPose(item: SpriteItem) {
  return {
    id: 0,
    type: "vehicle-v1:dump-truck",
    vehicleBed: true as const,
    vehicleHeading: item.bedGroup?.heading ?? 0,
    position: { wx: item.wx, wy: item.wy },
    wz: item.zOffset,
    collider: null,
  };
}
/** Conservative source-derived physical clips keep fallback occupants visible.
 * Loaded GPU meshes use their actual triangles instead. No new bitmap asset. */
export function drawBedContentsFallback(
  ctx: RasterSurface,
  camera: Camera,
  owner: SpriteItem,
  sheets: Map<string, Spritesheet>,
  draw: (
    ctx: RasterSurface,
    camera: Camera,
    item: SpriteItem,
    sheets: Map<string, Spritesheet>,
  ) => void,
) {
  if (!owner.bedGroup) return;
  const pose = bedItemPose(owner);
  for (const item of owner.bedGroup.contents) {
    if (item.flashHidden) continue;
    const height = item.spriteHeight * (item.scaleY ?? 1);
    const left = item.wx - item.spriteWidth / 2;
    const bottom = item.wy - item.zOffset + item.drawOffsetY;
    const screen = camera.worldToScreen(left, bottom - height);
    const end = camera.worldToScreen(left + item.spriteWidth, bottom);
    const dx = Math.floor(screen.sx),
      dy = Math.floor(screen.sy);
    const w = Math.floor(end.sx) - dx,
      h = Math.floor(end.sy) - dy;
    ctx.save();
    ctx.beginPath();
    for (let row = 0; row < item.spriteHeight; row++) {
      let start = -1;
      for (let col = 0; col <= item.spriteWidth; col++) {
        const visible =
          col < item.spriteWidth &&
          !bedOccludesPoint(
            pose,
            left + col + 0.5,
            item.wy,
            item.zOffset - item.drawOffsetY + height * (1 - (row + 0.5) / item.spriteHeight),
          );
        if (visible && start < 0) start = col;
        if (!visible && start >= 0) {
          const x = Math.floor((start * w) / item.spriteWidth),
            x2 = Math.floor((col * w) / item.spriteWidth);
          const y = Math.floor((row * h) / item.spriteHeight),
            y2 = Math.floor(((row + 1) * h) / item.spriteHeight);
          ctx.rect(dx + x, dy + y, x2 - x, y2 - y);
          start = -1;
        }
      }
    }
    ctx.clip();
    draw(ctx, camera, item, sheets);
    ctx.restore();
  }
}
