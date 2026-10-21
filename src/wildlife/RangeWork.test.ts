import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { rangeWorkRecipe } from "../scenarios/RangeWorkRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createFauna } from "./Fauna.js";
import { tickFoodSources } from "./FoodGrowth.js";
import { createFoodSource, createForageItem } from "./ForageResources.js";
import { prepareFaunaTravel, setFaunaRidden, startleFauna } from "./faunaInteractions.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const animal = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.fauna));
const items = (s: ScenarioSession) => s.realm.entityManager.entities.filter((e) => e.workItem);
const saved = (s: ScenarioSession, a: Entity) =>
  required(s.realm.entityManager.entities.find((e) => e.persistentId === a.persistentId));
const target = (s: ScenarioSession, a: Entity) =>
  required(s.realm.entityManager.entities.find((e) => e.persistentId === a.animalWork?.targetId));
const context = {
  environment: { isWater: () => false, canOccupy: () => true, surfaceZ: () => 0 },
  players: [],
  ready: () => true,
};
async function until(s: ScenarioSession, predicate: () => boolean, seconds = 120) {
  for (let i = 0; i < seconds * 30 && !predicate(); i++) await s.step(idle, 1 / 30);
  expect(
    s.realm.entityManager.entities.map((e) => ({
      type: e.type,
      p: e.position,
      z: e.wz,
      work: e.animalWork,
      ai: e.fauna,
      item: e.workItem,
    })),
    "Timed out",
  ).toSatisfy(() => predicate());
}
const branches = (s: ScenarioSession) =>
  items(s).reduce(
    (n, e) =>
      n +
      (e.workItem?.kind === "lodge" || e.workItem?.growth?.food === "twig"
        ? e.workItem.units
        : e.workItem?.kind === "twig"
          ? 1
          : 0),
    0,
  );

it("mounting a grazing horse cancels its task through shared sync without clearing ridden status", async () => {
  const s = await ScenarioSession.create(rangeWorkRecipe("horse"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "graze");
    const food = target(s, a);
    setFaunaRidden(a, true);
    await s.step(idle, 1 / 30);
    expect(a.animalWork?.state).toBe("idle");
    expect(a.wanderAI?.state).toBe("ridden");
    expect(a.sprite?.clip).toBe(0);
    expect(food.workItem?.claimedBy).toBeUndefined();
    expect(food.workItem?.units).toBe(3);
  } finally {
    await s.close();
  }
}, 60000);

