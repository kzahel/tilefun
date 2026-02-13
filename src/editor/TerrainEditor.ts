import type { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainId, toBaseTerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE } from "../config/constants.js";
import { getCollisionForWaterTile, TileId, terrainIdToTileId } from "../world/TileRegistry.js";
import { chunkKey, tileToChunk, tileToLocal } from "../world/types.js";
import type { World } from "../world/World.js";
import type { PaintMode, SubgridShape } from "./EditorMode.js";

const SUBGRID_STRIDE = CHUNK_SIZE * 2;

export class TerrainEditor {
  constructor(
    private readonly world: World,
    private readonly markChunkDirty: (key: string) => void,
    private readonly adjacency: TerrainAdjacency,
  ) {}

  /** Tile brush: set subgrid points of tile (tx,ty).
   *  bridgeDepth 0: full 3x3 (original behavior).
   *  bridgeDepth > 0: 5-point cross (skip corners to avoid diagonal nubs). */
  applyTileEdit(
    tx: number,
    ty: number,
    rawTerrainId: number | null,
    paintMode: PaintMode,
    bridgeDepth: number,
  ): void {
    const terrainId = rawTerrainId ?? this.getGlobalSubgrid(2 * tx + 1, 2 * ty + 1);
    const gsx0 = 2 * tx;
    const gsy0 = 2 * ty;
    const unpaint = paintMode === "unpaint";

    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
        // When bridge > 0, skip corners to avoid spiky diagonal artifacts
        if (bridgeDepth > 0 && (dx === 0 || dx === 2) && (dy === 0 || dy === 2)) continue;
        const gx = gsx0 + dx;
        const gy = gsy0 + dy;
        if (unpaint) {
          if (toBaseTerrainId(this.getGlobalSubgrid(gx, gy)) === toBaseTerrainId(terrainId)) {
            this.applySubgridWithBridges(
              gx,
              gy,
              this.findUnpaintReplacement(gx, gy, terrainId),
              0,
              bridgeDepth,
            );
          }
        } else {
          this.applySubgridWithBridges(gx, gy, terrainId, 0, bridgeDepth);
        }
      }
    }
  }

  /** Corner brush: 3x3 subgrid stamp centered on a tile vertex (even subgrid coord). */
  applyCornerEdit(
    gsx: number,
    gsy: number,
    rawTerrainId: number | null,
    paintMode: PaintMode,
    bridgeDepth: number,
  ): void {
    const terrainId = rawTerrainId ?? this.getGlobalSubgrid(gsx, gsy);
    const unpaint = paintMode === "unpaint";
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = gsx + dx;
        const gy = gsy + dy;
        if (unpaint) {
          if (toBaseTerrainId(this.getGlobalSubgrid(gx, gy)) === toBaseTerrainId(terrainId)) {
            this.applySubgridWithBridges(
              gx,
              gy,
              this.findUnpaintReplacement(gx, gy, terrainId),
              0,
              bridgeDepth,
            );
          }
        } else {
          this.applySubgridWithBridges(gx, gy, terrainId, 0, bridgeDepth);
        }
      }
    }
    // Re-derive terrain for the 4 tiles sharing this corner
    const tx = gsx / 2;
    const ty = gsy / 2;
    for (let dy = -1; dy <= 0; dy++) {
      for (let dx = -1; dx <= 0; dx++) {
        this.rederiveTerrainAt(tx + dx, ty + dy);
      }
    }
  }

  /** Subgrid brush: paint with configurable brush shape. */
  applySubgridEdit(
    gsx: number,
    gsy: number,
    rawTerrainId: number | null,
    paintMode: PaintMode,
    bridgeDepth: number,
    shape: SubgridShape,
  ): void {
    const terrainId = rawTerrainId ?? this.getGlobalSubgrid(gsx, gsy);
    const points = getSubgridBrushPoints(gsx, gsy, shape);

    if (paintMode === "unpaint") {
      for (const [px, py] of points) {
        if (toBaseTerrainId(this.getGlobalSubgrid(px, py)) === toBaseTerrainId(terrainId)) {
          const replacement = this.findUnpaintReplacement(px, py, terrainId);
          this.applySubgridWithBridges(px, py, replacement, 0, bridgeDepth);
        }
      }
    } else {
      for (const [px, py] of points) {
        this.applySubgridWithBridges(px, py, terrainId, 0, bridgeDepth);
      }
    }
  }

  /** Apply a road edit to a single tile. */
  applyRoadEdit(tx: number, ty: number, roadType: number, paintMode: PaintMode): void {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return;

    if (paintMode === "unpaint") {
      if (chunk.getRoad(lx, ly) === roadType) {
        chunk.setRoad(lx, ly, 0);
      }
    } else {
      chunk.setRoad(lx, ly, paintMode === "positive" ? roadType : 0);
    }

    chunk.dirty = true;
    chunk.revision++;
    const key = chunkKey(cx, cy);
    this.markChunkDirty(key);

    // Invalidate neighbor chunks for cross-chunk road connectivity
    if (lx === 0) this.invalidateChunkRender(cx - 1, cy);
    if (lx === CHUNK_SIZE - 1) this.invalidateChunkRender(cx + 1, cy);
    if (ly === 0) this.invalidateChunkRender(cx, cy - 1);
    if (ly === CHUNK_SIZE - 1) this.invalidateChunkRender(cx, cy + 1);
  }

  /** Elevation brush: set tile height for an NxN area centered on (tx, ty). */
  applyElevationEdit(tx: number, ty: number, height: number, gridSize: number): void {
    const half = Math.floor(gridSize / 2);
    for (let dy = -half; dy < gridSize - half; dy++) {
      for (let dx = -half; dx < gridSize - half; dx++) {
        this.setTileHeight(tx + dx, ty + dy, height);
      }
    }
  }

  private setTileHeight(tx: number, ty: number, height: number): void {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return;

    // Water constraint: water tiles cannot be elevated
    const terrain = toBaseTerrainId(this.getGlobalSubgrid(2 * tx + 1, 2 * ty + 1));
    if (height > 0 && (terrain === TerrainId.ShallowWater || terrain === TerrainId.DeepWater)) {
      return;
    }

    chunk.setHeight(lx, ly, height);
    chunk.dirty = true;
    chunk.revision++;
    this.markChunkDirty(chunkKey(cx, cy));
  }

  /** Fill all loaded chunks with a single terrain. */
  clearAllTerrain(terrainId: number): void {
    const tileId = terrainIdToTileId(terrainId);
    const collision = getCollisionForWaterTile(tileId, 9);
    for (const [key, chunk] of this.world.chunks.entries()) {
      chunk.subgrid.fill(terrainId);
      chunk.fillTerrain(tileId);
      chunk.fillCollision(collision);
      chunk.detail.fill(TileId.Empty);
      chunk.fillRoad(0);
      chunk.heightGrid.fill(0);
      chunk.dirty = true;
      chunk.autotileComputed = false;
      chunk.revision++;
      this.markChunkDirty(key);
    }
  }

  /** Clear all road data from loaded chunks. */
  clearAllRoads(): void {
    for (const [key, chunk] of this.world.chunks.entries()) {
      chunk.fillRoad(0);
      chunk.dirty = true;
      chunk.revision++;
      this.markChunkDirty(key);
    }
  }

  /** Mark all loaded chunks as needing autotile recomputation and re-render. */
  invalidateAllChunks(): void {
    for (const [, chunk] of this.world.chunks.entries()) {
      chunk.autotileComputed = false;
      chunk.dirty = true;
    }
  }

  // --- Internal helpers ---

  /** Count water subgrid points in the 3×3 area around a tile (global coords). */
  private countWaterSubgrid(tx: number, ty: number): number {
    let count = 0;
    const cx = 2 * tx + 1;
    const cy = 2 * ty + 1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = toBaseTerrainId(this.getGlobalSubgrid(cx + dx, cy + dy));
        if (t === TerrainId.ShallowWater || t === TerrainId.DeepWater) count++;
      }
    }
    return count;
  }

  /** Read raw subgrid value (may be a variant like ShallowWaterOnGrass). */
  getGlobalSubgrid(gsx: number, gsy: number): number {
    const cx = Math.floor(gsx / SUBGRID_STRIDE);
    const cy = Math.floor(gsy / SUBGRID_STRIDE);
    const lsx = gsx - cx * SUBGRID_STRIDE;
    const lsy = gsy - cy * SUBGRID_STRIDE;
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return TerrainId.Grass;
    return chunk.getSubgrid(lsx, lsy);
  }

  private setGlobalSubgrid(gsx: number, gsy: number, terrainId: number): void {
    const S = SUBGRID_STRIDE;
    const cx = Math.floor(gsx / S);
    const cy = Math.floor(gsy / S);
    const lsx = gsx - cx * S;
    const lsy = gsy - cy * S;

    this.setSubgridInChunk(cx, cy, lsx, lsy, terrainId);
    if (lsx === 0) this.setSubgridInChunk(cx - 1, cy, S, lsy, terrainId);
    if (lsy === 0) this.setSubgridInChunk(cx, cy - 1, lsx, S, terrainId);
    if (lsx === 0 && lsy === 0) this.setSubgridInChunk(cx - 1, cy - 1, S, S, terrainId);
  }

  private setSubgridInChunk(
    cx: number,
    cy: number,
    lsx: number,
    lsy: number,
    terrainId: number,
  ): void {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (chunk) {
      chunk.setSubgrid(lsx, lsy, terrainId);
      chunk.revision++;
      this.markChunkDirty(chunkKey(cx, cy));
    }
  }

  private findUnpaintReplacement(gsx: number, gsy: number, unpaintTerrain: number): number {
    const baseUnpaint = toBaseTerrainId(unpaintTerrain);
    const counts = new Map<number, number>();
    const dirs: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    for (const [dx, dy] of dirs) {
      const raw = this.getGlobalSubgrid(gsx + dx, gsy + dy);
      if (toBaseTerrainId(raw) !== baseUnpaint) counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    if (counts.size === 0) return TerrainId.Grass;
    let best: number = TerrainId.Grass;
    let bestCount = 0;
    for (const [t, c] of counts) {
      if (c > bestCount) {
        best = t;
        bestCount = c;
      }
    }
    return best;
  }

  private applySubgridWithBridges(
    gsx: number,
    gsy: number,
    terrainId: number,
    depth: number,
    maxBridge: number,
  ): void {
    this.setGlobalSubgrid(gsx, gsy, terrainId);

    if (maxBridge > 0 && depth < maxBridge) {
      const baseTerrain = toBaseTerrainId(terrainId);
      const cardinals: [number, number][] = [
        [gsx - 1, gsy],
        [gsx + 1, gsy],
        [gsx, gsy - 1],
        [gsx, gsy + 1],
      ];
      for (const [nx, ny] of cardinals) {
        const neighborBase = toBaseTerrainId(this.getGlobalSubgrid(nx, ny));
        if (neighborBase === baseTerrain) continue;
        if (this.adjacency.isValidAdjacency(baseTerrain, neighborBase)) continue;
        const step = this.adjacency.getBridgeStep(baseTerrain, neighborBase);
        if (step !== undefined) {
          // Bridge-inserted terrains use base TerrainId (not variant)
          this.applySubgridWithBridges(nx, ny, step, depth + 1, maxBridge);
        }
      }
    }

    // Re-derive terrain for tiles whose subgrid region includes this point
    const txMin = Math.ceil((gsx - 2) / 2);
    const txMax = Math.floor(gsx / 2);
    const tyMin = Math.ceil((gsy - 2) / 2);
    const tyMax = Math.floor(gsy / 2);
    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        this.rederiveTerrainAt(tx, ty);
      }
    }
  }

  private rederiveTerrainAt(tx: number, ty: number): void {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return;

    const baseTerrain = toBaseTerrainId(this.getGlobalSubgrid(2 * tx + 1, 2 * ty + 1));
    const tileId = terrainIdToTileId(baseTerrain);

    chunk.setTerrain(lx, ly, tileId);
    const waterCount = this.countWaterSubgrid(tx, ty);
    chunk.setCollision(lx, ly, getCollisionForWaterTile(tileId, waterCount));
    chunk.setDetail(lx, ly, TileId.Empty);

    // Water constraint: painting water on an elevated tile resets height to 0
    if (
      (baseTerrain === TerrainId.ShallowWater || baseTerrain === TerrainId.DeepWater) &&
      chunk.getHeight(lx, ly) > 0
    ) {
      chunk.setHeight(lx, ly, 0);
    }

    chunk.dirty = true;
    chunk.autotileComputed = false;

    if (lx === 0) this.invalidateChunk(cx - 1, cy);
    if (lx === CHUNK_SIZE - 1) this.invalidateChunk(cx + 1, cy);
    if (ly === 0) this.invalidateChunk(cx, cy - 1);
    if (ly === CHUNK_SIZE - 1) this.invalidateChunk(cx, cy + 1);
  }

  private invalidateChunk(cx: number, cy: number): void {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (chunk) {
      chunk.autotileComputed = false;
      chunk.dirty = true;
    }
  }

  private invalidateChunkRender(cx: number, cy: number): void {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (chunk) chunk.dirty = true;
  }
}

/** Compute the set of subgrid points affected by a brush of the given shape. */
export function getSubgridBrushPoints(
  gsx: number,
  gsy: number,
  shape: SubgridShape,
): [number, number][] {
  if (shape === "cross") {
    return [
      [gsx, gsy],
      [gsx - 1, gsy],
      [gsx + 1, gsy],
      [gsx, gsy - 1],
      [gsx, gsy + 1],
    ];
  }
  if (shape === "x") {
    return [
      [gsx, gsy],
      [gsx - 1, gsy - 1],
      [gsx + 1, gsy - 1],
      [gsx - 1, gsy + 1],
      [gsx + 1, gsy + 1],
    ];
  }
  const size = shape;
  const half = Math.floor(size / 2);
  const pts: [number, number][] = [];
  for (let dy = -half; dy < size - half; dy++) {
    for (let dx = -half; dx < size - half; dx++) {
      pts.push([gsx + dx, gsy + dy]);
    }
  }
  return pts;
}
