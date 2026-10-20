import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import { PlayerSession } from "../server/PlayerSession.js";
import {
  bedFloorSupport,
  bedLocalPoint,
  bedVisualOwner,
  bedWorldPoint,
  DUMP_BED,
  vehicleBedBlocks,
} from "../traffic/VehicleBed.js";
import { bedContents } from "../traffic/VehicleCargo.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { truckBedRecipe } from "./TruckBedRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("keeps a diagonal bed rider and loose food supported across a chunk seam", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    required(s.realm.traffic?.states.get(truck.id)).parked = true;
    truck.position = { wx: 128, wy: 280 };
    truck.vehicleHeading = Math.PI / 4;
    const p = s.player.player,
      point = bedWorldPoint(truck, -42, -2);
    p.position = { wx: point.wx, wy: point.wy + 3 };
    p.wz = p.groundZ = DUMP_BED.floorZ;
    const food = s.realm.entityManager.spawn(createForageItem("fruit", 0, 0));
    const anchor = bedWorldPoint(truck, -36, -7);
    food.position = { wx: anchor.wx, wy: anchor.wy + 2.5 };
    food.wz = food.groundZ = DUMP_BED.floorZ;
    for (const e of [truck, p, food]) s.realm.entityManager.spatialHash.update(e);
    expect(bedVisualOwner(p, [truck])?.id).toBe(truck.id);
    for (let i = 0; i < 20; i++) await s.step(idle);
    expect(food.wz).toBeCloseTo(DUMP_BED.floorZ);
    expect(food.jumpVZ).toBeUndefined();
    expect(p.wz).toBeCloseTo(DUMP_BED.floorZ);
  } finally {
    await s.close();
  }
}, 30000);
it.each([Direction.Right, Direction.Down, Direction.Left, Direction.Up])(
  "tips and discharges real cargo and an upright rider at heading %s",
  async (direction) => {
    const s = await ScenarioSession.create(truckBedRecipe(direction));
    try {
      await s.command({ kind: "vehicle-bed", action: "outside" });
      let truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
      const command = (action: "load" | "board" | "tip" | "lower") =>
        s.command({ kind: "vehicle-bed-action", entityId: truck.id, action });
      await command("load");
      await command("load");
      await command("board");
      const cargo = bedContents(truck, s.realm.entityManager.entities),
        ids = cargo.map((e) => e.persistentId);
      expect(cargo).toHaveLength(2);
      await command("tip");
      let highest = 0;
      for (let i = 0; i < 95; i++) {
        await s.step(idle);
        highest = Math.max(highest, s.player.player.wz ?? 0);
      }
      expect(truck.vehicleBedTilt).toBeGreaterThan(0.3);
      // Reload while moving, before discharge completes: target, pose, IDs survive.
      const tilt = truck.vehicleBedTilt;
      await s.reload();
      truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
      expect(truck.vehicleBedTilt).toBe(tilt);
      expect(truck.vehicleBedTarget).toBeCloseTo(DUMP_BED.maxTilt);
      for (let i = 0; i < 220; i++) await s.step(idle);
      expect(truck.vehicleBedTilt).toBeCloseTo(DUMP_BED.maxTilt);
      expect(highest).toBeGreaterThan(DUMP_BED.floorZ + 3);
      expect(bedContents(truck, s.realm.entityManager.entities)).toHaveLength(0);
      for (const pid of ids) {
        const actor = required(s.realm.entityManager.entities.find((e) => e.persistentId === pid));
        expect(actor.parentId).toBeUndefined();
        expect(actor.wz, actor.type).toBeCloseTo(0);
        expect(bedLocalPoint(truck, actor.position).x).toBeLessThan(-56);
        expect(actor.jumpVZ).toBeUndefined();
      }
      const p = s.player.player;
      expect(p.parentId).toBeUndefined();
      expect(p.wz).toBeCloseTo(0);
      const body = getEntityAABB(p.position, required(p.collider));
      expect(
        bedLocalPoint(truck, { wx: (body.left + body.right) / 2, wy: (body.top + body.bottom) / 2 })
          .x,
      ).toBeLessThan(-56);
      await s.reload();
      truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
      const fruit = required(
        s.realm.entityManager.entities.find((e) => e.type === "wildlife-resource-fruit-v1"),
      );
      expect(ids).toContain(fruit.persistentId);
      expect(fruit.wz).toBe(0);
      // Stand alongside to lower through normal controls, then drive again.
      await s.command({ kind: "vehicle-bed", action: "outside" });
      await command("lower");
      for (let i = 0; i < 200; i++) await s.step(idle);
      expect(truck.vehicleBedTilt).toBeUndefined();
      expect(truck.vehicleBedTarget).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  30000,
);

it("stops equipment before an external ceiling and resumes after it is cleared", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    const ceiling = s.realm.propManager.add({
      id: 0,
      type: "tip-clearance",
      isProp: true,
      position: { wx: -8, wy: 0 },
      sprite: { sheetKey: "", frameCol: 0, frameRow: 0, spriteWidth: 0, spriteHeight: 0 },
      collider: { offsetX: 0, offsetY: 30, width: 24, height: 60, zBase: 57, zHeight: 2 },
      walls: null,
    });
    await s.command({ kind: "vehicle-bed-action", entityId: truck.id, action: "tip" });
    for (let i = 0; i < 160; i++) await s.step(idle);
    const stopped = truck.vehicleBedTilt ?? 0;
    expect(stopped).toBeGreaterThan(0.01);
    expect(stopped).toBeLessThan(0.4);
    for (let i = 0; i < 20; i++) await s.step(idle);
    expect(truck.vehicleBedTilt).toBe(stopped);
    s.realm.propManager.remove(ceiling.id);
    for (let i = 0; i < 210; i++) await s.step(idle);
    expect(truck.vehicleBedTilt).toBeCloseTo(DUMP_BED.maxTilt);
  } finally {
    await s.close();
  }
}, 30000);

