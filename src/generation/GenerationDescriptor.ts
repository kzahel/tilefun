import { DEFAULT_ROAD_PARAMS, type RoadGenParams } from "./RoadGenerator.js";

export type GeneratorType = "classic" | "flat" | "regional";
export type GeneratorChoice = "classic" | "island" | "flat" | "regional";
export type GenerationDescriptor =
  | {
      readonly type: "classic";
      readonly version: "classic-v1";
      readonly seed: number;
      readonly preset: "classic" | "island";
      readonly roads: Readonly<RoadGenParams>;
    }
  | {
      readonly type: "flat";
      readonly version: "flat-v1";
      readonly seed: number;
      readonly preset: "grass";
    }
  | {
      readonly type: "regional";
      readonly version:
        | "regional-v1"
        | "regional-v2"
        | "regional-v3"
        | "regional-v4"
        | "regional-v5"
        | "regional-v6"
        | "regional-v7"
        | "regional-v8"
        | "regional-v9";
      readonly seed: number;
      readonly preset: "temperate-v1";
    };

export const REGIONAL_REVISIONS = [
  { version: "regional-v4", label: "Dense districts (v4)" },
  { version: "regional-v5", label: "Connected entrances (v5, review)" },
  { version: "regional-v9", label: "Varied architecture (v9, review)" },
  { version: "regional-v8", label: "Parks & squares (v8, review)" },
  { version: "regional-v7", label: "Parking lots (v7, review)" },
  { version: "regional-v6", label: "Commercial streets (v6, review)" },
  { version: "regional-v3", label: "Settled world (v3, legacy)" },
  { version: "regional-v2", label: "Districts (v2, old)" },
  { version: "regional-v1", label: "Terrain only (v1, old)" },
] as const;

export const GENERATOR_CATALOG = [
  { choice: "regional", label: "Procedural regional", overview: true, settlements: true },
  { choice: "classic", label: "Classic (legacy)", overview: true, settlements: false },
  { choice: "island", label: "Island (legacy)", overview: true, settlements: false },
  { choice: "flat", label: "Flat (legacy)", overview: true, settlements: false },
] as const;

/** Shared text seed convention. Random/omitted seeds are resolved by the authority. */
export function seedFromText(text: string): number {
  const value = text.trim();
  if (/^\d+$/.test(value)) {
    const seed = Number(value);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
      throw new Error("Seed must be an integer from 0 to 4294967295.");
    return seed;
  }
  if (!value) return 42;
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  return hash >>> 0;
}

function validateRoads(value: Readonly<RoadGenParams>): Readonly<RoadGenParams> {
  if (!value || typeof value !== "object") throw new Error("Invalid road settings.");
  for (const key of ["spacing", "width", "sidewalkWidth"] as const) {
    if (
      !Number.isInteger(value[key]) ||
      value[key] < (key === "sidewalkWidth" ? 0 : 1) ||
      value[key] > 4096
    )
      throw new Error(`Invalid road ${key}.`);
  }
  if (
    !Number.isFinite(value.density) ||
    value.density < 0 ||
    value.density > 1 ||
    !Number.isFinite(value.waterPenalty) ||
    value.waterPenalty < 0 ||
    value.waterPenalty > 100 ||
    typeof value.sidewalks !== "boolean" ||
    typeof value.centerLines !== "boolean"
  )
    throw new Error("Invalid road settings.");
  return Object.freeze({
    spacing: value.spacing,
    density: value.density,
    width: value.width,
    sidewalkWidth: value.sidewalkWidth,
    sidewalks: value.sidewalks,
    centerLines: value.centerLines,
    waterPenalty: value.waterPenalty,
  });
}

/** Validate at every external boundary; return an immutable, canonical copy. */
export function resolveDescriptor(value: GenerationDescriptor): GenerationDescriptor {
  if (!value || !Number.isFinite(value.seed)) throw new Error("Invalid generation seed.");
  switch (value.type) {
    case "classic":
      if (value.version !== "classic-v1" || !["classic", "island"].includes(value.preset)) break;
      return Object.freeze({
        type: "classic",
        version: "classic-v1",
        seed: value.seed,
        preset: value.preset,
        roads: validateRoads(value.roads),
      });
    case "flat":
      if (value.version !== "flat-v1" || value.preset !== "grass") break;
      return Object.freeze({ type: "flat", version: "flat-v1", seed: value.seed, preset: "grass" });
    case "regional":
      if (
        !REGIONAL_REVISIONS.some((r) => r.version === value.version) ||
        value.preset !== "temperate-v1" ||
        !Number.isInteger(value.seed) ||
        value.seed < 0 ||
        value.seed > 0xffffffff
      )
        break;
      return Object.freeze({
        type: "regional",
        version: value.version,
        seed: value.seed,
        preset: "temperate-v1",
      });
  }
  throw new Error("Unsupported generator version, type, preset, or seed.");
}

export function createDescriptor(
  choice: GeneratorChoice,
  seed: number,
  roads: RoadGenParams = DEFAULT_ROAD_PARAMS,
): GenerationDescriptor {
  switch (choice) {
    case "classic":
    case "island":
      return resolveDescriptor({
        type: "classic",
        version: "classic-v1",
        seed,
        preset: choice,
        roads,
      });
    case "flat":
      return resolveDescriptor({ type: "flat", version: "flat-v1", seed, preset: "grass" });
    case "regional":
      return resolveDescriptor({
        type: "regional",
        version: "regional-v4",
        seed,
        preset: "temperate-v1",
      });
    default:
      throw new Error("Unsupported generator type.");
  }
}

/** Capture Realm's effective legacy defaults, including its default roads. */
export function descriptorFromMetadata(meta?: {
  generation?: GenerationDescriptor;
  worldType?: string;
  seed?: number;
  roadParams?: Partial<RoadGenParams>;
}): GenerationDescriptor {
  if (meta?.generation) return resolveDescriptor(meta.generation);
  const oldType = meta?.worldType ?? "generated";
  if (!["generated", "classic", "island", "flat", "regional"].includes(oldType))
    throw new Error("Unsupported world type.");
  if (oldType === "regional")
    return resolveDescriptor({
      type: "regional",
      version: "regional-v1",
      seed: meta?.seed ?? 42,
      preset: "temperate-v1",
    });
  return createDescriptor(
    oldType === "generated" ? "classic" : (oldType as GeneratorChoice),
    meta?.seed ?? 42,
    { ...DEFAULT_ROAD_PARAMS, ...meta?.roadParams },
  );
}

export function descriptorChoice(descriptor: GenerationDescriptor): GeneratorChoice {
  return descriptor.type === "classic" ? descriptor.preset : descriptor.type;
}
export function descriptorKey(descriptor: GenerationDescriptor): string {
  return JSON.stringify(resolveDescriptor(descriptor));
}

/** Creation intent allows a blank seed; only the authority resolves randomness. */
export type GenerationRequest =
  | GenerationDescriptor
  | {
      choice: GeneratorChoice;
      seed?: number;
      roads?: RoadGenParams;
      version?: GenerationDescriptor["version"];
    };
export function resolveCreation(
  request: GenerationRequest,
  randomSeed: () => number = () => Math.floor(Math.random() * 2147483647),
): GenerationDescriptor {
  if (!request || typeof request !== "object") throw new Error("Invalid generation request.");
  if ("type" in request) return resolveDescriptor(request);
  const descriptor = createDescriptor(request.choice, request.seed ?? randomSeed(), request.roads);
  return request.version
    ? resolveDescriptor({ ...descriptor, version: request.version } as GenerationDescriptor)
    : descriptor;
}
