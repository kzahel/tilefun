import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createBall } from "../entities/Ball.js";
import { entityHeading } from "../rendering/EntityMeshPose.js";
import { PlayerSession } from "../server/PlayerSession.js";
import { path } from "../traffic/LaneGraph.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { bedHeading, bedLocalPoint, DUMP_BED } from "../traffic/VehicleBed.js";
import { bedContents } from "../traffic/VehicleCargo.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { truckBedRecipe } from "./TruckBedRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("keeps routed diagonal bed contacts aligned with the rendered mesh through stopping and reload", async () => {
  const recipe = truckBedRecipe();
  const lane = required(recipe.trafficLanes?.[0]);
  lane.path = path([
    { x: -512, y: 0 },
    { x: 0, y: 0 },
    { x: 512, y: 512 },
  ]);
  lane.b = { x: 512, y: 512 };
  recipe.roads = [{ left: -592, right: 592, top: -128, bottom: 592 }];
  const s = await ScenarioSession.create(recipe);
  try {
    let truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    await s.command({ kind: "vehicle-bed", action: "drive" });
    for (let i = 0; i < 90; i++) await s.step(idle);
    expect(bedHeading(truck)).toBeCloseTo(Math.PI / 4, 5);
    expect(bedHeading(truck)).toBeCloseTo(entityHeading(truck), 5);
    expect(s.player.player.wz).toBeCloseTo(DUMP_BED.floorZ);
    await s.command({ kind: "vehicle-bed", action: "stop" });
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(bedHeading(truck)).toBeCloseTo(Math.PI / 4, 5);
    await s.reload();
    truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    expect(bedHeading(truck)).toBeCloseTo(Math.PI / 4, 5);
    expect(roofSupport(s.player.player, [truck])?.id).toBe(truck.id);
  } finally {
    await s.close();
  }
}, 30000);
it.each([false, true])(
  "jumping in a moving bed does not block its truck (driven=%s)",
  async (driven) => {
    const s = await ScenarioSession.create(truckBedRecipe());
    try {
      const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
      let driver: PlayerSession | undefined;
      if (driven) {
        driver = new PlayerSession("jump-test-driver");
        driver.editorEnabled = false;
        await s.realm.addPlayer(driver);
        driver.player.position = { wx: 40, wy: 45 };
        driver.player.wz = driver.player.groundZ = 0;
        driver.visibleRange = { ...s.player.visibleRange };
        s.realm.entityManager.spatialHash.update(driver.player);
        s.realm.vehicles.enter(driver, truck.id);
      } else await s.command({ kind: "vehicle-bed", action: "drive" });
      const step = async (jump: boolean) => {
        if (driver) s.realm.vehicles.input(driver, { dx: 1, dy: 0 }, 1 / 60);
        await s.step({ ...idle, jump });
      };
      for (let i = 0; i < 180; i++) await step(false);
      const ball = s.realm.entityManager.spawn(
        createBall(truck.position.wx - 36, truck.position.wy - 7),
      );
      ball.wz = DUMP_BED.floorZ + 4;
      ball.jumpVZ = 20;
      ball.velocity = { ...(truck.velocity ?? { vx: 0, vy: 0 }) };
      const speed = () => Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0);
      const cruising = speed();
      expect(cruising).toBeGreaterThan(20);
      let slowest = cruising;
      for (let i = 0; i < 90; i++) {
        await step(i < 10);
        slowest = Math.min(slowest, speed());
      }
      expect(slowest).toBeGreaterThan(cruising * 0.95);
      expect(s.player.player.wz).toBeCloseTo(DUMP_BED.floorZ);
      expect(roofSupport(s.player.player, [truck])?.id).toBe(truck.id);
      expect(ball.wz).toBeCloseTo(DUMP_BED.floorZ);
    } finally {
      await s.close();
    }
  },
  30000,
);

