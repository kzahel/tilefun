import { CHUNK_SIZE, ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import { RoadType } from "../../road/RoadType.js";
import { CollisionFlag, TileId } from "../../world/TileRegistry.js";

/** The chunk layers the first-person ground reads; `Chunk` satisfies it. */
export interface FirstPersonChunk {
  getHeight(lx: number, ly: number): number;
  getTerrain(lx: number, ly: number): number;
  getRoad(lx: number, ly: number): number;
  getCollision(lx: number, ly: number): number;
}

/** Non-indexed triangles in game axes with linear vertex colors. */
export interface ColoredTriangles {
  positions: Float32Array;
  colors: Float32Array;
  /** Ground only: each vertex's place in its chunk's ground image (x, y in texels
   * from the image's top-left corner), or −1, −1 where no artwork applies. */
  texels?: Float32Array;
}

const TERRAIN_COLORS: Record<number, number> = {
  [TileId.Empty]: 0x2a2f38,
  [TileId.Grass]: 0x6aa84f,
  [TileId.Water]: 0x3f7fcf,
  [TileId.Sand]: 0xd8c690,
  [TileId.Forest]: 0x4f8a3c,
  [TileId.DenseForest]: 0x3d6e30,
  [TileId.DeepWater]: 0x2c5fa8,
  [TileId.DirtPath]: 0xa8835a,
  [TileId.Playground]: 0xc9a46b,
  [TileId.Curb]: 0x9a9a96,
};
const CLIFF_COLOR = 0x7a6a55;

const ASPHALT = 0x4b4e56;

/** Linear blend of two sRGB hex colours (per channel, display space). */
export function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return channel(16) | channel(8) | channel(0);
}

/**
 * Flat colour for one road-grid cell; the frozen ID bands come from RoadType.
 * Painted lines and crossings cover only part of their cell, so they blend toward
 * asphalt to approximate the cell's average rather than fill it with paint.
 */
export function roadColor(road: number): number {
  if (road === RoadType.Sidewalk || road === RoadType.CityPavement) return 0xb0aea6;
  if (road === RoadType.LineWhite) return mixColor(ASPHALT, 0xe6e6de, 0.3);
  if (road === RoadType.LineYellow) return mixColor(ASPHALT, 0xe2c14a, 0.3);
  if (road >= RoadType.CityLineHTop && road <= RoadType.CityLineVRight)
    return mixColor(ASPHALT, 0xe6e6de, 0.3);
  if (road >= RoadType.CityCrossHLeft && road <= RoadType.CityCrossVBottom)
    return mixColor(ASPHALT, 0xe6e6de, 0.55);
  if (road >= RoadType.CommercialStart && road < RoadType.RailHorizontalTop) return 0xb9b3a7;
  if (road >= RoadType.RailHorizontalTop && road < RoadType.ParkingStart) return 0x7a6650;
  if (road >= RoadType.ParkingStart && road < RoadType.RaceCurbRed) return 0x55585f;
  if (road === RoadType.RaceCurbRed) return 0xc0392b;
  if (road === RoadType.RaceCurbWhite || road === RoadType.RaceStart) return 0xe8e8e8;
  return ASPHALT;
}

export function groundColor(terrain: number, road: number, collision: number): number {
  if (road !== RoadType.None) return roadColor(road);
  if (collision & CollisionFlag.Water && terrain !== TileId.DeepWater)
    return TERRAIN_COLORS[TileId.Water] ?? 0;
  return TERRAIN_COLORS[terrain] ?? 0x6aa84f;
}

