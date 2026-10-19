import { required } from "../art/ArtCatalog.js";
import type { CreatureCallKind } from "../audio/CreatureCall.js";
import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { AnimationClip, EntityDef } from "../entities/EntityDefs.js";
import { AQUATIC_HUNTER_PROFILES, type AquaticHunterSpecies } from "./AquaticHunters.js";
import type { FaunaSpecies } from "./Fauna.js";
import {
  FIERCE_PROFILES,
  type FierceBehaviorProfile,
  type FierceSpecies,
} from "./FierceCreatures.js";
import { NATURAL_HUNTER_PROFILES, type NaturalHunterSpecies } from "./NaturalHunters.js";

const ORIGINAL_PREDATORS = [
  {
    species: "panther",
    label: "Panther",
    revision: "hunt-v1",
    speed: 8,
    chaseSpeed: 48,
    weight: 70,
  },
  {
    species: "tiger",
    label: "Wild tiger",
    revision: "pilot-v1",
    speed: 8,
    chaseSpeed: 40,
    weight: 180,
  },
  { species: "lion", label: "Lion", revision: "hunt-v1", speed: 8, chaseSpeed: 44, weight: 190 },
  {
    species: "brown-bear",
    label: "Brown bear",
    revision: "hunt-v1",
    speed: 7,
    chaseSpeed: 42,
    weight: 300,
  },
] as const;
export type PredatorSpecies =
  | (typeof ORIGINAL_PREDATORS)[number]["species"]
  | FierceSpecies
  | NaturalHunterSpecies
  | AquaticHunterSpecies;
export interface PredatorProfile {
  species: PredatorSpecies;
  label: string;
  revision: string;
  speed: number;
  chaseSpeed: number;
  preySpecies?: FaunaSpecies;
  weight: number;
  size: number;
  anchorY: number;
  body: readonly [number, number, number];
  fierce?: FierceBehaviorProfile;
  callKind?: CreatureCallKind;
  art?: { identity: string; sha256: string; clips: readonly AnimationClip[] };
  expansion?: {
    habitat: "woodland" | "open" | "deep";
    radius: number;
    group: number;
    inspection: readonly [number, number];
  };
}
export const PREDATOR_PROFILES: readonly PredatorProfile[] = [
  ...ORIGINAL_PREDATORS.map((p) => ({
    ...p,
    size: 96,
    anchorY: 72,
    body: (p.species === "brown-bear" ? [28, 16, 24] : [22, 12, 24]) as readonly [
      number,
      number,
      number,
    ],
  })),
  ...FIERCE_PROFILES,
  ...NATURAL_HUNTER_PROFILES,
  ...AQUATIC_HUNTER_PROFILES,
];
export const predatorType = (species: string) => `wildlife-${species}-predator-v1`;
const profilesByType = new Map(PREDATOR_PROFILES.map((p) => [predatorType(p.species), p]));
export const predatorProfile = (type: string) => profilesByType.get(type);
export interface PredatorBehavior {
  home: PositionComponent;
  radius: number;
  state:
    | "rest"
    | "patrol"
    | "stalk"
    | "display"
    | "windup"
    | "chase"
    | "pounce"
    | "feed"
    | "scared"
    | "evade"
    | "sleep"
    | "guard"
    | "perch"
    | "flight"
    | "ambush";
  timer: number;
  elapsed: number;
  cooldown: number;
  randomState: number;
  targetId?: string;
  aim?: PositionComponent;
  alarmFrom?: PositionComponent;
  meals: number;
  huntElapsed?: number;
  activity?: number;
  packId?: string;
  packRole?: number;
  displaySerial?: number;
  warningCooldown?: number;
  denId?: string;
  denPlaced?: boolean;
  flight?: {
    elapsed: number;
    duration: number;
    from: PositionComponent;
    to: PositionComponent;
    startZ: number;
    endZ: number;
    previousZ?: number;
    lift: number;
    attack: boolean;
  };
}
export const PREDATOR_DEFS: Record<string, EntityDef> = Object.fromEntries(
  PREDATOR_PROFILES.map((p) => [
    predatorType(p.species),
    {
      sprite: {
        sheetKey: predatorType(p.species),
        spriteWidth: p.size,
        spriteHeight: p.size,
        frameCount: 1,
        frameDuration: 100,
        drawOffsetY: p.anchorY - p.size / 2,
        clips: p.art?.clips ?? [
          { name: "idle", start: 0, count: 1, frameDuration: 180, loop: true },
          { name: "walk", start: 1, count: 12, frameDuration: 100, loop: true },
          { name: "feed", start: 13, count: 8, frameDuration: 160, loop: true },
          { name: "display", start: 21, count: 8, frameDuration: 160, loop: false },
          // Grounded brisk walk pending a separately reviewed running source.
          {
            name: "chase",
            start: p.fierce ? 29 : 1,
            count: p.fierce ? 8 : 12,
            frameDuration: p.fierce
              ? (p.fierce.chargeStride * 10 * 1000) / (p.chaseSpeed * 8)
              : (100 * p.speed) / p.chaseSpeed,
            loop: true,
          },
          ...(p.fierce
            ? [{ name: "sleep", start: 37, count: 4, frameDuration: 280, loop: true }]
            : []),
          ...(p.fierce && ["dragon", "griffin"].includes(p.fierce.kind)
            ? [{ name: "flight", start: 41, count: 8, frameDuration: 100, loop: true }]
            : []),
        ],
      },
      collider: {
        offsetX: 0,
        offsetY: 0,
        width: p.body[0],
        height: p.body[1],
        physicalHeight: p.body[2],
        solid: true,
      },
      wanderAI: {
        idleMin: 2,
        idleMax: 5,
        walkMin: 1,
        walkMax: 3,
        speed: p.speed,
        directional: true,
      },
      ...(p.expansion?.habitat === "deep" ? { aquatic: true, noShadow: true } : {}),
      weight: p.weight,
      hasVelocity: true,
    },
  ]),
);
export function createPredator(species: PredatorSpecies, wx: number, wy: number): Entity {
  const p = PREDATOR_PROFILES.find((p) => p.species === species);
  if (!p) throw new Error(`Unknown predator: ${species}`);
  const type = predatorType(species),
    def = required(PREDATOR_DEFS[type]);
  return {
    id: 0,
    type,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...required(def.sprite),
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...required(def.collider) },
    wanderAI: { ...required(def.wanderAI), state: "idle", timer: 0, dirX: 0, dirY: 0 },
    predator: {
      home: { wx, wy },
      radius: p.expansion?.radius ?? (p.fierce ? 240 : 160),
      state: "rest",
      timer: 1.5,
      elapsed: 0,
      cooldown: 0,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ 8137) >>> 0,
      meals: 0,
    },
    weight: p.weight,
    ...(def.noShadow ? { noShadow: true } : {}),
    tags: new Set(["npc", "wildlife", "predator"]),
  };
}
export const PREDATOR_FACTORIES = Object.fromEntries(
  PREDATOR_PROFILES.map((p) => [
    predatorType(p.species),
    (wx: number, wy: number) => createPredator(p.species, wx, wy),
  ]),
);
