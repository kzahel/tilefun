import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createBall } from "../entities/Ball.js";
import type { Entity } from "../entities/Entity.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { animalWorkRecipe } from "../scenarios/AnimalWorkRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna } from "./Fauna.js";
import { freshBallWork } from "./ForageResources.js";

it("drops an existing nest when its supporting tree is deleted and does not invent materials", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("crow"));
  try {
    const crow = actor(s, "crow");
    await until(s, () => (crow.animalWork?.deliveries ?? 0) >= 1);
    const nest = required(s.realm.entityManager.entities.find((e) => e.workItem?.kind === "nest"));
    expect(nest.wz).toBeGreaterThan(0);
    const tree = required(s.realm.propManager.props.find((p) => p.type === "prop-oak-tree"));
    s.realm.propManager.remove(tree.id);
    await until(s, () => !crow.animalWork?.siteId, 2);
    expect(nest.wz).toBe(0);
    expect(nest.workItem?.units).toBe(1);
    expect(s.realm.entityManager.entities.filter((e) => e.workItem?.kind === "twig")).toHaveLength(
      3,
    );
  } finally {
    await s.close();
  }
}, 60000);

it("seeds finite stable resources and ordinary tree perches at a natural crow home", () => {
  const generator = createGenerator(createDescriptor("regional", 2026), "thicket");
  const cx = Math.floor(-290 / 16),
    cy = Math.floor(-349 / 16);
  const region = Array.from({ length: 9 }, (_, i) => ({
    x: cx - 1 + (i % 3),
    y: cy - 1 + Math.floor(i / 3),
  }));
  const collect = () => region.flatMap((c) => generator.actors?.(c.x, c.y) ?? []);
  const actors = collect(),
    crows = actors.filter((a) => a.type === "wildlife-crow-provisional-v1");
  expect(crows).toHaveLength(2);
  for (const crow of crows) {
    const materials = actors.filter((a) => a.featureId.startsWith(`${crow.featureId}:forage:`));
    expect(materials.length).toBeGreaterThanOrEqual(4);
    const props = region.flatMap((c) => generator.placements(c.x, c.y, new Set()).placements);
    expect(props.some((p) => p.featureId === `${crow.featureId}:nest-tree`)).toBe(true);
  }
  region.reverse();
  expect(collect().sort((a, b) => a.featureId.localeCompare(b.featureId))).toEqual(
    actors.sort((a, b) => a.featureId.localeCompare(b.featureId)),
  );
});

it("waits safely for actor readiness and refuses blocked approaches", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("dog"));
  try {
    const dog = actor(s, "dog"),
      ball = addFetchBall(s);
    const environment = { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 };
    const players = [{ identity: s.player.clientId, entity: s.player.player }];
    s.realm.animalWork.update(dog, 0.1, { environment, players, ready: () => false });
    expect(dog.animalWork?.targetId).toBeUndefined();
    if (dog.animalWork) dog.animalWork.cooldown = 0;
    s.realm.animalWork.update(dog, 0.1, {
      environment: { ...environment, canOccupy: () => false },
      players,
      ready: () => true,
    });
    expect(dog.animalWork?.targetId).toBeUndefined();
    expect(ball.parentId).toBeUndefined();
    expect(dog.fauna?.motion).toBeUndefined();
  } finally {
    await s.close();
  }
});

it("publishes carried object parenting, height and socket through the ordinary binary snapshot", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("dog"));
  try {
    const dog = actor(s, "dog"),
      ball = addFetchBall(s);
    await until(s, () => !!dog.animalWork?.heldId);
    const snapshot = serializeEntity(ball),
      restored = deserializeEntity(snapshot);
    expect(restored.parentId).toBe(dog.id);
    expect(restored.localOffsetX).toBeCloseTo(ball.localOffsetX ?? 0, 2);
    const packets = s.frames().map(decodeServerMessage);
    expect(
      packets.some(
        (p) =>
          p.type === "frame" &&
          p.entityBaselines?.some((e) => e.id === ball.id && e.parentId === dog.id),
      ),
    ).toBe(true);
    expect(restored.workItem).toBeUndefined(); // gameplay state remains authoritative
  } finally {
    await s.close();
  }
}, 60000);

