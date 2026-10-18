import type { FierceBehaviorProfile } from "../wildlife/FierceCreatures.js";

export type CreatureCallKind = FierceBehaviorProfile["kind"] | "coyote" | "hyena" | "cat";

/** Short, bounded original synthesized calls; no downloaded animal recordings. */
export function creatureCallSamples(kind: CreatureCallKind, sampleRate: number): Float32Array {
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
      kind === "cat"
        ? 150 + 35 * Math.sin(Math.PI * fraction) + 8 * Math.sin(t * 42)
        : kind === "rex"
          ? 82 + 22 * Math.sin(Math.PI * fraction)
          : kind === "coyote"
            ? 480 + 240 * Math.sin(Math.PI * fraction * 1.3)
            : kind === "hyena"
              ? 260 + 420 * fraction + 70 * Math.sin(t * 28)
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
      kind === "cat"
        ? tone * 0.42 + Math.sin(phase * Math.PI * 4) * 0.18 + noise * 0.22
        : kind === "coyote"
          ? tone * 0.62 + Math.sin(phase * Math.PI * 4) * 0.16 + noise * 0.03
          : kind === "hyena"
            ? (tone * 0.5 + Math.sin(phase * Math.PI * 6) * 0.12 + noise * 0.1) *
              (0.6 + 0.4 * Math.sin(t * 18 * Math.PI) ** 2)
            : kind === "wolf"
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
