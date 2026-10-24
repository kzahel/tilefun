import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { RacetrackSource } from "../generation/regional/RacetrackPlanner.js";
import { vehicleDepot } from "../generation/regional/VehicleDepotPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { drivenCarPose } from "../traffic/Driving.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { ScenarioSession } from "./ScenarioSession.js";

it("populates seven real parked vehicles, drives the bridge and persists moved/deleted identities", async () => {
  const depot = vehicleDepot(required(new RacetrackSource(regionalWorld(2026)).owner(0, 0)));
  const range = {
    minCx: Math.floor(depot.bounds.minX / 16),
    minCy: Math.floor(depot.bounds.minY / 16),
    maxCx: Math.floor(depot.bounds.maxX / 16),
    maxCy: Math.floor(depot.bounds.maxY / 16),
  };
  const s = await ScenarioSession.create({
    version: 1,
    id: "generated-depot",
    generation: createDescriptor("regional", 2026),
    player: createPlayer(depot.arrival.x * 16, depot.arrival.y * 16),
    props: [],
  });
  const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
  try {
    await s.step(idle, 1 / 60, range);
    const cars = () =>
      s.realm.entityManager.entities.filter((e) =>
        e.proceduralId?.startsWith(`placed-vehicle-v1:${depot.id}:`),
      );
    expect(cars()).toHaveLength(7);
    expect(cars().every((e) => s.realm.traffic?.states.get(e.id)?.parked)).toBe(true);
    const underpass = { wx: (depot.center.x + 13) * 16, wy: (depot.center.y - 8) * 16 };
    const clearanceProbe = (model: string) => {
      const e = createVehicle(model, underpass.wx, underpass.wy, Direction.Down);
      e.id = -1;
      return drivenCarPose(
        e,
        { dx: 0, dy: 0 },
        1 / 60,
        s.realm.world,
        s.realm.propManager.props,
        [],
      );
    };
    expect(clearanceProbe("beetle")).toBeDefined();
    expect(clearanceProbe("dump-truck")).toBeUndefined();
    const sport = required(cars().find((e) => e.type === "vehicle-v1:rosso-coupe"));
    const identity = sport.proceduralId;
    await s.command({
      kind: "teleport",
      position: { wx: sport.position.wx, wy: sport.position.wy + 40 },
    });
    await s.command({ kind: "enter-vehicle", entityId: sport.id });
    let peak = 0;
    for (let i = 0; i < 400 && sport.position.wx < (depot.center.x + 27) * 16; i++) {
      await s.step({ ...idle, dx: 1, sprinting: true }, 1 / 60, range);
      peak = Math.max(peak, sport.wz ?? 0);
    }

    expect(peak).toBeCloseTo(48, 2);
    expect(sport.position.wx).toBeGreaterThan((depot.center.x + 26) * 16);
    for (let i = 0; i < 20; i++) await s.step(idle, 1 / 60, range);
    await s.command({ kind: "exit-vehicle" });
    const movedX = sport.position.wx;
    const deleted = required(
      cars().find((e) => e.proceduralId === `placed-vehicle-v1:${depot.id}:tow-car`),
    );
    s.realm.entityManager.remove(deleted.id);
    await s.reload();
    await s.step(idle, 1 / 60, range);
    const restored = required(cars().find((e) => e.proceduralId === identity));
    expect(restored.position.wx).toBeCloseTo(movedX, 2);
    expect(cars().filter((e) => e.proceduralId === identity)).toHaveLength(1);
    expect(cars().some((e) => e.proceduralId === deleted.proceduralId)).toBe(false);
  } finally {
    await s.close();
  }
}, 30000);
