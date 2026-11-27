import { TILE_SIZE } from "../../config/constants.js";
import { required } from "../../shared/required.js";
import { civicBuilding } from "./CivicBuildings.js";
import { denseBuilding } from "./DenseCityAssets.js";
import type { DenseDistrictPlan } from "./DenseDistrictPlanner.js";
import { denseDoorThresholds } from "./DenseDoorThresholds.js";
import type { Settlement } from "./RegionalPlanner.js";
export function connectDenseEntrances(
  plan: DenseDistrictPlan,
  settlement: Settlement,
): DenseDistrictPlan {
  const blocks = plan.blocks.map((block) => ({
    ...block,
    lots: block.lots.map((lot) => {
      const primary = denseDoorThresholds(
        civicBuilding(lot.buildingType) ?? denseBuilding(lot.buildingType),
      ).find((d) => d.primary);
      if (!primary) throw new Error(`Missing primary doorway for ${lot.id}`);
      return { ...lot, entrance: { ...lot.entrance, x: lot.anchor.x + primary.dx / TILE_SIZE } };
    }),
  }));
  const entrancePaths = blocks.flatMap((block) =>
    block.lots.flatMap((lot) => {
      const doors = denseDoorThresholds(
        civicBuilding(lot.buildingType) ?? denseBuilding(lot.buildingType),
      );
      const street = plan.streets.find(
        (s) =>
          required(s.points[0]).y === required(s.points[1]).y &&
          required(s.points[0]).y > lot.anchor.y &&
          required(s.points[0]).y - s.width / 2 - s.sidewalk === block.bounds.maxY,
      );
      if (!street) throw new Error(`No sidewalk for ${lot.id}`);
      return doors.map((door) => {
        const threshold = {
          x: lot.anchor.x + door.dx / TILE_SIZE,
          y: lot.anchor.y + door.dy / TILE_SIZE,
        };
        const sidewalk = {
          x: threshold.x,
          y: required(street.points[0]).y - street.width / 2 - street.sidewalk,
        };
        return {
          lotId: lot.id,
          doorId: door.id,
          threshold,
          sidewalk,
          bounds: {
            minX: Math.floor(threshold.x - door.width / TILE_SIZE / 2),
            maxX: Math.ceil(threshold.x + door.width / TILE_SIZE / 2),
            minY: threshold.y - 1,
            maxY: sidewalk.y + 1,
          },
        };
      });
    }),
  );
  return {
    ...plan,
    recipe: "dense-district-v2",
    id: `${settlement.id}:dense-district-v2`,
    blocks,
    entrancePaths,
  };
}
