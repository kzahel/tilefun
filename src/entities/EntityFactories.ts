import { createCampfire } from "./Campfire.js";
import { createChicken } from "./Chicken.js";
import { createCow } from "./Cow.js";
import { createCrow } from "./Crow.js";
import { createEggNest } from "./EggNest.js";
import type { Entity } from "./Entity.js";
import { createFish1, createFish2, createFish3 } from "./Fish.js";
import { createPigeon } from "./Pigeon.js";
import { createPigeon2 } from "./Pigeon2.js";
import { createSeagull } from "./Seagull.js";
import { createWorm1, createWorm2, createWorm3, createWorm4 } from "./Worm.js";

export const ENTITY_FACTORIES: Record<string, (wx: number, wy: number) => Entity> = {
  chicken: createChicken,
  cow: createCow,
  pigeon: createPigeon,
  pigeon2: createPigeon2,
  fish1: createFish1,
  fish2: createFish2,
  fish3: createFish3,
  campfire: createCampfire,
  "egg-nest": createEggNest,
  crow: createCrow,
  seagull: createSeagull,
  worm1: createWorm1,
  worm2: createWorm2,
  worm3: createWorm3,
  worm4: createWorm4,
};
