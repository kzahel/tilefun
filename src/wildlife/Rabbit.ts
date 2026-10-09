import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";

/** Provisional gameplay reuses the unchanged, unapproved rabbit pilot sheet. */
export const RABBIT_TYPE = "wildlife-rabbit-v1";
export const RABBIT_IMAGE = "demos/wildlife-v2/rabbit/pilot-v1/sheet.png";
export const RABBIT_CLIPS = [
  { name: "idle", start: 0, count: 1, frameDuration: 125, loop: true },
  { name: "hop", start: 1, count: 8, frameDuration: 125, loop: false },
  { name: "action", start: 9, count: 6, frameDuration: 125, loop: false },
] as const;
export interface RabbitBehavior {
  home: PositionComponent;
  radius: number;
  /** Open ground near retained woodland cover; manual rabbits use their home. */
  shelter: PositionComponent;
  state: "rest" | "action" | "startle" | "hop" | "recover";
  timer: number;
  randomState: number;
  activity: number;
  target: PositionComponent;
  alarmFrom?: PositionComponent;
  hop?: { elapsed: number; startZ: number; endZ: number; escaping: boolean };
}
export const RABBIT_DEF = {
  sprite: {
    sheetKey: RABBIT_TYPE,
    spriteWidth: 32,
    spriteHeight: 32,
    frameCount: 1,
    frameDuration: 125,
    drawOffsetY: 8,
    clips: RABBIT_CLIPS,
  },
  collider: { offsetX: 0, offsetY: 0, width: 8, height: 5, physicalHeight: 8, solid: true },
  hasVelocity: true,
  weight: 0.7,
  wanderAI: { idleMin: 2, idleMax: 5, walkMin: 1, walkMax: 3, speed: 30, directional: true },
} satisfies EntityDef;
export function createRabbit(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: RABBIT_TYPE,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...RABBIT_DEF.sprite,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...RABBIT_DEF.collider },
    wanderAI: { ...RABBIT_DEF.wanderAI, state: "idle", timer: 0, dirX: 0, dirY: 0 },
    rabbit: {
      home: { wx, wy },
      radius: 72,
      shelter: { wx, wy },
      state: "rest",
      timer: 2,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ 7601) >>> 0,
      activity: 0,
      target: { wx, wy },
    },
    weight: 0.7,
    tags: new Set(["npc", "wildlife"]),
  };
}
