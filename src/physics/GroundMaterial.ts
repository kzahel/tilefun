import { TerrainId, toBaseTerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE, ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";

/** What a wheel rolls on (231). Elevated props and other bodies are pavement. */
export type GroundMaterial = "paved" | "grass" | "dirt" | "sand" | "water";

/** The world both authority and client prediction share (one chunk lookup per call). */
export interface GroundMaterialSource {
  getChunkIfLoaded(
    cx: number,
    cy: number,
  ): Pick<Chunk, "getSubgrid" | "getHeight" | "getRoad"> | undefined;
}

const HALF_TILE = TILE_SIZE / 2;
/** Height tolerance (world px) separating a terrain contact from a prop surface. */
const LEVEL_TOLERANCE = 1;

function terrainMaterial(id: number): GroundMaterial {
  switch (toBaseTerrainId(id)) {
    case TerrainId.Sand:
    case TerrainId.SandLight:
      return "sand";
    case TerrainId.Grass:
      return "grass";
    case TerrainId.DirtLight:
    case TerrainId.DirtWarm:
      return "dirt";
    case TerrainId.ShallowWater:
    case TerrainId.DeepWater:
      return "water";
    default:
      return "paved";
  }
}

/** Material under a ground-contact point (world px). Roads win over terrain.
 * Contacts off the tile's terrain plane are authored props — ramps, bridges and
 * slabs above it, excavated floors such as garages below it (the compiler clips
 * terrain away there) — and drive as pavement. Physics passes exact ray hits;
 * presentation sampling a body point passes a looser `tolerance`. */
export function groundMaterialAt(
  source: GroundMaterialSource,
  wx: number,
  wy: number,
  wz: number,
  tolerance = LEVEL_TOLERANCE,
): GroundMaterial {
  const tx = Math.floor(wx / TILE_SIZE),
    ty = Math.floor(wy / TILE_SIZE);
  const cx = Math.floor(tx / CHUNK_SIZE),
    cy = Math.floor(ty / CHUNK_SIZE);
  const chunk = source.getChunkIfLoaded(cx, cy);
  if (!chunk) return "paved";
  const lx = tx - cx * CHUNK_SIZE,
    ly = ty - cy * CHUNK_SIZE;
  const floor = chunk.getHeight(lx, ly) * ELEVATION_PX;
  if (Math.abs(wz - floor) > tolerance) return "paved";
  if (chunk.getRoad(lx, ly) !== 0) return "paved";
  // Nearest half-tile subgrid point (corners and midpoints) within this chunk.
  const span = CHUNK_SIZE * TILE_SIZE;
  const sx = Math.round((wx - cx * span) / HALF_TILE),
    sy = Math.round((wy - cy * span) / HALF_TILE);
  return terrainMaterial(chunk.getSubgrid(sx, sy));
}
