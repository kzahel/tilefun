import { expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../rendering/AuthoredVehicleMeshes.js";
import { createVehicle } from "./Vehicle.js";
import {
  bedOccludesPoint,
  bedWorldPoint,
  DUMP_BED,
  entitySupportTops,
  vehicleBedBlocks,
} from "./VehicleBed.js";

it("keeps floor support and wall rejection through yaw, including non-cardinal poses", () => {
  expect(authoredVehicleForType("vehicle-v1:dump-truck")?.lateralScale).toBe(1);
  expect(vehicleMeshHeightScale("dump-truck")).toBe(1);
  const truck = createVehicle("dump-truck", 81, -33, Direction.Right);
  truck.vehicleBed = true;
  const player = createPlayer(0, 0);
  if (!player.collider) throw new Error("Missing player body");
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
    truck.vehicleHeading = heading;
    player.position = bedWorldPoint(truck, DUMP_BED.center.x, 0);
    player.position.wy += 3;
    const foot = getEntityAABB(player.position, player.collider);
    expect(vehicleBedBlocks(truck, foot, DUMP_BED.floorZ, 12), `free bed at ${heading}`).toBe(
      false,
    );
    expect(entitySupportTops(truck, foot)).toContain(DUMP_BED.floorZ);
    player.position = bedWorldPoint(truck, DUMP_BED.center.x, 18);
    expect(
      vehicleBedBlocks(truck, getEntityAABB(player.position, player.collider), DUMP_BED.floorZ, 12),
      `side wall at ${heading}`,
    ).toBe(true);
  }
});

it("the fallback ray hides a lower body behind the near wall and leaves its head visible", () => {
  const truck = createVehicle("dump-truck", 0, 0, Direction.Right);
  truck.vehicleBed = true;
  expect(bedOccludesPoint(truck, DUMP_BED.center.x, 12, DUMP_BED.floorZ + 2)).toBe(true);
  expect(bedOccludesPoint(truck, DUMP_BED.center.x, 12, DUMP_BED.floorZ + 24)).toBe(false);
  expect(bedOccludesPoint(truck, -90, 0, 10)).toBe(false);
});
