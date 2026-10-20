import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import type { Entity } from "../entities/Entity.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { pastureWorkRecipe } from "../scenarios/PastureWorkRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createFauna } from "./Fauna.js";
import { createFoodSource } from "./ForageResources.js";
import { prepareFaunaTravel, startleFauna } from "./faunaInteractions.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const animal = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.fauna));
const source = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.workItem?.growth));
async function until(s: ScenarioSession, p: () => boolean, seconds = 60) {
  for (let i = 0; i < seconds * 30 && !p(); i++) await s.step(idle, 1 / 30);
  expect(
    s.realm.entityManager.entities.map((e) => ({
      type: e.type,
      p: e.position,
      z: e.wz,
      task: e.animalWork,
      ai: e.fauna,
      food: e.workItem,
    })),
    "Timed out",
  ).toSatisfy(() => p());
}
function saved(s: ScenarioSession, a: Entity) {
  return required(s.realm.entityManager.entities.find((e) => e.persistentId === a.persistentId));
}

it("goat browses one finite shrub portion, hops onto an actual rock and returns through midair and perch reloads", async () => {
  const s = await ScenarioSession.create(pastureWorkRecipe("goat"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "browse");
    expect(a.velocity).toEqual({ vx: 0, vy: 0 });
    await until(s, () => a.animalWork?.state === "hop" && (a.wz ?? 0) > 4);
    expect(a.animalWork?.eaten).toBe(1);
    expect(source(s).workItem?.units).toBe(2);
    const before = a.wz;
    await s.reload();
    a = saved(s, a);
    expect(a.wz).toBeCloseTo(before ?? 0, 5);
    await until(s, () => a.animalWork?.state === "perch");
    expect(a.wz).toBe(8);
    expect(a.animalWork?.hops).toBe(1);
    await s.reload();
    a = saved(s, a);
    expect(a.wz).toBe(8);
    await until(s, () => a.animalWork?.state === "idle" && (a.wz ?? 0) === 0);
    expect(a.animalWork?.hops).toBe(1);
  } finally {
    await s.close();
  }
}, 60000);

it.each(["root", "pickup"] as const)(
  "interrupting a pig during %s preserves every actual portion",
  async (state) => {
    const s = await ScenarioSession.create(pastureWorkRecipe("pig"));
    try {
      const a = animal(s);
      await until(s, () => a.animalWork?.state === state);
      startleFauna(a, { wx: a.position.wx + 12, wy: a.position.wy });
      await s.step(idle, 1 / 30);
      expect(a.animalWork?.state).toBe("idle");
      expect(a.animalWork?.eaten).toBe(0);
      const roots = s.realm.entityManager.entities.filter(
        (e) => e.workItem?.kind === "root" && !e.workItem.growth,
      );
      expect(roots.every((e) => e.parentId === undefined && !e.workItem?.claimedBy)).toBe(true);
      expect((source(s).workItem?.units ?? 0) + roots.length).toBe(3);
    } finally {
      await s.close();
    }
  },
  60000,
);

it("unready rock support freezes an admitted hop, and removing it preserves height continuity then lands on real ground", async () => {
  const s = await ScenarioSession.create(pastureWorkRecipe("goat"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "hop" && (a.wz ?? 0) > 4);
    const z = a.wz,
      elapsed = a.fauna?.motion?.elapsed;
    s.realm.animalWork.update(a, 0.2, {
      environment: { isWater: () => false, canOccupy: () => true },
      players: [],
      ready: () => false,
    });
    prepareFaunaTravel(a, 0.2);
    expect(a.wz).toBe(z);
    expect(a.fauna?.motion?.elapsed).toBe(elapsed);
    const rock = required(s.realm.propManager.props.find((p) => p.type === "prop-low-rock"));
    s.realm.propManager.remove(rock.id);
    await s.step(idle, 1 / 30);
    expect(Math.abs((a.wz ?? 0) - (z ?? 0))).toBeLessThan(2);
    await until(s, () => !a.fauna?.motion && (a.wz ?? 0) === 0);
    expect(a.animalWork?.hops ?? 0).toBe(0);
  } finally {
    await s.close();
  }
}, 60000);

it("removing an elephant's actual tree cancels a reach without creating a fruit", async () => {
  const s = await ScenarioSession.create(pastureWorkRecipe("elephant"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "reach");
    const tree = required(s.realm.propManager.props.find((p) => p.type === "prop-oak-tree"));
    s.realm.propManager.remove(tree.id);
    await until(s, () => !s.realm.entityManager.entities.some((e) => e.workItem?.growth));
    expect(a.animalWork?.harvested ?? 0).toBe(0);
    expect(a.animalWork?.heldId).toBeUndefined();
    expect(s.realm.entityManager.entities.filter((e) => e.workItem?.kind === "fruit")).toHaveLength(
      0,
    );
  } finally {
    await s.close();
  }
}, 60000);

it("a depleted root patch remains visible and renews from its saved timer", async () => {
  const recipe = pastureWorkRecipe("pig");
  recipe.actors = [createFoodSource("root-patch", 160, 176)];
  const s = await ScenarioSession.create(recipe);
  try {
    const root = source(s);
    required(root.workItem).units = 0;
    required(root.workItem?.growth).remaining = 0.6;
    await s.reload();
    const loaded = source(s);
    expect(loaded.workItem?.units).toBe(0);
    expect(loaded.sprite?.frameCol).toBe(34);
    await until(s, () => loaded.workItem?.units === 1, 2);
    expect(loaded.sprite?.frameCol).toBe(35);
    expect(loaded.workItem?.growth?.interval).toBe(300);
    expect(loaded.workItem?.growth?.capacity).toBe(3);
  } finally {
    await s.close();
  }
});