import { startleFauna } from "./faunaInteractions.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("fetches through the real throw command and completes another throw with the same ball", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("dog"));
  try {
    let dog = actor(s, "dog");
    await s.command({ kind: "throw-ball", dirX: 1, dirY: 0, force: 0 });
    const ball = required(s.realm.entityManager.entities.find((e) => e.type === "ball"));
    await until(s, () => !!dog.animalWork?.heldId, 60);
    await until(s, () => (dog.animalWork?.deliveries ?? 0) >= 1, 60);
    await s.command({ kind: "throw-ball", dirX: 1, dirY: 0, force: 0 });
    await s.reload();
    dog = actor(s, "dog");
    await until(s, () => (dog.animalWork?.deliveries ?? 0) >= 2, 80);
    expect(
      s.realm.entityManager.entities.filter((e) => e.type === "ball").map((e) => e.persistentId),
    ).toEqual([ball.persistentId]);
  } finally {
    await s.close();
  }
}, 60000);

it("releases a carried resource on alarm without consuming or duplicating it", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("squirrel"));
  try {
    const squirrel = actor(s, "red-squirrel");
    await until(s, () => !!squirrel.animalWork?.heldId);
    const id = squirrel.animalWork?.heldId;
    startleFauna(squirrel, { wx: squirrel.position.wx - 8, wy: squirrel.position.wy });
    await s.step(idle, 1 / 30);
    const item = required(s.realm.entityManager.entities.find((e) => e.persistentId === id));
    expect(item.parentId).toBeUndefined();
    expect(item.workItem?.claimedBy).toBeUndefined();
    expect(squirrel.animalWork?.heldId).toBeUndefined();
    expect(
      s.realm.entityManager.entities.filter(
        (e) => e.workItem?.kind === "nut" || e.workItem?.kind === "fruit",
      ),
    ).toHaveLength(4);
  } finally {
    await s.close();
  }
}, 60000);

it("restores the eating action and attached food before the first reload snapshot", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("squirrel"));
  try {
    let squirrel = actor(s, "red-squirrel");
    await until(s, () => squirrel.animalWork?.state === "eat", 120);
    await s.step(idle, 0.1);
    const held = squirrel.animalWork?.heldId,
      clip = squirrel.sprite?.clip;
    await s.reload();
    squirrel = actor(s, "red-squirrel");
    expect(squirrel.animalWork?.state).toBe("eat");
    expect(squirrel.sprite?.clip).toBe(clip);
    expect(
      required(s.realm.entityManager.entities.find((e) => e.persistentId === held)).parentId,
    ).toBe(squirrel.id);
    await until(s, () => (squirrel.animalWork?.eaten ?? 0) >= 1);
    expect(s.realm.entityManager.entities.some((e) => e.persistentId === held)).toBe(false);
  } finally {
    await s.close();
  }
}, 60000);
const actor = (s: ScenarioSession, kind: string) =>
  required(s.realm.entityManager.entities.find((e) => e.type.includes(kind) && e.fauna));
async function until(s: ScenarioSession, test: () => boolean, seconds = 45) {
  for (let i = 0; i < seconds * 30 && !test(); i++) await s.step(idle, 1 / 30);
  if (!test())
    throw Error(
      JSON.stringify(
        s.realm.entityManager.entities.map((e) => ({
          type: e.type,
          pos: e.position,
          z: e.wz,
          fauna: e.fauna,
          task: e.animalWork,
          item: e.workItem,
        })),
        null,
        2,
      ),
    );
}
function addFetchBall(s: ScenarioSession, x = 184, y = 156): Entity {
  const ball = createBall(x, y);
  ball.wz = 0;
  ball.workItem = freshBallWork(s.player.clientId, s.player.player.position);
  return s.realm.entityManager.spawn(ball);
}

