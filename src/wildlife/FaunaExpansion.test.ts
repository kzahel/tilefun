import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { FAUNA_PROFILES, FAUNA_ROSTER, type FaunaProfile, faunaDefinition } from "./Fauna.js";
import { FAUNA_EXPANSION_ROSTER, FAUNA_WATER_EXPANSION_ROSTER } from "./FaunaExpansion.js";
import { NATURAL_HUNTER_PROFILES } from "./NaturalHunters.js";

it("reserves the natural queue without changing original habitat owner slots", () => {
  expect(FAUNA_ROSTER).toEqual([
    "fox",
    "cat",
    "dog",
    "cow",
    "sheep",
    "horse",
    "piglet",
    "goat",
    "elephant",
    "giraffe",
    "kangaroo",
    "king-cobra",
    "ant",
    "fish",
    "penguin",
    "harbor-seal",
    "manta-ray",
  ]);
  expect(FAUNA_EXPANSION_ROSTER).toHaveLength(169);
  const dedicated = ["rabbit", "robin", "deer", "frog", "mallard-duck", "lion", "tiger", "bear"];
  const all = [...FAUNA_ROSTER, ...FAUNA_EXPANSION_ROSTER, ...dedicated];
  expect(new Set(all).size).toBe(194);
  const roster = JSON.parse(readFileSync("art-source/wildlife-v2/roster.json", "utf8")) as {
    animals: { id: string; form: string }[];
  };
  expect([...all].sort()).toEqual(
    roster.animals
      .filter((a) => a.form === "natural")
      .map((a) => a.id)
      .sort(),
  );
});

it("keeps expansion admission and eviction independent and query-order stable", () => {
  const first = new NaturalLandscape(regionalWorld(2026), "thicket");
  const second = new NaturalLandscape(regionalWorld(2026), "thicket");
  const home = first.faunaHome(14, -4, true);
  expect(home?.species).toBe("chicken");
  expect(home?.id).toBe("fauna-expansion-home:14:-4");
  const active = new Set([...FAUNA_PROFILES, ...NATURAL_HUNTER_PROFILES].map((p) => p.species));
  for (let i = 0; i < 400; i++) {
    const a = first.faunaHome(i, -i, true);
    const b = second.faunaHome(399 - i, i - 399, true);
    if (a) expect(active.has(a.species)).toBe(true);
    if (b) expect(active.has(b.species)).toBe(true);
  }
  expect(first.cacheSizes.expansionFaunaHomes).toBeLessThanOrEqual(128);
  expect(second.cacheSizes.expansionFaunaHomes).toBeLessThanOrEqual(128);
  expect(first.faunaHome(14, -4, true)).toEqual(home);
  expect(second.faunaHome(14, -4, true)).toEqual(home);
  expect(first.faunaHome(14, -4)).toEqual(second.faunaHome(14, -4));
});

it("keeps original water refuges identical when expansion species become active", () => {
  const profiles = FAUNA_PROFILES as FaunaProfile[];
  const saved = [...profiles];
  const refuges = () => {
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    return Array.from({ length: 144 }, (_, i) => {
      const x = (i % 12) - 6,
        y = Math.floor(i / 12) - 6;
      return [n.pond(x, y), n.lagoon(x, y)];
    });
  };
  const active = refuges();
  try {
    profiles.splice(
      0,
      profiles.length,
      ...saved.filter((p) => !(FAUNA_EXPANSION_ROSTER as readonly string[]).includes(p.species)),
    );
    expect(refuges()).toEqual(active);
  } finally {
    profiles.splice(0, profiles.length, ...saved);
  }
});

it("keeps every original water actor and RNG unchanged when water expansion activates", () => {
  expect(FAUNA_WATER_EXPANSION_ROSTER).toHaveLength(42);
  const roster = JSON.parse(readFileSync("art-source/wildlife-v2/roster.json", "utf8")) as {
    animals: { id: string; form: string; media: string[] }[];
  };
  const original = new Set(["fish", "manta-ray", "penguin", "harbor-seal", "mallard-duck", "frog"]);
  expect([...FAUNA_WATER_EXPANSION_ROSTER].sort()).toEqual(
    roster.animals
      .filter((a) => a.form === "natural" && a.media.includes("water") && !original.has(a.id))
      .map((a) => a.id)
      .sort(),
  );
  const collect = () => {
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    return Array.from({ length: 64 }, (_, i) => n.wildlife(-23 + (i % 8), -144 + Math.floor(i / 8)))
      .flat()
      .filter((a) => a.type === "wildlife-fish-provisional-v1");
  };
  const active = collect();
  expect(active.length).toBeGreaterThan(0);
  const profiles = FAUNA_PROFILES as FaunaProfile[],
    saved = [...profiles];
  try {
    profiles.splice(
      0,
      profiles.length,
      ...saved.filter(
        (p) => !(FAUNA_WATER_EXPANSION_ROSTER as readonly string[]).includes(p.species),
      ),
    );
    expect(collect()).toEqual(active);
  } finally {
    profiles.splice(0, profiles.length, ...saved);
  }
});

it("starts crabs clear of the original fish even in a small pond", () => {
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const pond = n.pond(-87, 67);
  expect(pond?.ry).toBeLessThan(6);
  if (!pond) throw Error("Missing small-pond fixture");
  const cx = Math.floor(pond.x / 16),
    cy = Math.floor(pond.y / 16);
  const animals = Array.from({ length: 9 }, (_, i) =>
    n.wildlife(cx + (i % 3) - 1, cy + Math.floor(i / 3) - 1),
  )
    .flat()
    .filter((a) => a.featureId.includes(`${pond.id}:`));
  const crabs = animals.filter((a) => a.type === "wildlife-crab-provisional-v1");
  const fish = animals.filter((a) => a.type === "wildlife-fish-provisional-v1");
  expect(crabs).toHaveLength(2);
  expect(fish).toHaveLength(3);
  const bounds = (a: (typeof animals)[number]) => {
    const p = FAUNA_PROFILES.find((p) => a.type === `wildlife-${p.species}-provisional-v1`);
    if (!p) throw Error("Missing profile");
    return getEntityAABB({ wx: a.wx, wy: a.wy }, faunaDefinition(p).collider);
  };
  for (const crab of crabs)
    for (const f of fish) expect(aabbsOverlap(bounds(crab), bounds(f))).toBe(false);
});
