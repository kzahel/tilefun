import type { CreatureCallKind } from "../audio/CreatureCall.js";
import type { AnimationClip } from "../entities/EntityDefs.js";
import type { FierceBehaviorProfile } from "./FierceCreatures.js";
import { FOREST_HUNTER_PROFILES } from "./ForestSpecialists.js";
import { RAPTOR_PROFILES } from "./Raptors.js";
import { REPTILE_HUNTER_PROFILES } from "./ReptileHunters.js";
import { SMALL_GROUND_HUNTER_PROFILES } from "./SmallGroundHunters.js";
import { SECRETARY_BIRD_PROFILES } from "./TallBirds.js";

export const NATURAL_HUNTER_SPECIES = [
  "tasmanian-devil",
  "crocodile",
  "alligator",
  "komodo-dragon",

  "secretary-bird",
  "owl",
  "eagle",
  "hawk",
  "wolf",
  "coyote",
  "spotted-hyena",
  "jaguar",
  "leopard",
  "cheetah",
  "lynx",
  "bobcat",
  "polar-bear",
  "mongoose",
  "honey-badger",
  "fossa",
  "white-nosed-coati",
] as const;
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
  fierce?: FierceBehaviorProfile;
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
const cheetahClips: readonly AnimationClip[] = clips.map((clip) =>
  clip.name === "chase" ? { ...clip, frameDuration: 15 } : clip,
);
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
  {
    species: "jaguar",
    callKind: "cat",
    label: "Jaguar",
    revision: "roster-v2",
    speed: 16,
    chaseSpeed: 48,
    weight: 90,
    size: 64,
    anchorY: 48,
    body: [24, 14, 27],
    art: {
      identity: "jaguar-roster-v2-pixels-01",
      sha256: "e55e3128ebcf09869507b0c2370d695c1819eda59d922596a029a0189fdc8963",
      clips: clips,
    },
    expansion: {
      habitat: "woodland",
      radius: 176,
      group: 1,
      inspection: [1320, -664],
    },
  },
  {
    species: "leopard",
    callKind: "cat",
    label: "Leopard",
    revision: "roster-v2",
    speed: 16,
    chaseSpeed: 46,
    weight: 60,
    size: 64,
    anchorY: 48,
    body: [20, 12, 26],
    art: {
      identity: "leopard-roster-v2-pixels-01",
      sha256: "161a1294936a47f7d4e0c2623b4cb7c8e6cd83e765fa0ac3694548612aaeb567",
      clips: clips,
    },
    expansion: {
      habitat: "woodland",
      radius: 160,
      group: 1,
      inspection: [164, 800],
    },
  },
  {
    species: "cheetah",
    callKind: "cat",
    label: "Cheetah",
    revision: "roster-v2",
    speed: 20,
    chaseSpeed: 64,
    weight: 50,
    size: 64,
    anchorY: 48,
    body: [18, 10, 29],
    art: {
      identity: "cheetah-roster-v2-pixels-01",
      sha256: "c7beb1dc8ea3b83bcf3e7056adb974fece5d81f0f4044e0cf7fed92dd6b86b65",
      clips: cheetahClips,
    },
    expansion: {
      habitat: "open",
      radius: 192,
      group: 1,
      inspection: [1758, 1434],
    },
  },
  {
    species: "lynx",
    callKind: "cat",
    label: "Eurasian lynx",
    revision: "roster-v2",
    speed: 14,
    chaseSpeed: 42,
    weight: 23,
    size: 64,
    anchorY: 48,
    body: [18, 10, 23],
    art: {
      identity: "lynx-roster-v2-pixels-01",
      sha256: "d41012160813994f285e2a101c27ae019f136562a026536cab68c6d31ae600a7",
      clips: clips,
    },
    expansion: {
      habitat: "woodland",
      radius: 144,
      group: 1,
      inspection: [-487, -669],
    },
  },
  {
    species: "bobcat",
    callKind: "cat",
    label: "Bobcat",
    revision: "roster-v2",
    speed: 14,
    chaseSpeed: 40,
    weight: 12,
    size: 64,
    anchorY: 48,
    body: [16, 9, 21],
    art: {
      identity: "bobcat-roster-v2-pixels-01",
      sha256: "4fe6620c0187671c79ccf4b56d5d28a89dc95cdac3428f6a9481c750136d5355",
      clips: clips,
    },
    expansion: {
      habitat: "woodland",
      radius: 128,
      group: 1,
      inspection: [1383, 1250],
    },
  },
  {
    species: "polar-bear",
    callKind: "bear",
    label: "Polar bear",
    revision: "roster-v2",
    speed: 14,
    chaseSpeed: 42,
    weight: 300,
    size: 64,
    anchorY: 48,
    body: [34, 18, 30],
    art: {
      identity: "polar-bear-roster-v2-pixels-01",
      sha256: "7ccd05f7397e19c7fac25e22a752d5ba44e1a67f1dddf2061674745080eac2de",
      clips,
    },
    expansion: {
      habitat: "open",
      radius: 176,
      group: 1,
      inspection: [-90, 615],
    },
  },
  ...SMALL_GROUND_HUNTER_PROFILES,
  ...RAPTOR_PROFILES,
  ...SECRETARY_BIRD_PROFILES,
  ...REPTILE_HUNTER_PROFILES,
  ...FOREST_HUNTER_PROFILES,
];
