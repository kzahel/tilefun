import type { Prop } from "../entities/Prop.js";
import { deriveTerrain } from "../generation/deriveTerrain.js";
import {
  createDescriptor,
  type GenerationDescriptor,
  isCurrentGeneration,
} from "../generation/GenerationDescriptor.js";
import {
  type ActorPlacement,
  createGenerator,
  type WorldGenerator,
} from "../generation/Generator.js";
import { normalizeGeneration, overviewSteps } from "../generation/Overview.js";
import type { DenseDistrictPlan } from "../generation/regional/DenseDistrictPlanner.js";
import type { Bounds, RegionalRequest } from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import snapshots from "./city-review-snapshots-v1.json" with { type: "json" };

interface ArchivedScene {
  generation: GenerationDescriptor;
  bounds: Bounds;
  arrival: { x: number; y: number };
  props: number[];
  actors: ActorPlacement[];
}
const archive = snapshots as unknown as {
  scenes: Record<string, ArchivedScene>;
  plans: Record<string, DenseDistrictPlan>;
  props: Prop[];
  terrain: Record<
    string,
    Record<string, { subgrid: number[]; roadGrid: number[]; heightGrid: number[] }>
  >;
};
export function archivedCityScene(id: string) {
  const scene = archive.scenes[id];
  if (!scene) throw new Error(`Missing city review snapshot: ${id}`);
  const plan = archive.plans[scene.generation.version];
  if (!plan) throw new Error("Missing archived city plan");
  return structuredClone({
    ...scene,
    plan,
    props: scene.props.map((i) => {
      const prop = archive.props[i];
      if (!prop) throw new Error("Missing archived prop");
      return prop;
    }),
  });
}

function expand(encoded: number[], target: Uint8Array) {
  let offset = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    const count = encoded[i],
      value = encoded[i + 1];
    if (count === undefined || value === undefined || count < 1 || offset + count > target.length)
      throw new Error("Invalid archived terrain");
    target.fill(value, offset, offset + count);
    offset += count;
  }
  if (offset !== target.length) throw new Error("Incomplete archived terrain");
}

/** Finite review data, never a historical world generator or a save migration. */
export function createPreviewGenerator(
  generation: GenerationDescriptor,
  landscape?: import("../generation/regional/NaturalLandscape.js").LandscapeProfile,
): WorldGenerator {
  if (isCurrentGeneration(generation)) return createGenerator(generation, landscape);
  const scene = Object.values(archive.scenes).find(
    (s) => s.generation.version === generation.version && s.generation.seed === generation.seed,
  );
  if (!scene)
    throw new Error("This generator is retired. Choose Current regional to preview this seed.");
  const whole = Object.values(archive.scenes)
    .filter((s) => s.generation.version === generation.version)
    .reduce((a, b) => (b.props.length > a.props.length ? b : a), scene);
  return {
    descriptor: generation,
    terrain: {
      generate(chunk, cx, cy) {
        const data = archive.terrain[generation.version]?.[`${cx},${cy}`];
        if (!data)
          throw new Error(
            "Outside the archived review area. Choose Current regional to explore a world.",
          );
        expand(data.subgrid, chunk.subgrid);
        expand(data.roadGrid, chunk.roadGrid);
        expand(data.heightGrid, chunk.heightGrid);
        deriveTerrain(chunk);
      },
    },
    placements: () => ({
      placements: whole.props.map((i) => {
        const p = archive.props[i];
        if (!p?.proceduralId) throw new Error("Missing archived prop identity");
        return {
          featureId: p.proceduralId,
          propType: p.type,
          wx: p.position.wx,
          wy: p.position.wy,
        };
      }),
      newIntersectionKeys: [],
    }),
    actors: () => structuredClone(whole.actors),
  };
}
export function archivedCityPlan(generation: GenerationDescriptor) {
  createPreviewGenerator(generation); // Validate the finite seed/version identity.
  return structuredClone(archive.plans[generation.version]);
}

export function* previewOverviewSteps(
  input: GenerationDescriptor | RegionalWorld,
  request: RegionalRequest,
  landscape?: import("../generation/regional/NaturalLandscape.js").LandscapeProfile,
) {
  const generation = normalizeGeneration(input);
  if (isCurrentGeneration(generation)) return yield* overviewSteps(generation, request, landscape);
  const plan = archivedCityPlan(generation);
  if (!plan) throw new Error("Missing archived city plan");
  const result = yield* overviewSteps(createDescriptor("regional", generation.seed), request);
  return { ...result, world: generation, districts: [plan], countryside: [] };
}
