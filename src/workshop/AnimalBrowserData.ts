import ledger from "../../art-source/wildlife-v2/autonomous-140.json";
import { required } from "../art/ArtCatalog.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { NATURAL_CASES } from "../scenarios/NaturalLandscapeRecipe.js";
import { DEER_IMAGE, DEER_TYPE } from "../wildlife/Deer.js";
import { FAUNA_PROFILES, faunaType } from "../wildlife/Fauna.js";
import { FROG_IMAGE, FROG_TYPE } from "../wildlife/Frog.js";
import { MALLARD_IMAGE, MALLARD_TYPE } from "../wildlife/Mallard.js";
import { PREDATOR_PROFILES, predatorType } from "../wildlife/Predator.js";
import { RABBIT_IMAGE, RABBIT_TYPE } from "../wildlife/Rabbit.js";
import { ROBIN_IMAGE, ROBIN_TYPE } from "../wildlife/Robin.js";

const families = new Map(Object.entries(ledger.tasks).map(([id, t]) => [id, t.family]));
export const ANIMAL_BROWSER_ENTRIES = [
  ...FAUNA_PROFILES.map((p) => ({
    id: p.species,
    name: p.label,
    type: faunaType(p.species),
    image: p.image,
    hunter: false,
  })),
  ...PREDATOR_PROFILES.map((p) => ({
    id: p.species,
    name: p.label,
    type: predatorType(p.species),
    image: `demos/wildlife-v2/${p.species}/${p.revision}/sheet.png`,
    hunter: true,
  })),
  { id: "deer", name: "White-tailed deer", type: DEER_TYPE, image: DEER_IMAGE, hunter: false },
  { id: "frog", name: "Frog", type: FROG_TYPE, image: FROG_IMAGE, hunter: false },
  { id: "mallard", name: "Mallard duck", type: MALLARD_TYPE, image: MALLARD_IMAGE, hunter: false },
  { id: "robin", name: "Robin", type: ROBIN_TYPE, image: ROBIN_IMAGE, hunter: false },
  { id: "rabbit", name: "Rabbit", type: RABBIT_TYPE, image: RABBIT_IMAGE, hunter: false },
]
  .map((p) => ({
    ...p,
    family:
      families.get(p.id) ??
      families.get(p.id === "brown-bear" ? "bear" : p.id === "mallard" ? "mallard-duck" : p.id) ??
      (p.id.includes("cat") || p.id.includes("dog") ? "Pets" : "Fierce & fantasy"),
    scene:
      p.id === "deer"
        ? "deer"
        : p.id === "robin"
          ? "robins"
          : p.id === "rabbit"
            ? "rabbits"
            : p.id === "frog"
              ? "frogs"
              : p.id === "mallard"
                ? "pond"
                : p.id,
    sprite: required(ENTITY_DEFS[p.type]?.sprite),
  }))
  .filter((p) => NATURAL_CASES.some((c) => c.id === p.scene));
export type AnimalBrowserEntry = (typeof ANIMAL_BROWSER_ENTRIES)[number];