it("still stops a driven bed wall from sweeping through an airborne occupant", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    const player = s.player.player;
    player.position = { wx: 4, wy: 3 };
    player.wz = DUMP_BED.floorZ + 5;
    player.jumpVZ = 1;
    s.realm.entityManager.spatialHash.update(player);
    const traffic = required(s.realm.traffic),
      state = required(traffic.states.get(truck.id));
    truck.velocity = { vx: -32, vy: 0 };
    for (let i = 0; i < 12; i++) traffic.drive(state, { dx: -1, dy: 0, reversing: true }, 1 / 60);
    expect(truck.position.wx).toBeGreaterThan(-4);
    expect(truck.velocity?.vx).toBe(0);
    expect(player.position).toEqual({ wx: 4, wy: 3 });
    expect(player.wz).toBe(DUMP_BED.floorZ + 5);
  } finally {
    await s.close();
  }
}, 30000);
it("loads real identities, carries and reloads them, and unloads without duplication", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    await s.command({ kind: "vehicle-bed", action: "outside" });
    const id = required(s.handles.truck);
    const action = (action: "board" | "leave" | "load" | "unload") =>
      s.command({ kind: "vehicle-bed-action", entityId: id, action });
    await action("load");
    await action("load");
    const truck = required(s.realm.entityManager.byId.get(id));
    const cargo = bedContents(truck, s.realm.entityManager.entities);
    expect(cargo).toHaveLength(2);
    const ids = cargo.map((e) => e.persistentId).sort();
    await action("board");
    expect(s.player.player.parentId).toBeUndefined();
    const offsets = cargo.map((e) => bedLocalPoint(truck, e.position));
    await s.command({ kind: "vehicle-bed", action: "drive" });
    for (let i = 0; i < 120; i++) await s.step(idle);
    expect(truck.position.wx).toBeGreaterThan(25);
    for (const [i, item] of cargo.entries()) {
      expect(bedLocalPoint(truck, item.position)).toEqual(offsets[i]);
      expect(item.wz).toBeCloseTo(DUMP_BED.floorZ, 5);
      expect(item.parentId).toBeUndefined();
      expect(item.deathTimer).toBeUndefined();
    }
    await s.command({ kind: "vehicle-bed", action: "stop" });
    for (let i = 0; i < 60; i++) await s.step(idle);
    await s.reload();
    const restoredTruck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    const restored = bedContents(restoredTruck, s.realm.entityManager.entities);
    expect(restored.map((e) => e.persistentId).sort()).toEqual(ids);
    expect(s.player.player.wz).toBeCloseTo(DUMP_BED.floorZ);
    const total = s.realm.entityManager.entities.length;
    await s.command({ kind: "vehicle-bed-action", entityId: restoredTruck.id, action: "unload" });
    await s.command({ kind: "vehicle-bed-action", entityId: restoredTruck.id, action: "unload" });
    expect(bedContents(restoredTruck, s.realm.entityManager.entities)).toHaveLength(0);
    expect(s.realm.entityManager.entities).toHaveLength(total);
    expect(restored.every((e) => e.wz === 0 && e.parentId === undefined)).toBe(true);
    await s.command({ kind: "vehicle-bed-action", entityId: restoredTruck.id, action: "leave" });
    expect(s.player.player.wz).toBe(0);
  } finally {
    await s.close();
  }
}, 30000);

it("normal editor placements and old saved dump trucks acquire the bed; other roofs do not", async () => {
  const recipe = truckBedRecipe();
  recipe.traffic = [];
  const s = await ScenarioSession.create(recipe);
  try {
    const placed = required(required(s.realm.traffic).place("dump-truck", 140, 0));
    expect(placed.entity.vehicleBed).toBe(true);
    const record = required(s.realm.traffic).snapshot(placed);
    record.persistentId = required(placed.entity.persistentId);
    record.originScope = "0,0";
    delete record.vehicleBed;
    s.realm.entityManager.remove(placed.entity.id, false);
    required(s.realm.traffic).restore([record]);
    expect(required([...required(s.realm.traffic).states.values()][0]).entity.vehicleBed).toBe(
      true,
    );
    const other = required(required(s.realm.traffic).place("pickup", -140, 0));
    expect(other.entity.vehicleBed).toBeUndefined();
  } finally {
    await s.close();
  }
}, 30000);

