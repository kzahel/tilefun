import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import {
  bedOccludesPoint,
  bedPartMoves,
  bedPartVertices,
  DUMP_BED,
} from "../rendering/DumpBedPose.js";
import { createVehicle } from "../traffic/Vehicle.js";

it("keeps all six conservative tire clips fixed while the tub articulates", () => {
  const truck = { ...createVehicle("dump-truck", 0, 0, Direction.Right), vehicleBedTilt: 0 };
  const fixed = DUMP_BED.parts.filter((p) => !bedPartMoves(p));
  expect(fixed.filter((p) => p.name.startsWith("wheel-"))).toHaveLength(6);
  const before = fixed.map((p) => bedPartVertices(truck, p));
  truck.vehicleBedTilt = DUMP_BED.maxTilt;
  expect(fixed.map((p) => bedPartVertices(truck, p))).toEqual(before);
});

it("the fallback ray hides a lower body behind the near wall and leaves its head visible", () => {
  const truck = { ...createVehicle("dump-truck", 0, 0, Direction.Right), vehicleBedTilt: 0 };
  expect(bedOccludesPoint(truck, DUMP_BED.center.x, 12, DUMP_BED.floorZ + 2)).toBe(true);
  expect(bedOccludesPoint(truck, DUMP_BED.center.x, 12, DUMP_BED.floorZ + 24)).toBe(false);
  expect(bedOccludesPoint(truck, -90, 0, 10)).toBe(false);
});
