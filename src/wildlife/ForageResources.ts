import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import type { WorkItem } from "./AnimalWork.js";

export const SOURCE_KINDS = [
  "fruit-tree",
  "nut-tree",
  "seed-plant",
  "growing-plant",
  "browse-shrub",
  "root-patch",
  "scratch-patch",
  "nectar-flower",
  "spring-pool",
  "branch-pile",
  "canopy-leaves",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const sourceType = (kind: SourceKind) => `wildlife-resource-${kind}-v1`;
export const SOURCE_FOOD = {
  "fruit-tree": "fruit",
  "nut-tree": "nut",
  "seed-plant": "seed",
  "growing-plant": "greens",
  "browse-shrub": "greens",
  "root-patch": "root",
  "scratch-patch": "seed",
  "nectar-flower": "nectar",
  "spring-pool": "water",
  "branch-pile": "twig",
  "canopy-leaves": "greens",
} as const;
const sourceStart: Record<SourceKind, number> = {
  "growing-plant": 14,
  "seed-plant": 18,
  "nut-tree": 22,
  "fruit-tree": 26,
  "browse-shrub": 30,
  "root-patch": 34,
  "scratch-patch": 39,
  "nectar-flower": 43,
  "spring-pool": 52,
  "branch-pile": 56,
  "canopy-leaves": 60,
};
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
      interval:
        food === "twig"
          ? 360
          : food === "fruit"
            ? 240
            : food === "nut" || food === "root"
              ? 300
              : 180,
      remaining:
        food === "twig"
          ? 360
          : food === "fruit"
            ? 240
            : food === "nut" || food === "root"
              ? 300
              : 180,
    };
  }
  restoreWorkItemPose(e);
  return e;
}

export const FORAGE_SHEET = "wildlife-forage-resources-v1";
export const FORAGE_IMAGE = "demos/wildlife-v2/foraging-resources/behavior-v7/sheet.png";
export const FORAGE_KINDS = [
  "twig",
  "fruit",
  "nut",
  "nest",
  "cache",
  "greens",
  "seed",
  "root",
  "nectar",
  "water",
  "lodge",
  "dust",
] as const;
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
  root: [38],
  nectar: [51],
  water: [52],
  lodge: [64, 65, 66, 67, 68],
  dust: [69, 70, 71, 72],
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
        width: kind === "nest" ? 20 : kind === "dust" ? 24 : 6,
        height: kind === "dust" ? 12 : 5,
        physicalHeight: kind === "dust" ? 0 : 3,
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
  const source = SOURCE_KINDS.find((kind) => e.type === sourceType(kind));
  const sourceCells =
    item.growth && source
      ? Array.from(
          { length: 4 },
          (_, i) =>
            sourceStart[source] +
            (source === "nectar-flower" && (item.pollination?.remaining ?? 0) > 0 ? 4 : 0) +
            i,
        )
      : undefined;
  const stage = sourceCells
    ? Math.max(0, Math.min(3, item.units))
    : item.kind === "greens"
      ? Math.max(0, Math.min(2, 3 - item.units))
      : item.kind === "dust"
        ? Math.max(0, Math.min(3, item.units))
        : item.kind === "nest" || item.kind === "lodge"
          ? Math.min(4, item.units)
          : item.kind === "cache" && item.contents.length
            ? 1
            : 0;
  if (e.sprite) {
    e.sprite.clip =
      stage + (source === "nectar-flower" && (item.pollination?.remaining ?? 0) > 0 ? 4 : 0);
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
      frameCol: def.sprite.clips?.[0]?.start ?? 0,
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
          clips: Array.from({ length: kind === "nectar-flower" ? 8 : 4 }, (_, i) => ({
            name: `stage-${i}`,
            start: sourceStart[kind] + i,
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
  e.type === "ball" ||
  (["twig", "fruit", "nut", "root"] as const).some((kind) => e.type === forageType(kind));
export function freshBallWork(owner: string, returnPosition: Entity["position"]): WorkItem {
  return { kind: "ball", owner, returnPosition: { ...returnPosition }, units: 0, contents: [] };
}
