import { CHUNK_SIZE, ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ElevationItem } from "./SceneItem.js";
import type {
  TerrainRenderWorld,
  TerrainResourceId,
  TerrainResourceLookup,
} from "./TerrainPresentation.js";

type Descriptor = Omit<ElevationItem, "terrainResource">;
interface Layout {
  revision: number;
  visualRevision: number;
  cx: number;
  cy: number;
  descriptors: Descriptor[];
  resource: TerrainResourceId | null;
  items: ElevationItem[];
}

/** Backend-independent static geometry; weak keys never retain discarded chunks.
 * Cached records are immutable. Resource changes bind new records, so neither
 * old frames nor cached geometry hold image/canvas objects or mutate in place.
 */
export class ElevationDescriptorCache {
  private layouts = new WeakMap<Chunk, Layout>();
  private layoutBuilds = 0;
  private createdDescriptors = 0;
  private createdItems = 0;

  collect(
    world: Pick<TerrainRenderWorld, "getChunkIfLoaded">,
    visible: ChunkRange,
    resources: TerrainResourceLookup,
  ): ElevationItem[] {
    const output: ElevationItem[] = [];
    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;
        const resource = resources.resourceId(chunk, cx, cy);
        if (resource === null) continue;
        let layout = this.layouts.get(chunk);
        if (
          !layout ||
          layout.revision !== chunk.revision ||
          layout.visualRevision !== chunk.visualRevision ||
          layout.cx !== cx ||
          layout.cy !== cy
        ) {
          const descriptors: Descriptor[] = [];
          for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
              const height = chunk.getHeight(lx, ly);
              if (height <= 0) continue;
              const wx = (cx * CHUNK_SIZE + lx) * TILE_SIZE;
              const wy = (cy * CHUNK_SIZE + ly) * TILE_SIZE;
              const base = {
                kind: "elevation" as const,
                wx,
                wy,
                srcX: lx * TILE_SIZE,
                srcY: ly * TILE_SIZE,
                height,
              };
              descriptors.push({
                ...base,
                phase: "surface",
                sortKey: wy + height * ELEVATION_PX - 0.5,
              });
              descriptors.push({ ...base, phase: "cliff", sortKey: wy + TILE_SIZE });
            }
          }
          layout = {
            revision: chunk.revision,
            visualRevision: chunk.visualRevision,
            cx,
            cy,
            descriptors,
            resource: null,
            items: [],
          };
          this.layouts.set(chunk, layout);
          this.layoutBuilds++;
          this.createdDescriptors += descriptors.length;
        }
        if (layout.resource !== resource) {
          layout.resource = resource;
          layout.items = layout.descriptors.map((descriptor) => ({
            ...descriptor,
            terrainResource: resource,
          }));
          this.createdItems += layout.items.length;
        }
        for (const item of layout.items) output.push(item);
      }
    }
    return output;
  }

  clear(): void {
    this.layouts = new WeakMap();
  }

  getDiagnostics() {
    return {
      layoutBuilds: this.layoutBuilds,
      createdDescriptors: this.createdDescriptors,
      createdItems: this.createdItems,
    };
  }
}
