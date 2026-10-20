import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { woodlandWorkRecipe } from "../scenarios/WoodlandWorkRecipe.js";
import { createFauna } from "./Fauna.js";
import { tickFoodSources } from "./FoodGrowth.js";
import { createFoodSource, createForageItem } from "./ForageResources.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
async function until(s: ScenarioSession, p: () => boolean, seconds = 80) {
  for (let i = 0; i < seconds * 30 && !p(); i++) await s.step(idle, 1 / 30);
  expect(
    s.realm.entityManager.entities.map((e) => ({
      type: e.type,
      p: e.position,
      z: e.wz,
      task: e.animalWork,
      food: e.workItem,
      ai: e.fauna,
    })),
    "Timed out",
  ).toSatisfy(() => p());
}
it("climbs continuously, picks one fruit, eats on a supported crown and descends through reload", async () => {
  const s = await ScenarioSession.create(woodlandWorkRecipe("capuchin"));
  try {
    const a = required(s.realm.entityManager.entities.find((e) => e.fauna));
    await until(s, () => a.animalWork?.state === "climb" && (a.wz ?? 0) > 8);
    const id = a.persistentId,
      z = a.wz ?? 0;
    expect(z).toBeLessThan(32);
    await s.reload();
    const loaded = required(s.realm.entityManager.entities.find((e) => e.persistentId === id));
    expect(loaded.wz).toBeCloseTo(z, 5);
    await until(s, () => (loaded.animalWork?.eaten ?? 0) === 1);
    expect(loaded.wz).toBe(32);
    const source = required(s.realm.entityManager.entities.find((e) => e.workItem?.growth));
    expect(source.workItem?.units).toBe(2);
    await until(s, () => loaded.animalWork?.state === "idle" && (loaded.wz ?? 0) < 1);
    expect(s.realm.entityManager.entities.filter((e) => e.workItem?.kind === "fruit")).toHaveLength(
      1,
    );
  } finally {
    await s.close();
  }
}, 60000);
it("removing the actual tree cancels its crop and climbing support", async () => {
  const s = await ScenarioSession.create(woodlandWorkRecipe("capuchin"));
  try {
    const a = required(s.realm.entityManager.entities.find((e) => e.fauna));
    await until(s, () => a.animalWork?.state === "climb" && (a.wz ?? 0) > 8);
    const tree = required(s.realm.propManager.props.find((p) => p.type === "prop-oak-tree"));
    s.realm.propManager.remove(tree.id);
    await until(
      s,
      () => !a.animalWork?.tree && !s.realm.entityManager.entities.some((e) => e.workItem?.growth),
    );
    expect(a.animalWork?.eaten).toBe(0);
    expect(a.wz).toBe(0);
  } finally {
    await s.close();
  }
}, 60000);
it("transfers a real cached item to the raccoon and consumes it once under cover", async () => {
  const recipe = woodlandWorkRecipe("raccoon");
  recipe.actors = (recipe.actors ?? []).filter((e) => !e.type.includes("red-squirrel"));
  const s = await ScenarioSession.create(recipe);
  try {
    const a = required(s.realm.entityManager.entities.find((e) => e.type.includes("raccoon"))),
      cache = required(s.realm.entityManager.entities.find((e) => e.workItem?.kind === "cache"));
    await until(s, () => !!a.animalWork?.heldId);
    expect(cache.workItem?.contents.length).toBe(2);
    expect(a.animalWork?.stolen).toBe(1);
    const id = a.persistentId;
    await s.reload();
    const loaded = required(s.realm.entityManager.entities.find((e) => e.persistentId === id));
    await until(s, () => loaded.animalWork?.eaten === 1);
    expect(loaded.animalWork?.stolen).toBe(1);
    expect(loaded.position.wx).toBeGreaterThan(145);
    expect(loaded.position.wy).toBeCloseTo(104, 0);
    expect(
      s.realm.entityManager.entities
        .filter((e) => e.workItem?.kind === "nut" && !e.workItem.growth)
        .map((e) => ({ type: e.type, item: e.workItem, parent: e.parentId, p: e.position })),
    ).toEqual([]);
    expect(
      required(s.realm.entityManager.entities.find((e) => e.workItem?.kind === "cache")).workItem
        ?.contents.length,
    ).toBe(2);
  } finally {
    await s.close();
  }
}, 60000);
it("cat stalks, physically pounces and bats the same toy, then uses a real tree perch", async () => {
  const s = await ScenarioSession.create(woodlandWorkRecipe("cat"));
  try {
    const a = required(s.realm.entityManager.entities.find((e) => e.fauna)),
      ball = required(s.realm.entityManager.entities.find((e) => e.type === "ball"));
    const id = ball.persistentId;
    await until(s, () => a.animalWork?.state === "pounce" && (a.wz ?? 0) > 1);
    await until(s, () => a.animalWork?.state === "bat");
    expect(
      Math.hypot(a.position.wx - ball.position.wx, a.position.wy - ball.position.wy),
    ).toBeGreaterThanOrEqual(9);
    await until(s, () => (a.animalWork?.played ?? 0) >= 1);
    expect(ball.persistentId).toBe(id);
    expect(Math.hypot(ball.velocity?.vx ?? 0, ball.velocity?.vy ?? 0)).toBeGreaterThan(10);
    await until(s, () => a.animalWork?.state === "perch", 160);
    expect(a.wz).toBe(32);
    expect(s.realm.entityManager.byId.has(ball.id)).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);
it("only admitted growing sources renew, cap their stock and preserve timers through actor records", async () => {
  const s = await ScenarioSession.create(woodlandWorkRecipe("cat"));
  try {
    const manager = s.realm.entityManager,
      plant = manager.spawn(createFoodSource("growing-plant", 220, 220));
    const food = required(plant.workItem),
      growth = required(food.growth);
    food.units = 0;
    growth.remaining = 1;
    const env = { isWater: () => false, canOccupy: () => true };
    tickFoodSources(manager, new Map([[plant, 0.5]]), env);
    expect(food.units).toBe(0);
    expect(growth.remaining).toBe(0.5);
    const loaded = decodeActor(encodeActor(plant));
    if ("isProp" in loaded) throw Error("Expected plant");
    expect(loaded.workItem?.growth?.remaining).toBe(0.5);
    tickFoodSources(manager, new Map(), env);
    expect(growth.remaining).toBe(0.5);
    tickFoodSources(manager, new Map([[plant, 0.5]]), env);
    expect(food.units).toBe(1);
    tickFoodSources(manager, new Map([[plant, 10000]]), env);
    expect(food.units).toBe(3);
    const loose = manager.spawn(createForageItem("fruit", 232, 220));
    tickFoodSources(manager, new Map([[loose, 10000]]), env);
    expect(loose.workItem?.growth).toBeUndefined();
  } finally {
    await s.close();
  }
});
it("two monkeys cannot duplicate one remaining fruit", async () => {
  const recipe = woodlandWorkRecipe("capuchin");
  recipe.actors?.push(createFauna("capuchin-monkey", 196, 176));
  const source = required(recipe.actors?.find((e) => e.workItem?.growth));
  required(source.workItem).units = 1;
  const s = await ScenarioSession.create(recipe);
  try {
    await until(
      s,
      () =>
        s.realm.entityManager.entities.reduce((n, e) => n + (e.animalWork?.eaten ?? 0), 0) === 1,
    );
    for (let i = 0; i < 1800; i++) await s.step(idle, 1 / 30);
    expect(s.realm.entityManager.entities.reduce((n, e) => n + (e.animalWork?.eaten ?? 0), 0)).toBe(
      1,
    );
  } finally {
    await s.close();
  }
}, 60000);

it("freezes a committed grip and source clock while support scopes are unavailable", async () => {
  const s = await ScenarioSession.create(woodlandWorkRecipe("capuchin"));
  try {
    const a = required(s.realm.entityManager.entities.find((e) => e.fauna));
    await until(s, () => a.animalWork?.state === "climb" && (a.wz ?? 0) > 6);
    const task = required(a.animalWork),
      elapsed = task.elapsed,
      z = a.wz;
    const source = required(s.realm.entityManager.entities.find((e) => e.workItem?.growth)),
      growth = required(source.workItem?.growth);
    required(source.workItem).units = 1;
    const remaining = growth.remaining;
    const environment = { isWater: () => false, canOccupy: () => true, climbTrees: () => [] };
    s.realm.animalWork.update(a, 0.5, { environment, players: [], ready: () => false });
    tickFoodSources(s.realm.entityManager, new Map([[source, 0.5]]), environment, () => false);
    expect(task.elapsed).toBe(elapsed);
    expect(a.wz).toBe(z);
    expect(growth.remaining).toBe(remaining);
  } finally {
    await s.close();
  }
}, 60000);
it("a depleted growing plant stays in the world and renews after a saved partial timer", async () => {
  const recipe = woodlandWorkRecipe("cat");
  recipe.actors = [createFoodSource("growing-plant", 192, 176)];
  const s = await ScenarioSession.create(recipe);
  try {
    const source = required(s.realm.entityManager.entities.find((e) => e.workItem?.growth));
    required(source.workItem).units = 0;
    required(source.workItem?.growth).remaining = 0.6;
    const id = source.persistentId;
    await s.reload();
    const loaded = required(s.realm.entityManager.entities.find((e) => e.persistentId === id));
    expect(loaded.workItem?.units).toBe(0);
    expect(loaded.workItem?.growth?.remaining).toBe(0.6);
    for (let i = 0; i < 30; i++) await s.step(idle, 1 / 30);
    expect(loaded.workItem?.units).toBe(1);
    expect(loaded.sprite?.frameCol).toBe(15);
  } finally {
    await s.close();
  }
});
it.each(["cat", "cat-ginger", "cat-black"] as const)(
  "%s inherits physical toy play with its own retained coat clips",
  async (kind) => {
    const recipe = woodlandWorkRecipe("cat");
    recipe.actors = [createFauna(kind, 128, 176), ...(recipe.actors ?? []).filter((e) => !e.fauna)];
    const s = await ScenarioSession.create(recipe);
    try {
      const a = required(s.realm.entityManager.entities.find((e) => e.fauna));
      await until(s, () => (a.animalWork?.played ?? 0) > 0);
      expect(a.animalWork?.kind).toBe("cat");
    } finally {
      await s.close();
    }
  },
  60000,
);

it.each(["capuchin", "raccoon", "cat"] as const)("%s recipe has stable review identity", (kind) => {
  expect(woodlandWorkRecipe(kind)).toEqual(woodlandWorkRecipe(kind));
});

it("a raided squirrel restocks from actual renewable nuts without multiplying the six initial portions", async () => {
  const s = await ScenarioSession.create(woodlandWorkRecipe("raccoon"));
  try {
    const squirrel = required(
        s.realm.entityManager.entities.find((e) => e.type.includes("red-squirrel")),
      ),
      raccoon = required(s.realm.entityManager.entities.find((e) => e.type.includes("raccoon")));
    await until(
      s,
      () => (squirrel.animalWork?.deliveries ?? 0) > 1 && (raccoon.animalWork?.eaten ?? 0) > 0,
    );
    const total = s.realm.entityManager.entities.reduce(
      (n, e) =>
        n +
        (e.animalWork?.eaten ?? 0) +
        (e.workItem?.kind === "cache"
          ? e.workItem.contents.length
          : e.workItem?.growth
            ? e.workItem.units
            : ["fruit", "nut"].includes(e.workItem?.kind ?? "")
              ? 1
              : 0),
      0,
    );
    expect(total).toBe(6);
  } finally {
    await s.close();
  }
}, 60000);

it("naturally generated capuchins use their world crop and actual generated trunks", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("capuchin-monkey", "balanced"));
  try {
    const monkeys = s.realm.entityManager.entities.filter((e) =>
      e.type.includes("capuchin-monkey"),
    );
    expect(monkeys.length).toBeGreaterThan(0);
    const monkey = required(monkeys[0]);
    s.player.player.position = { wx: monkey.position.wx + 200, wy: monkey.position.wy + 160 };
    expect(s.realm.entityManager.entities.some((e) => e.workItem?.growth?.food === "fruit")).toBe(
      true,
    );
    await until(s, () => monkeys.some((e) => (e.animalWork?.eaten ?? 0) > 0), 100);
    expect(monkeys.some((e) => e.animalWork?.tree)).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);

it("natural raccoon clearings include a real foraging squirrel whose cache can be raided", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("raccoon", "thicket"));
  try {
    const raccoons = s.realm.entityManager.entities.filter((e) => e.type.includes("raccoon"));
    expect(raccoons.length).toBeGreaterThan(0);
    expect(
      s.realm.entityManager.entities.some((e) => e.proceduralId?.endsWith(":cache-forager")),
    ).toBe(true);
    const a = required(raccoons[0]);
    s.player.player.position = { wx: a.position.wx + 200, wy: a.position.wy + 160 };
    await until(s, () => raccoons.some((e) => (e.animalWork?.stolen ?? 0) > 0), 120);
  } finally {
    await s.close();
  }
}, 60000);
