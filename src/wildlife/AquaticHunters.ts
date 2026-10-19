import type { AnimationClip } from "../entities/EntityDefs.js";
import { DISTINCT_FISH_HUNTER_PROFILES } from "./DistinctFish.js";
import { LEGLESS_WATER_HUNTER_PROFILES } from "./LeglessCreatures.js";

export const AQUATIC_HUNTER_SPECIES = [
  "moray-eel",
  "electric-eel",
  "swordfish",
  "anglerfish",
  "shark",
  "hammerhead-shark",
  "orca",
  "dolphin",
  "narwhal",
] as const;
export type AquaticHunterSpecies = (typeof AQUATIC_HUNTER_SPECIES)[number];
const clips: readonly AnimationClip[] = [
  { name: "idle", start: 0, count: 1, frameDuration: 100, loop: true },
  { name: "swim", start: 1, count: 32, frameDuration: 40, loop: true },
  { name: "feed", start: 33, count: 8, frameDuration: 100, loop: true },
  { name: "display", start: 41, count: 8, frameDuration: 100, loop: false },
  { name: "chase", start: 49, count: 32, frameDuration: 20, loop: true },
];
/** Deep-water hunters retain dedicated immutable clips and fixed lagoon slots. */
export const AQUATIC_HUNTER_PROFILES = [
  ...DISTINCT_FISH_HUNTER_PROFILES,
  ...LEGLESS_WATER_HUNTER_PROFILES,
  {
    species: "shark",
    label: "Shark",
    revision: "roster-v2",
    speed: 18,
    chaseSpeed: 40,
    weight: 280,
    size: 96,
    anchorY: 72,
    body: [32, 16, 20],
    art: {
      identity: "shark-roster-v2-pixels-01",
      sha256: "c02561fe0470068cc99c33c51b518e6214f75ad30b4f08a9d14ee4fd78823fae",
      clips: clips,
    },
    expansion: {
      habitat: "deep",
      radius: 176,
      group: 1,
      inspection: [13419, -12921],
    },
  },
  {
    species: "hammerhead-shark",
    label: "Hammerhead shark",
    revision: "roster-v2",
    speed: 16,
    chaseSpeed: 38,
    weight: 180,
    size: 96,
    anchorY: 72,
    body: [34, 16, 20],
    art: {
      identity: "hammerhead-shark-roster-v2-pixels-01",
      sha256: "3ed82957fdcc77380bc20e4ffa20eb740b017c74cca456fc2ff1f5e43d6590ea",
      clips: clips,
    },
    expansion: {
      habitat: "deep",
      radius: 176,
      group: 1,
      inspection: [1446, 4207],
    },
  },
  {
    species: "orca",
    label: "Orca",
    revision: "roster-v2",
    speed: 20,
    chaseSpeed: 48,
    weight: 1200,
    size: 96,
    anchorY: 72,
    body: [42, 22, 24],
    art: {
      identity: "orca-roster-v2-pixels-01",
      sha256: "643a7041db730a1e3d3387ee7bb70b00a02c6c3e3ef5689b37e2adae4269e0fc",
      clips: clips,
    },
    expansion: {
      habitat: "deep",
      radius: 176,
      group: 1,
      inspection: [-656, -2958],
    },
  },
  {
    species: "dolphin",
    label: "Dolphin",
    revision: "roster-v2",
    speed: 20,
    chaseSpeed: 44,
    weight: 180,
    size: 96,
    anchorY: 72,
    body: [30, 16, 18],
    art: {
      identity: "dolphin-roster-v2-pixels-01",
      sha256: "0f83f6e80f2cca1cacf0086ce669065ab918f9c1272b19a397990d8a6c5b26b7",
      clips: clips,
    },
    expansion: {
      habitat: "deep",
      radius: 176,
      group: 1,
      inspection: [18532, -14421],
    },
  },
  {
    species: "narwhal",
    label: "Narwhal",
    revision: "roster-v2",
    speed: 16,
    chaseSpeed: 38,
    weight: 650,
    size: 96,
    anchorY: 72,
    body: [34, 18, 20],
    art: {
      identity: "narwhal-roster-v2-pixels-01",
      sha256: "978f2e21c6f22dd6b59a00b05dcbfce1090b832abf43fa3959903083515a855c",
      clips: clips,
    },
    expansion: {
      habitat: "deep",
      radius: 176,
      group: 1,
      inspection: [2661, 3727],
    },
  },
] as const;
