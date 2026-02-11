import alea from "alea";
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";

export interface NoiseMapOptions {
  frequency: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
}

const DEFAULTS: NoiseMapOptions = {
  frequency: 0.008,
  octaves: 5,
  lacunarity: 2.0,
  persistence: 0.5,
};

/**
 * Multi-octave simplex noise wrapper.
 * sample(x, y) returns a value in [0, 1].
 */
export class NoiseMap {
  private readonly noise: NoiseFunction2D;
  private readonly frequency: number;
  private readonly octaves: number;
  private readonly lacunarity: number;
  private readonly persistence: number;

  constructor(seed: string, options?: Partial<NoiseMapOptions>) {
    const opts = { ...DEFAULTS, ...options };
    this.frequency = opts.frequency;
    this.octaves = opts.octaves;
    this.lacunarity = opts.lacunarity;
    this.persistence = opts.persistence;
    this.noise = createNoise2D(alea(seed));
  }

  /** Sample noise at world-tile coordinates. Returns [0, 1]. */
  sample(x: number, y: number): number {
    let value = 0;
    let amplitude = 1;
    let freq = this.frequency;
    let maxAmplitude = 0;

    for (let i = 0; i < this.octaves; i++) {
      value += this.noise(x * freq, y * freq) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= this.persistence;
      freq *= this.lacunarity;
    }

    // Normalize from [-1,1] range to [0,1]
    return (value / maxAmplitude + 1) / 2;
  }
}
