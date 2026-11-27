import { expect, it } from "vitest";
import { buildingExterior } from "../../buildings/BuildingExteriors.js";
import { sectionInterval } from "../../buildings/BuildingSection.js";
import { createProp, getWallsForPropType } from "../../entities/PropFactories.js";
import { withLivedInLayout } from "../../interiors/BuildingDoors.js";
import { interiorPlan } from "../../interiors/GameplayInterior.js";
import { OUTING_CASES } from "../../scenarios/RegionalVenueRecipe.js";
import { required } from "../../shared/required.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { CIVIC_BUILDINGS } from "./CivicBuildings.js";
import { DenseDistrictSource } from "./DenseDistrictSource.js";
import { regionalWorld } from "./WorldDescriptor.js";

it("streams the same Ferngrove addresses used by the playable Workshop views", () => {
  const town = required(new DenseDistrictSource(regionalWorld(2026), true).owner(0, 0));
  const gen = createGenerator(createDescriptor("regional", 2026));
  expect(town.civicSites).toHaveLength(7);
  for (const site of town.civicSites ?? []) {
    expect(OUTING_CASES.find((c) => c.name === site.name)).toMatchObject(site.arrival);
    for (const a of site.actors)
      expect(
        gen
          .actors?.(Math.floor(a.wx / 256), Math.floor(a.wy / 256))
          .filter((e) => e.featureId === a.featureId),
      ).toEqual([a]);
    for (const p of site.props) {
      expect(
        gen.placements(Math.floor(p.wx / 256), Math.floor(p.wy / 256), new Set()).placements,
      ).toContainEqual(p);
      expect(createProp(p.propType, 0, 0).walls).toEqual(getWallsForPropType(p.propType));
    }
  }
});
it("gives every public building a furnished room and reconstructible solid exterior", () => {
  for (const r of CIVIC_BUILDINGS) {
    const b = required(buildingExterior(r.type));
    expect(b.sections.length).toBeGreaterThan(0);
    const id = withLivedInLayout(
      {
        version: "interior-v1",
        buildingType: r.type,
        parentWorldId: "town",
        featureId: "settlement:0:0:block:0:0:lot:0",
        floor: 0,
        returnX: 0,
        returnY: 1,
      },
      { wx: 0, wy: 0 },
    );
    expect(interiorPlan(id).objects.length).toBeGreaterThan(4);
  }
});
it("fits the 140 by 51 pixel fire engine inside the bay and an ambulance under the canopy", () => {
  const fire = required(buildingExterior("prop-city-civic-fire"));
  // A north/south chassis wholly behind the front beam; the same sections go to Rapier.
  const box = { left: -22, right: 29, top: -192, bottom: -52 };
  const hits = fire.sections.flatMap((s) => sectionInterval(s, box) ?? []);
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.every((h) => h.bottom >= 50)).toBe(true);
  const canopy = createProp("prop-civic-canopy", 0, 0);
  expect(canopy.walls?.filter((w) => w.zBase)).toMatchObject([{ zBase: 60 }]);
  expect(
    canopy.walls?.filter((w) => !w.zBase).every((w) => w.offsetY < -55 || w.offsetY > -9),
  ).toBe(true);
});
