export type SmallAnimalCallKind = "robin" | "frog" | "duck";

/** Existing provisional calls, now shared by ordinary gameplay and embedded labs. */
export const SMALL_ANIMAL_CALLS = [
  { species: "robin", type: "wildlife-robin-v1", kind: "robin", label: "Chirp", volume: 0.1 },
  { species: "frog", type: "wildlife-frog-v1", kind: "frog", label: "Croak", volume: 0.18 },
  { species: "mallard", type: "wildlife-mallard-v1", kind: "duck", label: "Quack", volume: 0.25 },
] as const;
const byType = new Map<string, (typeof SMALL_ANIMAL_CALLS)[number]>(
  SMALL_ANIMAL_CALLS.map((p) => [p.type, p]),
);
const bySpecies = new Map<string, (typeof SMALL_ANIMAL_CALLS)[number]>(
  SMALL_ANIMAL_CALLS.map((p) => [p.species, p]),
);
export const smallAnimalCallForType = (type: string) => byType.get(type);
export const smallAnimalCallForSpecies = (species: string) => bySpecies.get(species);

/** Sample the old three-note chirp, two-pulse croak and filtered descending quack.
 * Buffers can share voice limits, spatial mixing and cancellation with other calls.
 */
export function smallAnimalCallSamples(kind: SmallAnimalCallKind, rate: number): Float32Array {
  const duration = kind === "robin" ? 0.36 : kind === "frog" ? 0.32 : 0.21;
  const samples = new Float32Array(Math.ceil(rate * duration));
  const w = (2 * Math.PI * 950) / rate,
    alpha = Math.sin(w) / (2 * 1.5),
    a0 = 1 + alpha;
  let phase = 0,
    x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    let pitch: number, tone: number, envelope: number;
    if (kind === "robin") {
      const note = Math.min(2, Math.floor(t / 0.12)),
        local = t - note * 0.12,
        start = [2200, 2900, 2500][note] ?? 2200;
      pitch = start * (1800 / start) ** Math.min(1, local / 0.09);
      phase += pitch / rate;
      tone = Math.sin(phase * Math.PI * 2);
      envelope = Math.min(1, local / 0.015) * 0.01 ** (Math.max(0, local - 0.015) / 0.085);
    } else if (kind === "frog") {
      const local = t < 0.17 ? t : t - 0.17;
      pitch = t < 0.17 ? 160 - 65 * Math.min(1, t / 0.12) : 145 - 55 * Math.min(1, local / 0.13);
      phase += pitch / rate;
      tone = (2 / Math.PI) * Math.asin(Math.sin(phase * Math.PI * 2));
      envelope = Math.min(1, local / 0.015) * 0.006 ** (Math.max(0, local - 0.015) / 0.115);
    } else {
      pitch = 230 * (145 / 230) ** Math.min(1, t / 0.18);
      phase += pitch / rate;
      // Band-limit the saw before the same 950 Hz / Q=1.5 nasal bandpass.
      let saw = 0;
      const harmonics = Math.min(16, Math.floor(rate / (2 * pitch)));
      for (let h = 1; h <= harmonics; h++)
        saw -= ((2 / Math.PI) * Math.sin(phase * Math.PI * 2 * h)) / h;
      tone = (alpha * saw - alpha * x2 + 2 * Math.cos(w) * y1 - (1 - alpha) * y2) / a0;
      x2 = x1;
      x1 = saw;
      y2 = y1;
      y1 = tone;
      envelope = Math.min(1, t / 0.015) * 0.004 ** (Math.max(0, t - 0.015) / 0.185);
    }
    const tail = Math.min(1, (samples.length - 1 - i) / (rate * 0.01));
    samples[i] = tone * envelope * tail;
  }
  return samples;
}