it("an unsupported raised pool is released before a drink at the work decision boundary", async () => {
  const s = await ScenarioSession.create(rangeWorkRecipe("horse"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "drink");
    const pool = target(s, a);
    pool.wz = 20;
    s.realm.animalWork.update(a, 2, context);
    expect(a.animalWork?.drunk ?? 0).toBe(0);
    expect(pool.workItem?.units).toBe(3);
    expect(pool.workItem?.claimedBy).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it("horse reloads grazing phase and alternates one real grass portion with one real drink", async () => {
  const s = await ScenarioSession.create(rangeWorkRecipe("horse"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "graze");
    const pose = { ...a.sprite },
      work = JSON.parse(JSON.stringify(a.animalWork));
    expect(a.velocity).toEqual({ vx: 0, vy: 0 });
    await s.reload();
    a = saved(s, a);
    expect(a.sprite?.frameCol).toBe(pose.frameCol);
    expect(a.animalWork).toEqual(work);
    await until(s, () => (a.animalWork?.drunk ?? 0) === 1);
    expect(a.animalWork?.eaten).toBe(1);
    for (const source of items(s)) expect(source.workItem?.units).toBe(2);
    expect(a.wz).toBe(0);
  } finally {
    await s.close();
  }
}, 60000);

it("giraffe browses actual canopy leaves at height while its feet remain grounded through reload", async () => {
  const s = await ScenarioSession.create(rangeWorkRecipe("giraffe"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "browse");
    const crop = target(s, a);
    expect(crop.workItem?.growth?.tree).toBeDefined();
    expect(crop.wz).toBe(48);
    const tree = required(s.realm.propManager.props.find((p) => p.type === "prop-palm-tree"));
    const crown = required(tree.walls?.find((w) => w.walkableTop));
    const footprint = getEntityAABB(crop.position, required(crop.collider));
    const support = getEntityAABB(tree.position, crown);
    expect(footprint.left).toBeGreaterThanOrEqual(support.left);
    expect(footprint.right).toBeLessThanOrEqual(support.right);
    expect(footprint.top).toBeGreaterThanOrEqual(support.top);
    expect(footprint.bottom).toBeLessThanOrEqual(support.bottom);
    expect(a.wz).toBe(0);
    const col = a.sprite?.frameCol;
    await s.reload();
    a = saved(s, a);
    expect(a.sprite?.frameCol).toBe(col);
    await until(s, () => a.animalWork?.eaten === 1);
    expect(saved(s, crop).workItem?.units).toBe(2);
    expect(a.animalWork?.state).toBe("lower");
  } finally {
    await s.close();
  }
}, 60000);

it("removing actual canopy support cancels browsing without eating or replacing the crop", async () => {
  const s = await ScenarioSession.create(rangeWorkRecipe("giraffe"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "browse");
    const crop = target(s, a),
      tree = required(s.realm.propManager.props.find((p) => p.type === "prop-palm-tree"));
    s.realm.propManager.remove(tree.id);
    await until(
      s,
      () => !s.realm.entityManager.entities.some((e) => e.persistentId === crop.persistentId),
      2,
    );
    expect(a.animalWork?.eaten).toBe(0);
    expect(a.animalWork?.targetId).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it("beaver reloads a real carried branch and consumes exactly four branches into persistent shelter stages", async () => {
  const s = await ScenarioSession.create(rangeWorkRecipe("beaver"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "return" && !!a.fauna?.motion);
    const branch = required(items(s).find((e) => e.parentId === a.id)),
      pose = { ...branch.position, z: branch.wz };
    expect(branch.workItem?.kind).toBe("twig");
    expect(branches(s)).toBe(6);
    await s.reload();
    a = saved(s, a);
    expect({ ...saved(s, branch).position, z: saved(s, branch).wz }).toEqual(pose);
    await until(s, () =>
      items(s).some((e) => e.workItem?.kind === "lodge" && e.workItem.units === 4),
    );
    expect(a.animalWork?.deliveries).toBe(4);
    expect(branches(s)).toBe(6);
    const lodge = required(items(s).find((e) => e.workItem?.kind === "lodge"));
    expect(lodge.sprite?.frameCol).toBe(68);
    await s.reload();
    a = saved(s, a);
    expect(saved(s, lodge).workItem?.units).toBe(4);
    for (let i = 0; i < 30 * 8; i++) await s.step(idle, 1 / 30);
    expect(a.animalWork?.deliveries).toBe(4);
    expect(items(s).filter((e) => e.workItem?.kind === "lodge")).toHaveLength(1);
    expect(saved(s, lodge).workItem?.claimedBy).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it("two beavers share one real shelter, can use loose crow twigs, and cannot exceed its four-branch capacity", async () => {
  const recipe = rangeWorkRecipe("beaver");
  recipe.actors = recipe.actors?.filter((e) => !e.workItem?.growth) ?? [];
  recipe.actors?.push(
    createFauna("beaver", 92, 184),
    ...[0, 1, 2, 3].map((i) => createForageItem("twig", 140 + i * 5, 184 + i * 6)),
  );
  const s = await ScenarioSession.create(recipe);
  try {
    await until(s, () =>
      items(s).some((e) => e.workItem?.kind === "lodge" && e.workItem.units === 4),
    );
    expect(branches(s)).toBe(4);
    expect(
      s.realm.entityManager.entities.reduce((n, e) => n + (e.animalWork?.deliveries ?? 0), 0),
    ).toBe(4);
    expect(items(s).filter((e) => e.workItem?.kind === "twig")).toHaveLength(0);
  } finally {
    await s.close();
  }
}, 60000);

it.each(["pickup", "return"] as const)(
  "scaring a beaver during %s releases both claims and conserves all branches",
  async (state) => {
    const s = await ScenarioSession.create(rangeWorkRecipe("beaver"));
    try {
      const a = animal(s);
      await until(s, () => a.animalWork?.state === state);
      startleFauna(a, { wx: a.position.wx + 10, wy: a.position.wy });
      await s.step(idle, 1 / 30);
      expect(branches(s)).toBe(6);
      expect(items(s).every((e) => !e.workItem?.claimedBy && e.parentId === undefined)).toBe(true);
      expect(a.fauna?.alarmFrom).toBeDefined();
    } finally {
      await s.close();
    }
  },
  60000,
);

it.each(["move", "remove"] as const)(
  "a shelter %s during construction drops the actual held branch instead of building remotely",
  async (edit) => {
    const s = await ScenarioSession.create(rangeWorkRecipe("beaver"));
    try {
      const a = animal(s);
      await until(s, () => a.animalWork?.state === "build");
      const site = required(items(s).find((e) => e.workItem?.kind === "lodge"));
      if (edit === "remove") s.realm.entityManager.remove(site.id);
      else {
        site.position.wx += 70;
        s.realm.entityManager.spatialHash.update(site);
      }
      s.realm.animalWork.update(a, 2, context);
      expect(a.animalWork?.deliveries).toBe(0);
      expect(a.animalWork?.heldId).toBeUndefined();
      expect(site.workItem?.units).toBe(0);
      expect(branches(s)).toBe(6);
    } finally {
      await s.close();
    }
  },
  60000,
);

it.each(["horse", "giraffe", "beaver"] as const)(
  "moving a %s source out of current contact cancels before taking stock",
  async (kind) => {
    const s = await ScenarioSession.create(rangeWorkRecipe(kind));
    try {
      const a = animal(s);
      await until(
        s,
        () =>
          a.animalWork?.state ===
          (kind === "horse" ? "graze" : kind === "giraffe" ? "browse" : "pickup"),
      );
      const food = target(s, a),
        tree = food.workItem?.growth?.tree;
      const current = {
        ...context,
        environment: { ...context.environment, climbTrees: () => (tree ? [tree] : []) },
      };
      const state = a.animalWork?.state;
      s.realm.animalWork.update(a, 0, current);
      expect(a.animalWork?.state).toBe(state);
      food.position.wx += 70;
      s.realm.entityManager.spatialHash.update(food);
      s.realm.animalWork.update(a, 2, current);
      expect(food.workItem?.units).toBe(3);
      expect(a.animalWork?.eaten).toBe(0);
      expect(a.animalWork?.heldId).toBeUndefined();
      expect(food.workItem?.claimedBy).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  60000,
);

it("unready shelter scopes freeze committed hauling and following releases the actual held branch", async () => {
  const s = await ScenarioSession.create(rangeWorkRecipe("beaver"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "return" && !!a.fauna?.motion);
    const phase = a.fauna?.motion?.elapsed,
      elapsed = a.animalWork?.elapsed;
    s.realm.animalWork.update(a, 0.2, { ...context, ready: () => false });
    prepareFaunaTravel(a, 0.2);
    expect(a.fauna?.motion?.elapsed).toBe(phase);
    expect(a.animalWork?.elapsed).toBe(elapsed);
    required(a.wanderAI).following = true;
    s.realm.animalWork.update(a, 0.2, context);
    expect(a.animalWork?.heldId).toBeUndefined();
    expect(branches(s)).toBe(6);
    expect(items(s).every((e) => !e.workItem?.claimedBy)).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);

it("new spring and branch stocks renew only with admitted ready time and preserve their slow saved intervals", async () => {
  const recipe = rangeWorkRecipe("horse");
  recipe.actors = [
    createFoodSource("spring-pool", 144, 176),
    createFoodSource("branch-pile", 176, 176),
  ];
  const s = await ScenarioSession.create(recipe);
  try {
    for (const e of items(s)) {
      required(e.workItem).units = 0;
      required(e.workItem?.growth).remaining = 0.5;
    }
    const admitted = new Map(items(s).map((e) => [e, 1]));
    tickFoodSources(s.realm.entityManager, admitted, context.environment, () => false);
    expect(items(s).every((e) => e.workItem?.growth?.remaining === 0.5)).toBe(true);
    await s.reload();
    await until(s, () => items(s).every((e) => e.workItem?.units === 1), 2);
    expect(
      items(s)
        .map((e) => e.workItem?.growth?.interval)
        .sort(),
    ).toEqual([180, 360]);
  } finally {
    await s.close();
  }
});

it.each(["horse", "giraffe", "beaver"] as const)(
  "placing a manual %s without supplies creates no hidden stock, support or shelter",
  async (kind) => {
    const recipe = rangeWorkRecipe(kind);
    recipe.actors = recipe.actors?.filter((e) => e.fauna) ?? [];
    recipe.nativeProps = [];
    const s = await ScenarioSession.create(recipe);
    try {
      for (let i = 0; i < 90; i++) await s.step(idle, 1 / 30);
      expect(items(s)).toHaveLength(0);
      expect(animal(s).animalWork?.eaten).toBe(0);
      expect(animal(s).animalWork?.deliveries).toBe(0);
    } finally {
      await s.close();
    }
  },
);

it.each(["horse", "giraffe", "beaver"] as const)(
  "natural %s homes use real cell-owned supplies through production authority",
  async (kind) => {
    const s = await ScenarioSession.create(naturalLandscapeRecipe(kind, "thicket"));
    try {
      const animals = s.realm.entityManager.entities.filter(
        (e) => e.type === `wildlife-${kind}-provisional-v1`,
      );
      expect(animals.length).toBeGreaterThan(0);
      const a = required(animals[0]);
      s.player.player.position = { wx: a.position.wx + 200, wy: a.position.wy + 180 };
      expect(items(s).length).toBeGreaterThan(0);
      await until(
        s,
        () =>
          animals.some(
            (e) =>
              (kind === "beaver" ? (e.animalWork?.deliveries ?? 0) : (e.animalWork?.eaten ?? 0)) >
              0,
          ),
        180,
      );
    } finally {
      await s.close();
    }
  },
  60000,
);
