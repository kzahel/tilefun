import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { AnimationClip, EntityDef } from "../entities/EntityDefs.js";

/** Fixed existing roster order: adding gameplay profiles never remaps habitat owners. */
export const FAUNA_ROSTER = [
  "fox",
  "cat",
  "dog",
  "cow",
  "sheep",
  "horse",
  "piglet",
  "goat",
  "elephant",
  "giraffe",
  "kangaroo",
  "king-cobra",
  "ant",
  "fish",
  "penguin",
  "harbor-seal",
  "manta-ray",
] as const;
export type FaunaSpecies = (typeof FAUNA_ROSTER)[number];
export interface FaunaProfile {
  species: FaunaSpecies;
  label: string;
  image: string;
  identity: string;
  sha256: string;
  size: number;
  inspection: readonly [number, number];
  anchor: readonly [number, number];
  clips: readonly AnimationClip[];
  body: readonly [number, number, number];
  speed: number;
  radius: number;
  step: number;
  alarmDistance: number;
  group: number;
  cohesion: number;
  interest: number;
  habitat: "woodland" | "pasture" | "open" | "pond" | "shore" | "deep";
}
export const FAUNA_PROFILES: readonly FaunaProfile[] = [
  {
    species: "fox",
    label: "Red fox",
    image: "demos/wildlife-v2/fox/pilot-v2/sheet.png",
    identity: "fox-pilot-v2-drawing-03",
    sha256: "4c6c2a09eaaa6f8d08423f7146f8db2b4b3f9bb7f3bc3dc355750017d140c5ab",
    size: 48,
    inspection: [-598, -538],
    anchor: [24, 31],
    clips: [
      { name: "idle", start: 0, count: 1, frameDuration: 125, loop: true },
      { name: "walk", start: 1, count: 8, frameDuration: 125, loop: true },
      { name: "action", start: 9, count: 8, frameDuration: 125, loop: false },
      { name: "flee", start: 1, count: 8, frameDuration: 62.5, loop: true },
    ],
    body: [18, 8, 14],
    speed: 22,
    radius: 112,
    step: 32,
    alarmDistance: 30,
    group: 1,
    cohesion: 0,
    interest: 0.1,
    habitat: "woodland",
  },
];
export const faunaType = (species: FaunaSpecies) => `wildlife-${species}-provisional-v1`;
export const faunaProfile = (type: string | undefined) =>
  FAUNA_PROFILES.find((p) => faunaType(p.species) === type);
export interface FaunaBehavior {
  home: PositionComponent;
  shelter: PositionComponent;
  radius: number;
  groupId?: string;
  state: "rest" | "action" | "startle" | "travel" | "flee" | "recover";
  timer: number;
  randomState: number;
  activity: number;
  target: PositionComponent;
  alarmFrom?: PositionComponent;
  motion?: { elapsed: number; duration: number; escaping: boolean };
}
export function faunaDefinition(p: FaunaProfile) {
  return {
    sprite: {
      sheetKey: faunaType(p.species),
      spriteWidth: p.size,
      spriteHeight: p.size,
      frameCount: 1,
      frameDuration: p.clips[0]?.frameDuration ?? 100,
      drawOffsetY: p.size - p.anchor[1],
      clips: p.clips,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: p.body[0],
      height: p.body[1],
      physicalHeight: p.body[2],
      solid: true,
    },
    hasVelocity: true,
    weight: Math.max(1, p.body[0] * 2),
    wanderAI: { idleMin: 2, idleMax: 6, walkMin: 1, walkMax: 3, speed: p.speed, directional: true },
  } satisfies EntityDef;
}
export const FAUNA_DEFS: Record<string, EntityDef> = Object.fromEntries(
  FAUNA_PROFILES.map((p) => [faunaType(p.species), faunaDefinition(p)]),
);
export function createFauna(species: FaunaSpecies, wx: number, wy: number): Entity {
  const type = faunaType(species),
    p = faunaProfile(type);
  if (!p) throw new Error(`Unavailable fauna profile: ${species}`);
  const d = faunaDefinition(p);
  return {
    id: 0,
    type,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...d.sprite,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...d.collider },
    wanderAI: { ...d.wanderAI, state: "idle", timer: 0, dirX: 0, dirY: 0 },
    fauna: {
      home: { wx, wy },
      shelter: { wx, wy },
      radius: p.radius,
      state: "rest",
      timer: 2,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ 8001) >>> 0,
      activity: 0,
      target: { wx, wy },
    },
    weight: d.weight ?? 1,
    tags: new Set(["npc", "wildlife"]),
  };
}
export const FAUNA_FACTORIES: Record<string, (wx: number, wy: number) => Entity> =
  Object.fromEntries(
    FAUNA_PROFILES.map((p) => [
      faunaType(p.species),
      (wx: number, wy: number) => createFauna(p.species, wx, wy),
    ]),
  );
