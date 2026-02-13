import type { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE } from "../config/constants.js";
import type { SaveManager } from "../persistence/SaveManager.js";
import { getCollisionForTerrain, TileId, terrainIdToTileId } from "../world/TileRegistry.js";
import { chunkKey, tileToChunk, tileToLocal } from "../world/types.js";
import type { World } from "../world/World.js";
import type { PaintMode, SubgridShape } from "./EditorMode.js";

const SUBGRID_STRIDE = CHUNK_SIZE * 2;

export class TerrainEditor {
  constructor(
    private readonly world: World,
    private readonly saveManager: SaveManager,
    private readonly adjacency: TerrainAdjacency,
  ) {}

  /** Tile brush: set all 9 subgrid points of tile (tx,ty) to the same terrain. */
  applyTileEdit(
    tx: number,
    ty: number,
    rawTerrainId: TerrainId | null,
    paintMode: PaintMode,
    bridgeDepth: number,
  ): void {
    const terrainId: TerrainId = rawTerrainId ?? this.getGlobalSubgrid(2 * tx + 1, 2 * ty + 1);
    const gsx0 = 2 * tx;
    const gsy0 = 2 * ty;
    const unpaint = paintMode === "unpaint";
    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
        const gx = gsx0 + dx;
        const gy = gsy0 + dy;
        if (unpaint) {
          if (this.getGlobalSubgrid(gx, gy) === terrainId) {
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
    rawTerrainId: TerrainId | null,
    paintMode: PaintMode,
    bridgeDepth: number,
  ): void {
    const terrainId: TerrainId = rawTerrainId ?? this.getGlobalSubgrid(gsx, gsy);
    const unpaint = paintMode === "unpaint";
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = gsx + dx;
        const gy = gsy + dy;
        if (unpaint) {
          if (this.getGlobalSubgrid(gx, gy) === terrainId) {
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
    rawTerrainId: TerrainId | null,
    paintMode: PaintMode,
    bridgeDepth: number,
    shape: SubgridShape,
  ): void {
    const terrainId: TerrainId = rawTerrainId ?? this.getGlobalSubgrid(gsx, gsy);
    const points = getSubgridBrushPoints(gsx, gsy, shape);

    if (paintMode === "unpaint") {
      for (const [px, py] of points) {
        if (this.getGlobalSubgrid(px, py) === terrainId) {
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
    const key = chunkKey(cx, cy);
    this.saveManager.markChunkDirty(key);

    // Invalidate neighbor chunks for cross-chunk road connectivity
    if (lx === 0) this.invalidateChunkRender(cx - 1, cy);
    if (lx === CHUNK_SIZE - 1) this.invalidateChunkRender(cx + 1, cy);
    if (ly === 0) this.invalidateChunkRender(cx, cy - 1);
    if (ly === CHUNK_SIZE - 1) this.invalidateChunkRender(cx, cy + 1);
  }

  /** Fill all loaded chunks with a single terrain. */
  clearAllTerrain(terrainId: TerrainId): void {
    const tileId = terrainIdToTileId(terrainId);
    const collision = getCollisionForTerrain(tileId);
    for (const [key, chunk] of this.world.chunks.entries()) {
      chunk.subgrid.fill(terrainId);
      chunk.fillTerrain(tileId);
      chunk.fillCollision(collision);
      chunk.detail.fill(TileId.Empty);
      chunk.fillRoad(0);
      chunk.dirty = true;
      chunk.autotileComputed = false;
      this.saveManager.markChunkDirty(key);
    }
  }

  /** Clear all road data from loaded chunks. */
  clearAllRoads(): void {
    for (const [key, chunk] of this.world.chunks.entries()) {
      chunk.fillRoad(0);
      chunk.dirty = true;
      this.saveManager.markChunkDirty(key);
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

  getGlobalSubgrid(gsx: number, gsy: number): TerrainId {
    const cx = Math.floor(gsx / SUBGRID_STRIDE);
    const cy = Math.floor(gsy / SUBGRID_STRIDE);
    const lsx = gsx - cx * SUBGRID_STRIDE;
    const lsy = gsy - cy * SUBGRID_STRIDE;
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return TerrainId.Grass;
    return chunk.getSubgrid(lsx, lsy) as TerrainId;
  }

  private setGlobalSubgrid(gsx: number, gsy: number, terrainId: TerrainId): void {
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
    terrainId: TerrainId,
  ): void {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (chunk) {
      chunk.setSubgrid(lsx, lsy, terrainId);
      this.saveManager.markChunkDirty(chunkKey(cx, cy));
    }
  }

  private findUnpaintReplacement(gsx: number, gsy: number, unpaintTerrain: TerrainId): TerrainId {
    const counts = new Map<TerrainId, number>();
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
      const t = this.getGlobalSubgrid(gsx + dx, gsy + dy);
      if (t !== unpaintTerrain) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    if (counts.size === 0) return TerrainId.Grass;
    let best: TerrainId = TerrainId.Grass;
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
    terrainId: TerrainId,
    depth: number,
    maxBridge: number,
  ): void {
    this.setGlobalSubgrid(gsx, gsy, terrainId);

    if (maxBridge > 0 && depth < maxBridge) {
      const cardinals: [number, number][] = [
        [gsx - 1, gsy],
        [gsx + 1, gsy],
        [gsx, gsy - 1],
        [gsx, gsy + 1],
      ];
      for (const [nx, ny] of cardinals) {
        const neighbor = this.getGlobalSubgrid(nx, ny);
        if (neighbor === terrainId) continue;
        if (this.adjacency.isValidAdjacency(terrainId, neighbor)) continue;
        const step = this.adjacency.getBridgeStep(terrainId, neighbor);
        if (step !== undefined) {
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

    const terrain = this.getGlobalSubgrid(2 * tx + 1, 2 * ty + 1);
    const tileId = terrainIdToTileId(terrain);

    chunk.setTerrain(lx, ly, tileId);
    chunk.setCollision(lx, ly, getCollisionForTerrain(tileId));
    chunk.setDetail(lx, ly, TileId.Empty);
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
