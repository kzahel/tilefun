import { FlatStrategy } from "./FlatStrategy.js";
import { type GenerationDescriptor, resolveDescriptor } from "./GenerationDescriptor.js";
import { OnionStrategy } from "./OnionStrategy.js";
import { CityPlacesStrategy } from "./regional/CityPlacesStrategy.js";
import { CommercialDistrictStrategy } from "./regional/CommercialDistrictStrategy.js";
import { DenseDistrictStrategy } from "./regional/DenseDistrictStrategy.js";
import { DistrictStrategy } from "./regional/DistrictStrategy.js";
import { RegionalStrategy } from "./regional/RegionalStrategy.js";
import { SettledStrategy } from "./regional/SettledStrategy.js";
import { regionalWorld } from "./regional/WorldDescriptor.js";
import { generateStructuresForChunk, type StructurePlacement } from "./StructureGenerator.js";
import type { TerrainStrategy } from "./TerrainStrategy.js";

export interface ActorPlacement {
  readonly featureId: string;
  readonly type: string;
  readonly wx: number;
  readonly wy: number;
  readonly route: readonly { wx: number; wy: number }[];
}
export interface WorldGenerator {
  actors?(cx: number, cy: number): ActorPlacement[];
  readonly descriptor: GenerationDescriptor;
  readonly terrain: TerrainStrategy;
  placements(
    cx: number,
    cy: number,
    processed: ReadonlySet<string>,
  ): { placements: StructurePlacement[]; newIntersectionKeys: string[] };
}

/** Shared factory. Hosts do not select terrain or structure implementations. */
export function createGenerator(input: GenerationDescriptor): WorldGenerator {
  const descriptor = resolveDescriptor(input);
  switch (descriptor.type) {
    case "classic": {
      const radius = descriptor.preset === "island" ? 12 : 0;
      return {
        descriptor,
        terrain: new OnionStrategy(descriptor.seed, radius, descriptor.roads),
        placements: (cx, cy, processed) =>
          generateStructuresForChunk(cx, cy, descriptor.seed, descriptor.roads, radius, processed),
      };
    }
    case "flat":
      return {
        descriptor,
        terrain: new FlatStrategy(),
        placements: () => ({ placements: [], newIntersectionKeys: [] }),
      };
    case "regional": {
      const world = regionalWorld(descriptor.seed);
      let terrain: RegionalStrategy;
      switch (descriptor.version) {
        case "regional-v1":
          terrain = new RegionalStrategy(world);
          break;
        case "regional-v2":
          terrain = new DistrictStrategy(world);
          break;
        case "regional-v3":
          terrain = new SettledStrategy(world);
          break;
        case "regional-v4":
          terrain = new DenseDistrictStrategy(world);
          break;
        case "regional-v5":
          terrain = new DenseDistrictStrategy(world, true);
          break;
        case "regional-v7":
          terrain = new CityPlacesStrategy(world, 7);
          break;
        case "regional-v6":
          terrain = new CommercialDistrictStrategy(world);
          break;
      }
      return {
        descriptor,
        terrain,
        ...(terrain instanceof SettledStrategy || terrain instanceof DenseDistrictStrategy
          ? { actors: (cx: number, cy: number) => terrain.actors(cx, cy) }
          : {}),
        placements: (cx, cy) => ({
          placements: terrain instanceof DistrictStrategy ? terrain.placements(cx, cy) : [],
          newIntersectionKeys: [],
        }),
      };
    }
  }
}
