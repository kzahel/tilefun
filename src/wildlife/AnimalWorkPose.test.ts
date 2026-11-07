import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import { createDeer } from "./Deer.js";
import { createFauna, type FaunaSpecies } from "./Fauna.js";
import { createRabbit } from "./Rabbit.js";
import { createRobin } from "./Robin.js";

const SPECIES: Record<AnimalWork["kind"], FaunaSpecies | "deer" | "rabbit" | "robin"> = {
  dog: "dog",
  crow: "crow",
  squirrel: "red-squirrel",
  rabbit: "rabbit",
  robin: "robin",
  meerkat: "meerkat",
  capuchin: "capuchin-monkey",
  raccoon: "raccoon",
  cat: "cat",
  goat: "goat",
  pig: "piglet",
  elephant: "elephant",
  chicken: "chicken",
  bee: "bee",
  hummingbird: "ruby-throated-hummingbird",
  horse: "horse",
  giraffe: "giraffe",
  beaver: "beaver",
  cow: "cow",
  sheep: "sheep",
  donkey: "donkey",
  deer: "deer",
  peacock: "peacock",
  raven: "raven",
  hedgehog: "hedgehog",
  porcupine: "porcupine",
  fox: "fox",
};
// Every AnimalWork state, plus an unknown one to pin the "no clip" fallback.
const STATES = `idle seek pickup return deposit retrieve eat rest scan alarm lower climb descend
  stalk pounce bat perch rear browse sniff root reach curl shake hop scratch peck sip guard graze
  drink raise build settle lie ruminate stand bleat roll stamp wait open display close bury
  curl-in curled uncurl quills rattle relax listen`.split(/\s+/) as AnimalWork["state"][];

function animal(kind: AnimalWork["kind"]): Entity {
  const species = SPECIES[kind];
  if (species === "deer") return createDeer(0, 0);
  if (species === "rabbit") return createRabbit(0, 0);
  if (species === "robin") return createRobin(0, 0);
  return createFauna(species, 0, 0);
}

function restored(
  kind: AnimalWork["kind"],
  state: AnimalWork["state"],
  elapsed: number,
  variant: "plain" | "alarmed" | "moving",
) {
  const a = animal(kind);
  const ai = a.fauna ?? a.rabbit ?? a.robin;
  if (variant === "alarmed" && ai) ai.alarmFrom = { wx: 10, wy: 0 };
  if (variant === "moving" && a.fauna)
    a.fauna.motion = { elapsed: 0.42 } as NonNullable<typeof a.fauna.motion>;
  a.animalWork = {
    kind,
    state,
    elapsed,
    cooldown: 0,
    deliveries: 0,
    eaten: 0,
    retrieved: 0,
    facing: 2,
  };
  restoreAnimalWorkPose(a);
  return [a.sprite?.clip, a.sprite?.clipElapsedMs, a.sprite?.direction, a.sprite?.frameRow];
}

// Digest recorded against the nested-ternary implementation before it became tables.
it("restores the same clip, clip time and facing for every kind, state and variant", () => {
  const rows: unknown[] = [];
  for (const kind of Object.keys(SPECIES) as AnimalWork["kind"][])
    for (const state of STATES)
      for (const elapsed of [0.3, 0.9])
        for (const variant of ["plain", "alarmed", "moving"] as const)
          rows.push([kind, state, elapsed, variant, ...restored(kind, state, elapsed, variant)]);
  const json = JSON.stringify(rows, (_key, value) => (value === undefined ? "<undefined>" : value));
  expect(createHash("sha256").update(json).digest("hex").slice(0, 24)).toBe(
    "e15121da0a2ada9c96969fec",
  );
  // Sanity: the table restores real clips, not only the "no clip" fallback.
  expect(rows.filter((r) => (r as unknown[])[5] !== "<undefined>").length).toBeGreaterThan(100);
});
