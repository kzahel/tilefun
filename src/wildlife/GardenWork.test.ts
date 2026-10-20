import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import type { Entity } from "../entities/Entity.js";
import { gardenWorkRecipe } from "../scenarios/GardenWorkRecipe.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createFauna } from "./Fauna.js";
import { tickFoodSources } from "./FoodGrowth.js";
import { createFoodSource, sourceType } from "./ForageResources.js";
import { prepareFaunaTravel, startleFauna } from "./faunaInteractions.js";
import { pollinateFlower } from "./GardenWork.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const subject = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.fauna));
const sources = (s: ScenarioSession) =>
  s.realm.entityManager.entities.filter((e) => e.workItem?.growth);
async function until(s: ScenarioSession, p: () => boolean, seconds = 90) {
  for (let i = 0; i < seconds * 30 && !p(); i++) await s.step(idle, 1 / 30);
  expect(
    s.realm.entityManager.entities.map((e) => ({
      type: e.type,
      p: e.position,
      z: e.wz,
      ai: e.fauna,
      task: e.animalWork,
      item: e.workItem,
    })),
    "Timed out",
  ).toSatisfy(() => p());
}
const saved = (s: ScenarioSession, a: Entity) =>
  required(s.realm.entityManager.entities.find((e) => e.persistentId === a.persistentId));

