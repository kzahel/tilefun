import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { Camera } from "../rendering/Camera.js";
import { collectScene } from "../rendering/collectScene.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { commitVehiclePushes, planVehiclePushes } from "../traffic/VehiclePush.js";
import { World } from "../world/World.js";
import { createFauna } from "./Fauna.js";
import { createFrog, FROG_TYPE } from "./Frog.js";
import { createRabbit } from "./Rabbit.js";
import {
  canBecomeRoadkill,
  createRoadkill,
  isRoadkill,
  isSmallAnimal,
  ROADKILL_SCALE_Y,
  roadkillType,
} from "./Roadkill.js";

function fixture() {
  const world = new World(new FlatStrategy());
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) world.getChunk(x, y);
  const manager = new EntityManager();
  const car = manager.spawn(createVehicle("compact-1", 0, 0, Direction.Right));
  car.collider = { offsetX: 0, offsetY: 0, width: 20, height: 20, physicalHeight: 24 };
  const frog = manager.spawn(createFrog(13, -2));
  const after = { ...car, position: { wx: 2, wy: 0 } };
  const plan = () =>
    planVehiclePushes(
      [{ before: car, after }],
      1 / 60,
      { pushSpeed: 40, pushWeight: 80 },
      world,
      [],
      manager.entities,
    );
  return { world, manager, car, after, frog, plan };
}
it("registers all small species/variants and inert remains without making pets or big animals vulnerable", () => {
  const types = Object.keys(ENTITY_DEFS).filter(isSmallAnimal);
  expect(types).toContain(FROG_TYPE);
  expect(types).toEqual(
    expect.arrayContaining([
      "pigeon",
      "pigeon2",
      "chicken",
      "crow",
      "seagull",
      "wildlife-chicken-provisional-v1",
      "wildlife-pigeon-provisional-v1",
    ]),
  );
  expect(types).toHaveLength(12);
  for (const type of types) {
    const factory = required(ENTITY_FACTORIES[roadkillType(type)]);
    const remains = factory(10, 20);
    expect(isRoadkill(remains.type)).toBe(true);
    expect(remains.collider).toBeNull();
    expect(remains.wanderAI).toBeNull();
    expect(remains.velocity).toBeNull();
  }
  for (const animal of [
    createPlayer(0, 0),
    createFauna("cat", 0, 0),
    createFauna("dog", 0, 0),
    createFauna("cow", 0, 0),
  ])
    expect(canBecomeRoadkill(animal)).toBe(false);
});
it.each(Object.keys(ENTITY_FACTORIES).filter(isSmallAnimal))(
  "runs over every eligible species/variant: %s",
  (type) => {
    const f = fixture();
    f.manager.remove(f.frog.id);
    const animal = required(ENTITY_FACTORIES[type])(0, 0);
    const collider = required(animal.collider);
    animal.position = {
      wx: 10 + collider.width / 2 - collider.offsetX,
      wy: -10 + collider.height / 2 - collider.offsetY,
    };
    f.manager.spawn(animal);
    const plan = required(f.plan());
    expect(plan.some((p) => p.entity.id === animal.id && p.roadkill)).toBe(true);
    commitVehiclePushes(plan, f.manager);
    expect(f.manager.entities.some((e) => e.type === roadkillType(type))).toBe(true);
  },
);
it.each([0.001, 2, 12])(
  "kills on moving contact at displacement %s without pushing/slowing for the animal",
  (dx) => {
    const f = fixture();
    f.frog.position.wx = 12.999;
    f.after.position.wx = dx;
    const plan = required(f.plan());
    expect(f.manager.byId.has(f.frog.id)).toBe(true);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.roadkill).toBe(true);
    commitVehiclePushes(plan, f.manager);
    expect(f.manager.byId.has(f.frog.id)).toBe(false);
    expect(f.manager.entities.filter((e) => isRoadkill(e.type))).toHaveLength(1);
    expect(f.manager.entities.find((e) => isRoadkill(e.type))?.position).toEqual(f.frog.position);
  },
);
it("does not kill from a parked overlap, a diagonal near miss, an elevated animal or a protected follower", () => {
  const f = fixture();
  f.frog.position.wx = 8;
  f.after.position.wx = 0;
  expect(f.plan()).toBeUndefined();
  f.after.position.wx = 20;
  f.after.position.wy = 20;
  f.frog.position = { wx: -2, wy: 18 };
  // In the broad envelope, but never inside the moving body's actual path.
  expect(f.plan()).toEqual([]);
  f.frog.position = { wx: 13, wy: -2 };
  f.after.position = { wx: 2, wy: 0 };
  f.frog.wz = 24;
  expect(f.plan()).toEqual([]);
  f.frog.wz = 0;
  required(f.frog.wanderAI).following = true;
  expect(f.plan()?.some((p) => p.roadkill)).not.toBe(true);
  delete required(f.frog.wanderAI).following;
  f.frog.parentId = f.car.id;
  expect(f.plan()).toEqual([]);
  expect(f.manager.byId.has(f.frog.id)).toBe(true);
});
it("does not commit a death when another body blocks the same step", () => {
  const f = fixture();
  const blocker = f.manager.spawn(createPlayer(13, -3));
  blocker.velocity = null;
  expect(f.plan()).toBeUndefined();
  expect(f.manager.byId.has(f.frog.id)).toBe(true);
  expect(f.manager.entities.some((e) => isRoadkill(e.type))).toBe(false);
});
it("deduplicates contact by multiple train carriages", () => {
  const f = fixture();
  const plan = required(
    planVehiclePushes(
      [
        { before: f.car, after: f.after },
        { before: f.car, after: f.after },
      ],
      1 / 60,
      { pushSpeed: 80, pushWeight: 1000 },
      f.world,
      [],
      f.manager.entities,
    ),
  );
  expect(plan).toHaveLength(1);
  commitVehiclePushes(plan, f.manager);
  expect(f.manager.entities.filter((e) => isRoadkill(e.type))).toHaveLength(1);
});
it("persists and binary-replicates still, flattened, fading remains using original source pixels", () => {
  const animal = createRabbit(64, 64);
  animal.wz = 16;
  animal.proceduralId = "natural-rabbit";
  const corpse = createRoadkill(animal);
  corpse.deathTimer = 2.5;
  const restored = decodeActor(encodeActor(corpse)) as Entity;
  expect(restored.type).toBe(corpse.type);
  expect(restored.deathTimer).toBe(2.5);
  expect(restored.collider).toBeNull();
  expect(restored.proceduralId).toBeUndefined();
  const message = decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      entityBaselines: [serializeEntity(restored)],
    }),
  );
  if (message.type !== "frame") throw Error("Expected frame");
  const replica = deserializeEntity(required(message.entityBaselines?.[0]));
  expect(replica.collider).toBeNull();
  expect(replica.sprite?.frameCol).toBe(0);
  expect(replica.sprite?.moving).toBe(false);
  expect(replica.sprite?.clip).toBeUndefined();
  const camera = new Camera();
  camera.setViewport(400, 400);
  camera.snapTo(64, 64);
  const items = collectScene(
    [replica],
    [],
    { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 },
    camera,
    camera.getVisibleChunkRange(),
    1,
    { collectElevationItems: () => [] },
    [],
    false,
  );
  const item = required(items.find((i) => i.kind === "sprite"));
  if (item.kind !== "sprite") throw Error("Expected sprite");
  expect(item.sheetKey).toBe(animal.sprite?.sheetKey);
  expect(item.spriteHeight).toBe(animal.sprite?.spriteHeight);
  expect(item.scaleY).toBe(ROADKILL_SCALE_Y);
  expect(item.drawOffsetY).toBe((animal.sprite?.drawOffsetY ?? 0) * ROADKILL_SCALE_Y);
  expect(item.alpha).toBe(0.5);
  expect(item.hasShadow).toBe(false);
  expect(getEntityAABB(animal.position, required(animal.collider)).left).toBeLessThan(64);
});
