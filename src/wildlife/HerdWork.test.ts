import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { herdWorkRecipe } from "../scenarios/HerdWorkRecipe.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import type { WorkContext } from "./AnimalWorkSystem.js";
import { createFauna, faunaProfile } from "./Fauna.js";
import { forageType } from "./ForageResources.js";
import { startleFauna } from "./faunaInteractions.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const animals = (s: ScenarioSession) => s.realm.entityManager.entities.filter((e) => e.fauna);
const animal = (s: ScenarioSession) => required(animals(s)[0]);
const item = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.workItem));
const saved = (s: ScenarioSession, a: Entity) =>
  required(s.realm.entityManager.entities.find((e) => e.persistentId === a.persistentId));
const context: WorkContext = {
  environment: { isWater: () => false, surfaceZ: () => 0, canOccupy: () => true },
  players: [],
  ready: () => true,
};
async function until(s: ScenarioSession, check: () => boolean, seconds = 80) {
  for (let i = 0; i < seconds * 30 && !check(); i++) await s.step(idle, 1 / 30);
  expect(
    animals(s).map((e) => ({ p: e.position, work: e.animalWork, ai: e.fauna })),
    "Timed out",
  ).toSatisfy(() => check());
}

it("cow pays one grass portion, reloads resting rumination and stands after chewing exactly that meal", async () => {
  const s = await ScenarioSession.create(herdWorkRecipe("cow"));
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "ruminate");
    expect(a.animalWork?.eaten).toBe(1);
    expect(item(s).workItem?.units).toBe(2);
    expect(a.velocity).toEqual({ vx: 0, vy: 0 });
    const work = JSON.parse(JSON.stringify(a.animalWork)),
      sprite = { ...a.sprite };
    await s.reload();
    a = saved(s, a);
    expect(a.animalWork).toEqual(work);
    expect(a.sprite?.frameCol).toBe(sprite.frameCol);
    await until(s, () => a.animalWork?.state === "stand");
    expect(a.animalWork?.ruminated).toBe(1);
    expect(a.animalWork?.eaten).toBe(1);
    expect(item(s).workItem?.units).toBe(2);
  } finally {
    await s.close();
  }
}, 60000);

it("interrupted cow rumination keeps its paid meal and resumes without eating again", async () => {
  const s = await ScenarioSession.create(herdWorkRecipe("cow"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "ruminate");
    startleFauna(a, { wx: a.position.wx + 10, wy: a.position.wy });
    await s.step(idle, 1 / 30);
    expect(a.animalWork?.ruminated ?? 0).toBe(0);
    expect(a.animalWork?.eaten).toBe(1);
    expect(item(s).workItem?.claimedBy).toBeUndefined();
    await until(s, () => a.animalWork?.ruminated === 1);
    expect(a.animalWork?.eaten).toBe(1);
    expect(item(s).workItem?.units).toBe(2);
  } finally {
    await s.close();
  }
}, 60000);

it("unpaid rumination is rejected and moved grazing stock cannot be eaten remotely", async () => {
  const s = await ScenarioSession.create(herdWorkRecipe("cow"));
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "graze");
    item(s).wz = 20;
    s.realm.animalWork.update(a, 2, context);
    expect(a.animalWork?.eaten).toBe(0);
    expect(item(s).workItem?.units).toBe(3);
    const work = required(a.animalWork);
    work.state = "ruminate";
    work.elapsed = 5;
    s.realm.animalWork.update(a, 1, context);
    expect(work.state).toBe("idle");
    expect(work.ruminated ?? 0).toBe(0);
  } finally {
    await s.close();
  }
}, 60000);

