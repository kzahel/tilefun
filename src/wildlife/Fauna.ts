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
  {
    species: "cat",
    label: "Cat",
    image: "demos/wildlife-v2/cat/draft-v1/sheet.png",
    identity: "cat-draft-v1-pixels-01",
    sha256: "7deb523375c17ace54c264e135a3d92220d85b6d1b764e6f8d397530ebbb0f86",
    size: 48,
    anchor: [24, 34],
    inspection: [32, 37],
    clips: [
      {
        name: "idle",
        start: 0,
        count: 1,
        frameDuration: 160,
        loop: true,
      },
      {
        name: "walk",
        start: 1,
        count: 12,
        frameDuration: 160,
        loop: true,
      },
      {
        name: "action",
        start: 13,
        count: 8,
        frameDuration: 160,
        loop: false,
      },
      {
        name: "flee",
        start: 1,
        count: 12,
        frameDuration: 80,
        loop: true,
      },
    ],
    body: [14, 8, 12],
    speed: 16,
    radius: 80,
    step: 24,
    alarmDistance: 18,
    group: 1,
    cohesion: 0,
    interest: 0.12,
    habitat: "pasture",
  },
  {
    species: "dog",
    label: "Dog",
    image: "demos/wildlife-v2/dog/draft-v1/sheet.png",
    identity: "dog-draft-v1-pixels-02",
    sha256: "936fda286ee1c773aebfb852025f470da606f2f3907990ae2b9fee7307eef0bf",
    size: 64,
    anchor: [32, 44],
    inspection: [-25, 102],
    clips: [
      {
        name: "idle",
        start: 0,
        count: 1,
        frameDuration: 160,
        loop: true,
      },
      {
        name: "walk",
        start: 1,
        count: 16,
        frameDuration: 160,
        loop: true,
      },
      {
        name: "action",
        start: 17,
        count: 8,
        frameDuration: 160,
        loop: false,
      },
      {
        name: "flee",
        start: 1,
        count: 16,
        frameDuration: 80,
        loop: true,
      },
    ],
    body: [22, 10, 18],
    speed: 22,
    radius: 112,
    step: 32,
    alarmDistance: 18,
    group: 1,
    cohesion: 0,
    interest: 0.22,
    habitat: "pasture",
  },
  {
    species: "cow",
    label: "Pasture cow",
    image: "demos/wildlife-v2/cow/draft-v1/sheet.png",
    identity: "cow-draft-v1-drawing-03",
    sha256: "0550c1208a8cabc8028a18b78c2e0757b2fa3ed353d3ba7b364c151f7e20152e",
    size: 64,
    anchor: [32, 46],
    inspection: [31, -98],
    clips: [
      {
        name: "idle",
        start: 0,
        count: 1,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "walk",
        start: 1,
        count: 16,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "action",
        start: 17,
        count: 8,
        frameDuration: 100,
        loop: false,
      },
      {
        name: "flee",
        start: 1,
        count: 16,
        frameDuration: 50,
        loop: true,
      },
    ],
    body: [30, 16, 28],
    speed: 12,
    radius: 128,
    step: 24,
    alarmDistance: 30,
    group: 3,
    cohesion: 0.16,
    interest: 0,
    habitat: "pasture",
  },
  {
    species: "sheep",
    label: "Sheep",
    image: "demos/wildlife-v2/sheep/draft-v1/sheet.png",
    identity: "sheep-draft-v1-drawing-02",
    sha256: "b046916b03b19fbe4d1d5dc253402df7d0fdb5f25997553c70929dbea4ed0223",
    size: 48,
    anchor: [24, 35],
    inspection: [-355, 284],
    clips: [
      {
        name: "idle",
        start: 0,
        count: 1,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "walk",
        start: 1,
        count: 16,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "action",
        start: 17,
        count: 8,
        frameDuration: 100,
        loop: false,
      },
      {
        name: "flee",
        start: 1,
        count: 16,
        frameDuration: 50,
        loop: true,
      },
    ],
    body: [22, 12, 20],
    speed: 16,
    radius: 112,
    step: 26,
    alarmDistance: 28,
    group: 3,
    cohesion: 0.24,
    interest: 0,
    habitat: "pasture",
  },
  {
    species: "horse",
    label: "Horse",
    image: "demos/wildlife-v2/horse/draft-v1/sheet.png",
    identity: "horse-draft-v1-drawing-02",
    sha256: "d90732a9a52e4586c049dbeddac83a19427405dcb8d677f2883d9bdb0037a73a",
    size: 80,
    anchor: [40, 61],
    inspection: [105, 290],
    clips: [
      {
        name: "idle",
        start: 0,
        count: 1,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "walk",
        start: 1,
        count: 16,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "action",
        start: 17,
        count: 8,
        frameDuration: 100,
        loop: false,
      },
      {
        name: "flee",
        start: 1,
        count: 16,
        frameDuration: 50,
        loop: true,
      },
    ],
    body: [34, 14, 36],
    speed: 20,
    radius: 144,
    step: 44,
    alarmDistance: 38,
    group: 2,
    cohesion: 0.14,
    interest: 0,
    habitat: "pasture",
  },
  {
    species: "piglet",
    label: "Pig",
    image: "demos/wildlife-v2/piglet/draft-v1/sheet.png",
    identity: "piglet-draft-v1-drawing-03",
    sha256: "41e27f5048daf8e479044074314fc1af47ceb3228f2f150d9bc4ef7ff75c095a",
    size: 48,
    anchor: [24, 35],
    inspection: [-29, 221],
    clips: [
      {
        name: "idle",
        start: 0,
        count: 1,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "walk",
        start: 1,
        count: 12,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "action",
        start: 13,
        count: 8,
        frameDuration: 100,
        loop: false,
      },
      {
        name: "flee",
        start: 1,
        count: 12,
        frameDuration: 50,
        loop: true,
      },
    ],
    body: [18, 10, 14],
    speed: 14,
    radius: 96,
    step: 24,
    alarmDistance: 24,
    group: 3,
    cohesion: 0.16,
    interest: 0,
    habitat: "pasture",
  },
  {
    species: "goat",
    label: "Goat",
    image: "demos/wildlife-v2/goat/draft-v1/sheet.png",
    identity: "goat-draft-v1-drawing-02",
    sha256: "f8391c93c469fb89eb9acfc9c486184e05abeb072d909325d2cac67ee3770266",
    size: 48,
    anchor: [24, 35],
    inspection: [-30, 297],
    clips: [
      {
        name: "idle",
        start: 0,
        count: 1,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "walk",
        start: 1,
        count: 16,
        frameDuration: 100,
        loop: true,
      },
      {
        name: "action",
        start: 17,
        count: 8,
        frameDuration: 100,
        loop: false,
      },
      {
        name: "flee",
        start: 1,
        count: 16,
        frameDuration: 50,
        loop: true,
      },
    ],
    body: [20, 10, 20],
    speed: 18,
    radius: 112,
    step: 32,
    alarmDistance: 28,
    group: 3,
    cohesion: 0.12,
    interest: 0,
    habitat: "pasture",
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