/** Stable per-tile brightness variation, so flat ground still shows motion. */
export function tileJitter(tx: number, ty: number): number {
  let h = Math.imul(tx, 0x27d4eb2d) ^ Math.imul(ty, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return 0.95 + (((h ^ (h >>> 12)) >>> 0) % 1000) / 10000;
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Growable triangle writer; colours are sRGB hex scaled by a shade, stored linear. */
export class TriangleWriter {
  private positions: number[] = [];
  private colors: number[] = [];
  private texels: number[] = [];
  private textured = false;

  vertex(x: number, y: number, z: number, hex: number, shade: number, u = -1, v = -1): void {
    this.positions.push(x, y, z);
    this.texels.push(u, v);
    this.colors.push(
      srgbToLinear(Math.min(1, (((hex >> 16) & 255) / 255) * shade)),
      srgbToLinear(Math.min(1, (((hex >> 8) & 255) / 255) * shade)),
      srgbToLinear(Math.min(1, ((hex & 255) / 255) * shade)),
    );
  }

  /**
   * Two triangles a→b→c, a→c→d (counter-clockwise seen from the face's front).
   * A flat face of a chunk's ground passes `image`, the world position of its
   * ground image's top-left corner, to wear that image.
   */
  quad(
    corners: readonly (readonly [number, number, number])[],
    hex: number,
    shade: number,
    image?: { readonly x: number; readonly y: number },
  ): void {
    const [a, b, c, d] = corners;
    if (!a || !b || !c || !d) return;
    if (image) this.textured = true;
    for (const p of [a, b, c, a, c, d])
      if (image) this.vertex(p[0], p[1], p[2], hex, shade, p[0] - image.x, p[1] - image.y);
      else this.vertex(p[0], p[1], p[2], hex, shade);
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  finish(): ColoredTriangles {
    const positions = new Float32Array(this.positions),
      colors = new Float32Array(this.colors);
    if (!this.textured) return { positions, colors };
    return { positions, colors, texels: new Float32Array(this.texels) };
  }
}

/** Baked sector-style lighting: south faces (shown by the fixed view) are brightest. */
export const FACE_SHADE = { top: 1, south: 0.84, east: 0.74, west: 0.7, north: 0.6, bottom: 0.5 };

/**
 * One chunk of ground: a quad per tile at its terrain height, plus cliff walls on
 * edges that drop to a lower neighbour. Tile tops carry a flat colour and their
 * place in the chunk's ground image (250); cliff walls are flat-coloured only.
 * `heightAt` answers neighbouring tiles in world coordinates (0 where nothing is
 * loaded).
 */
export function buildTerrainChunk(
  chunk: FirstPersonChunk,
  cx: number,
  cy: number,
  heightAt: (tx: number, ty: number) => number,
): ColoredTriangles {
  const out = new TriangleWriter();
  const baseTx = cx * CHUNK_SIZE,
    baseTy = cy * CHUNK_SIZE;
  const image = { x: baseTx * TILE_SIZE, y: baseTy * TILE_SIZE };
  const localHeight = (lx: number, ly: number) =>
    lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE
      ? chunk.getHeight(lx, ly)
      : heightAt(baseTx + lx, baseTy + ly);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tx = baseTx + lx,
        ty = baseTy + ly;
      const x0 = tx * TILE_SIZE,
        y0 = ty * TILE_SIZE,
        x1 = x0 + TILE_SIZE,
        y1 = y0 + TILE_SIZE;
      const level = chunk.getHeight(lx, ly);
      const z = level * ELEVATION_PX;
      const color = groundColor(
        chunk.getTerrain(lx, ly),
        chunk.getRoad(lx, ly),
        chunk.getCollision(lx, ly),
      );
      out.quad(
        [
          [x0, y0, z],
          [x1, y0, z],
          [x1, y1, z],
          [x0, y1, z],
        ],
        color,
        tileJitter(tx, ty),
        image,
      );
      if (level <= 0) continue;
      const north = localHeight(lx, ly - 1) * ELEVATION_PX;
      const south = localHeight(lx, ly + 1) * ELEVATION_PX;
      const west = localHeight(lx - 1, ly) * ELEVATION_PX;
      const east = localHeight(lx + 1, ly) * ELEVATION_PX;
      if (south < z)
        out.quad(
          [
            [x0, y1, south],
            [x0, y1, z],
            [x1, y1, z],
            [x1, y1, south],
          ],
          CLIFF_COLOR,
          FACE_SHADE.south,
        );
      if (north < z)
        out.quad(
          [
            [x1, y0, north],
            [x1, y0, z],
            [x0, y0, z],
            [x0, y0, north],
          ],
          CLIFF_COLOR,
          FACE_SHADE.north,
        );
      if (east < z)
        out.quad(
          [
            [x1, y1, east],
            [x1, y1, z],
            [x1, y0, z],
            [x1, y0, east],
          ],
          CLIFF_COLOR,
          FACE_SHADE.east,
        );
      if (west < z)
        out.quad(
          [
            [x0, y0, west],
            [x0, y0, z],
            [x0, y1, z],
            [x0, y1, west],
          ],
          CLIFF_COLOR,
          FACE_SHADE.west,
        );
    }
  }
  return out.finish();
}
