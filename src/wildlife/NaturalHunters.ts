import type { CreatureCallKind } from "../audio/CreatureCall.js";
import type { AnimationClip } from "../entities/EntityDefs.js";

export const NATURAL_HUNTER_SPECIES = ["wolf", "coyote", "spotted-hyena"] as const;
export type NaturalHunterSpecies = (typeof NATURAL_HUNTER_SPECIES)[number];

/** Authored ground hunters use their own clips; original and fantasy banks stay immutable. */
export interface NaturalHunterProfile {
  species: NaturalHunterSpecies;
  label: string;
  revision: string;
  speed: number;
  chaseSpeed: number;
  weight: number;
  callKind: CreatureCallKind;
  size: number;
  anchorY: number;
  body: readonly [number, number, number];
  art: { identity: string; sha256: string; clips: readonly AnimationClip[] };
  expansion: {
    habitat: "woodland" | "open";
    radius: number;
    group: number;
    inspection: readonly [number, number];
  };
}
const clips: readonly AnimationClip[] = [
  { name: "idle", start: 0, count: 1, frameDuration: 100, loop: true },
  { name: "walk", start: 1, count: 32, frameDuration: 40, loop: true },
  { name: "feed", start: 33, count: 8, frameDuration: 100, loop: true },
  { name: "display", start: 41, count: 8, frameDuration: 100, loop: false },
  { name: "chase", start: 49, count: 32, frameDuration: 20, loop: true },
];
export const NATURAL_HUNTER_PROFILES: readonly NaturalHunterProfile[] = [
  {
    species: "wolf",
    callKind: "wolf",
    label: "Grey wolf",
    revision: "roster-v2",
    speed: 16,
    chaseSpeed: 40,
    weight: 45,
    size: 64,
    anchorY: 48,
    body: [20, 10, 26],
    art: {
      identity: "wolf-roster-v2-pixels-01",
      sha256: "88eea535d49696ced338823c40bf31c7d010454785909a49f9e57e6565fce341",
      clips,
    },
    expansion: { habitat: "woodland", radius: 160, group: 1, inspection: [-1191, -26] },
  },
  {
    species: "coyote",
    callKind: "coyote",
    label: "Coyote",
    revision: "roster-v2",
    speed: 14,
    chaseSpeed: 36,
    weight: 18,
    size: 64,
    anchorY: 48,
    body: [16, 9, 24],
    art: {
      identity: "coyote-roster-v2-pixels-01",
      sha256: "e179275885056a5fb04548ec517adcb663cadd7d6ac183d28e57432677b3da71",
      clips,
    },
    expansion: { habitat: "open", radius: 144, group: 1, inspection: [1881, -1573] },
  },
  {
    species: "spotted-hyena",
    callKind: "hyena",
    label: "Spotted hyena",
    revision: "roster-v2",
    speed: 14,
    chaseSpeed: 42,
    weight: 60,
    size: 64,
    anchorY: 48,
    body: [22, 12, 27],
    art: {
      identity: "spotted-hyena-roster-v2-pixels-01",
      sha256: "2bb072d95d260481f413e7e4dd0269fa41d2d91a1ae39c2787cd7bc319bdb3e2",
      clips,
    },
    expansion: { habitat: "open", radius: 160, group: 1, inspection: [-356, 481] },
  },
];
