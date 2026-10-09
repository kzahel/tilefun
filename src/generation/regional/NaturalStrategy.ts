import { TerrainId } from "../../autotile/TerrainId.js";
import { RailwayStrategy } from "../../railway/RailwayStrategy.js";
import type { Chunk } from "../../world/Chunk.js";
import { deriveTerrain } from "../deriveTerrain.js";
import { type LandscapeProfile, NaturalLandscape } from "./NaturalLandscape.js";
import { settlementPets } from "./SettlementPets.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Regional natural cover composed with production rail/traffic route sources. */
export class NaturalStrategy extends RailwayStrategy {
  readonly nature: NaturalLandscape;
  constructor(world: RegionalWorld, profile: LandscapeProfile) {
    super(world);
    this.nature = new NaturalLandscape(world, profile);
  }
  override generate(chunk: Chunk, cx: number, cy: number) {
    super.generate(chunk, cx, cy);
    const bounds = { minX: cx * 16 - 1, minY: cy * 16 - 1, maxX: cx * 16 + 17, maxY: cy * 16 + 17 };
    const farms = this.nature.farms.query(bounds);
    let changed = false;
    for (let sy = 0; sy < 33; sy++)
      for (let sx = 0; sx < 33; sx++) {
        const x = cx * 16 + sx / 2,
          y = cy * 16 + sy / 2;
        const farmTerrain = this.nature.farms.terrain(farms, x, y);
        if (farmTerrain !== undefined) {
          chunk.setSubgrid(sx, sy, farmTerrain);
          changed = true;
        }
        const terrain = this.nature.terrain(x, y);
        // Ponds were admitted against all infrastructure before realization.
        if (
          terrain !== TerrainId.Grass &&
          (this.nature.pondAt(cx * 16 + sx / 2, cy * 16 + sy / 2) ||
            this.nature.lagoonAt(cx * 16 + sx / 2, cy * 16 + sy / 2))
        ) {
          chunk.setSubgrid(sx, sy, terrain);
          changed = true;
        }
      }
    if (changed) deriveTerrain(chunk);
  }
  override actors(cx: number, cy: number) {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    const residents = this.nature.farms
      .query(bounds)
      .flatMap((p) => p.actors)
      .filter((a) => Math.floor(a.wx / 256) === cx && Math.floor(a.wy / 256) === cy);
    const pets = this.districts
      .query(bounds)
      .flatMap((p) => settlementPets(p, this.world.seed))
      .filter((a) => Math.floor(a.wx / 256) === cx && Math.floor(a.wy / 256) === cy);
    return [...super.actors(cx, cy), ...residents, ...pets, ...this.nature.wildlife(cx, cy)];
  }
  override placements(cx: number, cy: number) {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    return [
      ...super.placements(cx, cy),
      ...this.nature.farms.placements(this.nature.farms.query(bounds), bounds),
      ...this.nature.placements(cx, cy),
    ];
  }
}
