import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import { RoadType } from "../../road/RoadType.js";
import { CollisionFlag, TileId } from "../../world/TileRegistry.js";
import {
  buildTerrainChunk,
  CHUNK_TOP_VERTICES,
  type FirstPersonChunk,
  groundColor,
  mixColor,
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
    const { tops, walls } = buildTerrainChunk(raised, 0, 0, () => 0);
    // Tops never change size: a chunk's slot in the shared ground mesh (251).
    expect(tops.positions.length).toBe(CHUNK_TOP_VERTICES * 3);
    expect(walls.positions.length / 18).toBe(4);
    const top = 2 * ELEVATION_PX;
    expect(vertices(tops.positions).filter((v) => v[2] === top).length).toBe(6);
    expect(vertices(walls.positions).filter((v) => v[2] === top).length).toBe(4 * 3);
    // Walls are flat-coloured only.
    expect(walls.texels).toBeUndefined();
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

  it("places tile tops in the chunk's ground image and leaves cliff walls flat (250)", () => {
    // One raised tile: its top still wears the image; its four walls do not.
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
    expect(walls.positions.length / 3).toBe(4 * 6);
  });
});
