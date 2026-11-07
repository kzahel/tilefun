import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import { RoadType } from "../../road/RoadType.js";
import { CollisionFlag, TileId } from "../../world/TileRegistry.js";
import {
  buildTerrainChunk,
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
    const { positions, colors } = buildTerrainChunk(
      chunk(() => 0),
      2,
      -1,
      () => 0,
    );
    expect(positions.length).toBe(CHUNK_SIZE * CHUNK_SIZE * 6 * 3);
    expect(colors.length).toBe(positions.length);
    const all = vertices(positions);
    expect(Math.min(...all.map((v) => v[0] ?? 0))).toBe(2 * CHUNK_SIZE * TILE_SIZE);
    expect(Math.max(...all.map((v) => v[1] ?? 0))).toBe(0);
    expect(all.every((v) => v[2] === 0)).toBe(true);
  });

  it("raises tiles and walls only the edges that drop to lower neighbours", () => {
    // One raised tile in the chunk interior: its top plus four cliff faces.
    const raised = chunk((lx, ly) => (lx === 5 && ly === 5 ? 2 : 0));
    const { positions } = buildTerrainChunk(raised, 0, 0, () => 0);
    const quads = positions.length / 18;
    expect(quads).toBe(CHUNK_SIZE * CHUNK_SIZE + 4);
    const top = 2 * ELEVATION_PX;
    expect(vertices(positions).filter((v) => v[2] === top).length).toBe(6 + 4 * 3);
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
    const { positions } = buildTerrainChunk(edge, 0, 0, () => 1);
    expect(positions.length / 18).toBe(CHUNK_SIZE * CHUNK_SIZE);
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
    );
    expect(Math.max(...colors)).toBeLessThanOrEqual(1);
    expect(srgbToLinear(1)).toBeCloseTo(1, 9);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3);
  });
});