it("returns the same ball, preserves an occupied mouth through save/reload and releases near its owner", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("dog"));
  try {
    let dog = actor(s, "dog");
    const ball = addFetchBall(s),
      identity = ball.persistentId;
    await until(s, () => !!dog.animalWork?.heldId);
    expect(ball.parentId).toBe(dog.id);
    expect(ball.deathTimer).toBeUndefined();
    expect(ball.wz).toBeGreaterThanOrEqual(dog.wz ?? 0);
    await s.reload();
    dog = actor(s, "dog");
    await until(s, () => (dog.animalWork?.deliveries ?? 0) >= 1);
    const restored = required(
      s.realm.entityManager.entities.find((e) => e.persistentId === identity),
    );
    expect(restored.parentId).toBeUndefined();
    expect(restored.workItem?.returned).toBe(true);
    expect(
      Math.hypot(
        restored.position.wx - s.player.player.position.wx,
        restored.position.wy - s.player.player.position.wy,
      ),
    ).toBeLessThan(45);
    s.realm.handleMessage(s.player.clientId, s.player, {
      type: "throw-ball",
      dirX: 1,
      dirY: 0,
      force: 0,
    });
    expect(s.realm.entityManager.entities.filter((e) => e.type === "ball")).toHaveLength(1);
    expect(restored.workItem?.returned).toBeUndefined();
    expect(restored.jumpVZ).toBeGreaterThan(0);
  } finally {
    await s.close();
  }
}, 60000);

it("lets only one dog carry a ball and releases it when the dog is removed", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("dog"));
  try {
    const other = createFauna("dog-golden", 128, 184);
    s.realm.entityManager.spawn(other);
    const ball = addFetchBall(s);
    await until(s, () => ball.parentId !== undefined);
    const holders = s.realm.entityManager.entities.filter(
      (e) => e.animalWork?.heldId === ball.persistentId,
    );
    expect(holders).toHaveLength(1);
    s.realm.entityManager.remove(required(holders[0]).id);
    expect(ball.parentId).toBeUndefined();
    expect(ball.workItem?.claimedBy).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it("constructs a real elevated nest by consuming four actual twigs, including a reload", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("crow"));
  try {
    let crow = actor(s, "crow");
    await until(s, () => (crow.animalWork?.deliveries ?? 0) >= 1);
    expect(s.realm.entityManager.entities.filter((e) => e.workItem?.kind === "twig")).toHaveLength(
      3,
    );
    await s.reload();
    crow = actor(s, "crow");
    await until(s, () => (crow.animalWork?.deliveries ?? 0) >= 4, 100);
    const nests = s.realm.entityManager.entities.filter((e) => e.workItem?.kind === "nest");
    expect(nests).toHaveLength(1);
    expect(nests[0]?.workItem?.units).toBe(4);
    expect(nests[0]?.wz).toBeGreaterThan(0);
    expect(nests[0]?.sprite?.clip).toBe(4);
    expect(s.realm.entityManager.entities.filter((e) => e.workItem?.kind === "twig")).toHaveLength(
      0,
    );
  } finally {
    await s.close();
  }
}, 60000);

it("buries real food, retrieves from a durable cache and consumes it once", async () => {
  const s = await ScenarioSession.create(animalWorkRecipe("squirrel"));
  try {
    let squirrel = actor(s, "red-squirrel");
    await until(s, () => (squirrel.animalWork?.deliveries ?? 0) >= 2, 70);
    let cache = required(s.realm.entityManager.entities.find((e) => e.workItem?.kind === "cache"));
    expect(cache.workItem?.contents).toHaveLength(2);
    expect(cache.sprite?.clip).toBe(1);
    await s.reload();
    squirrel = actor(s, "red-squirrel");
    await until(s, () => (squirrel.animalWork?.eaten ?? 0) >= 1);
    cache = required(s.realm.entityManager.entities.find((e) => e.workItem?.kind === "cache"));
    expect(squirrel.animalWork?.retrieved).toBe(1);
    expect(cache.workItem?.contents).toHaveLength(1);
    expect(
      s.realm.entityManager.entities.filter(
        (e) => e.workItem?.kind === "nut" || e.workItem?.kind === "fruit",
      ),
    ).toHaveLength(2);
  } finally {
    await s.close();
  }
}, 60000);
