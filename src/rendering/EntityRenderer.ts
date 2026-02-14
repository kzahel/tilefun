import type { Spritesheet } from "../assets/Spritesheet.js";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";
import type { Renderable } from "./Renderable.js";

/** Interpolate between previous and current position. */
function lerpPos(item: Renderable, alpha: number): { wx: number; wy: number } {
  if (item.prevPosition) {
    return {
      wx: item.prevPosition.wx + (item.position.wx - item.prevPosition.wx) * alpha,
      wy: item.prevPosition.wy + (item.position.wy - item.prevPosition.wy) * alpha,
    };
  }
  return item.position;
}

/**
 * Draw renderables Y-sorted onto the main canvas.
 * Position is feet (bottom-center of sprite frame).
 * Alpha is the render interpolation fraction [0, 1) between fixed timesteps.
 */
export function drawEntities(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  items: Renderable[],
  sheets: Map<string, Spritesheet>,
  alpha = 1,
  world?: World,
): void {
  for (const item of items) {
    if (item.flashHidden) continue;
    const { sprite } = item;
    if (!sprite) continue;

    const sheet = sheets.get(sprite.sheetKey);
    if (!sheet) continue;

    const pos = lerpPos(item, alpha);

    // Elevation offset: look up tile height at entity's feet position
    let elevOffset = 0;
    if (world) {
      const tx = Math.floor(pos.wx / TILE_SIZE);
      const ty = Math.floor(pos.wy / TILE_SIZE);
      elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX * camera.scale;
    }

    // Position is at feet (bottom-center of the sprite frame).
    // Offset draw origin so sprite frame is centered horizontally
    // and extends upward from feet.
    const halfW = sprite.spriteWidth / 2;
    const screen = camera.worldToScreen(pos.wx - halfW, pos.wy - sprite.spriteHeight);

    const destW = sprite.spriteWidth * camera.scale;
    const destH = sprite.spriteHeight * camera.scale;

    // Shadow ellipse at visual feet (entities only, not props)
    if (!item.isProp && !item.noShadow) {
      const col = (item as { collider?: { offsetY: number; width: number } }).collider;
      const baseW = col ? col.width : sprite.spriteWidth * 0.6;
      const shadowW = baseW * camera.scale;
      const shadowH = shadowW * 0.35;
      const feetY = pos.wy + (col ? col.offsetY : (item.sortOffsetY ?? 0));
      const feetScreen = camera.worldToScreen(pos.wx, feetY);
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
    const dx = Math.floor(screen.sx);
    const dy = Math.floor(screen.sy - elevOffset);
    if (sprite.flipX) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(
        sheet.image,
        region.x,
        region.y,
        sprite.spriteWidth,
        sprite.spriteHeight,
        -(dx + destW),
        dy,
        destW,
        destH,
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        sheet.image,
        region.x,
        region.y,
        sprite.spriteWidth,
        sprite.spriteHeight,
        dx,
        dy,
        destW,
        destH,
      );
    }
  }
}
