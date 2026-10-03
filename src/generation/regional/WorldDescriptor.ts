/** Internal geography profile, not the saved-world compatibility version.
 * Output changes bump CURRENT_REGIONAL_VERSION in GenerationDescriptor.ts. */
export interface RegionalWorld {
  readonly seed: number;
  readonly generatorVersion: "regional-v1";
  readonly profile: "temperate-v1";
}

export const GENERATOR_VERSION = "regional-v1";
export const PROFILE = "temperate-v1";
export const MAX_WORLD_COORDINATE = 2 ** 24; // tiles, not gameplay pixels

export function regionalWorld(seed = 42): RegionalWorld {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("Seed must be an integer from 0 to 4294967295.");
  }
  return { seed, generatorVersion: GENERATOR_VERSION, profile: PROFILE };
}

export function validateWorld(world: RegionalWorld): void {
  regionalWorld(world.seed);
  if (world.generatorVersion !== GENERATOR_VERSION || world.profile !== PROFILE) {
    throw new Error("This explorer does not support that generator version or profile.");
  }
}

export { seedFromText } from "../GenerationDescriptor.js";