it("separated sheep actually regroup and reload the visible reunion pose", async () => {
  const s = await ScenarioSession.create(herdWorkRecipe("sheep"));
  try {
    let a = animal(s);
    const start = { ...a.position };
    await until(s, () => a.animalWork?.state === "bleat");
    expect(Math.hypot(a.position.wx - start.wx, a.position.wy - start.wy)).toBeGreaterThan(20);
    const nearest = Math.min(
      ...animals(s)
        .filter((e) => e !== a)
        .map((e) => Math.hypot(e.position.wx - a.position.wx, e.position.wy - a.position.wy)),
    );
    expect(nearest).toBeLessThanOrEqual(64);
    const col = a.sprite?.frameCol;
    const poses = () =>
      animals(s)
        .map((e) => ({
          id: e.persistentId,
          row: e.sprite?.frameRow,
          direction: e.sprite?.direction,
          column: e.sprite?.frameCol,
        }))
        .sort((x, y) => (x.id ?? "").localeCompare(y.id ?? ""));
    const before = poses();
    await s.reload();
    a = saved(s, a);
    expect(a.sprite?.frameCol).toBe(col);
    expect(poses()).toEqual(before);
    await until(s, () => a.animalWork?.regrouped === 1);
    expect(a.wz).toBe(0);
    expect(a.animalWork?.state).toBe("idle");
  } finally {
    await s.close();
  }
}, 60000);

it("sheep never recruits another natural group, attached or following companions", async () => {
  const s = await ScenarioSession.create(herdWorkRecipe("sheep"));
  try {
    const [a, b, c] = animals(s);
    required(required(a).fauna).groupId = "flock-a";
    required(required(b).fauna).groupId = "flock-b";
    required(required(c).fauna).groupId = "flock-a";
    required(required(c).wanderAI).following = true;
    s.realm.animalWork.update(required(a), 1, context);
    expect(a?.animalWork?.targetId).toBeUndefined();
    required(required(c).wanderAI).following = false;
    required(c).parentId = s.player.player.id;
    s.realm.animalWork.update(required(a), 5, context);
    expect(a?.animalWork?.targetId).toBeUndefined();
    expect(c?.parentId).toBe(s.player.player.id);
  } finally {
    await s.close();
  }
});

it("a moving or removed sheep peer does not produce a remote reunion", async () => {
  const r = herdWorkRecipe("sheep");
  r.actors = r.actors?.slice(0, 2) ?? [];
  const s = await ScenarioSession.create(r);
  try {
    const a = animal(s);
    await until(s, () => a.animalWork?.state === "bleat");
    const peer = required(animals(s).find((e) => e !== a));
    s.realm.entityManager.remove(peer.id);
    s.realm.animalWork.update(a, 2, context);
    expect(a.animalWork?.regrouped ?? 0).toBe(0);
    expect(a.animalWork?.targetId).toBeUndefined();
  } finally {
    await s.close();
  }
}, 60000);

it("donkey reloads a supported roll and makes one saved scuff only on completion", async () => {
  const recipe = herdWorkRecipe("donkey"),
    first = required(recipe.actors?.[0]);
  first.position = { wx: 208, wy: 184 };
  Object.assign(required(first.fauna), {
    home: { ...first.position },
    target: { ...first.position },
    shelter: { ...first.position },
  });
  const s = await ScenarioSession.create(recipe);
  try {
    let a = animal(s);
    await until(s, () => a.animalWork?.state === "roll");
    expect(a.sprite?.direction).toBe(Direction.Left);
    expect(item(s).workItem?.units).toBe(0);
    expect(item(s).collider?.physicalHeight).toBe(0);
    const pose = { ...a.sprite };
    await s.reload();
    a = saved(s, a);
    expect(a.sprite?.frameCol).toBe(pose.frameCol);
    await until(s, () => a.animalWork?.dustBaths === 1);
    expect(item(s).workItem?.units).toBe(1);
    expect(item(s).sprite?.frameCol).toBe(70);
    await until(s, () => a.animalWork?.state === "idle");
    expect(item(s).workItem?.claimedBy).toBeUndefined();
    await s.reload();
    expect(item(s).workItem?.units).toBe(1);
  } finally {
    await s.close();
  }
}, 60000);

it.each(["move", "raise", "remove"] as const)(
  "dust patch %s during a roll cancels without adding a bath or scuff",
  async (edit) => {
    const s = await ScenarioSession.create(herdWorkRecipe("donkey"));
    try {
      const a = animal(s);
      await until(s, () => a.animalWork?.state === "roll");
      const patch = item(s);
      if (edit === "move") patch.position.wx += 30;
      else if (edit === "raise") patch.wz = 16;
      else s.realm.entityManager.remove(patch.id);
      s.realm.animalWork.update(a, 4, context);
      expect(a.animalWork?.dustBaths ?? 0).toBe(0);
      expect(patch.workItem?.units).toBe(0);
      expect(patch.workItem?.claimedBy).toBeUndefined();
      expect(a.animalWork?.state).toBe("idle");
    } finally {
      await s.close();
    }
  },
  60000,
);

