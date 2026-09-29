import { TerrainId } from "../../autotile/TerrainId.js";
import { CHUNK_SIZE } from "../../config/constants.js";
import { RoadType } from "../../road/RoadType.js";
import { Chunk } from "../../world/Chunk.js";
import { deriveTerrain } from "../deriveTerrain.js";
import type { TerrainStrategy } from "../TerrainStrategy.js";
import { type Connection, plannedElevation, QUERY_LIMITS, queryRegion } from "./RegionalPlanner.js";
import { regionalTerrainForElevation } from "./RegionalTerrain.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Distance to orthogonal segments. Shared corridor identity comes from the planner. */
export function corridorDistance(connection: Connection, x: number, y: number): number {
  let distance = Infinity;
  for (let i = 1; i < connection.points.length; i++) {
    const a = connection.points[i - 1];
    const b = connection.points[i];
    if (!a || !b) continue;
    const px = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), x));
    const py = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), y));
    distance = Math.min(distance, Math.hypot(x - px, y - py));
  }
  return distance;
}

/** Independent regional realization; no Onion terrain or legacy road generator. */
export class RegionalStrategy implements TerrainStrategy {
  constructor(readonly world: RegionalWorld) {}

  generate(chunk: Chunk, cx: number, cy: number): void {
    const minX = cx * CHUNK_SIZE;
    const minY = cy * CHUNK_SIZE;
    const plan = queryRegion(this.world, {
      bounds: {
        minX: minX - 16,
        minY: minY - 16,
        maxX: minX + CHUNK_SIZE + 16,
        maxY: minY + CHUNK_SIZE + 16,
      },
      detail: "region",
      sampleStep: 64,
      limits: QUERY_LIMITS,
    });
    const distance = (x: number, y: number) =>
      Math.min(Infinity, ...plan.connections.map((road) => corridorDistance(road, x, y)));
    for (let sy = 0; sy < Chunk.SUBGRID_SIZE; sy++) {
      for (let sx = 0; sx < Chunk.SUBGRID_SIZE; sx++) {
        const x = minX + sx / 2;
        const y = minY + sy / 2;
        chunk.setSubgrid(
          sx,
          sy,
          distance(x, y) <= 6
            ? TerrainId.Grass
            : regionalTerrainForElevation(plannedElevation(this.world, x, y)),
        );
      }
    }
    deriveTerrain(chunk);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const d = distance(minX + lx + 0.5, minY + ly + 0.5);
        if (d <= 4) chunk.setRoad(lx, ly, d <= 0.5 ? RoadType.LineYellow : RoadType.Asphalt);
        else if (d <= 6) chunk.setRoad(lx, ly, RoadType.Sidewalk);
      }
    }
  }
}
