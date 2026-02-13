import { CHUNK_SIZE } from "../config/constants.js";
import { RoadType } from "../road/RoadType.js";
import type { Chunk } from "../world/Chunk.js";
import { fbm } from "./noise.js";

/** Noise scale matching OnionStrategy for elevation checks. */
const TERRAIN_NOISE_SCALE = 0.012;
/** Minimum elevation for road placement (no water, but sand is OK). */
const MIN_ROAD_ELEVATION = -0.15;
/** Seed offsets so horizontal and vertical grids are independent. */
const H_SEED_OFFSET = 7919;
const V_SEED_OFFSET = 13337;
/** Number of sample points along a segment for water checks. */
const WATER_SAMPLES = 5;

export interface RoadGenParams {
  /** Grid spacing in tiles between potential road lines. */
  spacing: number;
  /** Probability (0–1) that a grid segment has a road. Controls density. */
  density: number;
  /** Asphalt road width in tiles. */
  width: number;
  /** Sidewalk width in tiles on each side of the road. */
  sidewalkWidth: number;
  /** Auto-place sidewalk borders around roads. */
  sidewalks: boolean;
  /** Auto-place yellow center lines on straight segments. */
  centerLines: boolean;
  /** How strongly water reduces road activation (0 = ignore water, 1.5 = moderate avoidance). */
  waterPenalty: number;
}

export const DEFAULT_ROAD_PARAMS: RoadGenParams = {
  spacing: 40,
  density: 0.4,
  width: 5,
  sidewalkWidth: 3,
  sidewalks: true,
  centerLines: true,
};

/**
 * Deterministic hash for grid edge activation.
 * Returns a value in [0, 1) for the grid edge at (a, b) with the given seed.
 */