it("competing pigs share real stock and preserve portions across a reload", async () => {
  const recipe = pastureWorkRecipe("pig");
  recipe.actors?.push(createFauna("piglet", 128, 208));
  const s = await ScenarioSession.create(recipe);
  try {
    await until(s, () => s.realm.entityManager.entities.some((e) => e.animalWork?.heldId));
    await s.reload();
    await until(
      s,
      () => s.realm.entityManager.entities.reduce((n, e) => n + (e.animalWork?.eaten ?? 0), 0) >= 2,
    );
    const portions = s.realm.entityManager.entities.reduce(
      (n, e) =>
        n +
        (e.animalWork?.eaten ?? 0) +
        (e.workItem?.growth ? e.workItem.units : e.workItem?.kind === "root" ? 1 : 0),
      0,
    );
    expect(portions).toBe(3);
    expect(s.realm.entityManager.entities.filter((e) => e.workItem?.growth)).toHaveLength(1);
  } finally {
    await s.close();
  }
}, 60000);

it.each(["goat", "piglet", "elephant"] as const)(
  "natural %s homes have reachable supplies and shared production behavior",
  async (species) => {
    const s = await ScenarioSession.create(naturalLandscapeRecipe(species, "balanced"));
    try {
      const animals = s.realm.entityManager.entities.filter(
        (e) => e.type === `wildlife-${species}-provisional-v1`,
      );
      expect(animals.length).toBeGreaterThan(0);
      const a = required(animals[0]);
      s.player.player.position = { wx: a.position.wx + 200, wy: a.position.wy + 180 };
      expect(
        s.realm.entityManager.entities.some((e) => e.proceduralId?.endsWith(":pasture-food")),
      ).toBe(true);
      await until(s, () => animals.some((e) => (e.animalWork?.eaten ?? 0) > 0), 120);
    } finally {
      await s.close();
    }
  },
  60000,
);

it("pig uncovers one actual root, carries it through reload and eats without duplicating stock", async () => {
  const s = await ScenarioSession.create(pastureWorkRecipe("pig"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "root");
    expect(source(s).workItem?.units).toBe(3);
    await until(s, () => !!a.animalWork?.heldId);
    expect(source(s).workItem?.units).toBe(2);
    expect(a.animalWork?.uncovered).toBe(1);
    const root = required(
      s.realm.entityManager.entities.find((e) => e.workItem?.kind === "root" && !e.workItem.growth),
    );
    expect(root.parentId).toBe(a.id);
    expect(root.sprite?.frameCol).toBe(38); // The actual root cell on its first held snapshot.
    const rootId = root.persistentId;
    await s.reload();
    a = saved(s, a);
    await until(s, () => a.animalWork?.eaten === 1);
    expect(s.realm.entityManager.entities.some((e) => e.persistentId === rootId)).toBe(false);
    expect(source(s).workItem?.units).toBe(2);
    expect(a.animalWork?.uncovered).toBe(1);
  } finally {
    await s.close();
  }
}, 60000);

it("elephant reaches a real crop, curls one fruit to the mouth through reload, then shakes the remaining stock loose", async () => {
  const s = await ScenarioSession.create(pastureWorkRecipe("elephant"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "curl");
    expect(source(s).workItem?.units).toBe(2);
    expect(a.animalWork?.harvested).toBe(1);
    const held = required(s.realm.entityManager.entities.find((e) => e.parentId === a.id));
    expect(held.workItem?.kind).toBe("fruit");
    const pose = { x: held.position.wx, y: held.position.wy, z: held.wz };
    await s.reload();
    a = saved(s, a);
    const loaded = required(s.realm.entityManager.entities.find((e) => e.parentId === a.id));
    expect({ x: loaded.position.wx, y: loaded.position.wy, z: loaded.wz }).toEqual(pose);
    await until(s, () => a.animalWork?.eaten === 1);
    await until(s, () => a.animalWork?.shaken === 2);
    expect(source(s).workItem?.units).toBe(0);
    const fruit = s.realm.entityManager.entities.filter(
      (e) => e.workItem?.kind === "fruit" && !e.workItem.growth,
    );
    expect(fruit).toHaveLength(2);
    expect(fruit.every((e) => e.parentId === undefined && e.wz === 0)).toBe(true);
    expect(a.animalWork?.eaten).toBe(1);
    expect(a.animalWork?.harvested).toBe(1);
  } finally {
    await s.close();
  }
}, 60000);

it("removing a rock just before landing gives the goat time to settle onto the ground", async () => {
  const s = await ScenarioSession.create(pastureWorkRecipe("goat"));
  try {
    const a = animal(s);
    await until(
      s,
      () =>
        a.animalWork?.state === "hop" &&
        !a.animalWork.hopDown &&
        !!a.fauna?.motion &&
        a.fauna.motion.elapsed / a.fauna.motion.duration > 0.9,
    );
    const rock = required(s.realm.propManager.props.find((p) => p.type === "prop-low-rock"));
    s.realm.propManager.remove(rock.id);
    let previous = a.wz ?? 0;
    for (let i = 0; i < 60 && a.fauna?.motion; i++) {
      await s.step(idle, 1 / 30);
      const height = a.wz ?? 0;
      expect(Math.abs(height - previous)).toBeLessThan(2);
      expect(height).toBeGreaterThanOrEqual(0);
      previous = height;
    }
    expect(a.fauna?.motion).toBeUndefined();
    expect(a.wz).toBe(0);
  } finally {
    await s.close();
  }
}, 60000);
