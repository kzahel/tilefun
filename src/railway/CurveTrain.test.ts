import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { CURVE_TYPES, createCurveTrain, curveTrainView } from "./CurveTrain.js";
import { railAlignment } from "./RailPath.js";

it("selects untouched native ends and middles in each cardinal orientation", () => {
  const expected = [
    ["Exterior_Train_Blue_Left", "Exterior_Train_Blue_Middle", "Exterior_Train_Blue_Right"],
    ["Train_Blue_Back_Down", "Train_Blue_Middle_Down", "Train_Blue_Front_Down"],
    ["Exterior_Train_Blue_Right", "Exterior_Train_Blue_Middle", "Exterior_Train_Blue_Left"],
    ["Train_Blue_Front_Down", "Train_Blue_Middle_Down", "Train_Blue_Back_Down"],
  ];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    expect(CURVE_TYPES.map((t) => curveTrainView(t, quadrant * 64)?.name)).toEqual(
      expected[quadrant],
    );
  }
  const middle = required(CURVE_TYPES[1]);
  expect(curveTrainView(middle, 31)?.vertical).toBe(false);
  expect(curveTrainView(middle, 32)?.vertical).toBe(true);
  expect(curveTrainView(middle, 223)?.vertical).toBe(true);
  expect(curveTrainView(middle, 224)?.vertical).toBe(false);
  expect(curveTrainView(middle, 0)).toMatchObject({ x: 0, y: 105, width: 160, height: 62 });
  expect(curveTrainView(middle, 64)).toMatchObject({ x: 395, y: 104, width: 41, height: 112 });
});
it("assembles at native size on all four straight sections and restores each distinct body", () => {
  const path = required(curvedTrainRecipe().railways?.[0]?.path),
    a = railAlignment(path);
  for (const stop of path.stops) {
    const cars = createCurveTrain(a, stop.distance);
    for (const car of cars) {
      const restored = deserializeEntity(serializeEntity(car));
      expect(restored.type).toBe(car.type);
      expect(restored.sprite?.sheetKey).toBe(car.type);
      expect(restored.collider).toEqual(car.collider);
    }
    const vertical = Math.abs(Math.sin(a.sample(stop.distance).angle)) > 0.5;
    const bounds = cars
      .map((c) => getEntityAABB(c.position, required(c.collider)))
      .sort((p, q) => (vertical ? p.top - q.top : p.left - q.left));
    for (let i = 1; i < bounds.length; i++) {
      expect(vertical ? required(bounds[i]).top : required(bounds[i]).left).toBeCloseTo(
        vertical ? required(bounds[i - 1]).bottom : required(bounds[i - 1]).right,
        5,
      );
    }
  }
});
