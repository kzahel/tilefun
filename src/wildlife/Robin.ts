import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";

/** Existing unapproved draft, unchanged native cells and animation ranges. */
export const ROBIN_TYPE = "wildlife-robin-v1";
export const ROBIN_IMAGE = "demos/wildlife-v2/robin/draft-v2/sheet.png";
export const ROBIN_CLIPS = [
  { name: "idle", start: 0, count: 1, frameDuration: 120, loop: true },
  { name: "hop", start: 1, count: 8, frameDuration: 120, loop: false },
  { name: "flap", start: 9, count: 8, frameDuration: 120, loop: true },
  { name: "action", start: 17, count: 6, frameDuration: 120, loop: false },
] as const;
export interface RobinPerch extends PositionComponent {
  z: number;
}
export interface RobinBehavior {
  home: PositionComponent;
  radius: number;
  state: "rest" | "perch" | "action" | "startle" | "hop" | "flight" | "recover";
  timer: number;
  randomState: number;
  activity: number;
  target: RobinPerch;
  alarmFrom?: PositionComponent;
  motion?: { elapsed: number; duration: number; startZ: number; endZ: number; escaping: boolean };
}
export const ROBIN_DEF = {
  sprite: {
    sheetKey: ROBIN_TYPE,
    spriteWidth: 32,
    spriteHeight: 32,
    frameCount: 1,
    frameDuration: 120,
    drawOffsetY: 7,
    clips: ROBIN_CLIPS,
  },
  collider: { offsetX: 0, offsetY: 0, width: 6, height: 4, physicalHeight: 5, solid: true },
  hasVelocity: true,
  weight: 0.15,
  wanderAI: { idleMin: 2, idleMax: 5, walkMin: 1, walkMax: 3, speed: 30, directional: true },
} satisfies EntityDef;
export function createRobin(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: ROBIN_TYPE,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...ROBIN_DEF.sprite,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...ROBIN_DEF.collider },
    wanderAI: { ...ROBIN_DEF.wanderAI, state: "idle", timer: 0, dirX: 0, dirY: 0 },
    robin: {
      home: { wx, wy },
      radius: 112,
      state: "rest",
      timer: 1.5,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ 7801) >>> 0,
      activity: 0,
      target: { wx, wy, z: 0 },
    },
    weight: 0.15,
    tags: new Set(["npc", "wildlife"]),
  };
}
