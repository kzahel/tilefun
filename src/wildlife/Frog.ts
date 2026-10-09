import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";

/** Provisional gameplay, using the unchanged existing brown common frog draft. */
export const FROG_TYPE = "wildlife-frog-v1";
export const FROG_IMAGE = "demos/wildlife-v2/frog/draft-v1/sheet.png";
export const FROG_CLIPS = [
  { name: "idle", start: 0, count: 1, frameDuration: 140, loop: true },
  { name: "hop", start: 1, count: 8, frameDuration: 140, loop: false },
  { name: "swim", start: 9, count: 8, frameDuration: 140, loop: true },
  { name: "action", start: 17, count: 6, frameDuration: 140, loop: false },
] as const;
export interface FrogBehavior {
  home: PositionComponent;
  radius: number;
  state: "rest" | "blink" | "startle" | "hop" | "swim" | "recover";
  timer: number;
  randomState: number;
  activity: number;
  target: PositionComponent;
  last: PositionComponent;
  stuck: number;
  alarmFrom?: PositionComponent;
  hop?: { elapsed: number; startZ: number; endZ: number };
}
export const FROG_DEF = {
  sprite: {
    sheetKey: FROG_TYPE,
    spriteWidth: 48,
    spriteHeight: 48,
    frameCount: 1,
    frameDuration: 140,
    drawOffsetY: 14,
    clips: FROG_CLIPS,
  },
  collider: { offsetX: 0, offsetY: 0, width: 6, height: 4, physicalHeight: 4, solid: true },
  hasVelocity: true,
  amphibious: true,
  weight: 0.2,
  wanderAI: { idleMin: 2, idleMax: 5, walkMin: 1, walkMax: 3, speed: 15, directional: true },
} satisfies EntityDef;
export function createFrog(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: FROG_TYPE,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...FROG_DEF.sprite,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...FROG_DEF.collider },
    wanderAI: { ...FROG_DEF.wanderAI, state: "idle", timer: 0, dirX: 0, dirY: 0 },
    frog: {
      home: { wx, wy },
      radius: 112,
      state: "rest",
      timer: 2,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ 7501) >>> 0,
      activity: 0,
      target: { wx, wy },
      last: { wx, wy },
      stuck: 0,
    },
    weight: 0.2,
    tags: new Set(["npc", "wildlife"]),
  };
}
