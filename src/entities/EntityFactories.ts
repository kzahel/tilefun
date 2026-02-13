import { createCampfire } from "./Campfire.js";
import { createChicken } from "./Chicken.js";
import { createCow } from "./Cow.js";
import { createCrow } from "./Crow.js";
import { createEggNest } from "./EggNest.js";
import type { Entity } from "./Entity.js";
import { createFish1, createFish2, createFish3 } from "./Fish.js";
import { createGem } from "./Gem.js";
import { createGhostAngry, createGhostFriendly } from "./Ghost.js";
import {
  createPerson1,
  createPerson2,
  createPerson3,
  createPerson4,
  createPerson5,
  createPerson6,
  createPerson7,
  createPerson8,
  createPerson9,
  createPerson10,
  createPerson11,
  createPerson12,
  createPerson13,
  createPerson14,
  createPerson15,
  createPerson16,
  createPerson17,
  createPerson18,
  createPerson19,
  createPerson20,
} from "./Person.js";
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
  gem: createGem,
  "ghost-friendly": createGhostFriendly,
  "ghost-angry": createGhostAngry,
  "egg-nest": createEggNest,
  crow: createCrow,
  seagull: createSeagull,
  worm1: createWorm1,
  worm2: createWorm2,
  worm3: createWorm3,
  worm4: createWorm4,
  person1: createPerson1,
  person2: createPerson2,
  person3: createPerson3,
  person4: createPerson4,
  person5: createPerson5,
  person6: createPerson6,
  person7: createPerson7,
  person8: createPerson8,
  person9: createPerson9,
  person10: createPerson10,
  person11: createPerson11,
  person12: createPerson12,
  person13: createPerson13,
  person14: createPerson14,
  person15: createPerson15,
  person16: createPerson16,
  person17: createPerson17,
  person18: createPerson18,
  person19: createPerson19,
  person20: createPerson20,
};
