import { FlatStrategy } from "./FlatStrategy.js";
import { type GenerationDescriptor, resolveDescriptor } from "./GenerationDescriptor.js";
import { OnionStrategy } from "./OnionStrategy.js";
import { generateStructuresForChunk, type StructurePlacement } from "./StructureGenerator.js";
import type { TerrainStrategy } from "./TerrainStrategy.js";

export interface WorldGenerator {
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
    case "regional":
      throw new Error("Regional tile realization is not installed yet.");
  }
}
