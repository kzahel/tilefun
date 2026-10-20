import { expect, it } from "vitest";
import { CollisionIndex } from "../entities/CollisionIndex.js";
import { getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { SpatialHash } from "../entities/SpatialHash.js";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../rendering/AuthoredVehicleMeshes.js";
import { createVehicle } from "./Vehicle.js";
import {
  bedOccludesPoint,
  bedPartMoves,
  bedPartVertices,
  bedQueryBounds,
  bedWorldPoint,
  DUMP_BED,
  entitySupportTops,
  vehicleBedBlocks,
  vehicleBedMovementBlocks,
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

it("keeps the shared default body height for colliders without an explicit height", () => {
  const truck = createVehicle("dump-truck", 0, 0, Direction.Right);
  const actor = createPlayer(0, 18);
  actor.wz = 10;
  actor.collider = { offsetX: 0, offsetY: 1, width: 2, height: 2, solid: true };
  expect(
    vehicleBedMovementBlocks(truck, getEntityAABB(actor.position, actor.collider), actor),
  ).toBe(false);
});

it("indexes diagonal and articulated bed extents independently of the unchanged road body", () => {
  const truck = createVehicle("dump-truck", 128, 280, Direction.Right);
  truck.id = 12;
  truck.vehicleHeading = Math.PI / 4;
  const box = { left: 100, right: 104, top: 248, bottom: 252 };
  const sparse = new SpatialHash();
  sparse.insert(truck);
  expect(sparse.queryRange(0, 0, 0, 0)).toContain(truck);
  const dense = new CollisionIndex();
  dense.rebuild([truck]);
  expect(dense.query(box)).toContain(truck);
  expect(truck.collider?.height).toBe(46);
  const before = { ...bedQueryBounds(truck) };
  truck.vehicleBedTilt = DUMP_BED.maxTilt;
  sparse.update(truck);
  dense.update(truck);
  const after = bedQueryBounds(truck);
  expect(after.top).toBeLessThan(before.top);
  expect(truck.collider?.height).toBe(46);
});

it("keeps all six conservative tire clips fixed while the tub articulates", () => {
  const truck = createVehicle("dump-truck", 0, 0, Direction.Right);
  const fixed = DUMP_BED.parts.filter((p) => !bedPartMoves(p));
  expect(fixed.filter((p) => p.name.startsWith("wheel-"))).toHaveLength(6);
  const before = fixed.map((p) => bedPartVertices(truck, p));
  truck.vehicleBedTilt = DUMP_BED.maxTilt;
  expect(fixed.map((p) => bedPartVertices(truck, p))).toEqual(before);
  for (const x of [40, (-1.12 * 400) / 23, (-2.4 * 400) / 23])
    for (const y of [(-1.04 * 400) / 23, (1.04 * 400) / 23])
      expect(
        vehicleBedBlocks(truck, { left: x - 1, right: x + 1, top: y - 1, bottom: y + 1 }, 0, 12),
      ).toBe(true);
});

it("the fallback ray hides a lower body behind the near wall and leaves its head visible", () => {
  const truck = createVehicle("dump-truck", 0, 0, Direction.Right);
  truck.vehicleBed = true;
  expect(bedOccludesPoint(truck, DUMP_BED.center.x, 12, DUMP_BED.floorZ + 2)).toBe(true);
  expect(bedOccludesPoint(truck, DUMP_BED.center.x, 12, DUMP_BED.floorZ + 24)).toBe(false);
  expect(bedOccludesPoint(truck, -90, 0, 10)).toBe(false);
});
