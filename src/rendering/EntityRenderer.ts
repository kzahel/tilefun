import type { Spritesheet } from "../assets/Spritesheet.js";
import { PIXEL_SCALE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Camera } from "./Camera.js";

/**
 * Draw entities Y-sorted onto the main canvas.
 * Entity position is feet (bottom-center of sprite frame).
 */
export function drawEntities(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  entities: Entity[],
  sheets: Map<string, Spritesheet>,
): void {
  for (const entity of entities) {
    const { sprite } = entity;
    if (!sprite) continue;

    const sheet = sheets.get(sprite.sheetKey);
    if (!sheet) continue;

    // Position is at feet (bottom-center of the sprite frame).
    // Offset draw origin so sprite frame is centered horizontally
    // and extends upward from feet.
    const halfW = sprite.spriteWidth / 2;
    const screen = camera.worldToScreen(
      entity.position.wx - halfW,
      entity.position.wy - sprite.spriteHeight,
    );

    const destW = sprite.spriteWidth * PIXEL_SCALE;
    const destH = sprite.spriteHeight * PIXEL_SCALE;

    const region = sheet.getRegion(sprite.frameCol, sprite.frameRow);
    ctx.drawImage(
      sheet.image,
      region.x,
      region.y,
      region.width,
      region.height,
      Math.floor(screen.sx),
      Math.floor(screen.sy),
      destW,
      destH,
    );
  }
}
