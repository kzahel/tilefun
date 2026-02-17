import type { Spritesheet } from "../assets/Spritesheet.js";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Camera } from "./Camera.js";
import { GRASS_ANCHOR_X, GRASS_ANCHOR_Y } from "./GrassBladeRenderer.js";
import type { ElevationItem, GrassItem, ParticleItem, SceneItem, SpriteItem } from "./SceneItem.js";

/**
 * Draw a pre-sorted scene item list onto a Canvas2D context.
 * Two passes: shadow pre-pass, then main draw pass.
 */
export function drawScene2D(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  items: SceneItem[],
  sheets: Map<string, Spritesheet>,
  grassSheet: Spritesheet | undefined,
): void {
  // Shadow pre-pass: draw ground shadows before all sprites so they appear
  // behind props (e.g. table shadow peeks out at edges, not on top)
  drawShadows(ctx, camera, items);

  // Main draw pass
  for (const item of items) {
    switch (item.kind) {
      case "sprite":
        // Draw elevated shadows inline so they appear on top of the
        // elevation surface tile rather than being covered by it.
        if (item.hasShadow && !item.flashHidden && item.shadowTerrainZ > 0) {
          drawOneShadow(ctx, camera, item);
        }
        drawSprite(ctx, camera, item, sheets);
        break;
      case "elevation":
        drawElevation(ctx, camera, item);
        break;
      case "grass":
        if (grassSheet) drawGrass(ctx, camera, item, grassSheet);
        break;
      case "particle":
        drawParticle(ctx, camera, item);
        break;
    }
  }
}

/** Draw a single entity shadow ellipse. */
function drawOneShadow(ctx: CanvasRenderingContext2D, camera: Camera, item: SpriteItem): void {
  const shadowW = item.shadowWidth * camera.scale;
  const shadowH = shadowW * 0.35;
  const terrainOffset = item.shadowTerrainZ * camera.scale;
  const feetScreen = camera.worldToScreen(item.wx, item.shadowFeetWy);
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

/**
 * Pre-pass: draw shadows for entities on flat terrain only.
 * Elevated shadows are drawn inline in the main pass (after the elevation
 * tile surface so they aren't covered up).
 */
function drawShadows(ctx: CanvasRenderingContext2D, camera: Camera, items: SceneItem[]): void {
  for (const item of items) {
    if (item.kind !== "sprite" || !item.hasShadow || item.flashHidden) continue;
    // Skip elevated shadows — they'll be drawn inline in the main pass
    if (item.shadowTerrainZ > 0) continue;
    drawOneShadow(ctx, camera, item);
  }
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  item: SpriteItem,
  sheets: Map<string, Spritesheet>,
): void {
  if (item.flashHidden) return;
  const sheet = sheets.get(item.sheetKey);
  if (!sheet) return;

  const totalZScreen = item.zOffset * camera.scale;
  // Position is at feet (bottom-center of the sprite frame).
  // Offset draw origin so sprite frame is centered horizontally
  // and extends upward from feet.
  const halfW = item.spriteWidth / 2;
  const screen = camera.worldToScreen(item.wx - halfW, item.wy - item.spriteHeight);
  const destW = item.spriteWidth * camera.scale;
  const destH = item.spriteHeight * camera.scale;
  const region = sheet.getRegion(item.frameCol, item.frameRow);
  const drawOffsetY = item.drawOffsetY * camera.scale;
  const dx = Math.floor(screen.sx);
  const dy = Math.floor(screen.sy - totalZScreen + drawOffsetY);

  ctx.save();
  if (item.alpha !== undefined) {
    ctx.globalAlpha = Math.max(0, Math.min(1, item.alpha));
  }

  if (item.flipX) {
    ctx.scale(-1, 1);
    ctx.drawImage(
      sheet.image,
      region.x,
      region.y,
      item.spriteWidth,
      item.spriteHeight,
      -(dx + destW),
      dy,
      destW,
      destH,
    );
  } else {
    ctx.drawImage(
      sheet.image,
      region.x,
      region.y,
      item.spriteWidth,
      item.spriteHeight,
      dx,
      dy,
      destW,
      destH,
    );
  }

  ctx.restore();
}

function drawElevation(ctx: CanvasRenderingContext2D, camera: Camera, item: ElevationItem): void {
  const tileScreenSize = TILE_SIZE * camera.scale;
  const screen = camera.worldToScreen(item.wx, item.wy);
  const tileSx = Math.round(screen.sx);
  const tileSy = Math.round(screen.sy);
  const cliffH = item.height * ELEVATION_PX * camera.scale;

  if (item.phase === "surface") {
    // Elevated tile shifted up
    ctx.drawImage(
      item.chunkCache,
      item.srcX,
      item.srcY,
      TILE_SIZE,
      TILE_SIZE,
      tileSx,
      tileSy - cliffH,
      tileScreenSize,
      tileScreenSize,
    );
    // Subtle darken on elevated surface so it reads as raised
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000";
    ctx.fillRect(tileSx, tileSy - cliffH, tileScreenSize, tileScreenSize);
    ctx.globalAlpha = 1;
  } else {
    // Cliff face: stretch bottom 1px row downward
    ctx.drawImage(
      item.chunkCache,
      item.srcX,
      item.srcY + TILE_SIZE - 1,
      TILE_SIZE,
      1,
      tileSx,
      tileSy + tileScreenSize - cliffH,
      tileScreenSize,
      cliffH,
    );
    // Darken the cliff face
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.fillRect(tileSx, tileSy + tileScreenSize - cliffH, tileScreenSize, cliffH);
    ctx.globalAlpha = 1;
  }
}

function drawGrass(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  item: GrassItem,
  sheet: Spritesheet,
): void {
  const screen = camera.worldToScreen(item.wx, item.wy);
  const scale = camera.scale;
  const ay = GRASS_ANCHOR_Y[item.variant] ?? 7;
  ctx.save();
  ctx.translate(screen.sx, screen.sy);
  ctx.rotate(item.angle);
  sheet.drawTile(ctx, item.variant, 0, -GRASS_ANCHOR_X * scale, -ay * scale, scale);
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, camera: Camera, item: ParticleItem): void {
  const screen = camera.worldToScreen(item.wx, item.wy);
  const r = item.size * camera.scale;
  ctx.globalAlpha = item.alpha;
  ctx.fillStyle = item.color;
  ctx.fillRect(
    Math.floor(screen.sx - r / 2),
    Math.floor(screen.sy - item.z * camera.scale - r / 2),
    Math.ceil(r),
    Math.ceil(r),
  );
  ctx.globalAlpha = 1;
}
