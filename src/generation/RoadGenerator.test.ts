import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { RoadType } from "../road/RoadType.js";
import { Chunk } from "../world/Chunk.js";
import {
  DEFAULT_ROAD_PARAMS,
  generateChunkRoads,
  isRoadAtGlobal,
  type RoadGenParams,
} from "./RoadGenerator.js";

const SEED = 42;

describe("isRoadAtGlobal", () => {
  it("is deterministic — same inputs give same output", () => {
    const a = isRoadAtGlobal(100, 200, SEED, DEFAULT_ROAD_PARAMS, 0);
    const b = isRoadAtGlobal(100, 200, SEED, DEFAULT_ROAD_PARAMS, 0);
    expect(a).toBe(b);
  });

  it("returns false for deep water island edge", () => {
    const farAway = 1000;
    expect(isRoadAtGlobal(farAway, farAway, SEED, DEFAULT_ROAD_PARAMS, 12)).toBe(false);
  });

  it("produces roads only at grid-aligned positions", () => {
    const params = DEFAULT_ROAD_PARAMS;
    for (let tx = 0; tx < 200; tx++) {
      for (let ty = 0; ty < 200; ty++) {
        if (isRoadAtGlobal(tx, ty, SEED, params, 0)) {
          const nearHLine =
            ty % params.spacing < params.width || ty % params.spacing >= params.spacing;
          const nearVLine =
            tx % params.spacing < params.width || tx % params.spacing >= params.spacing;
          expect(nearHLine || nearVLine).toBe(true);
        }
      }
    }
  });

  it("produces some roads with default params", () => {
    let foundRoad = false;
    for (let tx = 0; tx < 200; tx++) {
      for (let ty = 0; ty < 200; ty++) {
        if (isRoadAtGlobal(tx, ty, SEED, DEFAULT_ROAD_PARAMS, 0)) {
          foundRoad = true;
          break;
        }
      }
      if (foundRoad) break;
    }
    expect(foundRoad).toBe(true);
  });

  it("produces no roads when density is 0", () => {
    const params: RoadGenParams = { ...DEFAULT_ROAD_PARAMS, density: 0 };
    let foundRoad = false;
    for (let tx = 0; tx < 200; tx++) {
      for (let ty = 0; ty < 200; ty++) {
        if (isRoadAtGlobal(tx, ty, SEED, params, 0)) {
          foundRoad = true;
          break;
        }
      }
      if (foundRoad) break;
    }
    expect(foundRoad).toBe(false);
  });

  it("road width matches params.width", () => {
    const params: RoadGenParams = { ...DEFAULT_ROAD_PARAMS, density: 1, width: 5 };
    // Find an active H segment on dry land. Use mid-segment x to avoid V road overlap.
    let tested = false;
    for (let gy = 0; gy < 20 && !tested; gy++) {
      for (let gx = 0; gx < 20 && !tested; gx++) {
        const midX = gx * params.spacing + (params.spacing >> 1);
        const centerY = gy * params.spacing + (params.width >> 1);
        if (!isRoadAtGlobal(midX, centerY, SEED, params, 0)) continue;
        // Count road tiles across the width at this x position
        let roadCount = 0;
        const roadY = gy * params.spacing;
        for (let ty = roadY - 1; ty <= roadY + params.width; ty++) {
          if (isRoadAtGlobal(midX, ty, SEED, params, 0)) roadCount++;
        }
        expect(roadCount).toBe(params.width);
        tested = true;
      }
    }
    expect(tested).toBe(true);
  });

  it("disables entire segment when water is along its path", () => {
    // Check that H segments are all-or-nothing: sample two points mid-segment
    // (away from V grid lines) and verify they agree.
    const params: RoadGenParams = { ...DEFAULT_ROAD_PARAMS, density: 1 };
    const spacing = params.spacing;
    for (let gy = -2; gy < 5; gy++) {
      for (let gx = -2; gx < 5; gx++) {
        const center = gy * spacing + (params.width >> 1);
        // Two sample points well within the segment, far from V grid lines
        const x1 = gx * spacing + Math.floor(spacing / 3);
        const x2 = gx * spacing + Math.floor((2 * spacing) / 3);
        const road1 = isRoadAtGlobal(x1, center, SEED, params, 0);
        const road2 = isRoadAtGlobal(x2, center, SEED, params, 0);
        expect(road1).toBe(road2);
      }
    }
  });
});

