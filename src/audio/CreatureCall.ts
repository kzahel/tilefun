import type { FierceBehaviorProfile } from "../wildlife/FierceCreatures.js";

/** Short, bounded original synthesized calls; no downloaded animal recordings. */
export function creatureCallSamples(
  kind: FierceBehaviorProfile["kind"],
  sampleRate: number,
): Float32Array {
  const duration = 1.28;
  const output = new Float32Array(Math.ceil(sampleRate * duration));
  let phase = 0,
    seed = 1737;
  for (let i = 0; i < output.length; i++) {
    const t = i / sampleRate,
      fraction = t / duration;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const pitch =
      kind === "rex"
        ? 82 + 22 * Math.sin(Math.PI * fraction)
        : kind === "wolf"
          ? 350 + 210 * Math.sin(Math.PI * fraction * 0.85)
          : kind === "dragon"
            ? 145 + 38 * Math.sin(Math.PI * fraction)
            : kind === "griffin"
              ? 950 - 370 * fraction + 65 * Math.sin(t * 70)
              : 1700 + 200 * Math.sin(t * 50);
    phase += pitch / sampleRate;
    const tone = Math.sin(phase * Math.PI * 2);
    const voice =
      kind === "wolf"
        ? tone * 0.7 + Math.sin(phase * Math.PI * 4) * 0.12
        : kind === "spider"
          ? noise * 0.6 + tone * 0.15
          : tone * 0.45 +
            Math.sin(phase * Math.PI * 6) * 0.14 +
            noise * (kind === "rex" ? 0.27 : 0.15);
    output[i] = Math.sin(Math.PI * Math.min(1, fraction)) ** 0.8 * voice * (1 - 0.15 * fraction);
  }
  return output;
}
