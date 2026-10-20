import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createBall } from "../entities/Ball.js";
import { encodeActor } from "../persistence/ActorRecords.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { woodlandWorkRecipe } from "../scenarios/WoodlandWorkRecipe.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { freshBallWork } from "./ForageResources.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
async function scene() {
  const recipe = woodlandWorkRecipe("cat");
  recipe.actors = [];
  return ScenarioSession.create(recipe);
}
const toss = { kind: "throw-ball", dirX: 1, dirY: 0, force: 0 } as const;
it("throws ten persistent toys, evicts oldest across reload/unload, and keeps original age on rethrow", async () => {
  const s = await scene();
  try {
    for (let i = 0; i < 10; i++) await s.command(toss);
    let balls = s.realm.entityManager.entities.filter((e) => e.type === "ball");
    expect(balls.length).toBe(10);
    const oldest = required(balls[0]),
      second = required(balls[1]),
      record = encodeActor(oldest);
    for (const b of balls) {
      b.velocity = { vx: 0, vy: 0 };
      b.wz = 0;
      delete b.jumpVZ;
      delete b.jumpZ;
    }
    await s.realm.flushAsync();
    s.realm.entityManager.remove(oldest.id, false);
    await s.command(toss);
    expect(s.realm.ownedBalls.accepts(record)).toBe(false);
    s.realm.records?.restore([record]);
    expect(s.realm.entityManager.entities.some((e) => e.persistentId === record.persistentId)).toBe(
      false,
    );
    await s.reload();
    balls = s.realm.entityManager.entities.filter((e) => e.type === "ball");
    expect(balls.length).toBe(10);
    expect(balls.some((e) => e.persistentId === oldest.persistentId)).toBe(false);
    const reused = required(balls.find((e) => e.persistentId === second.persistentId));
    const item = required(reused.workItem),
      order = item.ballOrder;
    item.returned = true;
    reused.position = { ...s.player.player.position };
    await s.command(toss);
    expect(reused.workItem?.ballOrder).toBe(order);
    expect(s.realm.entityManager.entities.filter((e) => e.type === "ball")).toHaveLength(10);
    // The returned/rethrown oldest toy is still the next to retire.
    await s.command(toss);
    expect(s.realm.entityManager.byId.has(reused.id)).toBe(false);
    for (const b of s.realm.entityManager.entities.filter((e) => e.type === "ball")) {
      b.velocity = { vx: 0, vy: 0 };
      b.wz = 0;
      delete b.jumpVZ;
      delete b.jumpZ;
    }
    for (let i = 0; i < 1200; i++) await s.step(idle, 1 / 30);
    expect(s.realm.entityManager.entities.filter((e) => e.type === "ball")).toHaveLength(10);
    expect(
      s.realm.entityManager.entities
        .filter((e) => e.type === "ball")
        .every((e) => e.deathTimer === undefined),
    ).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);
it("protects held toys, separates owners and refuses a new toy when all ten are held", async () => {
  const s = await scene();
  try {
    const owner = s.player.profileId || s.player.clientId;
    for (let i = 0; i < 10; i++) await s.command(toss);
    const balls = s.realm.entityManager.entities.filter((e) => e.type === "ball");
    for (const b of balls) b.parentId = s.player.player.id;
    const extra = createBall(288, 280);
    extra.workItem = freshBallWork(owner, { wx: 288, wy: 280 });
    expect(s.realm.ownedBalls.admit(owner, extra)).toBe(false);
    const other = createBall(288, 280);
    other.workItem = freshBallWork("other-player", { wx: 288, wy: 280 });
    expect(s.realm.ownedBalls.admit("other-player", other)).toBe(true);
    s.realm.entityManager.spawn(other);
    const loose = required(balls[3]);
    delete loose.parentId;
    await s.command(toss);
    expect(s.realm.entityManager.byId.has(loose.id)).toBe(false);
    expect(s.realm.entityManager.byId.has(required(balls[0]).id)).toBe(true);
    expect(s.realm.entityManager.byId.has(other.id)).toBe(true);
  } finally {
    await s.close();
  }
});

it("player toys stay on water while ordinary disposable balls retain their existing water loss", async () => {
  const s = await scene();
  try {
    await s.command(toss);
    const toy = required(s.realm.entityManager.entities.find((e) => e.type === "ball"));
    toy.wz = 0;
    toy.velocity = { vx: 0, vy: 0 };
    delete toy.jumpVZ;
    delete toy.jumpZ;
    const ordinary = s.realm.entityManager.spawn(createBall(128, 128));
    ordinary.wz = 0;
    tickBallPhysics(
      s.realm.entityManager,
      1 / 30,
      () => CollisionFlag.Water,
      () => 0,
    );
    expect(s.realm.entityManager.byId.has(toy.id)).toBe(true);
    expect(toy.deathTimer).toBeUndefined();
    expect(s.realm.entityManager.byId.has(ordinary.id)).toBe(false);
  } finally {
    await s.close();
  }
});
