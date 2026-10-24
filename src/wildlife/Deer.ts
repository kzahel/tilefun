import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import { finishedBank } from "./FinishedArt.js";
import forestArt from "./forest-art.json" with { type: "json" };

/** Repaired adult doe motion; exact finished pixels remain pending human review. */
export const DEER_TYPE = "wildlife-deer-v1";
export const DEER_IMAGE = finishedBank("deer")?.image ?? forestArt.deer.image;
export const DEER_CLIPS = [
  { name: "idle", start: 0, count: 1, frameDuration: 100, loop: true },
  { name: "walk", start: 1, count: 32, frameDuration: 30, loop: true },
  { name: "action", start: 33, count: 8, frameDuration: 100, loop: false },
  // Provisional brisk walk: reuse the native planted walk, without inventing a gallop.
  { name: "flee", start: 1, count: 32, frameDuration: 15, loop: true },
  ...Object.entries(forestArt.deer.clips).map(([name, clip]) => ({
    ...clip,
    name,
    loop: name === "browse",
  })),
] as const;
export interface DeerBehavior {
  home: PositionComponent;
  radius: number;
  shelter: PositionComponent;
  herdId?: string;
  state: "rest" | "action" | "startle" | "travel" | "flee" | "recover";
  timer: number;
  randomState: number;
  activity: number;
  facing?: Direction;
  target: PositionComponent;
  alarmFrom?: PositionComponent;
  motion?: { elapsed: number; duration: number; escaping: boolean; workPaused?: boolean };
}
export const DEER_DEF = {
  sprite: {
    sheetKey: DEER_TYPE,
    spriteWidth: 48,
    spriteHeight: 48,
    frameCount: 1,
    frameDuration: 100,
    drawOffsetY: 12,
    clips: DEER_CLIPS,
  },
  collider: { offsetX: 0, offsetY: 0, width: 20, height: 10, physicalHeight: 24, solid: true },
  hasVelocity: true,
  weight: 45,
  wanderAI: { idleMin: 2, idleMax: 5, walkMin: 1, walkMax: 3, speed: 18, directional: true },
} satisfies EntityDef;
export function createDeer(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: DEER_TYPE,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...DEER_DEF.sprite,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...DEER_DEF.collider },
    wanderAI: { ...DEER_DEF.wanderAI, state: "idle", timer: 0, dirX: 0, dirY: 0 },
    deer: {
      home: { wx, wy },
      radius: 112,
      shelter: { wx, wy },
      state: "rest",
      timer: 2,
      randomState: ((Math.floor(wx) * 73856093) ^ (Math.floor(wy) * 19349663) ^ 7901) >>> 0,
      activity: 0,
      target: { wx, wy },
    },
    weight: 45,
    tags: new Set(["npc", "wildlife"]),
  };
}
