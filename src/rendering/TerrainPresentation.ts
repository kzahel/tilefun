import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { World } from "../world/World.js";
import type { ElevationItem } from "./SceneItem.js";

/** Opaque identity scoped to the lifetime of one published backend resource.
 * Never serialize it as world data. A released identity must not resolve to a new image.
 */
export type TerrainResourceId = number & { readonly terrainResource: unique symbol };
export type TerrainRenderWorld = Pick<World, "getRoadAt" | "getChunkIfLoaded">;

/** Read-only presentation data; no Canvas or concrete renderer dependency. */
export interface TerrainPresentation {
  collectElevationItems(world: TerrainRenderWorld, visible: ChunkRange): ElevationItem[];
}

/** Resource identities only; usable by a frame builder without graphics APIs. */
export interface TerrainResourceLookup {
  resourceId(chunk: Chunk, cx: number, cy: number): TerrainResourceId | null;
}
