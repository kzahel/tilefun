import type { Entity } from "../entities/Entity.js";
import { DEER_TYPE } from "./Deer.js";
import { FAUNA_PROFILES, faunaType } from "./Fauna.js";
import { FROG_TYPE } from "./Frog.js";
import { MALLARD_TYPE } from "./Mallard.js";
import { RABBIT_TYPE } from "./Rabbit.js";
import { ROBIN_TYPE } from "./Robin.js";

const birds = [
  "kiwi",
  "kakapo",
  "wild-turkey",
  "peacock",
  "mallard-duck",
  "robin",
  "chicken",
  "pigeon",
  "crow",
  "seagull",
] as const;
const small = [
  "rabbit",
  "frog",
  "red-squirrel",
  "mouse",
  "rat",
  "chinchilla",
  "hedgehog",
  ...birds,
] as const;
const antelopes = [
  "gemsbok-oryx",
  "gazelle",
  "impala",
  "springbok",
  "saiga-antelope",
  "gerenuk",
] as const;
const lightAntelopes = antelopes.filter((s) => s !== "gemsbok-oryx");
const heavyBovids = ["american-bison", "water-buffalo", "musk-ox"] as const;
const pasture = [
  "ostrich",
  "emu",
  "cassowary",
  "porcupine",
  "raccoon",
  "skunk",
  "red-panda",
  "moose",
  "elk",
  "warthog",
  "zebra",
  "okapi",
  "camel",
  "wildebeest",
  ...antelopes,
  "deer",
  "sheep",
  "goat",
  "piglet",
  "kangaroo",
  "donkey",
  "mule",
  "llama",
  "alpaca",
] as const;

const smallerCats = ["cheetah", "lynx", "bobcat"] as const;
const felids = ["jaguar", "leopard", ...smallerCats] as const;

/** Explicit game food web. Direction means hunter → prey, never inferred from mass.
 * These size/threat tiers are game rules, not a claim of measured animal ecology. */
export const HUNTING_DIETS = {
  shark: ["fish", "harbor-seal", "penguin", "manta-ray", "octopus", "crab"],
  "hammerhead-shark": ["fish", "manta-ray", "octopus", "crab"],
  orca: ["shark", "hammerhead-shark", "fish", "harbor-seal", "penguin", "manta-ray", "octopus"],
  "polar-bear": [
    ...small,
    ...pasture,
    "wolf",
    "coyote",
    "spotted-hyena",
    "fox",
    "musk-ox",
    "fish",
    "harbor-seal",
    "penguin",
  ],
  jaguar: [...small, ...pasture, ...smallerCats, "fox", "wolf", "coyote", "giant-spider"],
  leopard: [...small, ...pasture, ...smallerCats, "fox", "wolf", "coyote", "giant-spider"],
  cheetah: [...small, ...lightAntelopes, "deer", "sheep", "goat", "piglet", "kangaroo", "alpaca"],
  lynx: [...small, "fox"],
  bobcat: [...small],
  "giant-spider": [
    "ant",
    "butterfly",
    "red-squirrel",
    "rabbit",
    "frog",
    "robin",
    "chicken",
    "pigeon",
    "king-cobra",
  ],
  coyote: [...small, "fox"],
  wolf: [...small, ...pasture, "lynx", "bobcat", "fox", "coyote"],
  "spotted-hyena": [...small, ...pasture, ...smallerCats, "fox", "coyote", "wolf"],
  "dire-wolf": [
    "panda",
    "musk-ox",
    ...felids,
    ...small,
    ...pasture,
    "wolf",
    "coyote",
    "spotted-hyena",
    "fox",
    "giant-spider",
  ],
  panther: [
    ...smallerCats,
    ...small,
    ...pasture,
    "wolf",
    "coyote",
    "spotted-hyena",
    "fox",
    "king-cobra",
    "giant-spider",
  ],
  tiger: [
    "panda",
    ...heavyBovids,
    ...felids,
    ...small,
    ...pasture,
    "wolf",
    "coyote",
    "spotted-hyena",
    "fox",
    "cow",
    "horse",
    "panther",
    "dire-wolf",
    "giant-spider",
  ],
  lion: [
    "panda",
    ...heavyBovids,
    ...felids,
    ...small,
    ...pasture,
    "wolf",
    "coyote",
    "spotted-hyena",
    "fox",
    "cow",
    "horse",
    "panther",
    "dire-wolf",
    "giant-spider",
  ],
  "brown-bear": [
    "panda",
    ...heavyBovids,
    ...felids,
    "wolf",
    "coyote",
    "spotted-hyena",
    ...small,
    ...pasture,
    "fox",
    "cow",
    "fish",
    "crab",
    "panther",
    "dire-wolf",
    "giant-spider",
  ],
  griffin: [
    "panda",
    ...felids,
    ...small,
    ...pasture,
    "wolf",
    "coyote",
    "spotted-hyena",
    "fox",
    "king-cobra",
    "panther",
    "dire-wolf",
    "giant-spider",
  ],
  "small-dragon": [
    "rhinoceros",
    "hippopotamus",
    "panda",
    "polar-bear",
    ...heavyBovids,
    ...felids,
    "wolf",
    "coyote",
    "spotted-hyena",
    ...small,
    ...pasture,
    "fox",
    "cow",
    "horse",
    "panther",
    "tiger",
    "lion",
    "brown-bear",
    "gorilla",
    "dire-wolf",
    "griffin",
    "giant-spider",
  ],
  "t-rex": [
    "rhinoceros",
    "hippopotamus",
    "panda",
    "polar-bear",
    ...heavyBovids,
    ...felids,
    "wolf",
    "coyote",
    "spotted-hyena",
    ...small,
    ...pasture,
    "fox",
    "cow",
    "horse",
    "elephant",
    "giraffe",
    "panther",
    "tiger",
    "lion",
    "brown-bear",
    "gorilla",
    "dire-wolf",
    "small-dragon",
    "griffin",
    "giant-spider",
  ],
} as const;
export type HuntingSpecies = keyof typeof HUNTING_DIETS;

