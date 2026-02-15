import type { Spritesheet } from "../assets/Spritesheet.js";
import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { chunkToWorld } from "../world/types.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";
import type { Renderable } from "./Renderable.js";

interface BladeInstance {
  wx: number;
  wy: number;
  variant: number;
  phase: number;
  period: number;
}

interface ChunkBladeCache {
  revision: number;
  blades: BladeInstance[];
}

// Tuning
const MAX_SWAY_RAD = 0.15;
const PUSH_RADIUS = 24;
const PUSH_RADIUS_SQ = PUSH_RADIUS * PUSH_RADIUS;
const MAX_PUSH_RAD = 0.5;
const TWO_PI = Math.PI * 2;

// Anchor: X is always center of 8px cell, Y depends on variant
const ANCHOR_X = 4;
const ANCHOR_Y = [7, 7, 6, 6]; // big-A, big-B, small-A, small-B

const bladeCache = new Map<string, ChunkBladeCache>();

function spatialHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function buildBladesForChunk(chunk: Chunk, cx: number, cy: number): BladeInstance[] {
  const blades: BladeInstance[] = [];
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
        const ox = 2 + (((bh >> 0) & 0xff) % 12);
        const oy = 2 + (((bh >> 8) & 0xff) % 12);
        blades.push({
          wx: tileWx + ox,
          wy: tileWy + oy,
          variant: ((bh >> 16) & 0xff) % 4,
          phase: (((bh >> 20) & 0xff) / 255) * TWO_PI,
          period: 1.5 + (((bh >> 12) & 0xff) / 255) * 1.5,
        });
      }
    }
  }
  return blades;
}

function getBlades(chunk: Chunk, cx: number, cy: number): BladeInstance[] {
  const key = `${cx},${cy}`;
  const cached = bladeCache.get(key);
  if (cached && cached.revision === chunk.revision) {
    return cached.blades;
  }
  const blades = buildBladesForChunk(chunk, cx, cy);
  bladeCache.set(key, { revision: chunk.revision, blades });
  return blades;
}

let _debugLogged = false;

/**
 * Collect grass blade renderables for Y-sorted drawing with entities/props.
 * Each blade gets a customDraw callback that handles rotation/sway.
 */
export function collectGrassBladeRenderables(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  world: World,
  entityPositions: readonly { position: { wx: number; wy: number } }[],
  sheet: Spritesheet,
  visible: ChunkRange,
): Renderable[] {
  const nowSec = performance.now() / 1000;
  const scale = camera.scale;
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const result: Renderable[] = [];

  // Debug: log once on first call
  if (!_debugLogged) {
    _debugLogged = true;
    let chunkCount = 0;
    let totalBlades = 0;
    let sampleBlendBase = "";
    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;
        chunkCount++;
        if (!sampleBlendBase) {
          const vals = Array.from(chunk.blendBase.slice(0, 16));
          sampleBlendBase = `chunk(${cx},${cy}) autotile=${chunk.autotileComputed} rev=${chunk.revision} blendBase[0..15]=[${vals.join(",")}]`;
        }
        if (chunk.autotileComputed) {
          totalBlades += getBlades(chunk, cx, cy).length;
        }
      }
    }
    console.warn(
      `[GrassBlades] sheet=${sheet.cols}x${sheet.rows} visible=${visible.minCx},${visible.minCy}..${visible.maxCx},${visible.maxCy} chunks=${chunkCount} blades=${totalBlades}`,
    );
    if (sampleBlendBase) console.warn(`[GrassBlades] ${sampleBlendBase}`);
  }

  // Pre-extract entity positions for fast iteration
  const eCount = entityPositions.length;
  const ewx = new Float64Array(eCount);
  const ewy = new Float64Array(eCount);
  for (let i = 0; i < eCount; i++) {
    const ep = entityPositions[i];
    if (ep) {
      ewx[i] = ep.position.wx;
      ewy[i] = ep.position.wy;
    }
  }

  for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
    for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
      const chunk = world.getChunkIfLoaded(cx, cy);
      if (!chunk?.autotileComputed) continue;

      const blades = getBlades(chunk, cx, cy);
      if (blades.length === 0) continue;

      // Quick chunk-level screen cull
      const origin = chunkToWorld(cx, cy);
      const chunkScreen = camera.worldToScreen(origin.wx, origin.wy);
      const chunkScreenSize = CHUNK_SIZE * TILE_SIZE * scale;
      if (
        chunkScreen.sx + chunkScreenSize < -30 ||
        chunkScreen.sy + chunkScreenSize < -30 ||
        chunkScreen.sx > canvasW + 30 ||
        chunkScreen.sy > canvasH + 30
      ) {
        continue;
      }

      for (const blade of blades) {
        const screen = camera.worldToScreen(blade.wx, blade.wy);

        // Per-blade screen cull
        if (
          screen.sx < -30 ||
          screen.sy < -30 ||
          screen.sx > canvasW + 30 ||
          screen.sy > canvasH + 30
        ) {
          continue;
        }

        // 1. Idle sway
        const swayAngle = Math.sin(nowSec * (TWO_PI / blade.period) + blade.phase) * MAX_SWAY_RAD;

        // 2. Entity push-away: find closest entity within radius
        let pushAngle = 0;
        let closestDistSq = PUSH_RADIUS_SQ;
        for (let e = 0; e < eCount; e++) {
          const dx = blade.wx - (ewx[e] ?? 0);
          const dy = blade.wy - (ewy[e] ?? 0);
          const dSq = dx * dx + dy * dy;
          if (dSq < closestDistSq && dSq > 0.1) {
            closestDistSq = dSq;
            const dist = Math.sqrt(dSq);
            const strength = 1 - dist / PUSH_RADIUS;
            pushAngle = (dx / dist) * strength * MAX_PUSH_RAD;
          }
        }

        // 3. Blend: push overrides sway but keeps a trace of sway for liveliness
        const angle = pushAngle !== 0 ? pushAngle + swayAngle * 0.3 : swayAngle;

        // Capture values for the draw callback
        const sx = screen.sx;
        const sy = screen.sy;
        const variant = blade.variant;
        const ay = ANCHOR_Y[variant] ?? 7;
        const drawAngle = angle;

        result.push({
          position: { wx: blade.wx, wy: blade.wy },
          sprite: null,
          isProp: true,
          noShadow: true,
          customDraw: () => {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(drawAngle);
            sheet.drawTile(ctx, variant, 0, -ANCHOR_X * scale, -ay * scale, scale);
            ctx.restore();
          },
        });
      }
    }
  }

  return result;
}
