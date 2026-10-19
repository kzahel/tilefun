import type { AnimationClip } from "../entities/EntityDefs.js";

export const AQUATIC_HUNTER_SPECIES = ["shark", "hammerhead-shark", "orca"] as const;
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
] as const;
