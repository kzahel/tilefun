import { it } from "vitest";
import type { Entity } from "../src/entities/Entity.js";
import { naturalLandscapeRecipe } from "../src/scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import { CONTINUATION_BIRD_PROFILES } from "../src/wildlife/ContinuationBirds.js";
import {
  CRUSTACEAN_FAUNA_PROFILES,
  CRUSTACEAN_LAND_HUNTER_PROFILES,
  CRUSTACEAN_WATER_HUNTER_PROFILES,
} from "../src/wildlife/Crustaceans.js";
import {
  DISTINCT_FISH_FAUNA_PROFILES,
  DISTINCT_FISH_HUNTER_PROFILES,
} from "../src/wildlife/DistinctFish.js";
import { faunaType } from "../src/wildlife/Fauna.js";
import {
  FOREST_HUNTER_PROFILES,
  FOREST_SPECIALIST_PROFILES,
} from "../src/wildlife/ForestSpecialists.js";
import { GREAT_APE_PROFILES } from "../src/wildlife/GreatApes.js";
import {
  GROUND_ARTHROPOD_FAUNA_PROFILES,
  GROUND_ARTHROPOD_HUNTER_PROFILES,
} from "../src/wildlife/GroundArthropods.js";
import { GROUND_PRIMATE_PROFILES } from "../src/wildlife/GroundPrimates.js";
import { GROUND_SPECIALIST_PROFILES } from "../src/wildlife/GroundSpecialists.js";
import {
  LEGLESS_FAUNA_PROFILES,
  LEGLESS_LAND_HUNTER_PROFILES,
  LEGLESS_WATER_HUNTER_PROFILES,
} from "../src/wildlife/LeglessCreatures.js";
import {
  MARINE_ODDITY_FAUNA_PROFILES,
  MARINE_ODDITY_HUNTER_PROFILES,
} from "../src/wildlife/MarineOddities.js";
import { MORE_MAMMAL_PROFILES } from "../src/wildlife/MoreMammals.js";
import { predatorType } from "../src/wildlife/Predator.js";
import { REPTILE_HUNTER_PROFILES } from "../src/wildlife/ReptileHunters.js";
import { SEABIRD_PROFILES } from "../src/wildlife/Seabirds.js";
import { SHORE_MAMMAL_PROFILES } from "../src/wildlife/ShoreMammals.js";
import { TALL_BIRD_PROFILES } from "../src/wildlife/TallBirds.js";
import { UPRIGHT_COMPANION_PROFILES } from "../src/wildlife/UprightCompanions.js";
import { testPart } from "./TestParts.test-helper.js";

/** Wildlife expansions whose "Watch AI" scenes are checked per species (147+). */
export const WATCHED_FAUNA = [
  ...CONTINUATION_BIRD_PROFILES,
  ...GREAT_APE_PROFILES,
  ...GROUND_PRIMATE_PROFILES,
  ...DISTINCT_FISH_FAUNA_PROFILES,
  ...GROUND_SPECIALIST_PROFILES,
  ...SEABIRD_PROFILES,
  ...TALL_BIRD_PROFILES,
  ...FOREST_SPECIALIST_PROFILES,
  ...MORE_MAMMAL_PROFILES,
  ...SHORE_MAMMAL_PROFILES,
  ...LEGLESS_FAUNA_PROFILES,
  ...GROUND_ARTHROPOD_FAUNA_PROFILES,
  ...MARINE_ODDITY_FAUNA_PROFILES,
  ...CRUSTACEAN_FAUNA_PROFILES,
  ...UPRIGHT_COMPANION_PROFILES,
];
export const WATCHED_HUNTERS = [
  ...DISTINCT_FISH_HUNTER_PROFILES,
  ...REPTILE_HUNTER_PROFILES,
  ...FOREST_HUNTER_PROFILES,
  ...LEGLESS_LAND_HUNTER_PROFILES,
  ...GROUND_ARTHROPOD_HUNTER_PROFILES,
  ...LEGLESS_WATER_HUNTER_PROFILES,
  ...MARINE_ODDITY_HUNTER_PROFILES,
  ...CRUSTACEAN_LAND_HUNTER_PROFILES,
  ...CRUSTACEAN_WATER_HUNTER_PROFILES,
];

const IDLE = { dx: 0, dy: 0, jump: false, sprinting: false };
/** The browser poll's 12 s at 60 Hz. */
const MAX_TICKS = 720;

/**
 * Run a species' animal-browser "Watch AI" scene headless (the browser opens
 * every one with the thicket profile) until an actor of `type` satisfies
 * `moved` relative to where it first appeared. Natural populations may seed
 * after the first tick, as they do while the browser scene loads.
 */
async function watchScene(
  scene: string,
  type: string,
  moved: (actor: Entity, start: { wx: number; wy: number }) => boolean,
) {
  const s = await ScenarioSession.create(naturalLandscapeRecipe(scene, "thicket"));
  try {
    const start = new Map<number, { wx: number; wy: number }>();
    for (let i = 0; i < MAX_TICKS; i++) {
      await s.step(IDLE);
      for (const e of s.realm.entityManager.entities) {
        if (e.type !== type) continue;
        const from = start.get(e.id);
        if (!from) start.set(e.id, { ...e.position });
        else if (moved(e, from)) return;
      }
    }
    throw Error(`${type}: ${start.size} spawned, none moved in ${MAX_TICKS} ticks`);
  } finally {
    await s.close();
  }
}
const away = (p: { wx: number; wy: number }, q: { wx: number; wy: number }) =>
  Math.hypot(p.wx - q.wx, p.wy - q.wy) > 1;

/** A natural animal walks (or hops) away from its first pose.
 * Shared Rapier contacts rest within solver slop, not at exact zero. */
function watchFauna(animal: (typeof WATCHED_FAUNA)[number]) {
  return watchScene(
    animal.species,
    faunaType(animal.species),
    (e, start) =>
      (animal.hop ? (e.wz ?? 0) > 2 : Math.abs(e.wz ?? 0) < 0.5) && away(e.position, start),
  );
}
function watchHunter(animal: (typeof WATCHED_HUNTERS)[number]) {
  return watchScene(
    animal.species,
    predatorType(animal.species),
    (e, start) => (e.sprite?.frameCol ?? 0) > 4 && away(e.position, start),
  );
}

/**
 * Each animal-browser "Watch AI" scene, headless, for one
 * `AnimalScenes.partN.test.ts` slice. The browser spec keeps card -> scene ->
 * camera representatives (tests/animal-browser.spec.ts).
 */
export function defineAnimalSceneSuite(partFileUrl: string): void {
  const cases = [
    ...WATCHED_FAUNA.map((animal) => ({ species: animal.species, run: () => watchFauna(animal) })),
    ...WATCHED_HUNTERS.map((animal) => ({
      species: animal.species,
      run: () => watchHunter(animal),
    })),
  ];
  it.each(testPart(cases, partFileUrl))("$species Watch AI scene runs a moving animal", (c) =>
    c.run(),
  );
}
