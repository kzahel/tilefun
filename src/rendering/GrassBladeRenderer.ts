import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { chunkToWorld } from "../world/types.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";
import { GrassFrameBuffer } from "./GrassFrameBuffer.js";
import type { GrassItem, SceneItem } from "./SceneItem.js";

export { GrassFrameBuffer } from "./GrassFrameBuffer.js";

/** Shared presentation LOD in logical camera zoom, independent of backend/DPR.
 * At overview scale the base grass terrain carries the surface detail instead.
 */
export function grassOpacity(zoom: number): number {
  const t = Math.max(0, Math.min(1, (zoom - 0.25) / 0.25));
  return t * t * (3 - 2 * t);
}

/**
 * A chunk's blades as parallel arrays, in generation order: numbers in typed
 * arrays, not `{ wx, wy, ... }` records. V8 shares one hidden-class tree between
 * object literals with the same leading keys, so another record with a
 * fractional `wx` deprecated the class of blades already built; the per-frame
 * loop over them was then re-optimized without end while the camera stayed
 * (0.2 → 1.7 ms a frame in about half of sessions, by load order).
 */
interface ChunkBlades {
  readonly count: number;
  readonly wx: Float64Array;
  readonly wy: Float64Array;
  readonly variant: Uint8Array;
  readonly phase: Float64Array;
  /** Sway radians per second: 2π over the blade's period of 1.5–3 seconds. */
  readonly rate: Float64Array;
}

interface ChunkBladeCache {
  cx: number;
  cy: number;
  revision: number;
  blades: ChunkBlades;
}

// Tuning
const MAX_SWAY_RAD = 0.15;
const PUSH_RADIUS = 24;
const PUSH_RADIUS_SQ = PUSH_RADIUS * PUSH_RADIUS;
/** Neighbour grid cell: wider than the push radius, so a pusher is always in
 * a blade's own cell or one beside it. */
const PUSH_CELL = 32;
const MAX_PUSH_RAD = 0.5;
const TWO_PI = Math.PI * 2;

/** Anchor X: always center of 8px cell. Exported for Canvas2D renderer. */
export const GRASS_ANCHOR_X = 4;
/** Anchor Y per variant: [big-A, big-B, small-A, small-B]. Exported for Canvas2D renderer. */
export const GRASS_ANCHOR_Y = [7, 7, 6, 6];

// Derived placements belong to a chunk's lifetime, not to a global coordinate.
// Weak keys release unloaded chunks' blades and isolate worlds/replacements
// whose coordinates and revisions happen to match. No GPU resources live here.
const bladeCache = new WeakMap<Chunk, ChunkBladeCache>();

function spatialHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function buildBladesForChunk(chunk: Chunk, cx: number, cy: number): ChunkBlades {
  const wx: number[] = [];
  const wy: number[] = [];
  const variant: number[] = [];
  const phase: number[] = [];
  const rate: number[] = [];
  const baseTx = cx * CHUNK_SIZE;
  const baseTy = cy * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const idx = ly * CHUNK_SIZE + lx;

      // Full-grass: blendBase is Grass, no blend layers, no road
      if (
        chunk.blendBase[idx] !== TerrainId.Grass ||
        chunk.blendLayers[idx * MAX_BLEND_LAYERS] !== 0 ||
        chunk.getRoad(lx, ly) !== 0 ||
        chunk.getHeight(lx, ly) > 0
      ) {
        continue;
      }

      const tileX = baseTx + lx;
      const tileY = baseTy + ly;
      const h0 = spatialHash(tileX, tileY);

      // ~60% of full-grass tiles get blades
      if (h0 % 10 < 4) continue;

      const count = 1 + ((h0 >> 8) % 3);
      const tileWx = tileX * TILE_SIZE;
      const tileWy = tileY * TILE_SIZE;

      for (let b = 0; b < count; b++) {
        const bh = spatialHash(tileX + b * 7, tileY + b * 13);
        // Position within tile: avoid 2px border (range [2, 13])
        wx.push(tileWx + 2 + (((bh >> 0) & 0xff) % 12));
        wy.push(tileWy + 2 + (((bh >> 8) & 0xff) % 12));
        variant.push(((bh >> 16) & 0xff) % 4);
        phase.push((((bh >> 20) & 0xff) / 255) * TWO_PI);
        rate.push(TWO_PI / (1.5 + (((bh >> 12) & 0xff) / 255) * 1.5));
      }
    }
  }
  return {
    count: wx.length,
    wx: Float64Array.from(wx),
    wy: Float64Array.from(wy),
    variant: Uint8Array.from(variant),
    phase: Float64Array.from(phase),
    rate: Float64Array.from(rate),
  };
}

function getBlades(chunk: Chunk, cx: number, cy: number): ChunkBlades {
  const cached = bladeCache.get(chunk);
  if (cached && cached.revision === chunk.revision && cached.cx === cx && cached.cy === cy) {
    return cached.blades;
  }
  const blades = buildBladesForChunk(chunk, cx, cy);
  bladeCache.set(chunk, { cx, cy, revision: chunk.revision, blades });
  return blades;
}

/** Viewport bounds in world coordinates for culling. */
export interface WorldViewport {
  minWx: number;
  minWy: number;
  maxWx: number;
  maxWy: number;
}

