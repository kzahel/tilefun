import { CHUNK_SIZE, PIXEL_SCALE, TILE_SIZE } from "../config/constants.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { RenderView, TerrainDraw } from "./RenderFrame.js";
import type { GroundTerrainResources, TerrainRenderWorld } from "./TerrainPresentation.js";

export interface TerrainDrawOptions {
  readonly readyOnly?: boolean;
  readonly overscanPixels?: number;
}

/** Shared culling/placement policy. Neither image resources nor raster work are
 * reachable here; changing the camera only changes these borrowed placements.
 */
export class TerrainFrame {
  readonly draws: TerrainDraw[] = [];
  private readonly pool: TerrainDraw[] = [];

  collect(
    view: RenderView,
    world: Pick<TerrainRenderWorld, "getChunkIfLoaded">,
    resources: GroundTerrainResources,
    visible: ChunkRange,
    options?: TerrainDrawOptions,
    viewportWidth = view.viewportWidth,
    viewportHeight = view.viewportHeight,
  ): readonly TerrainDraw[] {
    this.draws.length = 0;
    const nativeSize = CHUNK_SIZE * TILE_SIZE,
      scale = PIXEL_SCALE * view.zoom;
    const size = nativeSize * scale;
    for (let cy = visible.minCy; cy <= visible.maxCy; cy++)
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;
        const x = Math.round((cx * nativeSize - view.x) * scale + view.viewportWidth / 2);
        const y = Math.round((cy * nativeSize - view.y) * scale + view.viewportHeight / 2);
        if (x + size < 0 || y + size < 0 || x > viewportWidth || y > viewportHeight) continue;
        const resource = resources.groundResourceId(chunk, cx, cy, options?.readyOnly ?? false);
        if (resource === null) continue;
        const index = this.draws.length;
        let draw = this.pool[index];
        if (!draw) {
          draw = { resource, x, y, width: 0, height: 0 };
          if (index < 2048) this.pool.push(draw);
        }
        draw.resource = resource;
        draw.x = x;
        draw.y = y;
        draw.width = size + (options?.overscanPixels ?? 1);
        draw.height = draw.width;
        this.draws.push(draw);
      }
    return this.draws;
  }
  clear(): void {
    this.draws.length = 0;
    this.pool.length = 0;
  }
}