const identities = new Map<string, string>([
  ...FAUNA_PROFILES.map((p) => [faunaType(p.species), p.species] as const),
  [DEER_TYPE, "deer"],
  [RABBIT_TYPE, "rabbit"],
  [FROG_TYPE, "frog"],
  [ROBIN_TYPE, "robin"],
  [MALLARD_TYPE, "mallard-duck"],
  ...Object.keys(HUNTING_DIETS).map(
    (species) => [`wildlife-${species}-predator-v1`, species] as const,
  ),
  ...["chicken", "cow", "pigeon", "crow", "seagull"].map((species) => [species, species] as const),
  ["pigeon2", "pigeon"],
  ["fish1", "fish"],
  ["fish2", "fish"],
  ["fish3", "fish"],
]);
const companions = new Set([
  "hamster",
  "guinea-pig",
  "cat",
  "dog",
  ...FAUNA_PROFILES.filter((p) => p.variantOf).map((p) => p.species),
]);
const diets = new Map<string, ReadonlySet<string>>(
  Object.entries(HUNTING_DIETS).map(([species, prey]) => [species, new Set(prey)]),
);

/** Every recognized animal has an identity, including safe pets and aquatic fauna.
 * Unknown types (players, characters, vehicles, props) are never food. */
export const creatureSpecies = (entity: Pick<Entity, "type">): string | undefined =>
  identities.get(entity.type);
export function dietFor(species: string): ReadonlySet<string> {
  return diets.get(species) ?? EMPTY_DIET;
}
const EMPTY_DIET: ReadonlySet<string> = new Set();

export function canEat(hunter: Entity, prey: Entity): boolean {
  const species = creatureSpecies(prey),
    predator = creatureSpecies(hunter);
  return (
    !!species &&
    !!predator &&
    hunter !== prey &&
    species !== predator &&
    !companions.has(species) &&
    prey.deathTimer === undefined &&
    hunter.deathTimer === undefined &&
    prey.parentId === undefined &&
    !prey.wanderAI?.following &&
    prey.wanderAI?.state !== "ridden" &&
    dietFor(predator).has(species)
  );
}

export const FOOD_WEB = [...new Set(identities.values())].sort().map((species) => ({
  species,
  protected: companions.has(species),
  eats: [...dietFor(species)],
}));
