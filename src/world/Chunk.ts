import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { CHUNK_SIZE } from "../config/constants.js";
import type { TileId } from "./TileRegistry.js";

const AREA = CHUNK_SIZE * CHUNK_SIZE;

/**
 * Sub-grid dimensions. For a 16×16 tile chunk, the sub-grid is 33×33.
 * Each tile occupies a 2×2 region centered at (2*tx+1, 2*ty+1).
 * - Centers (odd,odd): tile terrain
 * - Midpoints (mixed parity): edge shared between 2 tiles
 * - Corners (even,even): vertex shared between 4 tiles
 */
const SUBGRID_SIZE = CHUNK_SIZE * 2 + 1;
const SUBGRID_AREA = SUBGRID_SIZE * SUBGRID_SIZE;

function idx(lx: number, ly: number): number {
  return ly * CHUNK_SIZE + lx;
}

function subgridIdx(sx: number, sy: number): number {
  return sy * SUBGRID_SIZE + sx;
}

export class Chunk {
  /** Sub-grid size (33 for 16-tile chunks). */
  static readonly SUBGRID_SIZE = SUBGRID_SIZE;
  /** @deprecated Use SUBGRID_SIZE. Old corner grid was CHUNK_SIZE+1=17. */
  static readonly CORNER_SIZE = CHUNK_SIZE + 1;

  /** Sub-grid terrain values (33×33 = 1089). Stores TerrainId at each point. */
  readonly subgrid: Uint8Array;
  /** Base terrain tile IDs (derived from subgrid). */
  readonly terrain: Uint16Array;
  /** Decoration tile IDs (0 = empty). */
  readonly detail: Uint16Array;
  /**
   * Per-tile blend layer data.
   * Flat array: MAX_BLEND_LAYERS slots per tile, 256 tiles.
   * Each entry: (sheetIndex << 16 | spriteCol << 8 | spriteRow), 0 = empty.
   */
  readonly blendLayers: Uint32Array;
  /** Collision bitfield per tile. */
  readonly collision: Uint8Array;

  /** True when the OffscreenCanvas render cache needs rebuilding. */
  dirty = true;
  /** True after the autotile pass has been computed for this chunk. */
  autotileComputed = false;
  /** Cached pre-rendered chunk canvas (terrain + details at native resolution). */
  renderCache: OffscreenCanvas | null = null;

  /** Road surface per tile (RoadType enum). 0 = no road. */
  readonly roadGrid: Uint8Array;

  /** Elevation height per tile (0–MAX_ELEVATION). */
  readonly heightGrid: Uint8Array;

  /** Computed base TerrainId per tile (from autotile blend algorithm). */
  readonly blendBase: Uint8Array;

  constructor() {
    this.subgrid = new Uint8Array(SUBGRID_AREA);
    this.terrain = new Uint16Array(AREA);
    this.detail = new Uint16Array(AREA);
    this.blendLayers = new Uint32Array(MAX_BLEND_LAYERS * AREA);
    this.collision = new Uint8Array(AREA);
    this.roadGrid = new Uint8Array(AREA);
    this.heightGrid = new Uint8Array(AREA);
    this.blendBase = new Uint8Array(AREA);
  }

  /** Read sub-grid point at (sx, sy) in [0, SUBGRID_SIZE). */
  getSubgrid(sx: number, sy: number): number {
    return this.subgrid[subgridIdx(sx, sy)] ?? 0;
  }

  /** Write sub-grid point at (sx, sy). */
  setSubgrid(sx: number, sy: number, terrain: number): void {
    this.subgrid[subgridIdx(sx, sy)] = terrain;
  }

  /**
   * Read corner value — maps corner coords (cx, cy) in [0, 17)
   * to subgrid even coords (cx*2, cy*2).
   */
  getCorner(cx: number, cy: number): number {
    return this.subgrid[subgridIdx(cx * 2, cy * 2)] ?? 0;
  }

  /**
   * Write corner value — maps corner coords to subgrid even coords.
   */
  setCorner(cx: number, cy: number, terrain: number): void {
    this.subgrid[subgridIdx(cx * 2, cy * 2)] = terrain;
  }

  getTerrain(lx: number, ly: number): TileId {
    return this.terrain[idx(lx, ly)] as TileId;
  }

  setTerrain(lx: number, ly: number, id: TileId): void {
    this.terrain[idx(lx, ly)] = id;
  }

  getCollision(lx: number, ly: number): number {
    return this.collision[idx(lx, ly)] as number;
  }

  setCollision(lx: number, ly: number, flags: number): void {
    this.collision[idx(lx, ly)] = flags;
  }

  getDetail(lx: number, ly: number): TileId {
    return this.detail[idx(lx, ly)] as TileId;
  }

  setDetail(lx: number, ly: number, id: TileId): void {
    this.detail[idx(lx, ly)] = id;
  }

  /** Fill entire chunk with a single terrain tile. */
  fillTerrain(id: TileId): void {
    this.terrain.fill(id);
  }

  /** Fill entire chunk collision with a single flag set. */
  fillCollision(flags: number): void {
    this.collision.fill(flags);
  }

  getRoad(lx: number, ly: number): number {
    return this.roadGrid[idx(lx, ly)] ?? 0;
  }

  setRoad(lx: number, ly: number, roadType: number): void {
    this.roadGrid[idx(lx, ly)] = roadType;
  }

  fillRoad(roadType: number): void {
    this.roadGrid.fill(roadType);
  }

  getHeight(lx: number, ly: number): number {
    return this.heightGrid[idx(lx, ly)] ?? 0;
  }

  setHeight(lx: number, ly: number, h: number): void {
    this.heightGrid[idx(lx, ly)] = h;
  }
}
