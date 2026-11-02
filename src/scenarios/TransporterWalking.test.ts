import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { SpatialHash } from "../entities/SpatialHash.js";
import { createMovementContext } from "../physics/SimulationEnvironment.js";
import { transporterLocal, transporterWorld } from "../traffic/CarTransporter.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { transporterSurfaceTops } from "../traffic/TransporterSurface.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { transporterRecipe } from "./TransporterRecipe.js";

it("uses continuous truck-local support and carries a deck passenger through turning", async () => {
  const s = await ScenarioSession.create({
    ...transporterRecipe(),
    parkedVehicles: required(transporterRecipe().parkedVehicles).filter(
      (v) => v.model === "car-transporter",
    ),
  });
  try {
    const truck = required(
      s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:car-transporter"),
    );
    truck.vehicleHeading = Math.PI / 4;
    s.realm.entityManager.spatialHash.update(truck);
    const p = s.player.player;
    p.position = transporterWorld(truck, -35, 0);
    p.wz = p.groundZ = 24.65;
    s.realm.entityManager.spatialHash.update(p);
    const before = transporterLocal(truck, p.position);
    // An actual second player drives; the first remains an ordinary standing rider.
    const driver = createPlayer(100, 100);
    s.realm.entityManager.spawn(driver);
    const state = required(s.realm.traffic?.states.get(truck.id));
    state.driverId = driver.id;
    for (let i = 0; i < 35; i++)
      s.realm.traffic?.drive(state, { dx: 1, dy: 0, sprinting: false }, 1 / 60);
    const after = transporterLocal(truck, p.position);
    expect(truck.position.wx).toBeGreaterThan(0);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
    expect(p.wz).toBeCloseTo(24.65, 2);
  } finally {
    await s.close();
  }
});

it("keeps the ramp gap open, indexes the overhang and blocks airborne/side entry", async () => {
  const s = await ScenarioSession.create({
    ...transporterRecipe(),
    parkedVehicles: required(transporterRecipe().parkedVehicles).filter(
      (v) => v.model === "car-transporter",
    ),
  });
  try {
    const truck = required(
      s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:car-transporter"),
    );
    truck.vehicleRamp = 1;
    const p = createPlayer(-120, 0),
      box = getEntityAABB(p.position, required(p.collider));
    expect(transporterSurfaceTops(truck, box)).toEqual([]);
    const hash = new SpatialHash();
    truck.position.wx = 330;
    hash.insert(truck);
    expect(hash.queryRange(0, -1, 0, 0)).toContain(truck);
    truck.position.wx = 0;
    const ctx = createMovementContext({
      movingEntity: p,
      queryEntities: () => [truck],
      queryProps: () => [],
      getCollision: () => 0,
      getHeight: () => 0,
      excludeIds: new Set([p.id]),
      noclip: false,
    });
    p.position = { wx: -40, wy: 40 };
    expect(ctx.isEntityBlocked(getEntityAABB({ wx: -40, wy: 0 }, required(p.collider)))).toBe(true);
    p.position = { wx: -120, wy: 16 };
    p.wz = 0;
    p.jumpVZ = 0;
    expect(ctx.isEntityBlocked(getEntityAABB(p.position, required(p.collider)))).toBe(true);
  } finally {
    await s.close();
  }
});

it("rejects stowing an occupied ramp and leaves an unrelated upper-floor player independent", async () => {
  const s = await ScenarioSession.create({
    ...transporterRecipe(),
    parkedVehicles: required(transporterRecipe().parkedVehicles).filter(
      (v) => v.model === "car-transporter",
    ),
  });
  try {
    const truck = required(
      s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:car-transporter"),
    );
    await s.command({ kind: "vehicle-transporter-action", entityId: truck.id, action: "deploy" });
    const other = createPlayer(-110, 16);
    other.wz = 15.5;
    s.realm.entityManager.spawn(other);
    await expect(
      s.command({ kind: "vehicle-transporter-action", entityId: truck.id, action: "stow" }),
    ).rejects.toThrow("Clear the loading ramp");
    other.wz = 96;
    expect(roofSupport(other, [truck])).toBeUndefined();
    await s.command({ kind: "vehicle-transporter-action", entityId: truck.id, action: "stow" });
    expect(truck.vehicleRamp).toBeUndefined();
  } finally {
    await s.close();
  }
});
