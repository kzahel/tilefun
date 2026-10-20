import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import type { WorkItem } from "./AnimalWork.js";

export const SOURCE_KINDS = ["fruit-tree", "nut-tree", "seed-plant", "growing-plant"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const sourceType = (kind: SourceKind) => `wildlife-resource-${kind}-v1`;
export const SOURCE_FOOD = {
  "fruit-tree": "fruit",
  "nut-tree": "nut",
  "seed-plant": "seed",
  "growing-plant": "greens",
} as const;
export function createFoodSource(kind: SourceKind, wx: number, wy: number): Entity {
  const food = SOURCE_FOOD[kind],
    e = createForageItem(food, wx, wy);
  e.type = sourceType(kind);
  const sprite = FORAGE_DEFS[e.type]?.sprite;
  if (sprite && e.sprite) Object.assign(e.sprite, sprite);
  if (e.workItem) {
    e.workItem.units = 3;
    e.workItem.growth = {
      food,
      capacity: 3,
      interval: food === "fruit" ? 240 : food === "nut" ? 300 : 180,
      remaining: food === "fruit" ? 240 : food === "nut" ? 300 : 180,
    };
  }
  restoreWorkItemPose(e);
  return e;
}

export const FORAGE_SHEET = "wildlife-forage-resources-v1";
export const FORAGE_IMAGE = "demos/wildlife-v2/foraging-resources/behavior-v3/sheet.png";
export const FORAGE_KINDS = ["twig", "fruit", "nut", "nest", "cache", "greens", "seed"] as const;
export type ForageKind = (typeof FORAGE_KINDS)[number];
export const forageType = (kind: ForageKind) => `wildlife-resource-${kind}-v1`;
const cells = {
  twig: [0],
  fruit: [1],
  nut: [2],
  nest: [3, 4, 5, 6, 7],
  cache: [8, 9],
  greens: [10, 11, 12],
  seed: [13],
};
export const FORAGE_DEFS: Record<string, EntityDef> = Object.fromEntries(
  FORAGE_KINDS.map((kind) => [
    forageType(kind),
    {
      sprite: {
        sheetKey: FORAGE_SHEET,
        spriteWidth: 32,
        spriteHeight: 32,
        frameCount: 1,
        frameDuration: 200,
        drawOffsetY: 16,
        clips: cells[kind].map((start, i) => ({
          name: `stage-${i}`,
          start,
          count: 1,
          frameDuration: 200,
          loop: true,
        })),
      },
      collider: {
        offsetX: 0,
        offsetY: 0,
        width: kind === "nest" ? 20 : 6,
        height: 5,
        physicalHeight: 3,
        solid: false,
      },
      wanderAI: null,
      hasVelocity: false,
      weight: 0.1,
    },
  ]),
);

export function restoreWorkItemPose(e: Entity): void {
  const item = e.workItem;
  if (!item || item.kind === "ball") return;
  const sourceCells = item.growth
    ? item.kind === "greens"
      ? [14, 15, 16, 17]
      : item.kind === "seed"
        ? [18, 19, 20, 21]
        : item.kind === "nut"
          ? [22, 23, 24, 25]
          : [26, 27, 28, 29]
    : undefined;
  const stage = sourceCells
    ? Math.max(0, Math.min(3, item.units))
    : item.kind === "greens"
      ? Math.max(0, Math.min(2, 3 - item.units))
      : item.kind === "nest"
        ? Math.min(4, item.units)
        : item.kind === "cache" && item.contents.length
          ? 1
          : 0;
  if (e.sprite) {
    e.sprite.clip = stage;
    e.sprite.frameCol = (sourceCells ?? cells[item.kind])[stage] ?? 0;
    e.sprite.animTimer = 0;
  }
}
export function createForageItem(kind: ForageKind, wx: number, wy: number): Entity {
  const type = forageType(kind),
    def = FORAGE_DEFS[type];
  if (!def?.sprite || !def.collider) throw Error("Invalid forage kind");
  return {
    id: 0,
    type,
    position: { wx, wy },
    wz: 0,
    velocity: null,
    sprite: {
      ...def.sprite,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
      clip: 0,
    },
    collider: { ...def.collider },
    wanderAI: null,
    workItem: { kind, units: kind === "greens" ? 3 : kind === "seed" ? 1 : 0, contents: [] },
    weight: 0.1,
    tags: new Set(["wildlife-resource"]),
  };
}
for (const kind of SOURCE_KINDS) {
  const def = FORAGE_DEFS[forageType(SOURCE_FOOD[kind])];
  if (!def?.sprite) throw Error("Missing food definition");
  FORAGE_DEFS[sourceType(kind)] = {
    ...def,
    sprite: def.sprite
      ? {
          ...def.sprite,
          clips: Array.from({ length: 4 }, (_, i) => ({
            name: `stage-${i}`,
            start:
              (kind === "growing-plant"
                ? 14
                : kind === "seed-plant"
                  ? 18
                  : kind === "nut-tree"
                    ? 22
                    : 26) + i,
            count: 1,
            frameDuration: 200,
            loop: true,
          })),
        }
      : null,
  };
}
export const FORAGE_FACTORIES = {
  ...Object.fromEntries(
    SOURCE_KINDS.map((kind) => [
      sourceType(kind),
      (x: number, y: number) => createFoodSource(kind, x, y),
    ]),
  ),
  ...Object.fromEntries(
    FORAGE_KINDS.map((kind) => [
      forageType(kind),
      (x: number, y: number) => createForageItem(kind, x, y),
    ]),
  ),
};
export const isCarryable = (e: Entity) =>
  e.type === "ball" || FORAGE_KINDS.slice(0, 3).some((kind) => e.type === forageType(kind));
export function freshBallWork(owner: string, returnPosition: Entity["position"]): WorkItem {
  return { kind: "ball", owner, returnPosition: { ...returnPosition }, units: 0, contents: [] };
}
