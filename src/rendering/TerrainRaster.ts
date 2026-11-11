import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";

/** Center-out rows keep the camera's nearest ground available first. */
export function terrainRowOrder(centerRow: number): number[] {
  const order: number[] = [];
  for (let d = 0; d < CHUNK_SIZE; d++) {
    const up = centerRow - d;
    if (up >= 0) order.push(up);
    if (d === 0) continue;
    const down = centerRow + d;
    if (down < CHUNK_SIZE) order.push(down);
  }
  return order;
}

/** Canvas draws may merely record commands, even with willReadFrequently.
 * Read the entire changed row before the builder checks its deadline or publishes
 * pixels. This charges raster completion here instead of at the later GPU-page
 * copy. The returned pixels are discarded; no round-trip write changes colors.
 * A row is the atomic unit: a deadline can overrun by one completed row. */
export function finishTerrainRow(ctx: OffscreenCanvasRenderingContext2D, row: number): void {
  ctx.getImageData(0, row * TILE_SIZE, CHUNK_SIZE * TILE_SIZE, TILE_SIZE);
}
