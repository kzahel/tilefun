import { expect, it } from "vitest";
import { createCurveTrain } from "../railway/CurveTrain.js";
import { RailAlignment } from "../railway/RailPath.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { authoredTrainForType } from "./AuthoredTrainMeshes.js";
import { EntityMeshPose, meshAssetFor } from "./EntityMeshPose.js";

it("keeps the live and allcars train sprite paths unchanged; inspection has three physical identities", () => {
  const types = ["train-curve-proof-v1:rear", "train-curve-proof-v1", "train-curve-proof-v1:front"];
  for (const [i, type] of types.entries()) {
    expect(meshAssetFor({ type })).toBeUndefined();
    expect(meshAssetFor({ type }, true)).toBeUndefined();
    expect(meshAssetFor({ type }, false, true)).toBe(
      `train-blue-${["rear", "middle", "front"][i]}-authored-v3`,
    );
  }
  expect(authoredTrainForType("train-local-v1")).toBeUndefined();
});

it("reverses signed wheel travel while retaining the physical end orientation and simulation", () => {
  const path = curvedTrainRecipe().railways?.[0]?.path;
  if (!path) throw Error("Missing train fixture");
  const cars = createCurveTrain(new RailAlignment(path), 200);
  const train = cars[2];
  if (!train) throw Error("Missing front carriage");
  train.id = 3;
  train.velocity = { vx: 10, vy: 0 };
  const poses = new EntityMeshPose(false, true);
  const first = poses.evaluate(train, 1);
  if (!first) throw Error("Missing inspection pose");
  train.position.wx += 4;
  const before = structuredClone(train);
  expect(poses.evaluate(train, 1.1)?.wheelTravel).toBeCloseTo(4);
  expect(train).toEqual(before);
  const orientation = [...first.orientation] as const;
  train.velocity.vx = -10;
  train.position.wx -= 3;
  poses.evaluate(train, 1.2);
  expect(first.wheelTravel).toBeCloseTo(1);
  expect(
    Math.abs(first.orientation[2] * orientation[2] + first.orientation[3] * orientation[3]),
  ).toBeCloseTo(1);
  train.position.wx += 1000;
  poses.evaluate(train, 1.3);
  expect(first.wheelTravel).toBeCloseTo(1);
  poses.retain([]);
  expect(poses.evaluate(train, 1.4)?.wheelTravel).toBe(0);
});

it("uses independent continuous curve tangents and preserves them when velocity reverses", () => {
  const path = curvedTrainRecipe().railways?.[0]?.path;
  if (!path) throw Error("Missing train fixture");
  const cars = createCurveTrain(new RailAlignment(path), 900);
  const poses = new EntityMeshPose(false, true);
  const orientations = cars.map((car, i) => {
    car.id = i + 1;
    const angle = ((car.sprite?.frameRow ?? 0) * Math.PI) / 128;
    car.velocity = { vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10 };
    const q = poses.evaluate(car, 1)?.orientation;
    return q ? [...q] : undefined;
  });
  expect(new Set(orientations.map((q) => JSON.stringify(q))).size).toBeGreaterThan(1);
  cars.forEach((car, i) => {
    if (!car.velocity) throw Error("Missing velocity");
    car.velocity.vx *= -1;
    car.velocity.vy *= -1;
    const q = poses.evaluate(car, 1.1)?.orientation;
    expect(
      Math.abs(
        (q?.[2] ?? 0) * (orientations[i]?.[2] ?? 0) + (q?.[3] ?? 0) * (orientations[i]?.[3] ?? 0),
      ),
    ).toBeCloseTo(1);
  });
});