/**
 * Collect grass blade scene items for Y-sorted drawing with entities/props.
 * Returns renderer-agnostic GrassItem[] with pre-computed sway + push angles.
 * A supplied result is appended to. With scratch, records are borrowed until
 * its next collection; without scratch the caller owns the returned records.
 */
export function collectGrassBladeItems(
  world: Pick<World, "getChunkIfLoaded">,
  entityPositions: readonly { position: { wx: number; wy: number } }[],
  visible: ChunkRange,
  viewport: WorldViewport,
  nowSec: number,
  scratch = new GrassFrameBuffer(),
  result: GrassItem[] = [],
): GrassItem[] {
  appendGrassBladeItems(world, entityPositions, visible, viewport, nowSec, scratch, result);
  return result;
}

/**
 * The blades a camera shows, at its zoom's grass opacity, for a renderer that
 * draws them apart from the sorted scene list (the 3D scene's top-down view).
 * Placement, sway and push are the fixed view's: the same blades from the same
 * entities. Empty at overview zooms. Records are borrowed until `scratch` is
 * next used.
 */
export function collectCameraGrass(
  world: Pick<World, "getChunkIfLoaded">,
  entityPositions: readonly { position: { wx: number; wy: number } }[],
  camera: Pick<
    Camera,
    "zoom" | "screenToWorld" | "viewportWidth" | "viewportHeight" | "getVisibleChunkRange"
  >,
  nowSec: number,
  scratch: GrassFrameBuffer,
): GrassItem[] {
  const result: GrassItem[] = [];
  const alpha = grassOpacity(camera.zoom);
  if (alpha <= 0) return result;
  const topLeft = camera.screenToWorld(0, 0),
    bottomRight = camera.screenToWorld(camera.viewportWidth, camera.viewportHeight);
  appendGrassBladeItems(
    world,
    entityPositions,
    camera.getVisibleChunkRange(),
    { minWx: topLeft.wx, minWy: topLeft.wy, maxWx: bottomRight.wx, maxWy: bottomRight.wy },
    nowSec,
    scratch,
    result,
    alpha === 1 ? undefined : alpha,
  );
  return result;
}

/** Append in generation order; pooled records are borrowed until scratch is reused. */
export function appendGrassBladeItems(
  world: Pick<World, "getChunkIfLoaded">,
  entityPositions: readonly { position: { wx: number; wy: number } }[],
  visible: ChunkRange,
  viewport: WorldViewport,
  nowSec: number,
  scratch: GrassFrameBuffer,
  result: SceneItem[],
  alpha?: number,
): void {
  scratch.begin(entityPositions);
  // World-space margin for culling (grass blades are small, 30 world pixels is generous)
  const margin = 30;

  // Only entities near a blade can push it: group those around the view by
  // cell, so each blade reads its neighbours instead of every entity.
  const reach = margin + PUSH_RADIUS;
  scratch.index(
    viewport.minWx - reach,
    viewport.minWy - reach,
    viewport.maxWx + reach,
    viewport.maxWy + reach,
    PUSH_CELL,
  );
  const ewx = scratch.x;
  const ewy = scratch.y;

  for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
    for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
      const chunk = world.getChunkIfLoaded(cx, cy);
      if (!chunk?.autotileComputed) continue;

      const blades = getBlades(chunk, cx, cy);
      if (blades.count === 0) continue;

      // Quick chunk-level world-space cull
      const origin = chunkToWorld(cx, cy);
      const chunkSize = CHUNK_SIZE * TILE_SIZE;
      if (
        origin.wx + chunkSize < viewport.minWx - margin ||
        origin.wy + chunkSize < viewport.minWy - margin ||
        origin.wx > viewport.maxWx + margin ||
        origin.wy > viewport.maxWy + margin
      ) {
        continue;
      }

      const { count, wx: bladeWx, wy: bladeWy, variant, phase, rate } = blades;
      for (let b = 0; b < count; b++) {
        const wx = bladeWx[b] ?? 0;
        const wy = bladeWy[b] ?? 0;
        // Per-blade world-space cull
        if (
          wx < viewport.minWx - margin ||
          wy < viewport.minWy - margin ||
          wx > viewport.maxWx + margin ||
          wy > viewport.maxWy + margin
        ) {
          continue;
        }

        // 1. Idle sway
        const swayAngle = Math.sin(nowSec * (rate[b] ?? 0) + (phase[b] ?? 0)) * MAX_SWAY_RAD;

        // 2. Entity push-away: the closest entity within radius
        let pushAngle = 0;
        const pusher = scratch.closest(wx, wy, 0.1, PUSH_RADIUS_SQ);
        if (pusher >= 0) {
          const dx = wx - (ewx[pusher] ?? 0);
          const dy = wy - (ewy[pusher] ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const strength = 1 - dist / PUSH_RADIUS;
          pushAngle = (dx / dist) * strength * MAX_PUSH_RAD;
        }

        // 3. Blend: push overrides sway but keeps a trace of sway for liveliness
        const angle = pushAngle !== 0 ? pushAngle + swayAngle * 0.3 : swayAngle;

        result.push(scratch.next(wx, wy, variant[b] ?? 0, angle, alpha));
      }
    }
  }

  scratch.end();
}
