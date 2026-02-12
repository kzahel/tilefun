import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { CHUNK_SIZE } from "../config/constants.js";
import type { TileId } from "./TileRegistry.js";

const AREA = CHUNK_SIZE * CHUNK_SIZE;
/** Corner grid is one larger than tile grid in each dimension. */
const CORNER_SIZE = CHUNK_SIZE + 1;
const CORNER_AREA = CORNER_SIZE * CORNER_SIZE;

function idx(lx: number, ly: number): number {
  return ly * CHUNK_SIZE + lx;
}

function cornerIdx(cx: number, cy: number): number {
  return cy * CORNER_SIZE + cx;
}

export class Chunk {
  static readonly CORNER_SIZE = CORNER_SIZE;

  /** Corner terrain values (17×17 = 289). Stores TerrainId at each vertex. */
  readonly corners: Uint8Array;
  /** Base terrain tile IDs (derived from corners). */
  readonly terrain: Uint16Array;
  /** Decoration tile IDs (0 = empty). */
  readonly detail: Uint16Array;
  /** Per-layer autotile caches. Each is packed (row<<8 | col), 0 = no autotile. */
  readonly autotileLayers: Uint16Array[];
  /**
   * Per-tile blend layer data for graph renderer.
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

  constructor(layerCount: number) {
    this.corners = new Uint8Array(CORNER_AREA);
    this.terrain = new Uint16Array(AREA);
    this.detail = new Uint16Array(AREA);
    this.autotileLayers = [];
    for (let i = 0; i < layerCount; i++) {
      this.autotileLayers.push(new Uint16Array(AREA));
    }
    this.blendLayers = new Uint32Array(MAX_BLEND_LAYERS * AREA);
    this.collision = new Uint8Array(AREA);
  }

  getCorner(cx: number, cy: number): number {
    return this.corners[cornerIdx(cx, cy)] ?? 0;
  }

  setCorner(cx: number, cy: number, terrain: number): void {
    this.corners[cornerIdx(cx, cy)] = terrain;
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
}
