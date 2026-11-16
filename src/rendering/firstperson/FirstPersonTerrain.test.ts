import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import { RoadType } from "../../road/RoadType.js";
import { CollisionFlag, TileId } from "../../world/TileRegistry.js";
import {
  buildTerrainChunk,
  CHUNK_TOP_VERTICES,
  CLIFF_ART_SHADE,
  type FirstPersonChunk,
  groundColor,
  mixColor,
  RAISED_ART_SHADE,
  roadColor,
  srgbToLinear,
} from "./FirstPersonTerrain.js";

function chunk(height: (lx: number, ly: number) => number, road = 0): FirstPersonChunk {
  return {
    getHeight: height,
    getTerrain: () => TileId.Grass,
    getRoad: () => road,
    getCollision: () => 0,
  };
}

const vertices = (positions: Float32Array) =>
  Array.from({ length: positions.length / 3 }, (_, i) => [
    positions[i * 3] ?? NaN,
    positions[i * 3 + 1] ?? NaN,
    positions[i * 3 + 2] ?? NaN,
  ]);

describe("first-person terrain chunks", () => {
  it("emits one flat quad per tile in world pixels", () => {
    const { tops, walls } = buildTerrainChunk(
      chunk(() => 0),
      2,
      -1,
      () => 0,
    );
    const { positions, colors } = tops;
    expect(walls.positions.length).toBe(0);
    expect(CHUNK_TOP_VERTICES).toBe(CHUNK_SIZE * CHUNK_SIZE * 6);
    expect(positions.length).toBe(CHUNK_TOP_VERTICES * 3);
    expect(colors.length).toBe(positions.length);
    const all = vertices(positions);
    expect(Math.min(...all.map((v) => v[0] ?? 0))).toBe(2 * CHUNK_SIZE * TILE_SIZE);
    expect(Math.max(...all.map((v) => v[1] ?? 0))).toBe(0);
    expect(all.every((v) => v[2] === 0)).toBe(true);
  });

  it("raises tiles and walls only the edges that drop to lower neighbours", () => {
    // One raised tile in the chunk interior: its top plus four cliff faces.
    const raised = chunk((lx, ly) => (lx === 5 && ly === 5 ? 2 : 0));
    const { tops, cliffs, walls } = buildTerrainChunk(raised, 0, 0, () => 0);
    // Tops never change size: a chunk's slot in the shared ground mesh (251).
    expect(tops.positions.length).toBe(CHUNK_TOP_VERTICES * 3);
    expect(cliffs.positions.length / 18).toBe(1);
    expect(walls.positions.length / 18).toBe(3);
    const top = 2 * ELEVATION_PX;
    expect(vertices(tops.positions).filter((v) => v[2] === top).length).toBe(6);
    expect(vertices(walls.positions).filter((v) => v[2] === top).length).toBe(3 * 3);
    // North, east and west walls are flat-coloured only.
    expect(walls.texels).toBeUndefined();
    // The raised top is darkened as the fixed view darkens it; the rest are not.
    const shades = tops.artShades ?? [];
    expect([...shades].filter((s) => s === Math.fround(RAISED_ART_SHADE))).toHaveLength(6);
    expect([...shades].filter((s) => s === 1)).toHaveLength(CHUNK_TOP_VERTICES - 6);
    // The south face wears the tile's bottom row across its width, darker still.
    const y1 = 6 * TILE_SIZE;
    const texels = cliffs.texels ?? [];
    for (let i = 0; i < 6; i++) {
      expect(texels[i * 2]).toBe(cliffs.positions[i * 3]);
      expect(texels[i * 2 + 1]).toBe(y1 - 0.5);
    }
    expect([...(cliffs.artShades ?? [])].every((s) => s === Math.fround(CLIFF_ART_SHADE))).toBe(
      true,
    );
    expect(vertices(cliffs.positions).every((v) => v[1] === y1)).toBe(true);
  });

  it("asks the world for heights across chunk edges", () => {
    const edge = chunk(() => 1);
    const asked: string[] = [];
    buildTerrainChunk(edge, 0, 0, (tx, ty) => {
      asked.push(`${tx},${ty}`);
      return 1;
    });
    expect(asked).toContain("-1,0");
    expect(asked).toContain(`${CHUNK_SIZE},0`);
    // Equal-height neighbours add no cliffs.
    expect(buildTerrainChunk(edge, 0, 0, () => 1).walls.positions.length).toBe(0);
    // A lower neighbour across the edge gets a wall along the whole side.
    const dropped = buildTerrainChunk(edge, 0, 0, (tx) => (tx < 0 ? 0 : 1));
    expect(dropped.walls.positions.length / 18).toBe(CHUNK_SIZE);
    const south = buildTerrainChunk(edge, 0, 0, (_tx, ty) => (ty >= CHUNK_SIZE ? 0 : 1));
    expect(south.cliffs.positions.length / 18).toBe(CHUNK_SIZE);
    expect(south.walls.positions.length).toBe(0);
  });

  it("colours roads, water and terrain from their semantic layers", () => {
    expect(groundColor(TileId.Grass, RoadType.Asphalt, 0)).toBe(roadColor(RoadType.Asphalt));
    expect(roadColor(RoadType.ParkingStart + 3)).toBe(roadColor(RoadType.ParkingStart));
    // Partial paint blends toward asphalt instead of filling the cell.
    expect(roadColor(RoadType.LineYellow)).toBe(
      mixColor(roadColor(RoadType.Asphalt), 0xe2c14a, 0.3),
    );
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(groundColor(TileId.Grass, 0, CollisionFlag.Water)).toBe(groundColor(TileId.Water, 0, 0));
    expect(groundColor(TileId.Sand, 0, 0)).not.toBe(groundColor(TileId.Grass, 0, 0));
    const { colors } = buildTerrainChunk(
      chunk(() => 0),
      0,
      0,
      () => 0,
    ).tops;
    expect(Math.max(...colors)).toBeLessThanOrEqual(1);
    expect(srgbToLinear(1)).toBeCloseTo(1, 9);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3);
  });

  it("places tile tops in the chunk's ground image and leaves the unseen cliff walls flat (250)", () => {
    // One raised tile: its top still wears the image; its north, east and west walls do not.
    const { tops, walls } = buildTerrainChunk(
      chunk((lx, ly) => (lx === 3 && ly === 5 ? 2 : 0)),
      2,
      -1,
      () => 0,
    );
    const { positions, texels } = tops;
    if (!texels) throw Error("ground without texels");
    expect(texels.length).toBe((positions.length / 3) * 2);
    const size = CHUNK_SIZE * TILE_SIZE;
    vertices(positions).forEach(([x, y, z], i) => {
      // Image texels are world pixels from the chunk's north-west corner, at any height.
      expect([texels[i * 2], texels[i * 2 + 1]]).toEqual([
        (x ?? NaN) - 2 * size,
        (y ?? NaN) + size,
      ]);
      expect(z === 0 || z === 2 * ELEVATION_PX).toBe(true);
    });
    expect(Math.max(...texels)).toBe(size);
    expect(walls.positions.length / 3).toBe(3 * 6);
  });
});