it.each(["chicken", "bee"] as const)(
  "moving a %s resource out of contact cancels before taking stock",
  async (kind) => {
    const s = await ScenarioSession.create(gardenWorkRecipe(kind));
    try {
      const a = subject(s);
      await until(s, () => a.animalWork?.state === (kind === "chicken" ? "scratch" : "sip"));
      const food = required(
        s.realm.entityManager.entities.find((e) => e.persistentId === a.animalWork?.targetId),
      );
      food.position.wx += 60;
      s.realm.entityManager.spatialHash.update(food);
      s.realm.animalWork.update(a, 2, {
        environment: { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 },
        players: [],
        ready: () => true,
      });
      expect(a.animalWork?.state).toBe("idle");
      expect(a.animalWork?.eaten).toBe(0);
      expect(a.animalWork?.uncovered ?? 0).toBe(0);
      expect(food.workItem?.units).toBe(3);
      expect(food.workItem?.claimedBy).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  60000,
);

it("an unsupported raised bloom releases its guard at the authority decision boundary", async () => {
  const s = await ScenarioSession.create(gardenWorkRecipe("hummingbird"));
  try {
    const a = subject(s);
    await until(s, () => a.animalWork?.state === "guard");
    const flower = required(
      s.realm.entityManager.entities.find((e) => e.persistentId === a.animalWork?.targetId),
    );
    flower.wz = 20;
    // Exercise work authority before the physics pass reconciles raw world height.
    s.realm.animalWork.update(a, 0.1, {
      environment: { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 },
      players: [],
      ready: () => true,
    });
    expect(a.animalWork?.state).toBe("idle");
    expect(a.animalWork?.warnings ?? 0).toBe(0);
    expect(flower.workItem?.units).toBe(2);
    expect(flower.workItem?.claimedBy).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it("competing chickens cannot duplicate stock or manufacture supplies when placed manually", async () => {
  const recipe = gardenWorkRecipe("chicken");
  recipe.actors?.push(createFauna("chicken", 116, 200));
  const s = await ScenarioSession.create(recipe);
  try {
    await until(
      s,
      () => s.realm.entityManager.entities.reduce((n, e) => n + (e.animalWork?.eaten ?? 0), 0) >= 2,
    );
    expect(
      s.realm.entityManager.entities.reduce(
        (n, e) =>
          n +
          (e.animalWork?.eaten ?? 0) +
          (e.workItem?.growth ? e.workItem.units : e.workItem?.kind === "seed" ? 1 : 0),
        0,
      ),
    ).toBe(3);
  } finally {
    await s.close();
  }
  const empty = gardenWorkRecipe("chicken");
  empty.actors = empty.actors?.filter((e) => e.fauna) ?? [];
  const manual = await ScenarioSession.create(empty);
  try {
    for (let i = 0; i < 120; i++) await manual.step(idle, 1 / 30);
    expect(sources(manual)).toHaveLength(0);
    expect(subject(manual).animalWork?.eaten).toBe(0);
  } finally {
    await manual.close();
  }
}, 60000);

it("guard warnings preserve following and attached birds, and source-boundary readiness rejects unchecked flight", async () => {
  const s = await ScenarioSession.create(gardenWorkRecipe("hummingbird"));
  try {
    const a = subject(s);
    await until(s, () => a.animalWork?.state === "guard");
    const flower = required(
      s.realm.entityManager.entities.find((e) => e.persistentId === a.animalWork?.targetId),
    );
    const follower = createFauna(
      "ruby-throated-hummingbird",
      flower.position.wx,
      flower.position.wy,
    );
    required(follower.wanderAI).following = true;
    s.realm.entityManager.spawn(follower);
    const attached = createFauna(
      "ruby-throated-hummingbird",
      flower.position.wx,
      flower.position.wy,
    );
    attached.parentId = a.id;
    s.realm.entityManager.spawn(attached);
    for (let i = 0; i < 45; i++)
      s.realm.animalWork.update(a, 1 / 30, {
        environment: { isWater: () => false, canOccupy: () => true },
        players: [],
        ready: () => true,
      });
    expect(a.animalWork?.warnings ?? 0).toBe(0);
    expect(follower.fauna?.alarmFrom).toBeUndefined();
    expect(attached.fauna?.alarmFrom).toBeUndefined();
    const start = a.position.wx;
    expect(
      s.realm.animalWork.go(a, { wx: start + 40, wy: a.position.wy }, 0, {
        environment: { isWater: () => false, canOccupy: () => true },
        players: [],
        ready: (p) => Math.abs(p.wx - start - 20) > 3,
      }),
    ).toBe(false);
    expect(a.fauna?.motion).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it("chicken uncovers exactly one real seed, reloads it at its beak, then eats it", async () => {
  const s = await ScenarioSession.create(gardenWorkRecipe("chicken"));
  try {
    let a = subject(s);
    await until(s, () => a.animalWork?.state === "scratch");
    expect(sources(s)[0]?.workItem?.units).toBe(3);
    await until(s, () => a.animalWork?.state === "peck");
    expect(sources(s)[0]?.workItem?.units).toBe(2);
    const seed = required(s.realm.entityManager.entities.find((e) => e.parentId === a.id));
    expect(seed.workItem?.kind).toBe("seed");
    const pose = { ...seed.position, z: seed.wz };
    await s.reload();
    a = saved(s, a);
    const loaded = required(s.realm.entityManager.entities.find((e) => e.parentId === a.id));
    expect({ ...loaded.position, z: loaded.wz }).toEqual(pose);
    await until(s, () => a.animalWork?.eaten === 1);
    expect(s.realm.entityManager.entities.some((e) => e.persistentId === seed.persistentId)).toBe(
      false,
    );
    expect(sources(s)[0]?.workItem?.units).toBe(2);
  } finally {
    await s.close();
  }
}, 60000);

it.each(["scratch", "peck"] as const)(
  "interrupting a chicken during %s conserves all three seeds",
  async (state) => {
    const s = await ScenarioSession.create(gardenWorkRecipe("chicken"));
    try {
      const a = subject(s);
      await until(s, () => a.animalWork?.state === state);
      startleFauna(a, { wx: a.position.wx + 8, wy: a.position.wy });
      await s.step(idle, 1 / 30);
      const seeds = s.realm.entityManager.entities.filter(
        (e) => e.workItem?.kind === "seed" && !e.workItem.growth,
      );
      expect((sources(s)[0]?.workItem?.units ?? 0) + seeds.length).toBe(3);
      expect(seeds.every((e) => e.parentId === undefined && !e.workItem?.claimedBy)).toBe(true);
    } finally {
      await s.close();
    }
  },
  60000,
);

it("bee pays for nectar at distinct flowers, carries pollen through reload and advances only real crop time", async () => {
  const s = await ScenarioSession.create(gardenWorkRecipe("bee"));
  try {
    let a = subject(s);
    await until(s, () => a.animalWork?.eaten === 1);
    const first = a.animalWork?.lastFlowerId;
    expect(first).toBeTruthy();
    await s.reload();
    a = saved(s, a);
    expect(a.animalWork?.lastFlowerId).toBe(first);
    await until(s, () => (a.animalWork?.pollinated ?? 0) > 0);
    expect(a.animalWork?.lastFlowerId).not.toBe(first);
    const flowers = sources(s).filter((e) => e.type === sourceType("nectar-flower"));
    expect(
      flowers.reduce((n, e) => n + (e.workItem?.units ?? 0), 0) + (a.animalWork?.eaten ?? 0),
    ).toBe(6);
    const marked = required(flowers.find((e) => e.workItem?.pollination));
    expect(marked.sprite?.frameCol).toBeGreaterThanOrEqual(47);
    expect(marked.sprite?.clip).toBe((marked.workItem?.units ?? 0) + 4);
    const crop = required(sources(s).find((e) => e.type === sourceType("growing-plant")));
    expect(crop.workItem?.growth?.remaining).toBeLessThan(90);
    expect(crop.workItem?.units).toBe(0);
    const remaining = marked.workItem?.pollination?.remaining;
    await s.reload();
    expect(saved(s, marked).workItem?.pollination?.remaining).toBe(remaining);
  } finally {
    await s.close();
  }
}, 60000);

it("a destination's saved pollination cap protects full, unready and distant crops and never creates instant stock", async () => {
  const s = await ScenarioSession.create(gardenWorkRecipe("bee"));
  try {
    const a = subject(s);
    await until(s, () => a.animalWork?.eaten === 1);
    const flower = createFoodSource("nectar-flower", 140, 176),
      crop = createFoodSource("growing-plant", 160, 176);
    const context = {
      environment: { isWater: () => false, canOccupy: () => true },
      players: [],
      ready: () => true,
    };
    required(crop.workItem?.growth).remaining = 20;
    required(crop.workItem).units = 0;
    pollinateFlower(a, flower, [crop], context);
    expect(crop.workItem?.growth?.remaining).toBe(1);
    expect(crop.workItem?.units).toBe(0);
    required(a.animalWork).lastFlowerId = "other";
    required(crop.workItem?.growth).remaining = 80;
    pollinateFlower(a, flower, [crop], context);
    expect(crop.workItem?.growth?.remaining).toBe(80);
    required(flower.workItem?.pollination).remaining = 0;
    required(a.animalWork).lastFlowerId = "other";
    pollinateFlower(a, flower, [crop], { ...context, ready: () => false });
    expect(crop.workItem?.growth?.remaining).toBe(80);
    required(flower.workItem?.pollination).remaining = 0;
    required(a.animalWork).lastFlowerId = "other";
    required(crop.workItem).units = 3;
    pollinateFlower(a, flower, [crop], context);
    expect(crop.workItem?.growth?.remaining).toBe(80);
    required(flower.workItem?.pollination).remaining = 0;
    required(a.animalWork).lastFlowerId = "other";
    required(crop.workItem).units = 0;
    crop.position.wx = 400;
    pollinateFlower(a, flower, [crop], context);
    expect(crop.workItem?.growth?.remaining).toBe(80);
    crop.position.wx = 160;
    required(crop.workItem?.growth).remaining = 0.2;
    required(flower.workItem?.pollination).remaining = 0;
    required(a.animalWork).lastFlowerId = "other";
    pollinateFlower(a, flower, [crop], context);
    expect(crop.workItem?.growth?.remaining).toBe(0.2);
  } finally {
    await s.close();
  }
}, 60000);

it("nectar stock and pollination clocks advance only for admitted ready sources, including full flowers", async () => {
  const recipe = gardenWorkRecipe("bee");
  recipe.actors = [createFoodSource("nectar-flower", 144, 176)];
  const s = await ScenarioSession.create(recipe);
  try {
    const flower = required(sources(s)[0]),
      item = required(flower.workItem);
    item.pollination = { remaining: 0.5, count: 1 };
    const env = { isWater: () => false, canOccupy: () => true };
    tickFoodSources(s.realm.entityManager, new Map([[flower, 1]]), env, () => false);
    expect(item.pollination.remaining).toBe(0.5);
    tickFoodSources(s.realm.entityManager, new Map(), env);
    expect(item.pollination.remaining).toBe(0.5);
    tickFoodSources(s.realm.entityManager, new Map([[flower, 1]]), env);
    expect(item.pollination.remaining).toBe(0);
    expect(item.units).toBe(3);
    expect(flower.sprite?.frameCol).toBe(46);
    item.units = 0;
    required(item.growth).remaining = 0.5;
    await s.reload();
    const loaded = required(sources(s)[0]);
    await until(s, () => loaded.workItem?.units === 1, 2);
    expect(loaded.workItem?.growth?.interval).toBe(180);
  } finally {
    await s.close();
  }
});

it("unready flower scopes freeze flight and action phase, and deleting a bloom cancels without a sip", async () => {
  const s = await ScenarioSession.create(gardenWorkRecipe("hummingbird"));
  try {
    const a = subject(s);
    await until(s, () => a.animalWork?.state === "seek" && !!a.fauna?.motion);
    const phase = a.fauna?.motion?.elapsed,
      z = a.wz;
    s.realm.animalWork.update(a, 0.2, {
      environment: { isWater: () => false, canOccupy: () => true },
      players: [],
      ready: () => false,
    });
    prepareFaunaTravel(a, 0.2);
    expect(a.fauna?.motion?.elapsed).toBe(phase);
    expect(a.wz).toBe(z);
    await until(s, () => a.animalWork?.state === "sip");
    const flower = required(
      s.realm.entityManager.entities.find((e) => e.persistentId === a.animalWork?.targetId),
    );
    s.realm.entityManager.remove(flower.id);
    expect(a.animalWork?.state).toBe("idle");
    expect(a.animalWork?.eaten).toBe(0);
  } finally {
    await s.close();
  }
}, 60000);

it("hummingbird reloads a hover pose, spends one nectar, warns one rival and releases its bounded guard", async () => {
  const s = await ScenarioSession.create(gardenWorkRecipe("hummingbird"));
  try {
    let a = subject(s);
    await until(s, () => a.animalWork?.state === "sip");
    const column = a.sprite?.frameCol;
    await s.reload();
    a = saved(s, a);
    expect(a.sprite?.frameCol).toBe(column);
    await until(s, () => a.animalWork?.state === "guard");
    expect(a.animalWork?.eaten).toBe(1);
    const rival = createFauna("ruby-throated-hummingbird", a.position.wx + 8, a.position.wy);
    s.realm.entityManager.spawn(rival);
    await until(s, () => (a.animalWork?.warnings ?? 0) > 0, 3);
    expect(rival.fauna?.alarmFrom).toBeDefined();
    expect(a.animalWork?.warnings).toBe(1);
    await until(s, () => a.animalWork?.state === "idle", 8);
    expect(a.animalWork?.targetId).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it.each(["chicken", "bee", "ruby-throated-hummingbird"] as const)(
  "natural %s homes use actual bounded supplies and production actions",
  async (species) => {
    const s = await ScenarioSession.create(naturalLandscapeRecipe(species, "thicket"));
    try {
      const animals = s.realm.entityManager.entities.filter(
        (e) => e.type === `wildlife-${species}-provisional-v1`,
      );
      expect(animals.length).toBeGreaterThan(0);
      const a = required(animals[0]);
      s.player.player.position = { wx: a.position.wx + 200, wy: a.position.wy + 180 };
      expect(sources(s).length).toBeGreaterThan(0);
      await until(s, () => animals.some((e) => (e.animalWork?.eaten ?? 0) > 0), 120);
    } finally {
      await s.close();
    }
  },
  60000,
);
