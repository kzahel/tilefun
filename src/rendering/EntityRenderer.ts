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