describe("generateChunkRoads", () => {
  it("produces consistent roads across chunk boundaries", () => {
    const chunkA = new Chunk();
    const chunkB = new Chunk();
    generateChunkRoads(chunkA, 0, 0, SEED, DEFAULT_ROAD_PARAMS, 0);
    generateChunkRoads(chunkB, 1, 0, SEED, DEFAULT_ROAD_PARAMS, 0);

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const txBorder = CHUNK_SIZE;
      const expectedRoad = isRoadAtGlobal(txBorder, ly, SEED, DEFAULT_ROAD_PARAMS, 0);
      const actualRoad = chunkB.getRoad(0, ly) !== RoadType.None;
      if (expectedRoad) {
        expect(actualRoad).toBe(true);
      }
    }
  });

  it("places thick sidewalks around roads", () => {
    const params: RoadGenParams = { ...DEFAULT_ROAD_PARAMS, density: 1 };
    let foundSidewalk = false;
    let maxDist = 0;
    for (let cx = 0; cx < 10 && !foundSidewalk; cx++) {
      const chunk = new Chunk();
      generateChunkRoads(chunk, cx, 0, SEED, params, 0);
      const baseTx = cx * CHUNK_SIZE;
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          if (chunk.getRoad(lx, ly) === RoadType.Sidewalk) {
            foundSidewalk = true;
            // Verify it's within sidewalkWidth of an asphalt tile
            const tx = baseTx + lx;
            const ty = ly;
            let minChebyshev = 999;
            for (let dy = -params.sidewalkWidth; dy <= params.sidewalkWidth; dy++) {
              for (let dx = -params.sidewalkWidth; dx <= params.sidewalkWidth; dx++) {
                if (isRoadAtGlobal(tx + dx, ty + dy, SEED, params, 0)) {
                  minChebyshev = Math.min(minChebyshev, Math.max(Math.abs(dx), Math.abs(dy)));
                }
              }
            }
            expect(minChebyshev).toBeLessThanOrEqual(params.sidewalkWidth);
            maxDist = Math.max(maxDist, minChebyshev);
          }
        }
      }
    }
    expect(foundSidewalk).toBe(true);
    // Sidewalk should extend beyond 1 tile with sidewalkWidth=3
    expect(maxDist).toBeGreaterThan(1);
  });

  it("places center lines on road center, not at intersections", () => {
    const params: RoadGenParams = { ...DEFAULT_ROAD_PARAMS, density: 1 };
    const centerOffset = params.width >> 1;
    for (let cx = 0; cx < 10; cx++) {
      const chunk = new Chunk();
      const baseTx = cx * CHUNK_SIZE;
      generateChunkRoads(chunk, cx, 0, SEED, params, 0);
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          if (chunk.getRoad(lx, ly) === RoadType.LineYellow) {
            const tx = baseTx + lx;
            const ty = ly;
            // Must be at center offset of exactly one road direction
            const gyC = Math.round(ty / params.spacing);
            const hRoadY = gyC * params.spacing;
            const onH = ty - hRoadY >= 0 && ty - hRoadY < params.width;
            const isHCenter = ty - hRoadY === centerOffset;

            const gxC = Math.round(tx / params.spacing);
            const vRoadX = gxC * params.spacing;
            const onV = tx - vRoadX >= 0 && tx - vRoadX < params.width;
            const isVCenter = tx - vRoadX === centerOffset;

            // Must be center of exactly one direction
            expect((isHCenter && onH && !onV) || (isVCenter && onV && !onH)).toBe(true);
          }
        }
      }
    }
  });

  it("does not place roads on water with island mode", () => {
    const chunk = new Chunk();
    generateChunkRoads(chunk, 100, 100, SEED, DEFAULT_ROAD_PARAMS, 12);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        expect(chunk.getRoad(lx, ly)).toBe(RoadType.None);
      }
    }
  });

  it("skips sidewalks when sidewalks=false", () => {
    const params: RoadGenParams = { ...DEFAULT_ROAD_PARAMS, density: 1, sidewalks: false };
    const chunk = new Chunk();
    generateChunkRoads(chunk, 0, 0, SEED, params, 0);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        expect(chunk.getRoad(lx, ly)).not.toBe(RoadType.Sidewalk);
      }
    }
  });

  it("skips center lines when centerLines=false", () => {
    const params: RoadGenParams = { ...DEFAULT_ROAD_PARAMS, density: 1, centerLines: false };
    const chunk = new Chunk();
    generateChunkRoads(chunk, 0, 0, SEED, params, 0);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        expect(chunk.getRoad(lx, ly)).not.toBe(RoadType.LineYellow);
      }
    }
  });
});
