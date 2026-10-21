import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { forestWorkRecipe } from "../scenarios/ForestWorkRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import type { WorkContext } from "./AnimalWorkSystem.js";
import { startleDeer } from "./deerInteractions.js";
import { createFauna, faunaType } from "./Fauna.js";
import { createFoodSource, createForageItem, forageType } from "./ForageResources.js";
import { prepareFaunaTravel, startleFauna } from "./faunaInteractions.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const actors = (s: ScenarioSession) => s.realm.entityManager.entities;
const animal = (s: ScenarioSession) => required(actors(s).find((e) => e.deer || e.fauna));
const byId = (s: ScenarioSession, id: string | undefined) =>
  required(actors(s).find((e) => e.persistentId === id));
const context: WorkContext = {
  environment: { isWater: () => false, surfaceZ: () => 0, canOccupy: () => true },
  players: [],
  ready: () => true,
};
it.each(["deer", "peacock", "raven"] as const)(
  "a newly blocked standing footprint interrupts %s work without a remote outcome",
  async (kind) => {
    const s = await ScenarioSession.create(forestWorkRecipe(kind));
    try {
      const a = animal(s);
      await until(
        s,
        () =>
          a.animalWork?.state ===
          (kind === "deer" ? "browse" : kind === "peacock" ? "display" : "bury"),
      );
      s.realm.animalWork.update(a, 2, {
        ...context,
        environment: { ...context.environment, canOccupy: () => false },
      });
      expect(a.animalWork?.state).toBe("idle");
      expect(a.animalWork?.eaten).toBe(0);
      expect(a.animalWork?.courted ?? 0).toBe(0);
      expect(a.animalWork?.deliveries).toBe(0);
      expect(a.animalWork?.heldId).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  60000,
);
it.each(["deer", "peacock", "raven"] as const)(
  "manual %s placement creates neither supplies nor extra animals",
  async (kind) => {
    const recipe = forestWorkRecipe(kind);
    recipe.actors = required(recipe.actors).slice(0, 1);
    const s = await ScenarioSession.create(recipe);
    try {
      for (let i = 0; i < 300; i++) await s.step(idle, 1 / 30);
      expect(actors(s).filter((e) => e.deer || e.fauna)).toHaveLength(1);
      expect(actors(s).filter((e) => e.workItem)).toEqual([]);
    } finally {
      await s.close();
    }
  },
  60000,
);
it("two ravens reserve and store each real pebble at most once", async () => {
  const recipe = forestWorkRecipe("raven");
  recipe.actors?.push(createFauna("raven", 160, 160));
  const s = await ScenarioSession.create(recipe);
  try {
    const ids = actors(s)
      .filter((e) => e.type === forageType("shiny"))
      .map((e) => e.persistentId)
      .sort();
    await until(
      s,
      () =>
        actors(s)
          .filter((e) => e.fauna)
          .reduce((n, e) => n + (e.animalWork?.deliveries ?? 0), 0) === 3,
      120,
    );
    const stored = actors(s)
      .filter((e) => e.workItem?.kind === "hoard")
      .flatMap((e) => e.workItem?.storedIds ?? [])
      .sort();
    expect(stored).toEqual(ids);
    expect(new Set(stored).size).toBe(3);
    expect(actors(s).filter((e) => e.type === forageType("shiny"))).toHaveLength(3);
  } finally {
    await s.close();
  }
}, 60000);
async function until(s: ScenarioSession, test: () => boolean, seconds = 80) {
  for (let i = 0; i < seconds * 30 && !test(); i++) await s.step(idle, 1 / 30);
  expect(
    actors(s)
      .filter((e) => e.deer || e.fauna)
      .map((e) => ({ p: e.position, z: e.wz, work: e.animalWork, ai: e.deer ?? e.fauna })),
    "Timed out",
  ).toSatisfy(() => test());
}
it("deer walks to finite browse contact and reloads the same paid meal/action", async () => {
  const s = await ScenarioSession.create(forestWorkRecipe("deer"));
  try {
    let a = animal(s);
    const start = { ...a.position };
    await until(s, () => a.animalWork?.state === "browse");
    expect(Math.hypot(a.position.wx - start.wx, a.position.wy - start.wy)).toBeGreaterThan(20);
    const task = JSON.parse(JSON.stringify(a.animalWork)),
      pose = { row: a.sprite?.frameRow, col: a.sprite?.frameCol };
    await s.reload();
    a = byId(s, a.persistentId);
    expect(a.animalWork).toEqual(task);
    expect({ row: a.sprite?.frameRow, col: a.sprite?.frameCol }).toEqual(pose);
    await until(s, () => a.animalWork?.eaten === 1);
    expect(required(actors(s).find((e) => e.workItem?.growth)).workItem?.units).toBe(2);
    expect(a.animalWork?.state).toBe("raise");
  } finally {
    await s.close();
  }
}, 60000);
it.each(["move", "raise"] as const)(
  "deer releases a %s shrub without taking a distant portion",
  async (change) => {
    const s = await ScenarioSession.create(forestWorkRecipe("deer"));
    try {
      const a = animal(s);
      await until(s, () => a.animalWork?.state === "browse");
      const food = required(actors(s).find((e) => e.workItem?.growth));
      if (change === "move") food.position.wx += 80;
      else food.wz = 20;
      s.realm.animalWork.update(a, 2, context);
      expect(a.animalWork?.eaten).toBe(0);
      expect(food.workItem?.units).toBe(3);
      expect(food.workItem?.claimedBy).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  60000,
);
it.each(["move", "remove", "alarm", "following", "blocked"] as const)(
  "peacock %s interruption cannot complete a remote encounter",
  async (change) => {
    const s = await ScenarioSession.create(forestWorkRecipe("peacock"));
    try {
      const a = animal(s);
      await until(s, () => a.animalWork?.state === "display");
      const b = byId(s, a.animalWork?.partnerId);
      if (change === "move") b.position.wx += 80;
      else if (change === "remove") s.realm.entityManager.remove(b.id);
      else if (change === "alarm") startleFauna(b, { wx: b.position.wx + 10, wy: b.position.wy });
      else if (change === "following") required(b.wanderAI).following = true;
      const ctx =
        change === "blocked"
          ? {
              ...context,
              environment: {
                ...context.environment,
                canOccupy: (_e: unknown, p: { wx: number; wy: number }) =>
                  Math.hypot(p.wx - b.position.wx, p.wy - b.position.wy) > 1,
              },
            }
          : context;
      s.realm.animalWork.update(a, 4, ctx);
      expect(a.animalWork?.courted ?? 0).toBe(0);
      expect(b.animalWork?.courted ?? 0).toBe(0);
      expect(a.animalWork?.partnerId).toBeUndefined();
      expect(b.animalWork?.partnerId).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  60000,
);
it("a lone peacock and birds from different natural groups cannot make up a partner", async () => {
  const recipe = forestWorkRecipe("peacock");
  const a = required(recipe.actors?.[0]),
    b = required(recipe.actors?.[1]);
  required(a.fauna).groupId = "one";
  required(b.fauna).groupId = "two";
  const s = await ScenarioSession.create(recipe);
  try {
    for (let i = 0; i < 300; i++) await s.step(idle, 1 / 30);
    expect(
      actors(s)
        .filter((e) => e.fauna)
        .every((e) => !e.animalWork?.partnerId && !e.animalWork?.courted),
    ).toBe(true);
    s.realm.entityManager.remove(required(actors(s).find((e) => e.fauna?.groupId === "two")).id);
    for (let i = 0; i < 120; i++) await s.step(idle, 1 / 30);
    expect(animal(s).animalWork?.partnerId).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);
it("a third peacock cannot join an already reserved reciprocal pair", async () => {
  const recipe = forestWorkRecipe("peacock");
  recipe.actors?.push(createFauna("peacock", 176, 224));
  const s = await ScenarioSession.create(recipe);
  try {
    await until(s, () => actors(s).some((e) => e.animalWork?.state === "display"));
    const pair = actors(s).filter((e) => e.animalWork?.partnerId);
    expect(pair).toHaveLength(2);
    for (const a of pair)
      expect(byId(s, a.animalWork?.partnerId).animalWork?.partnerId).toBe(a.persistentId);
  } finally {
    await s.close();
  }
}, 60000);
it("moving a raven cache while it carries an object drops that actual object without a deposit", async () => {
  const s = await ScenarioSession.create(forestWorkRecipe("raven"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "return");
    const held = byId(s, a.animalWork?.heldId),
      site = byId(s, a.animalWork?.siteId);
    site.position.wx += 48;
    s.realm.animalWork.update(a, 2, context);
    expect(a.animalWork?.deliveries).toBe(0);
    expect(site.workItem?.units).toBe(0);
    expect(held.parentId).toBeUndefined();
    expect(held.workItem?.claimedBy).toBeUndefined();
    expect(actors(s).filter((e) => e.type === forageType("shiny"))).toHaveLength(3);
  } finally {
    await s.close();
  }
}, 60000);
it("a placed cache is reused, stops at three objects and leaves a fourth pebble loose", async () => {
  const recipe = forestWorkRecipe("raven");
  recipe.actors?.push(createForageItem("hoard", 144, 200), createForageItem("shiny", 188, 204));
  const s = await ScenarioSession.create(recipe);
  try {
    const a = animal(s),
      site = required(actors(s).find((e) => e.type === forageType("hoard")));
    await until(s, () => a.animalWork?.deliveries === 3, 120);
    for (let i = 0; i < 600; i++) await s.step(idle, 1 / 30);
    expect(actors(s).filter((e) => e.type === forageType("hoard"))).toHaveLength(1);
    expect(a.animalWork?.siteId).toBe(site.persistentId);
    expect(site.workItem?.storedIds).toHaveLength(3);
    expect(a.animalWork?.deliveries).toBe(3);
    expect(
      actors(s).filter((e) => e.type === forageType("shiny") && e.parentId === undefined),
    ).toHaveLength(1);
  } finally {
    await s.close();
  }
}, 60000);
it.each(["deer", "peacock", "raven"] as const)(
  "%s freezes work clocks at an unready target and preserves controlled companions",
  async (kind) => {
    const s = await ScenarioSession.create(forestWorkRecipe(kind));
    try {
      const a = animal(s);
      await until(s, () =>
        kind === "deer"
          ? a.animalWork?.state === "browse"
          : kind === "peacock"
            ? a.animalWork?.state === "display"
            : a.animalWork?.state === "return" && !!a.fauna?.motion,
      );
      const task = required(a.animalWork),
        elapsed = task.elapsed,
        cooldown = task.cooldown,
        motion = a.fauna?.motion?.elapsed;
      s.realm.animalWork.update(a, 10, {
        ...context,
        ready: () => false,
        environment: { ...context.environment, surfaceZ: () => 999 },
      });
      if (a.fauna?.motion) prepareFaunaTravel(a, 1);
      expect(task.elapsed).toBe(elapsed);
      expect(task.cooldown).toBe(cooldown);
      expect(a.fauna?.motion?.elapsed).toBe(motion);
      required(a.wanderAI).following = true;
      s.realm.animalWork.syncAll(actors(s));
      expect(task.state).toBe("idle");
      expect(task.heldId).toBeUndefined();
      expect(task.partnerId).toBeUndefined();
      expect(
        actors(s)
          .filter((e) => e.type === faunaType("peacock"))
          .every((e) => !e.animalWork?.partnerId),
      ).toBe(true);
    } finally {
      await s.close();
    }
  },
  60000,
);
it("a browsing deer visibly stamps, saves that alarm and then physically escapes", async () => {
  const s = await ScenarioSession.create(forestWorkRecipe("deer"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "browse");
    startleDeer(a, { wx: a.position.wx - 10, wy: a.position.wy });
    await until(s, () => a.animalWork?.state === "stamp");
    const pose = a.sprite?.frameCol;
    await s.reload();
    a = byId(s, a.persistentId);
    expect(a.sprite?.frameCol).toBe(pose);
    expect(a.animalWork?.eaten).toBe(0);
    expect(actors(s).find((e) => e.workItem?.growth)?.workItem?.claimedBy).toBeUndefined();
    const start = { ...a.position };
    await until(s, () => a.deer?.state === "flee");
    expect(a.animalWork?.alarms).toBe(1);
    await until(s, () => Math.hypot(a.position.wx - start.wx, a.position.wy - start.wy) > 12);
    expect(a.animalWork?.alarms).toBe(1);
  } finally {
    await s.close();
  }
}, 60000);
it("two peacocks actually meet, reload reciprocal displays and count one encounter each", async () => {
  const s = await ScenarioSession.create(forestWorkRecipe("peacock"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "display");
    const b = byId(s, a.animalWork?.partnerId);
    expect(b.animalWork?.partnerId).toBe(a.persistentId);
    expect(
      Math.hypot(a.position.wx - b.position.wx, a.position.wy - b.position.wy),
    ).toBeLessThanOrEqual(42);
    const poses = () =>
      actors(s)
        .filter((e) => e.fauna)
        .map((e) => ({
          id: e.persistentId,
          p: { ...e.position },
          work: JSON.parse(JSON.stringify(e.animalWork)),
          col: e.sprite?.frameCol,
          row: e.sprite?.frameRow,
        }))
        .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
    const saved = poses();
    await s.reload();
    expect(poses()).toEqual(saved);
    a = byId(s, a.persistentId);
    await until(s, () => a.animalWork?.courted === 1);
    expect(
      actors(s)
        .filter((e) => e.fauna)
        .map((e) => e.animalWork?.courted),
    ).toEqual([1, 1]);
    expect(
      actors(s)
        .filter((e) => e.fauna)
        .every((e) => !e.animalWork?.partnerId),
    ).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);
it("raven carry, saved cache stocks and deletion conserve the same three real pebble actors", async () => {
  const s = await ScenarioSession.create(forestWorkRecipe("raven"));
  try {
    let a = animal(s);
    const ids = actors(s)
      .filter((e) => e.type === forageType("shiny"))
      .map((e) => e.persistentId)
      .sort();
    await until(s, () => !!a.animalWork?.heldId);
    const held = a.animalWork?.heldId;
    expect(byId(s, held).parentId).toBe(a.id);
    await s.reload();
    a = byId(s, a.persistentId);
    expect(a.animalWork?.heldId).toBe(held);
    expect(byId(s, held).parentId).toBe(a.id);
    await until(s, () => a.animalWork?.deliveries === 3, 120);
    const cache = byId(s, a.animalWork?.siteId);
    expect(cache.workItem?.storedIds?.slice().sort()).toEqual(ids);
    expect(cache.workItem?.units).toBe(3);
    expect(
      actors(s)
        .filter((e) => e.type === forageType("shiny"))
        .map((e) => e.persistentId)
        .sort(),
    ).toEqual(ids);
    await s.reload();
    a = byId(s, a.persistentId);
    const restored = byId(s, cache.persistentId);
    for (const id of ids) {
      const item = byId(s, id);
      expect(item.parentId).toBe(restored.id);
      expect(item.workItem?.cachedIn).toBe(restored.persistentId);
      expect(item.flashHidden).toBe(true);
    }
    s.realm.entityManager.remove(restored.id);
    for (const id of ids) {
      const item = byId(s, id);
      expect(item.parentId).toBeUndefined();
      expect(item.workItem?.cachedIn).toBeUndefined();
      expect(item.flashHidden).toBe(false);
    }
    expect(actors(s).filter((e) => e.type === forageType("shiny"))).toHaveLength(3);
    await s.reload();
    for (const id of ids) {
      expect(byId(s, id).parentId).toBeUndefined();
      expect(byId(s, id).workItem?.cachedIn).toBeUndefined();
      expect(byId(s, id).flashHidden).toBe(false);
    }
  } finally {
    await s.close();
  }
}, 60000);

it.each(["deer", "raven", "raven-site"] as const)(
  "%s rejects an unready distant candidate before probing its terrain",
  async (kind) => {
    const recipe = forestWorkRecipe(kind === "deer" ? "deer" : "raven");
    const a = required(recipe.actors?.[0]);
    recipe.actors = [a];
    const x = a.position.wx,
      y = a.position.wy;
    recipe.actors.push(
      kind === "deer"
        ? createFoodSource("browse-shrub", x + 150, y)
        : createForageItem("shiny", x + (kind === "raven-site" ? 40 : 150), y),
    );
    if (kind === "raven-site") recipe.actors.push(createForageItem("hoard", x + 150, y));
    const distant = required(recipe.actors.find((e) => e.position.wx === x + 150));
    required(distant.workItem).claimedBy = "unready-retained-claim";
    const s = await ScenarioSession.create(recipe);
    try {
      const inside = (p: { wx: number; wy: number }) => Math.hypot(p.wx - x, p.wy - y) < 96;
      const probe = (p: { wx: number; wy: number }) => {
        if (!inside(p)) throw Error("Unready candidate terrain probe");
        return 0;
      };
      expect(() =>
        s.realm.animalWork.update(animal(s), 1 / 30, {
          ...context,
          ready: inside,
          environment: {
            ...context.environment,
            surfaceZ: probe,
            isWater: (p) => {
              probe(p);
              return false;
            },
          },
        }),
      ).not.toThrow();
      expect(actors(s).find((e) => e.position.wx === x + 150)?.workItem?.claimedBy).toBe(
        "unready-retained-claim",
      );
      if (kind === "raven-site") {
        const site = actors(s).find((e) => e.persistentId === animal(s).animalWork?.siteId);
        expect(site?.position.wx).not.toBe(x + 150);
      } else expect(animal(s).animalWork?.targetId).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  60000,
);