it("allows an independent person to walk uphill and jump from an inclined floor", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck))),
      p = s.player.player;
    truck.vehicleBedTilt = truck.vehicleBedTarget = 0.25;
    p.wz = p.groundZ = required(
      bedFloorSupport(truck, getEntityAABB(p.position, required(p.collider))),
    );
    const x = p.position.wx,
      z = p.wz;
    const y = p.position.wy;
    for (let i = 0; i < 10; i++) await s.step({ ...idle, dx: 1, dy: 1 });
    expect(p.position.wx).toBeGreaterThan(x + 1);
    expect(p.position.wy).toBeGreaterThan(y + 1);
    expect(p.wz).toBeGreaterThan(z);
    const floor = p.wz ?? 0;
    for (let i = 0; i < 10; i++) await s.step({ ...idle, jump: i < 4 });
    expect(p.wz).toBeGreaterThan(floor + 5);
    expect(p.parentId).toBeUndefined();
  } finally {
    await s.close();
  }
}, 30000);

it("requires a nearby stopped operator and prevents driving until the bed is level", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    const driver = new PlayerSession("tip-driver");
    driver.editorEnabled = false;
    await s.realm.addPlayer(driver);
    driver.player.position = { wx: 30, wy: 40 };
    driver.player.wz = driver.player.groundZ = 0;
    driver.visibleRange = { ...s.player.visibleRange };
    s.realm.entityManager.spatialHash.update(driver.player);
    s.realm.vehicles.enter(driver, truck.id);
    s.realm.vehicles.bed(driver, truck.id, "tip");
    const start = { ...truck.position };
    for (let i = 0; i < 60; i++) {
      s.realm.vehicles.input(driver, { dx: 1, dy: 0 }, 1 / 60);
      await s.step(idle);
    }
    expect(truck.position).toEqual(start);
    expect(truck.vehicleBedTilt).toBeGreaterThan(0.2);
    const floor = bedFloorSupport(
      truck,
      getEntityAABB(s.player.player.position, required(s.player.player.collider)),
    );
    expect(floor).toBeCloseTo(s.player.player.wz ?? 0);
    expect(
      vehicleBedBlocks(
        truck,
        getEntityAABB(s.player.player.position, required(s.player.player.collider)),
        s.player.player.wz ?? 0,
        12,
      ),
    ).toBe(false);
    expect(() => s.realm.vehicles.bed(s.player, truck.id, "load")).toThrow(/Lower/);
    s.realm.vehicles.bed(driver, truck.id, "lower");
    for (let i = 0; i < 90; i++) await s.step(idle);
    s.realm.vehicles.input(driver, { dx: 1, dy: 0 }, 1 / 60);
    expect(truck.position.wx).toBeGreaterThan(start.wx);
  } finally {
    await s.close();
  }
}, 30000);
