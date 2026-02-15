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
 * Draw ground shadows for all entities in a pre-pass, before Y-sorted sprites.
 * Shadows always render at terrain level so they appear behind props — when an
 * entity stands on a walkable surface, the shadow peeks out from behind it at
 * the edges and transitions smoothly when walking off.
 */
export function drawEntityShadows(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  items: Renderable[],
  alpha = 1,
  world?: World,
): void {
  for (const item of items) {
    if (item.isProp || item.noShadow || item.flashHidden) continue;
    const { sprite } = item;
    if (!sprite) continue;

    const pos = lerpPos(item, alpha);

    // Always use terrain height — not prop surface — so the shadow stays on
    // the ground and gets naturally occluded by prop sprites drawn afterward
    let terrainOffset = 0;
    if (world) {
      const tx = Math.floor(pos.wx / TILE_SIZE);
      const ty = Math.floor(pos.wy / TILE_SIZE);
      terrainOffset = world.getHeightAt(tx, ty) * ELEVATION_PX * camera.scale;
    }

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
      Math.floor(feetScreen.sy - terrainOffset),
      shadowW / 2,
      shadowH / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Draw renderables Y-sorted onto the main canvas.
 * Position is feet (bottom-center of sprite frame).
 * Alpha is the render interpolation fraction [0, 1) between fixed timesteps.
 * Shadows are drawn separately via drawEntityShadows (pre-pass).
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
    if (item.customDraw) {
      item.customDraw();
      continue;
    }
    const { sprite } = item;
    if (!sprite) continue;

    const sheet = sheets.get(sprite.sheetKey);
    if (!sheet) continue;

    const pos = lerpPos(item, alpha);

    // Total Z visual offset: lerp wz directly for smooth transitions when
    // stepping on/off walkable surfaces (avoids snap from split elevOffset +
    // jumpOffset where one is lerped and the other isn't). Falls back to
    // terrain + jumpZ lerp for entities without wz (props).
    let totalZOffset: number;
    if (item.wz !== undefined) {
      const prevWz = item.prevWz ?? item.wz;
      const lerpedWz = prevWz + (item.wz - prevWz) * alpha;
      totalZOffset = lerpedWz * camera.scale;
    } else {
      let elevOffset = 0;
      if (world) {
        const tx = Math.floor(pos.wx / TILE_SIZE);
        const ty = Math.floor(pos.wy / TILE_SIZE);
        elevOffset = world.getHeightAt(tx, ty) * ELEVATION_PX * camera.scale;
      }
      const curJumpZ = item.jumpZ ?? 0;
      const lerpedJumpZ =
        item.prevJumpZ !== undefined
          ? item.prevJumpZ + (curJumpZ - item.prevJumpZ) * alpha
          : curJumpZ;
      totalZOffset = elevOffset + lerpedJumpZ * camera.scale;
    }

    // Position is at feet (bottom-center of the sprite frame).
    // Offset draw origin so sprite frame is centered horizontally
    // and extends upward from feet.
    const halfW = sprite.spriteWidth / 2;
    const screen = camera.worldToScreen(pos.wx - halfW, pos.wy - sprite.spriteHeight);

    const destW = sprite.spriteWidth * camera.scale;
    const destH = sprite.spriteHeight * camera.scale;

    const region = sheet.getRegion(sprite.frameCol, sprite.frameRow);
    const drawOffsetY = (sprite.drawOffsetY ?? 0) * camera.scale;
    const dx = Math.floor(screen.sx);
    const dy = Math.floor(screen.sy - totalZOffset + drawOffsetY);
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
