/**
 * Simple seeded 2D value noise for terrain generation.
 * No dependencies — just deterministic hash + bilinear interpolation + fBm.
 */

/** Integer hash → pseudo-random float in [0, 1). */
function hash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h = Math.imul(h ^ (h >>> 16), 2654435769);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth interpolation (Hermite / smoothstep). */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise at continuous coordinates. Returns value in [0, 1). */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);

  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);

  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Fractal Brownian motion — layered octaves of value noise.
 * Returns value roughly in [-1, 1] (centered around 0).
 */
export function fbm(
  x: number,
  y: number,
  seed: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise(x * frequency, y * frequency, seed + i * 31);
    max += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  // Normalize to [-1, 1]
  return (value / max) * 2 - 1;
}