it("dust bathing requires room around the entire rolling area, not just a dry site center", async () => {
  const s = await ScenarioSession.create(herdWorkRecipe("donkey"));
  try {
    const a = animal(s),
      patch = item(s);
    const blocked = {
      ...context,
      environment: {
        ...context.environment,
        isWater: (p: { wx: number }) => p.wx > patch.position.wx + 10,
      },
    };
    s.realm.animalWork.update(a, 1, blocked);
    expect(a.animalWork?.targetId).toBeUndefined();
    expect(patch.workItem?.claimedBy).toBeUndefined();
  } finally {
    await s.close();
  }
});

it("two donkeys reserve one reusable patch without overlapping baths or consuming the site", async () => {
  const r = herdWorkRecipe("donkey");
  r.actors?.push(createFauna("donkey", 208, 184));
  const s = await ScenarioSession.create(r);
  try {
    await until(s, () => animals(s).some((a) => a.animalWork?.state === "roll"));
    expect(animals(s).filter((a) => a.animalWork?.state === "roll")).toHaveLength(1);
    expect(item(s).workItem?.claimedBy).toBeTruthy();
    await until(s, () => animals(s).reduce((n, a) => n + (a.animalWork?.dustBaths ?? 0), 0) >= 2);
    expect(item(s).workItem?.units).toBe(2);
    expect(item(s).type).toBe(forageType("dust"));
  } finally {
    await s.close();
  }
}, 60000);

it.each(["cow", "donkey"] as const)(
  "%s action clocks and outcomes freeze while the resource scope is unready",
  async (kind) => {
    const s = await ScenarioSession.create(herdWorkRecipe(kind));
    try {
      const a = animal(s);
      await until(s, () => a.animalWork?.state === (kind === "cow" ? "graze" : "roll"));
      const before = JSON.stringify(a.animalWork),
        units = item(s).workItem?.units;
      s.realm.animalWork.update(a, 30, { ...context, ready: () => false });
      expect(JSON.stringify(a.animalWork)).toBe(before);
      expect(item(s).workItem?.units).toBe(units);
    } finally {
      await s.close();
    }
  },
  60000,
);

it.each(["cow", "sheep", "donkey"] as const)(
  "following %s cancels its active task and preserves companion control",
  async (kind) => {
    const s = await ScenarioSession.create(herdWorkRecipe(kind));
    try {
      const a = animal(s);
      await until(s, () => ["graze", "bleat", "roll"].includes(a.animalWork?.state ?? ""));
      required(a.wanderAI).following = true;
      s.realm.animalWork.sync(a);
      expect(a.animalWork?.state).toBe("idle");
      expect(a.wanderAI?.following).toBe(true);
      expect(s.realm.entityManager.entities.every((e) => !e.workItem?.claimedBy)).toBe(true);
    } finally {
      await s.close();
    }
  },
  60000,
);

it("natural cow and donkey supplies preserve manual placement semantics", async () => {
  for (const kind of ["cow", "donkey"] as const) {
    const r = herdWorkRecipe(kind);
    r.actors = [createFauna(kind, 112, 176)];
    const s = await ScenarioSession.create(r);
    try {
      for (let i = 0; i < 90; i++) await s.step(idle, 1 / 30);
      expect(s.realm.entityManager.entities.some((e) => e.workItem)).toBe(false);
    } finally {
      await s.close();
    }
  }
});

it.each(["cow", "donkey"] as const)(
  "%s natural inspection uses its actual new supply and shared work authority",
  async (kind) => {
    const s = await ScenarioSession.create(naturalLandscapeRecipe(kind, "thicket"));
    try {
      const group = animals(s).filter((e) => faunaProfile(e.type)?.species === kind);
      expect(group.length).toBeGreaterThan(0);
      const first = required(group[0]);
      s.player.player.position = { wx: first.position.wx + 200, wy: first.position.wy + 180 };
      await until(
        s,
        () =>
          group.some((a) =>
            kind === "cow"
              ? (a.animalWork?.ruminated ?? 0) > 0
              : (a.animalWork?.dustBaths ?? 0) > 0,
          ),
        140,
      );
    } finally {
      await s.close();
    }
  },
  60000,
);
