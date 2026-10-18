import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";

export const INDOOR_ROLES = ["reader", "diner", "cleaner", "chef"] as const;
export type IndoorRole = (typeof INDOOR_ROLES)[number];
const actionFrames = { reader: 18, diner: 6, cleaner: 17, chef: 6 };
export const INDOOR_PEOPLE_DEFS: Record<string, EntityDef> = Object.fromEntries(
  INDOOR_ROLES.map((role) => [
    `indoor-${role}`,
    {
      sprite: {
        sheetKey: `indoor-${role}`,
        spriteWidth: 32,
        spriteHeight: 64,
        drawOffsetY: 16,
        frameCount: 6,
        frameDuration: 140,
        clips: [
          { name: "walk", start: 0, count: 6, frameDuration: 140, loop: true },
          { name: role, start: 6, count: actionFrames[role], frameDuration: 160, loop: true },
        ],
      },
      collider: {
        offsetX: 0,
        offsetY: 0,
        width: 10,
        height: 6,
        physicalHeight: 24,
        solid: true,
        clientSolid: true,
      },
      wanderAI: null,
      hasVelocity: true,
      weight: 70,
    },
  ]),
);

export const INDOOR_PEOPLE_FACTORIES = Object.fromEntries(
  INDOOR_ROLES.map((role) => [
    `indoor-${role}`,
    (wx: number, wy: number): Entity => {
      const def = INDOOR_PEOPLE_DEFS[`indoor-${role}`];
      if (!def?.sprite || !def.collider) throw new Error("Missing indoor person definition");
      return {
        id: 0,
        type: `indoor-${role}`,
        position: { wx, wy },
        velocity: { vx: 0, vy: 0 },
        collider: { ...def.collider },
        wanderAI: null,
        weight: 70,
        tags: new Set(["npc"]),
        sprite: {
          ...def.sprite,
          frameCol: 0,
          frameRow: 0,
          animTimer: 0,
          direction: Direction.Down,
          moving: false,
        },
      };
    },
  ]),
);
