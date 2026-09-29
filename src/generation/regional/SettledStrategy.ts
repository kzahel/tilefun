import { TerrainId } from "../../autotile/TerrainId.js";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { Chunk } from "../../world/Chunk.js";
import { deriveTerrain } from "../deriveTerrain.js";
import type { ActorPlacement } from "../Generator.js";
import { edgeHash } from "../RoadGenerator.js";
import { CountrySource, pathDistance } from "./CountrysidePlanner.js";
import { DistrictStrategy, type FeaturePlacement, streetDistance } from "./DistrictStrategy.js";
import { intersects, QUERY_LIMITS, queryRegion } from "./RegionalPlanner.js";
import { corridorDistance } from "./RegionalStrategy.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Revision 3 adds scenery and actor plans without changing the frozen v2 producer. */
export class SettledStrategy extends DistrictStrategy {
  readonly country: CountrySource;
  constructor(world: RegionalWorld) {
    super(world, true);
    this.country = new CountrySource(world);
  }
  override generate(chunk: Chunk, cx: number, cy: number): void {
    super.generate(chunk, cx, cy);
    const x0 = cx * CHUNK_SIZE,
      y0 = cy * CHUNK_SIZE;
    const plans = this.country.query({ minX: x0 - 2, minY: y0 - 2, maxX: x0 + 18, maxY: y0 + 18 });
    if (!plans.length) return;
    const regional = queryRegion(this.world, {
      bounds: { minX: x0 - 8, minY: y0 - 8, maxX: x0 + 24, maxY: y0 + 24 },
      detail: "region",
      sampleStep: 64,
      limits: QUERY_LIMITS,
    });
    for (let sy = 0; sy < Chunk.SUBGRID_SIZE; sy++)
      for (let sx = 0; sx < Chunk.SUBGRID_SIZE; sx++) {
        const x = x0 + sx / 2,
          y = y0 + sy / 2;
        // A main or district road remains the higher-priority admitted corridor.
        if (regional.connections.some((c) => corridorDistance(c, x, y) <= 6)) continue;
        const district = this.districts.at(x, y);
        if (district?.streets.some((s) => streetDistance(s, x, y) <= s.width / 2 + s.sidewalk))
          continue;
        for (const plan of plans) {
          if (plan.paths.some((path) => pathDistance(path, x, y) <= 1.25)) {
            chunk.setSubgrid(sx, sy, TerrainId.DirtLight);
            break;
          }
          const b = plan.bounds;
          if (
            plan.kind === "farm" &&
            x >= b.minX + 3 &&
            x < b.minX + 18 &&
            y >= b.minY + 12 &&
            y < b.maxY - 4
          )
            chunk.setSubgrid(sx, sy, TerrainId.DirtLight);
        }
      }
    deriveTerrain(chunk);
  }
  override placements(cx: number, cy: number): FeaturePlacement[] {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    const search = {
      minX: bounds.minX - 20,
      minY: bounds.minY - 20,
      maxX: bounds.maxX + 20,
      maxY: bounds.maxY + 20,
    };
    const props = super.placements(cx, cy);
    for (const plan of this.country.query(search))
      for (const p of plan.props) {
        const x = p.wx / TILE_SIZE,
          y = p.wy / TILE_SIZE;
        if (intersects(bounds, { minX: x - 5, minY: y - 12, maxX: x + 5, maxY: y + 1 }))
          props.push(p);
      }
    // Garden districts leave some frontage open and furnish it from existing native props.
    for (const plan of this.districts.query(search))
      if (plan.style === "garden")
        for (const block of plan.blocks) {
          if (block.kind !== "homes") continue;
          const x = (block.bounds.minX + block.bounds.maxX) / 2,
            y = block.bounds.minY + 5;
          if (intersects(bounds, { minX: x - 4, minY: y - 4, maxX: x + 4, maxY: y + 1 }))
            props.push({
              featureId: `${block.id}:garden`,
              propType: "prop-garden-fountain",
              wx: x * 16,
              wy: y * 16,
            });
        }
    return props;
  }
  actors(cx: number, cy: number): ActorPlacement[] {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    const actors: ActorPlacement[] = [];
    for (const plan of this.country.query(bounds)) actors.push(...plan.actors);
    for (const plan of this.districts.query(bounds)) {
      const streets = plan.streets
        .filter((s) => s.kind !== "alley" && s.points[0]?.y === s.points[1]?.y)
        .slice(0, 3);
      for (const [i, s] of streets.entries()) {
        const a = s.points[0],
          b = s.points[1];
        if (!a || !b) continue;
        const wx = ((a.x + b.x) / 2) * 16,
          wy = (a.y + s.width / 2 + 1) * 16;
        actors.push({
          featureId: `${plan.id}:resident:${i}`,
          type: `person${1 + Math.floor(edgeHash(i, a.y, this.world.seed) * 20)}`,
          wx,
          wy,
          route: [
            { wx: (a.x + 12) * 16, wy },
            { wx: (b.x - 12) * 16, wy },
          ],
        });
      }
    }
    return actors.filter((p) => {
      const xs = p.route.map((v) => v.wx / 16),
        ys = p.route.map((v) => v.wy / 16);
      return intersects(bounds, {
        minX: Math.min(...xs) - 1,
        minY: Math.min(...ys) - 1,
        maxX: Math.max(...xs) + 1,
        maxY: Math.max(...ys) + 1,
      });
    });
  }
}
