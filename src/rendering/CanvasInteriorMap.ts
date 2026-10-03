import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import {
  INTERIOR_DRAW_ORDER,
  type InteriorLayer,
  type InteriorSurface,
  type LayeredInteriorMap,
} from "../interiors/LayeredInteriorMap.js";

/** Draws every floor first, then opaque/transparent walls and foreground pieces. */
export function drawLayeredInteriorMap(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  map: LayeredInteriorMap,
  layers: readonly InteriorLayer[] = INTERIOR_DRAW_ORDER,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(0, map.contentOffsetY ?? 0);
  for (const layer of layers) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.cells[y]?.[x];
        if (!cell) continue;
        for (const tile of cell[layer]) {
          const entry = getModernInteriorsEntry(tile.key);
          if (!entry) throw new Error(`Missing interior tile: ${tile.key}`);
          const [sx, sy, sw, sh] = entry.rect;
          const cropX = tile.cropX ?? 0;
          const width = tile.cropWidth ?? sw - cropX;
          const height = tile.cropHeight ?? sh;
          ctx.drawImage(
            atlasImage,
            sx + cropX,
            sy,
            width,
            height,
            x * 16 + cropX + (tile.offsetX ?? 0),
            y * 16 + (tile.offsetY ?? 0),
            tile.drawWidth ?? width,
            height,
          );
        }
      }
    }
    if (layer === "wall" && map.surfaces) drawInteriorSurfaces(ctx, atlasImage, map.surfaces);
  }
  ctx.restore();
}

/** Integer scan conversion keeps the experimental extrusions pixel-crisp. */
function drawInteriorSurfaces(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  surfaces: InteriorSurface[],
): void {
  const outline = getModernInteriorsEntry("room-builder/3d-walls/c08-r01");
  if (!outline) throw new Error("Missing wall outline material");
  for (const surface of surfaces) {
    const entry = getModernInteriorsEntry(surface.key);
    if (!entry) throw new Error(`Missing surface material ${surface.key}`);
    const points = surface.points;
    const minY = Math.min(...points.map((p) => p[1])),
      maxY = Math.max(...points.map((p) => p[1]));
    for (let y = minY; y < maxY; y++) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        if (!a || !b) throw new Error("Missing polygon edge");
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5))
          intersections.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const left = Math.ceil((intersections[i] ?? 0) - 0.5),
          right = Math.ceil((intersections[i + 1] ?? 0) - 0.5);
        if (right > left)
          ctx.drawImage(
            atlas,
            entry.rect[0] + surface.sampleX,
            entry.rect[1] + surface.sampleY,
            1,
            1,
            left,
            y,
            right - left,
            1,
          );
      }
    }
    points.forEach((a, i) => {
      if (!surface.edges[i]) return;
      const b = points[(i + 1) % points.length];
      if (!a || !b) throw new Error("Missing polygon edge");
      let x = a[0],
        y = a[1];
      const dx = Math.abs(b[0] - x),
        dy = -Math.abs(b[1] - y),
        sx = x < b[0] ? 1 : -1,
        sy = y < b[1] ? 1 : -1;
      let error = dx + dy;
      while (true) {
        ctx.drawImage(atlas, outline.rect[0], outline.rect[1], 1, 1, x, y, 1, 1);
        if (x === b[0] && y === b[1]) break;
        const twice = 2 * error;
        if (twice >= dy) {
          error += dy;
          x += sx;
        }
        if (twice <= dx) {
          error += dx;
          y += sy;
        }
      }
    });
  }
}
