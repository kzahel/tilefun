import { expect, it } from "vitest";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { NATURAL_HUNTER_PROFILES } from "./NaturalHunters.js";

it("seeds authored antelopes as legal natural companions in hunter clearings", () => {
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const prey = NATURAL_HUNTER_PROFILES.flatMap((p) => {
    const [x, y] = p.expansion.inspection;
    const gx = Math.floor(x / 64),
      gy = Math.floor(y / 64);
    return Array.from({ length: 16 }, (_, i) =>
      n.expansionPredators(gx * 4 + (i % 4), gy * 4 + Math.floor(i / 4)),
    )
      .flat()
      .filter((a) => a.fauna);
  });
  expect(prey.length).toBeGreaterThan(0);
  expect(prey.every((a) => a.featureId.startsWith("wildlife:expansion-prey:"))).toBe(true);
});
