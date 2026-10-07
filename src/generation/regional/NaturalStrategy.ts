import { TerrainId } from "../../autotile/TerrainId.js";
import { RailwayStrategy } from "../../railway/RailwayStrategy.js";
import type { Chunk } from "../../world/Chunk.js";
import { deriveTerrain } from "../deriveTerrain.js";
import { type LandscapeProfile, NaturalLandscape } from "./NaturalLandscape.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Optional composition for review. Retains production rail/traffic route sources. */
export class NaturalStrategy extends RailwayStrategy {
  readonly nature: NaturalLandscape;
  constructor(world: RegionalWorld, profile: LandscapeProfile) {
    super(world);
    this.nature = new NaturalLandscape(world, profile);
  }
  override generate(chunk: Chunk, cx: number, cy: number) {
    super.generate(chunk, cx, cy);
    let changed = false;
    for (let sy = 0; sy < 33; sy++)
      for (let sx = 0; sx < 33; sx++) {
        const terrain = this.nature.terrain(cx * 16 + sx / 2, cy * 16 + sy / 2);
        // Ponds were admitted against all infrastructure before realization.
        if (terrain !== TerrainId.Grass && this.nature.pondAt(cx * 16 + sx / 2, cy * 16 + sy / 2)) {
          chunk.setSubgrid(sx, sy, terrain);
          changed = true;
        }
      }
    if (changed) deriveTerrain(chunk);
  }
  override placements(cx: number, cy: number) {
    return [...super.placements(cx, cy), ...this.nature.placements(cx, cy)];
  }
}
