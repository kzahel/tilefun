import type { PredatorProfile } from "./Predator.js";

export type FierceSpecies = "t-rex" | "small-dragon" | "dire-wolf" | "griffin" | "giant-spider";
export interface FierceBehaviorProfile {
  kind: "rex" | "dragon" | "wolf" | "griffin" | "spider";
  stride: number;
  chargeStride: number;
  windup: number;
  chargeSeconds: number;
  sense: number;
  displayRadius: number;
}

/** Release each bank only after its source, native playback and gameplay pass. */
export const FIERCE_PROFILES: readonly PredatorProfile[] = [
  {
    species: "t-rex",
    label: "T. rex",
    revision: "fierce-v1",
    speed: 12,
    chaseSpeed: 88,
    weight: 6000,
    size: 160,
    anchorY: 120,
    body: [46, 26, 48],
    fierce: {
      kind: "rex",
      stride: 1.44,
      chargeStride: 4.32,
      windup: 0.7,
      chargeSeconds: 4.5,
      sense: 176,
      displayRadius: 144,
    },
  },
  {
    species: "small-dragon",
    label: "Small dragon",
    revision: "fierce-v1",
    speed: 10,
    chaseSpeed: 58,
    weight: 450,
    size: 128,
    anchorY: 96,
    body: [30, 18, 28],
    fierce: {
      kind: "dragon",
      stride: 1.2,
      chargeStride: 2.1,
      windup: 0.5,
      chargeSeconds: 5,
      sense: 160,
      displayRadius: 112,
    },
  },
];
