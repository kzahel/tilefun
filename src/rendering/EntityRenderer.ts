import type { Spritesheet } from "../assets/Spritesheet.js";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";
import type { Renderable } from "./Renderable.js";

/**
 * Draw renderables Y-sorted onto the main canvas.
 * Position is feet (bottom-center of sprite frame).
 */
export function drawEntities(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  items: Renderable[],
  sheets: Map<string, Spritesheet>,
  world?: World,
): void {
  for (const item of items) {
    if (item.flashHidden) continue;
    const { sprite } = item;
    if (!sprite) continue;

    const sheet = sheets.get(sprite.sheetKey);
    if (!sheet) continue;

    // Elevation offset: look up tile height at entity's feet position
    let elevOffset = 0;
    if (world) {
      const tx = Math.floor(item.position.wx / TILE_SIZE);
      const ty = Math.floor(item.position.wy / TILE_SIZE);
      elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX * camera.scale;
    }

    // Position is at feet (bottom-center of the sprite frame).
    // Offset draw origin so sprite frame is centered horizontally
    // and extends upward from feet.
    const halfW = sprite.spriteWidth / 2;
    const screen = camera.worldToScreen(
      item.position.wx - halfW,
      item.position.wy - sprite.spriteHeight,
    );

    const destW = sprite.spriteWidth * camera.scale;
    const destH = sprite.spriteHeight * camera.scale;

    // Shadow ellipse at visual feet (entities only, not props)
    if (!item.isProp && !item.noShadow) {
      const col = (item as { collider?: { offsetY: number; width: number } }).collider;
      const baseW = col ? col.width : sprite.spriteWidth * 0.6;
      const shadowW = baseW * camera.scale;
      const shadowH = shadowW * 0.35;
      const feetY = item.position.wy + (col ? col.offsetY : (item.sortOffsetY ?? 0));
      const feetScreen = camera.worldToScreen(item.position.wx, feetY);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(
        Math.floor(feetScreen.sx),
        Math.floor(feetScreen.sy - elevOffset),
        shadowW / 2,
        shadowH / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    const region = sheet.getRegion(sprite.frameCol, sprite.frameRow);
    ctx.drawImage(
      sheet.image,
      region.x,
      region.y,
      region.width,
      region.height,
      Math.floor(screen.sx),
      Math.floor(screen.sy - elevOffset),
      destW,
      destH,
    );
  }
}
