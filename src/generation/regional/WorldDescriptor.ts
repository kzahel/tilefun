/** Immutable identity. Changing any generation rule requires a new version. */
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

/** Same seed convention as the game menu, without importing game UI. */
export function seedFromText(text: string): number {
  const value = text.trim();
  if (/^\d+$/.test(value)) return regionalWorld(Number(value)).seed;
  if (!value) return 42;
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  return hash >>> 0;
}
