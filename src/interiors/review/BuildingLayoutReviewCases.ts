import { withBuildingLayout } from "../BuildingDoors.js";
import { buildingLayout } from "../BuildingLayouts.js";
import type { ReviewCase } from "./ReviewCases.js";

export function buildingLayoutReviewCases(): ReviewCase[] {
  return (
    [
      [
        "butcher",
        "Butcher · sales floor and preparation room · two entrances",
        "prop-city-dense-v1-butcher-2",
      ],
      [
        "bay-apartment",
        "Bay apartment · bedroom, kitchen and shared hall · two entrances",
        "prop-city-dense-v1-condo-bay-3",
      ],
      [
        "shop",
        "Shop · sales floor and preparation room · one entrance",
        "prop-city-dense-v1-bakery-3",
      ],
      [
        "apartment",
        "Apartment · bedroom, kitchen and shared hall · one entrance",
        "prop-city-dense-v1-hotel-4-roof-sign",
      ],
    ] as const
  ).map(([id, name, buildingType]) => {
    const identity = withBuildingLayout(
      {
        version: "interior-v1",
        parentWorldId: "review",
        featureId: "settlement:0:0:block:0:0:lot:0",
        buildingType,
        floor: 0,
        returnX: 0,
        returnY: 0,
      },
      { wx: 0, wy: 0 },
    );
    const layout = buildingLayout(identity);
    return {
      id: `building-layout-v2-${id}`,
      name,
      stage: 16,
      building: identity,
      ...layout,
    };
  });
}
