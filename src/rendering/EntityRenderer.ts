import type { Spritesheet } from "../assets/Spritesheet.js";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { World } from "../world/World.js";
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
  world?: World,
): void {
  for (const entity of entities) {
    const { sprite } = entity;
    if (!sprite) continue;

    const sheet = sheets.get(sprite.sheetKey);
    if (!sheet) continue;

    // Elevation offset: look up tile height at entity's feet position
    let elevOffset = 0;
    if (world) {
      const tx = Math.floor(entity.position.wx / TILE_SIZE);
      const ty = Math.floor(entity.position.wy / TILE_SIZE);
      elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX * camera.scale;
    }

    // Position is at feet (bottom-center of the sprite frame).
    // Offset draw origin so sprite frame is centered horizontally
    // and extends upward from feet.
    const halfW = sprite.spriteWidth / 2;
    const screen = camera.worldToScreen(
      entity.position.wx - halfW,
      entity.position.wy - sprite.spriteHeight,
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
