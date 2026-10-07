import type { RouteWaypoint } from "../entities/Entity.js";
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import { FlatStrategy } from "./FlatStrategy.js";
import { type GenerationDescriptor, requireCurrentGeneration } from "./GenerationDescriptor.js";
import { OnionStrategy } from "./OnionStrategy.js";
import { type LandscapeProfile, landscapeProfile } from "./regional/NaturalLandscape.js";
import { NaturalStrategy } from "./regional/NaturalStrategy.js";
import { regionalWorld } from "./regional/WorldDescriptor.js";
import { generateStructuresForChunk, type StructurePlacement } from "./StructureGenerator.js";
import type { TerrainStrategy } from "./TerrainStrategy.js";

export interface ActorPlacement {
  readonly featureId: string;
  readonly type: string;
  readonly wx: number;
  readonly wy: number;
  readonly route: readonly RouteWaypoint[];
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
export function createGenerator(
  input: GenerationDescriptor,
  landscape?: LandscapeProfile,
): WorldGenerator {
  const descriptor = requireCurrentGeneration(input);
  landscape = landscapeProfile(landscape);
  if (landscape && descriptor.type !== "regional")
    throw new Error("Landscape preview requires regional generation");
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
      const terrain = landscape
        ? new NaturalStrategy(world, landscape)
        : new RailwayStrategy(world);
      return {
        descriptor,
        terrain,
        actors: (cx, cy) => terrain.actors(cx, cy),
        placements: (cx, cy) => ({
          placements: terrain.placements(cx, cy),
          newIntersectionKeys: [],
        }),
      };
    }
  }
}
