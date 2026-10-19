import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { createFauna, FAUNA_PROFILES, type FaunaProfile, faunaType } from "./Fauna.js";
import {
  FAUNA_EXPANSION_ROSTER,
  FAUNA_WATER_EXPANSION_ROSTER,
  UPRIGHT_COMPANION_SPECIES,
} from "./FaunaExpansion.js";
import { canEat, FOOD_WEB } from "./FoodWeb.js";
import { createPredator, PREDATOR_PROFILES } from "./Predator.js";
import { UPRIGHT_COMPANION_PROFILES } from "./UprightCompanions.js";

describe.each(UPRIGHT_COMPANION_PROFILES)("$species supported biped motion", (p) => {
  it("uses two planted fixed legs, attached arms and supported body weight transfer", () => {
    const base = `public/demos/wildlife-v2/${p.species}/roster-v3`;
    const m = JSON.parse(readFileSync(`${base}/sprite.json`, "utf8"));
    const a = JSON.parse(readFileSync(`${base}/source-audit.json`, "utf8"));
    const pixels = JSON.parse(readFileSync(`${base}/pixel-audit.json`, "utf8"));
    expect(
      createHash("sha256")
        .update(readFileSync(`${base}/sheet.png`))
        .digest("hex"),
    ).toBe(p.sha256);
    expect(m.identity).toBe(p.identity);
    expect(m.anchor).toEqual(p.anchor);
    expect(a.walkingLegs).toBe(2);
    expect(a.continuousSamplesPerFacing).toBe(257);
    expect(a.continuousActionSamplesPerFacing).toBe(257);
    expect(a.fixedLengthLinkChecks).toBeGreaterThan(8000);
    expect(a.buriedHipRootChecks).toBeGreaterThan(2000);
    expect(a.fixedArmLinkChecks).toBeGreaterThan(6000);
    expect(a.torsoSupportBoundsChecks).toBeGreaterThan(1000);
    expect(a.earAttachmentChecks).toBeGreaterThan(4000);
    expect(a.plantedTravelPairs).toBeGreaterThan(600);
    expect(a.maxContinuousEndpointGapWorldUnits).toBeLessThan(0.002);
    expect(a.maxContactSlideWorldUnits).toBeLessThan(0.00001);
    expect(a.maxQuarterPoseRotationStepDegrees).toBeLessThan(4);
    expect(a.maxSubsampleLegRotationStepDegrees).toBeLessThan(2);
    expect(Object.values(a.bodyRangePixels.walk).every((v) => Number(v) >= 1)).toBe(true);
    expect(Object.values(pixels.bodyPaintCentroidRangePixels).every((v) => Number(v) >= 1)).toBe(
      true,
    );
    if (p.species === "elephant-upright") expect(a.trunkFixedLengthChecks).toBeGreaterThan(4000);
    else expect(a.neckFixedLengthChecks).toBeGreaterThan(3000);
  });

  it("is a protected companion for every hunting species", () => {
    const e = createFauna(p.species, 0, 0);
    expect(p.companion).toBe(true);
    expect(FOOD_WEB.find((row) => row.species === p.species)).toMatchObject({
      protected: true,
      eats: [],
    });
    for (const h of PREDATOR_PROFILES)
      expect(canEat(createPredator(h.species, 0, 0), e)).toBe(false);
  });

  it("has deterministic independent natural ownership and bounded cache eviction", () => {
    const [x, y] = p.inspection;
    const gx = Math.floor(x / 64),
      gy = Math.floor(y / 64);
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    const home = n.companionHome(gx, gy);
    expect(home?.species).toBe(p.species);
    expect(home?.id).toBe(`fauna-companion-home:${gx}:${gy}`);
    if (!home) throw Error("Missing natural companion home");
    for (
      let cy = Math.floor((home.y - home.clearance - 4) / 16);
      cy <= Math.floor((home.y + home.clearance + 4) / 16);
      cy++
    )
      for (
        let cx = Math.floor((home.x - home.clearance - 4) / 16);
        cx <= Math.floor((home.x + home.clearance + 4) / 16);
        cx++
      )
        for (const prop of n.placements(cx, cy))
          expect(Math.hypot(prop.wx / 16 - home.x, prop.wy / 16 - home.y)).toBeGreaterThanOrEqual(
            home.clearance + 4,
          );
    for (let i = 0; i < 260; i++) n.companionHome(100 + i, -100 - i);
    expect(n.cacheSizes.companionFaunaHomes).toBeLessThanOrEqual(128);
    expect(n.companionHome(gx, gy)).toEqual(home);
    const reversed = new NaturalLandscape(regionalWorld(2026), "thicket");
    for (let i = 259; i >= 0; i--) reversed.companionHome(100 + i, -100 - i);
    expect(reversed.companionHome(gx, gy)).toEqual(home);
  });
});

it("adds companions downstream without changing prior wildlife owners, records or water refuges", () => {
  expect(UPRIGHT_COMPANION_SPECIES).toEqual(["elephant-upright", "giraffe-upright"]);
  expect(FAUNA_EXPANSION_ROSTER).toHaveLength(169);
  expect(FAUNA_WATER_EXPANSION_ROSTER).toHaveLength(42);
  const companionTypes = new Set(UPRIGHT_COMPANION_SPECIES.map(faunaType));
  const collect = () => {
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    return UPRIGHT_COMPANION_PROFILES.map((p) => {
      const [x, y] = p.inspection,
        gx = Math.floor(x / 64),
        gy = Math.floor(y / 64);
      return {
        owners: [
          n.faunaHome(gx, gy),
          n.faunaHome(gx, gy, true),
          n.rabbitGlade(gx, gy),
          n.deerGlade(gx, gy),
        ],
        water: Array.from({ length: 25 }, (_, i) => {
          const wx = Math.floor(x / 128) + (i % 5) - 2,
            wy = Math.floor(y / 128) + Math.floor(i / 5) - 2;
          return [n.pond(wx, wy), n.lagoon(wx, wy)];
        }),
        actors: Array.from({ length: 64 }, (_, i) =>
          n.wildlife(gx * 4 + (i % 8) - 2, gy * 4 + Math.floor(i / 8) - 2),
        )
          .flat()
          .filter((a) => !companionTypes.has(a.type)),
        scenery: Array.from({ length: 64 }, (_, i) =>
          n.placements(gx * 4 + (i % 8) - 2, gy * 4 + Math.floor(i / 8) - 2),
        ),
      };
    });
  };
  const active = collect();
  expect(active.some((r) => r.actors.length > 0)).toBe(true);
  const profiles = FAUNA_PROFILES as FaunaProfile[],
    saved = [...profiles];
  try {
    profiles.splice(0, profiles.length, ...saved.filter((p) => !p.companion));
    expect(collect()).toEqual(active);
  } finally {
    profiles.splice(0, profiles.length, ...saved);
  }
});
