import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";

export const INTERIOR_DRAW_ORDER = ["floor", "wall", "foreground", "objects"] as const;
export type InteriorLayer = (typeof INTERIOR_DRAW_ORDER)[number];

export interface InteriorVisualTile {
  key: string;
  /** Optional left-aligned source slice for doorway outlines and junction trim. */
  cropWidth?: number;
  /** Trim the same pixels from the source and destination left edge. */
  cropX?: number;
  cropHeight?: number;
  /** Pixel placement relative to the atlas cell, independent of its source crop. */
  offsetX?: number;
  /** Stretch a uniform atlas strip when emitting a wider wall surface. */
  drawWidth?: number;
}

export interface InteriorLayeredCell {
  /** Collision/topology meaning is independent of what is drawn here. */
  semantic: string;
  floor: InteriorVisualTile[];
  wall: InteriorVisualTile[];
  foreground: InteriorVisualTile[];
  objects: InteriorVisualTile[];
}

export interface LayeredInteriorMap {
  width: number;
  height: number;
  pixelHeight: number;
  cells: InteriorLayeredCell[][];
}

export function createLayeredInteriorMap(
  width: number,
  height: number,
  pixelHeight = height * 16,
  semanticAt: (x: number, y: number) => string = () => "void",
): LayeredInteriorMap {
  return {
    width,
    height,
    pixelHeight,
    cells: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        semantic: semanticAt(x, y),
        floor: [],
        wall: [],
        foreground: [],
        objects: [],
      })),
    ),
  };
}

export function placeInteriorTile(
  map: LayeredInteriorMap,
  layer: InteriorLayer,
  x: number,
  y: number,
  tile: InteriorVisualTile,
): void {
  const cell = map.cells[y]?.[x];
  if (!cell) throw new Error(`Interior tile ${tile.key} is outside ${map.width}×${map.height}`);
  cell[layer].push(tile);
}

/** Draws every floor first, then opaque/transparent walls and foreground pieces. */
export function drawLayeredInteriorMap(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  map: LayeredInteriorMap,
  layers: readonly InteriorLayer[] = INTERIOR_DRAW_ORDER,
): void {
  ctx.imageSmoothingEnabled = false;
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
            y * 16,
            tile.drawWidth ?? width,
            height,
          );
        }
      }
    }
  }
}
