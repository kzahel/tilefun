import { required } from "../art/ArtCatalog.js";
import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";

export const PREDATOR_PROFILES = [
  {
    species: "panther",
    label: "Panther",
    revision: "hunt-v1",
    speed: 8,
    chaseSpeed: 48,
    weight: 70,
  },
  { species: "tiger", label: "Tiger", revision: "pilot-v1", speed: 8, chaseSpeed: 40, weight: 180 },
] as const;
export type PredatorSpecies = (typeof PREDATOR_PROFILES)[number]["species"];
export const predatorType = (species: string) => `wildlife-${species}-predator-v1`;
export interface PredatorBehavior {
  home: PositionComponent;
  radius: number;
  state: "rest" | "patrol" | "stalk" | "chase" | "pounce" | "feed" | "scared";
  timer: number;
  elapsed: number;
  cooldown: number;
  randomState: number;
  targetId?: string;
  aim?: PositionComponent;
  alarmFrom?: PositionComponent;
  meals: number;
}
export const PREDATOR_DEFS: Record<string, EntityDef> = Object.fromEntries(
  PREDATOR_PROFILES.map((p) => [
    predatorType(p.species),
    {
      sprite: {
        sheetKey: predatorType(p.species),
        spriteWidth: 96,
        spriteHeight: 96,
        frameCount: 1,
        frameDuration: 100,
        drawOffsetY: 24,
        clips: [
          { name: "idle", start: 0, count: 1, frameDuration: 180, loop: true },
          { name: "walk", start: 1, count: 12, frameDuration: 100, loop: true },
          { name: "feed", start: 13, count: 8, frameDuration: 160, loop: true },
          { name: "display", start: 21, count: 8, frameDuration: 160, loop: false },
          // Grounded brisk walk pending a separately reviewed running source.
          {
            name: "chase",
            start: 1,
            count: 12,
            frameDuration: (100 * p.speed) / p.chaseSpeed,
            loop: true,
          },
        ],
      },
      collider: { offsetX: 0, offsetY: 0, width: 22, height: 12, physicalHeight: 24, solid: true },
      wanderAI: {
        idleMin: 2,
        idleMax: 5,
        walkMin: 1,
        walkMax: 3,
        speed: p.speed,
        directional: true,
      },
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
      radius: 160,
      state: "rest",
      timer: 1.5,
      elapsed: 0,
      cooldown: 0,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ 8137) >>> 0,
      meals: 0,
    },
    weight: p.weight,
    tags: new Set(["npc", "wildlife", "predator"]),
  };
}
export const PREDATOR_FACTORIES = Object.fromEntries(
  PREDATOR_PROFILES.map((p) => [
    predatorType(p.species),
    (wx: number, wy: number) => createPredator(p.species, wx, wy),
  ]),
);