it("a second real player and cargo ride while another player drives, turns and brakes", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    const rider = s.player.player;
    const ball = s.realm.entityManager.spawn(createBall(-30, 8));
    ball.wz = ball.groundZ = DUMP_BED.floorZ;
    const driver = new PlayerSession("truck-driver");
    driver.editorEnabled = false;
    await s.realm.addPlayer(driver);
    driver.player.position = { wx: 40, wy: 45 };
    driver.player.wz = driver.player.groundZ = 0;
    driver.visibleRange = { ...s.player.visibleRange };
    s.realm.entityManager.spatialHash.update(driver.player);
    s.realm.vehicles.enter(driver, truck.id);
    const a = bedLocalPoint(truck, rider.position),
      b = bedLocalPoint(truck, ball.position);
    for (let i = 0; i < 160; i++) {
      s.realm.vehicles.input(driver, { dx: i < 60 ? 1 : 0.7, dy: i < 60 ? 0 : 0.7 }, 1 / 60);
      await s.step(idle);
    }
    expect(truck.vehicleHeading).toBeGreaterThan(0.2);
    expect(truck.position.wx).toBeGreaterThan(40);
    expect(bedLocalPoint(truck, rider.position).x).toBeCloseTo(a.x, 3);
    expect(bedLocalPoint(truck, rider.position).y).toBeCloseTo(a.y, 3);
    expect(bedLocalPoint(truck, ball.position).x).toBeCloseTo(b.x, 3);
    expect(bedLocalPoint(truck, ball.position).y).toBeCloseTo(b.y, 3);
    expect(roofSupport(rider, [truck])?.id).toBe(truck.id);
    expect(rider.parentId).toBeUndefined();
    expect(driver.player.parentId).toBe(truck.id);
    for (let i = 0; i < 60; i++) {
      s.realm.vehicles.input(driver, { dx: 0, dy: 0 }, 1 / 60);
      await s.step(idle);
    }
    expect(Math.hypot(truck.velocity?.vx ?? 0, truck.velocity?.vy ?? 0)).toBeLessThan(0.01);
  } finally {
    await s.close();
  }
}, 30000);

it("rejects moving, remote, occupied and animal-claimed loads without mutation", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    await s.command({ kind: "vehicle-bed", action: "outside" });
    const act = (action: "board" | "load") =>
      s.command({ kind: "vehicle-bed-action", entityId: truck.id, action });
    truck.velocity = { vx: 1, vy: 0 };
    await expect(act("board")).rejects.toThrow("stop");
    truck.velocity = { vx: 0, vy: 0 };
    s.player.player.position.wx = 600;
    await expect(act("load")).rejects.toThrow("Stand beside");
    await s.command({ kind: "vehicle-bed", action: "outside" });
    const ceiling = s.realm.propManager.add({
      id: 0,
      type: "cargo-test-ceiling",
      isProp: true,
      position: { wx: -20, wy: 0 },
      sprite: { sheetKey: "", frameCol: 0, frameRow: 0, spriteWidth: 0, spriteHeight: 0 },
      collider: { offsetX: 0, offsetY: 30, width: 100, height: 60, zBase: 38, zHeight: 3 },
      walls: null,
    });
    await expect(act("board")).rejects.toThrow("No clear space");
    s.realm.propManager.remove(ceiling.id);
    for (const e of s.realm.entityManager.entities.filter((e) => e.type === "ball" || e.workItem))
      s.realm.entityManager.remove(e.id);
    const fruit = s.realm.entityManager.spawn(createForageItem("fruit", -20, 48));
    required(fruit.workItem).claimedBy = "another-animal";
    await expect(act("load")).rejects.toThrow("Bring a loose");
    expect(fruit.position).toEqual({ wx: -20, wy: 48 });
    for (const x of [-16, 0, 16])
      for (const y of [-7, 7]) {
        const item = s.realm.entityManager.spawn(
          createForageItem("fruit", DUMP_BED.center.x + x, y + 2.5),
        );
        item.wz = DUMP_BED.floorZ;
      }
    await expect(act("board")).rejects.toThrow("No clear space");
    expect(s.player.player.wz).toBe(0);
  } finally {
    await s.close();
  }
}, 30000);

it("a thrown ball lands on the floor, rebounds off a tub wall and falls after support removal", async () => {
  const s = await ScenarioSession.create(truckBedRecipe());
  try {
    await s.command({ kind: "vehicle-bed", action: "outside" });
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    const ball = s.realm.entityManager.spawn(createBall(-30, 0));
    ball.wz = DUMP_BED.floorZ + 12;
    ball.jumpVZ = -10;
    for (let i = 0; i < 90; i++) await s.step(idle);
    expect(ball.wz).toBeCloseTo(DUMP_BED.floorZ);
    expect(ball.jumpVZ).toBeUndefined();
    ball.velocity = { vx: -80, vy: 0 };
    for (let i = 0; i < 30; i++) await s.step(idle);
    expect(ball.position.wx).toBeGreaterThan(-53);
    expect(required(ball.velocity).vx).toBeGreaterThan(0);
    s.realm.entityManager.remove(truck.id);
    await s.step(idle);
    expect(ball.wz).toBeCloseTo(DUMP_BED.floorZ);
    expect(ball.jumpVZ).toBe(0);
    for (let i = 0; i < 90; i++) await s.step(idle);
    expect(ball.wz).toBeCloseTo(0);
  } finally {
    await s.close();
  }
}, 30000);
