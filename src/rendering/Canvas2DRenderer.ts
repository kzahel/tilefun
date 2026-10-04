import type { Spritesheet } from "../assets/Spritesheet.js";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Camera } from "./Camera.js";
import { GRASS_ANCHOR_X, GRASS_ANCHOR_Y } from "./GrassBladeRenderer.js";
import type { RasterSurface } from "./RasterSurface.js";
import { collectSceneOrder, type RenderPass } from "./RenderFrame.js";
import type { ElevationItem, GrassItem, ParticleItem, SceneItem, SpriteItem } from "./SceneItem.js";
import type { TerrainResourceId } from "./TerrainPresentation.js";

/** Canvas-specific resource resolution stays on the drawing side of the boundary. */
export interface CanvasTerrainSource {
  resolveTerrainResource(id: TerrainResourceId): CanvasImageSource | null;
}

/**
 * Draw a pre-sorted scene item list onto a Canvas2D context.
 * Two passes: shadow pre-pass, then main draw pass.
 */
export function drawScene2D(
  ctx: RasterSurface,
  camera: Camera,
  items: readonly SceneItem[],
  sheets: Map<string, Spritesheet>,
  grassSheet: Spritesheet | undefined,
  pixelExactShadows = false,
  terrain?: CanvasTerrainSource,
  order: readonly number[] = collectSceneOrder(items, []),
): void {
  drawScenePass2D(
    ctx,
    camera,
    { kind: "scene", items, order, pixelExactShadows },
    sheets,
    grassSheet,
    terrain,
  );
}

/** Native Canvas references and production consume the same semantic pass. */
export function drawScenePass2D(
  ctx: RasterSurface,
  camera: Camera,
  pass: Extract<RenderPass, { kind: "scene" }>,
  sheets: Map<string, Spritesheet>,
  grassSheet: Spritesheet | undefined,
  terrain?: CanvasTerrainSource,
): void {
  if (pass.clipRects) {
    ctx.save();
    ctx.beginPath();
    for (const rect of pass.clipRects) ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
  }
  try {
    for (const entry of pass.order) {
      const item = pass.items[entry < 0 ? -entry - 1 : entry];
      if (item)
        drawSceneEntry2D(
          ctx,
          camera,
          item,
          sheets,
          grassSheet,
          pass.pixelExactShadows,
          terrain,
          entry < 0,
        );
    }
  } finally {
    if (pass.clipRects) ctx.restore();
  }
}

/** Draw one explicitly ordered body or shadow. No scene ordering policy here. */
export function drawSceneEntry2D(
  ctx: RasterSurface,
  camera: Camera,
  item: SceneItem,
  sheets: Map<string, Spritesheet>,
  grassSheet: Spritesheet | undefined,
  pixelExactShadows = false,
  terrain?: CanvasTerrainSource,
  shadow = false,
): void {
  if (shadow) {
    if (item.kind === "sprite") drawOneShadow(ctx, camera, item, pixelExactShadows);
    return;
  }
  switch (item.kind) {
    case "sprite":
      drawSprite(ctx, camera, item, sheets);
      break;
    case "elevation": {
      if (!terrain) throw new Error("Elevation drawing requires terrain resources");
      const image = terrain.resolveTerrainResource(item.terrainResource);
      if (image) drawElevation(ctx, camera, item, image);
      break;
    }
    case "grass":
      if (grassSheet) drawGrass(ctx, camera, item, grassSheet);
      break;
    case "particle":
      drawParticle(ctx, camera, item);
      break;
  }
}

/** Draw a single entity shadow ellipse. */
function drawOneShadow(
  ctx: RasterSurface,
  camera: Camera,
  item: SpriteItem,
  pixelExactShadows: boolean,
): void {
  const shadowW = item.shadowWidth * camera.scale;
  const shadowH = shadowW * 0.35;
  const terrainOffset = item.shadowTerrainZ * camera.scale;
  const feetScreen = camera.worldToScreen(item.wx, item.shadowFeetWy);
  if (pixelExactShadows) {
    (
      ctx.pixelShadow ??
      ((...args: [number, number, number, number]) =>
        drawPixelShadow(ctx as CanvasRenderingContext2D, ...args))
    )(
      Math.floor(feetScreen.sx),
      Math.floor(feetScreen.sy - terrainOffset),
      shadowW / 2,
      shadowH / 2,
    );
    return;
  }
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

/** Native-pixel approval rendering must avoid backend-dependent ellipse
 * antialiasing and alpha rounding. Integer pixels and explicit source-over math
 * give the same result in GPU Chromium, headless-shell and other browsers.
 * Gameplay retains its existing smooth shadows.
 */
function drawPixelShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  if (rx <= 0 || ry <= 0) return;
  const left = Math.max(0, Math.floor(cx - rx)),
    top = Math.max(0, Math.floor(cy - ry)),
    right = Math.min(ctx.canvas.width, Math.ceil(cx + rx)),
    bottom = Math.min(ctx.canvas.height, Math.ceil(cy + ry));
  if (right <= left || bottom <= top) return;
  const image = ctx.getImageData(left, top, right - left, bottom - top);
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue;
      const i = ((y - top) * image.width + x - left) * 4,
        oldAlpha = image.data[i + 3] ?? 0;
      const alpha = 77 + Math.round((oldAlpha * 178) / 255);
      for (let channel = 0; channel < 3; channel++)
        image.data[i + channel] = Math.round(
          ((image.data[i + channel] ?? 0) * oldAlpha * 178) / (alpha * 255),
        );
      image.data[i + 3] = alpha;
    }
  ctx.putImageData(image, left, top);
}

function drawSprite(
  ctx: RasterSurface,
  camera: Camera,
  item: SpriteItem,
  sheets: Map<string, Spritesheet>,
): void {
  if (item.flashHidden) return;
  if (ctx.meshBody?.(camera, item)) return;
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

function drawElevation(
  ctx: RasterSurface,
  camera: Camera,
  item: ElevationItem,
  image: CanvasImageSource,
): void {
  const tileScreenSize = TILE_SIZE * camera.scale;
  const screen = camera.worldToScreen(item.wx, item.wy);
  const tileSx = Math.round(screen.sx);
  const tileSy = Math.round(screen.sy);
  const cliffH = item.height * ELEVATION_PX * camera.scale;

  if (item.phase === "surface") {
    // Elevated tile shifted up
    ctx.drawImage(
      image,
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
      image,
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

function drawGrass(ctx: RasterSurface, camera: Camera, item: GrassItem, sheet: Spritesheet): void {
  const screen = camera.worldToScreen(item.wx, item.wy);
  const scale = camera.scale;
  const ay = GRASS_ANCHOR_Y[item.variant] ?? 7;
  ctx.save();
  ctx.translate(screen.sx, screen.sy);
  ctx.rotate(item.angle);
  const region = sheet.getRegion(item.variant, 0);
  ctx.drawImage(
    sheet.image,
    region.x,
    region.y,
    region.width,
    region.height,
    -GRASS_ANCHOR_X * scale,
    -ay * scale,
    region.width * scale,
    region.height * scale,
  );
  ctx.restore();
}

function drawParticle(ctx: RasterSurface, camera: Camera, item: ParticleItem): void {
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
