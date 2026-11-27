import { PLAYER_FRAME_DURATION } from "../config/constants.js";
import type { WildlifeMeshDefinition } from "./WildlifeMeshCatalog.js";

export const TOWN_PEDESTRIANS = [4, 10, 20] as const;

interface StandingCharacterModel extends WildlifeMeshDefinition {
  /** Distance in world pixels for one complete left/right walk cycle. */
  stride?: number;
}

const clips = [
  { name: "Idle", start: 0, count: 1, frameDuration: PLAYER_FRAME_DURATION, loop: true },
  { name: "Walk", start: 0, count: 4, frameDuration: PLAYER_FRAME_DURATION, loop: true },
];

// Match each sprite's front and profile widths at gameplay scale.
const townTopDownWidths = {
  4: { width: 1, depth: 1.33 },
  10: { width: 1.11, depth: 1.33 },
  20: { width: 1.15, depth: 1.27 },
};

/** Register a standing appearance here for both NPCs and player-selected models. */
export const STANDING_CHARACTER_MODELS: ReadonlyMap<string, StandingCharacterModel> = new Map<
  string,
  StandingCharacterModel
>([
  [
    "player",
    {
      path: "demos/classic-player-3d/v1/classic-player.glb",
      height: 16,
      // Widen the profile and reduce how much ground depth the oblique camera
      // adds to the silhouette's height. Classic 2D measures 10 × 16 from the side.
      topDown: { width: 1.1, depth: 1.35, height: 0.92, worldY: 0.14 },
      forwardYaw: Math.PI,
      animation: { clips },
    },
  ],
  ...TOWN_PEDESTRIANS.map(
    (number) =>
      [
        `person${number}`,
        {
          path: `demos/town-people-3d/v1/person${number}.glb`,
          height: number === 4 ? 24 : 22,
          unitScale: 10,
          topDown: { ...townTopDownWidths[number], height: 0.97, worldY: 0.16 },
          forwardYaw: Math.PI,
          stride: 28,
          animation: { clips },
        },
      ] as const,
  ),
]);