function edgeHash(a: number, b: number, seed: number): number {
  let h = (a * 374761393 + b * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h = Math.imul(h ^ (h >>> 16), 2654435769);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Compute elevation at a tile center, matching OnionStrategy logic. */
export function getElevation(tx: number, ty: number, seed: number, islandRadius: number): number {
  const wx = tx + 0.5;
  const wy = ty + 0.5;
  if (islandRadius > 0) {
    const dist = Math.sqrt(wx * wx + wy * wy);
    return 1 - (2 * dist) / islandRadius;
  }
  return fbm(wx * TERRAIN_NOISE_SCALE, wy * TERRAIN_NOISE_SCALE, seed, 3);
}

/**
 * Is a horizontal road segment active and dry (no water along its path)?
 * Checks hash activation AND samples elevation along the segment center.
 */
function isHSegmentActive(
  gx: number,
  gy: number,
  seed: number,
  params: RoadGenParams,
  islandRadius: number,
): boolean {
  if (edgeHash(gx, gy, seed + H_SEED_OFFSET) >= params.density) return false;
  // Sample elevation along the center of the road band
  const centerY = gy * params.spacing + (params.width >> 1);
  const startX = gx * params.spacing;
  const endX = (gx + 1) * params.spacing - 1;
  for (let i = 0; i < WATER_SAMPLES; i++) {
    const x = startX + Math.round((i * (endX - startX)) / (WATER_SAMPLES - 1));
    if (getElevation(x, centerY, seed, islandRadius) < MIN_ROAD_ELEVATION) return false;
  }
  return true;
}

/**
 * Is a vertical road segment active and dry (no water along its path)?
 */
function isVSegmentActive(
  gx: number,
  gy: number,
  seed: number,
  params: RoadGenParams,
  islandRadius: number,
): boolean {
  if (edgeHash(gx, gy, seed + V_SEED_OFFSET) >= params.density) return false;
  const centerX = gx * params.spacing + (params.width >> 1);
  const startY = gy * params.spacing;
  const endY = (gy + 1) * params.spacing - 1;
  for (let i = 0; i < WATER_SAMPLES; i++) {
    const y = startY + Math.round((i * (endY - startY)) / (WATER_SAMPLES - 1));
    if (getElevation(centerX, y, seed, islandRadius) < MIN_ROAD_ELEVATION) return false;
  }
  return true;
}

/**
 * Pure function: is there a base road (asphalt) at this global tile?
 * Roads are axis-aligned segments on a grid. Entire segments are disabled
 * if any part crosses water, so roads stop cleanly at grid intersections.
 */
export function isRoadAtGlobal(
  tx: number,
  ty: number,
  seed: number,
  params: RoadGenParams,
  islandRadius: number,
): boolean {
  const { spacing, width } = params;

  // Check horizontal road: occupies rows [gy*spacing, gy*spacing + width)
  const gyCandidate = Math.round(ty / spacing);
  const roadY = gyCandidate * spacing;
  const dyFromRoad = ty - roadY;
  if (dyFromRoad >= 0 && dyFromRoad < width) {
    const gx = Math.floor(tx / spacing);
    if (isHSegmentActive(gx, gyCandidate, seed, params, islandRadius)) return true;
  }

  // Check vertical road: occupies cols [gx*spacing, gx*spacing + width)
  const gxCandidate = Math.round(tx / spacing);
  const roadX = gxCandidate * spacing;
  const dxFromRoad = tx - roadX;
  if (dxFromRoad >= 0 && dxFromRoad < width) {
    const gy = Math.floor(ty / spacing);
    if (isVSegmentActive(gxCandidate, gy, seed, params, islandRadius)) return true;
  }

  return false;
}

/** Fill chunk.roadGrid with generated roads (asphalt + sidewalks + center lines). */
export function generateChunkRoads(
  chunk: Chunk,
  cx: number,
  cy: number,
  seed: number,
  params: RoadGenParams,
  islandRadius: number,
): void {
  const baseTx = cx * CHUNK_SIZE;
  const baseTy = cy * CHUNK_SIZE;
  const { spacing, width } = params;
  const centerOffset = width >> 1;

  // Helper: check if global tile is asphalt, using in-chunk data when available
  const isAsphaltAt = (tx: number, ty: number): boolean => {
    const lx = tx - baseTx;
    const ly = ty - baseTy;
    if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE) {
      const r = chunk.getRoad(lx, ly);
      return r === RoadType.Asphalt || r === RoadType.LineYellow;
    }
    return isRoadAtGlobal(tx, ty, seed, params, islandRadius);
  };

  // Pass 1: Base asphalt
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      if (isRoadAtGlobal(baseTx + lx, baseTy + ly, seed, params, islandRadius)) {
        chunk.setRoad(lx, ly, RoadType.Asphalt);
      }
    }
  }

  // Pass 2: Thick sidewalk borders (Chebyshev distance <= sidewalkWidth from any road tile)
  if (params.sidewalks && params.sidewalkWidth > 0) {
    const sw = params.sidewalkWidth;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (chunk.getRoad(lx, ly) !== RoadType.None) continue;
        const tx = baseTx + lx;
        const ty = baseTy + ly;
        if (getElevation(tx, ty, seed, islandRadius) < MIN_ROAD_ELEVATION) continue;
        // Check if any tile within sidewalkWidth (Chebyshev distance) is a road
        let nearRoad = false;
        for (let dy = -sw; dy <= sw && !nearRoad; dy++) {
          for (let dx = -sw; dx <= sw && !nearRoad; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (isAsphaltAt(tx + dx, ty + dy)) nearRoad = true;
          }
        }
        if (nearRoad) chunk.setRoad(lx, ly, RoadType.Sidewalk);
      }
    }
  }

  // Pass 3: Center line markings on straight segments (not at intersections)
  if (params.centerLines) {
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (chunk.getRoad(lx, ly) !== RoadType.Asphalt) continue;
        const tx = baseTx + lx;
        const ty = baseTy + ly;

        // Determine which road direction(s) this tile is on
        const gyC = Math.round(ty / spacing);
        const hRoadY = gyC * spacing;
        const onH = ty - hRoadY >= 0 && ty - hRoadY < width;
        const isHCenter = ty - hRoadY === centerOffset;

        const gxC = Math.round(tx / spacing);
        const vRoadX = gxC * spacing;
        const onV = tx - vRoadX >= 0 && tx - vRoadX < width;
        const isVCenter = tx - vRoadX === centerOffset;

        // Place center line only on straight segments:
        // - H center line if on H road center and NOT also on a V road
        // - V center line if on V road center and NOT also on an H road
        if ((isHCenter && onH && !onV) || (isVCenter && onV && !onH)) {
          chunk.setRoad(lx, ly, RoadType.LineYellow);
        }
      }
    }
  }
}
