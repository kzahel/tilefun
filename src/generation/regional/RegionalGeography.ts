import { fbm } from "../noise.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export const REGION_SIZE = 1024;

export function regionalHash(cx: number, cy: number, seed: number, salt: number): number {
  let h = Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263) ^ seed ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

export function plannedMoisture(world: RegionalWorld, x: number, y: number): number {
  return fbm(x / 1100, y / 1100, world.seed + 2801, 2);
}

/** The regional geographic spine; local realization must consume these constraints. */
export function naturalElevation(world: RegionalWorld, x: number, y: number): number {
  return (
    fbm(x / 4096, y / 4096, world.seed, 3) * 0.72 +
    fbm(x / 640, y / 640, world.seed + 1709, 2) * 0.28
  );
}
