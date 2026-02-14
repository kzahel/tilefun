import { Direction, type Entity } from "./Entity.js";

const PERSON_SPEED = 20;
const PERSON_FRAME_DURATION = 140;
const PERSON_FRAME_COUNT = 6;

function createPerson(n: number, wx: number, wy: number): Entity {
  return {
    id: 0,
    type: `person${n}`,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: `person${n}`,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: PERSON_FRAME_DURATION,
      frameCount: PERSON_FRAME_COUNT,
      direction: Direction.Down,
      moving: false,
      spriteWidth: 16,
      spriteHeight: 32,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 6,
    },
    wanderAI: {
      state: "idle",
      timer: 2.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.5,
      idleMax: 5.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: PERSON_SPEED,
      directional: true,
    },
    tags: new Set(["befriendable", "npc"]),
  };
}

export const createPerson1 = (wx: number, wy: number) => createPerson(1, wx, wy);
export const createPerson2 = (wx: number, wy: number) => createPerson(2, wx, wy);
export const createPerson3 = (wx: number, wy: number) => createPerson(3, wx, wy);
export const createPerson4 = (wx: number, wy: number) => createPerson(4, wx, wy);
export const createPerson5 = (wx: number, wy: number) => createPerson(5, wx, wy);
export const createPerson6 = (wx: number, wy: number) => createPerson(6, wx, wy);
export const createPerson7 = (wx: number, wy: number) => createPerson(7, wx, wy);
export const createPerson8 = (wx: number, wy: number) => createPerson(8, wx, wy);
export const createPerson9 = (wx: number, wy: number) => createPerson(9, wx, wy);
export const createPerson10 = (wx: number, wy: number) => createPerson(10, wx, wy);
export const createPerson11 = (wx: number, wy: number) => createPerson(11, wx, wy);
export const createPerson12 = (wx: number, wy: number) => createPerson(12, wx, wy);
export const createPerson13 = (wx: number, wy: number) => createPerson(13, wx, wy);
export const createPerson14 = (wx: number, wy: number) => createPerson(14, wx, wy);
export const createPerson15 = (wx: number, wy: number) => createPerson(15, wx, wy);
export const createPerson16 = (wx: number, wy: number) => createPerson(16, wx, wy);
export const createPerson17 = (wx: number, wy: number) => createPerson(17, wx, wy);
export const createPerson18 = (wx: number, wy: number) => createPerson(18, wx, wy);
export const createPerson19 = (wx: number, wy: number) => createPerson(19, wx, wy);
export const createPerson20 = (wx: number, wy: number) => createPerson(20, wx, wy);
