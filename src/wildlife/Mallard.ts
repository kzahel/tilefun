import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";

/** Provisional gameplay use of unchanged drawing-02; not a human art approval. */
export const MALLARD_TYPE = "wildlife-mallard-v1";
export const MALLARD_IMAGE = "demos/wildlife-v2/mallard-duck/draft-v1/sheet.png";
export const MALLARD_CLIPS = [
  { name: "idle", start: 0, count: 1, frameDuration: 160, loop: true },
  { name: "waddle", start: 1, count: 8, frameDuration: 160, loop: true },
  { name: "swim", start: 9, count: 8, frameDuration: 160, loop: true },
  { name: "flap", start: 17, count: 8, frameDuration: 160, loop: false },
  { name: "action", start: 25, count: 6, frameDuration: 160, loop: false },
  { name: "flight", start: 17, count: 8, frameDuration: 100, loop: true },
] as const;
export interface MallardBehavior {
  home: { wx: number; wy: number };
  radius: number;
  state: "rest" | "travel" | "quack" | "flap" | "startle" | "flight" | "recover";
  timer: number;
  randomState: number;
  target: { wx: number; wy: number };
  last: { wx: number; wy: number };
  stuck: number;
  activity: number;
  alarmFrom?: { wx: number; wy: number };
  flight?: { elapsed: number; duration: number; startZ: number; endZ: number };
}
export const MALLARD_DEF = {
  sprite: {
    sheetKey: MALLARD_TYPE,
    spriteWidth: 48,
    spriteHeight: 48,
    frameCount: 1,
    frameDuration: 160,
    drawOffsetY: 14,
    clips: MALLARD_CLIPS,
  },
  collider: { offsetX: 0, offsetY: 0, width: 10, height: 6, physicalHeight: 9, solid: true },
  hasVelocity: true,
  amphibious: true,
  weight: 1,
  wanderAI: { idleMin: 2, idleMax: 5, walkMin: 2, walkMax: 5, speed: 13, directional: true },
} satisfies EntityDef;
export function createMallard(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: MALLARD_TYPE,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...MALLARD_DEF.sprite,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...MALLARD_DEF.collider },
    wanderAI: { ...MALLARD_DEF.wanderAI, state: "idle", timer: 0, dirX: 0, dirY: 0 },
    mallard: {
      home: { wx, wy },
      radius: 160,
      state: "rest",
      timer: 2,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663)) >>> 0,
      target: { wx, wy },
      last: { wx, wy },
      stuck: 0,
      activity: 0,
    },
    weight: 1,
    tags: new Set(["npc", "wildlife"]),
  };
}
