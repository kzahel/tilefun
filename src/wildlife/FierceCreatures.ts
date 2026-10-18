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
];
