import { expect, it } from "vitest";
import { runEquipment } from "../server/EquipmentControl.js";
import { required } from "../shared/required.js";
import { insideDumpBed } from "../traffic/DumpBed.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { vehicleDynamicsRecipe } from "./VehicleDynamicsRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("keeps resting bed cargo in reach of the player and discharges it when tipped", async () => {
  const s = await ScenarioSession.create(vehicleDynamicsRecipe("compact-1", "bed"));
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    // Longer than the ordinary resting-ball cleanup: bed cargo is kept.
    for (let i = 0; i < 240; i++) await s.step(idle);
    const balls = s.realm.entityManager.entities.filter((e) => e.type === "ball");
    expect(balls.filter((ball) => insideDumpBed(truck, ball, truck.vehicleHeading))).toHaveLength(
      3,
    );
    runEquipment(s.realm.vehicles, s.player, { entityId: truck.id, action: "tip" });
    for (let i = 0; i < 360; i++) await s.step(idle);
    expect(balls.some((ball) => insideDumpBed(truck, ball, truck.vehicleHeading))).toBe(false);
  } finally {
    await s.close();
  }
});

function handle(s: ScenarioSession, name: string) {
  return required(s.realm.entityManager.byId.get(required(s.handles[name])));
}
const drive = (dx: number) => ({ ...idle, dx });

it("attaches, tows, reloads and releases a car with the ordinary tow truck controls", async () => {
  const s = await ScenarioSession.create(vehicleDynamicsRecipe("compact-1", "tow"));
  try {
    for (let i = 0; i < 30; i++) await s.step(idle);
    let truck = handle(s, "tow-truck");
    const car = handle(s, "tow-car");
    runEquipment(s.realm.vehicles, s.player, { entityId: truck.id, action: "attach" });
    expect(truck.towTargetId).toBe(car.id);
    expect(car.towedBy).toBe(truck.id);
    expect(() => s.realm.vehicles.enter(s.player, car.id)).toThrow(/Release/);
    s.realm.vehicles.enter(s.player, truck.id);
    const start = car.position.wx;
    for (let i = 0; i < 90; i++) await s.step(drive(1));
    expect(car.position.wx - start).toBeGreaterThan(40);
    s.realm.vehicles.exit(s.player);
    for (let i = 0; i < 60; i++) await s.step(idle);
    await s.reload();
    truck = handle(s, "tow-truck");
    for (let i = 0; i < 2; i++) await s.step(idle);
    const reloaded = required(s.realm.entityManager.byId.get(required(truck.towTargetId)));
    expect(reloaded.proceduralId).toBe(car.proceduralId);
    expect(reloaded.towedBy).toBe(truck.id);
    const [x, y] = [truck.position.wx, truck.position.wy + 30];
    await s.command({ kind: "teleport", position: { wx: x, wy: y } });
    runEquipment(s.realm.vehicles, s.player, { entityId: truck.id, action: "release" });
    expect(truck.towTargetId).toBeUndefined();
    expect(reloaded.towedBy).toBeUndefined();
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(Math.abs(reloaded.wz ?? 0)).toBeLessThan(1);
  } finally {
    await s.close();
  }
});

it("loads, secures, carries and unloads a car on the transporter", async () => {
  const s = await ScenarioSession.create(vehicleDynamicsRecipe("compact-1", "transport"));
  try {
    for (let i = 0; i < 30; i++) await s.step(idle);
    const truck = handle(s, "transporter"),
      beetle = handle(s, "beetle");
    await s.command({ kind: "teleport", position: { wx: 340, wy: 274 } });
    runEquipment(s.realm.vehicles, s.player, { entityId: truck.id, action: "deploy" });
    expect(truck.vehicleRamp).toBe(1);
    await s.command({ kind: "teleport", position: { wx: 150, wy: 262 } });
    s.realm.vehicles.enter(s.player, beetle.id);
    for (let i = 0; i < 360 && beetle.position.wx < truck.position.wx - 24; i++)
      await s.step(drive(1));
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect((beetle.wz ?? 0) - (truck.wz ?? 0)).toBeGreaterThan(20);
    s.realm.vehicles.exit(s.player);
    for (let i = 0; i < 30; i++) await s.step(idle);
    await s.command({ kind: "teleport", position: { wx: 340, wy: 274 } });
    runEquipment(s.realm.vehicles, s.player, { entityId: truck.id, action: "stow" });
    expect(truck.vehicleRamp).toBeUndefined();
    expect(truck.transportLoadId).toBe(beetle.id);
    s.realm.vehicles.enter(s.player, truck.id);
    const start = truck.position.wx;
    for (let i = 0; i < 90; i++) await s.step(drive(-1));
    expect(start - truck.position.wx).toBeGreaterThan(30);
    expect((beetle.wz ?? 0) - (truck.wz ?? 0)).toBeGreaterThan(20);
    for (let i = 0; i < 90; i++) await s.step(idle);
    runEquipment(s.realm.vehicles, s.player, { entityId: truck.id, action: "deploy" });
    expect(truck.transportLoadId).toBeUndefined();
    expect(beetle.transportedBy).toBeUndefined();
  } finally {
    await s.close();
  }
});
