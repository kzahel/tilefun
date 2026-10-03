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
  offsetY?: number;
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
  /** Viewport padding for geometry that projects above the plan's origin. */
  contentOffsetY?: number;
  cells: InteriorLayeredCell[][];
  surfaces?: InteriorSurface[];
}

export interface InteriorSurface {
  points: [number, number][];
  plane: string;
  key: string;
  sampleX: number;
  sampleY: number;
  edges: boolean[];
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
