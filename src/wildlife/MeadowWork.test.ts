import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { actorPlacements } from "../generation/ActorPlacements.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { meadowWorkRecipe } from "../scenarios/MeadowWorkRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna, faunaProfile } from "./Fauna.js";
import { createForageItem } from "./ForageResources.js";
import { createPredator } from "./Predator.js";
import { createRabbit } from "./Rabbit.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
it.each([
  {
    profile: undefined,
    bounds: { minX: -132, minY: -468, maxX: -12, maxY: -380 },
    label: "default",
  },
  {
    profile: "balanced" as const,
    bounds: { minX: -468, minY: -564, maxX: -364, maxY: -460 },
    label: "balanced",
  },
])("keeps dense forest previews inside the existing actor cap ($label)", ({ profile, bounds }) => {
  const actors = actorPlacements(
    createGenerator(createDescriptor("regional", 2026), profile),
    bounds,
  );
  expect(actors.length).toBeLessThanOrEqual(128);
  expect(actors.filter((a) => a.robin).length).toBeGreaterThan(50);
  const seeds = actors.filter((a) => a.type.includes("resource-seed"));
  expect(seeds.length).toBeGreaterThan(0);
  expect(
    new Set(seeds.map((a) => `${Math.floor(a.wx / 256)},${Math.floor(a.wy / 256)}`)).size,
  ).toBe(seeds.length);
});
it.each(["food", "owner"] as const)(
  "reconciles a food claim after independent %s residency eviction",
  async (evicted) => {
    const s = await ScenarioSession.create(meadowWorkRecipe("rabbit"));
    try {
      const rabbit = required(s.realm.entityManager.entities.find((e) => e.rabbit));
      await until(s, () => rabbit.animalWork?.state === "eat");
      const plant = required(
        s.realm.entityManager.entities.find((e) => e.workItem?.kind === "greens"),
      );
      const record = encodeActor(evicted === "food" ? plant : rabbit);
      s.realm.entityManager.remove(evicted === "food" ? plant.id : rabbit.id, false);
      if (evicted === "food") {
        await until(s, () => rabbit.animalWork?.state === "idle");
        const loaded = decodeActor(record);
        if ("isProp" in loaded) throw Error("Expected a resource actor");
        s.realm.entityManager.spawn(loaded);
      } else s.realm.entityManager.spawn(createRabbit(128, 176));
      await until(s, () =>
        s.realm.entityManager.entities.some((e) => (e.animalWork?.eaten ?? 0) > 0),
      );
      if (evicted === "owner") {
        const loaded = decodeActor(record);
        if ("isProp" in loaded) throw Error("Expected an animal actor");
        s.realm.entityManager.spawn(loaded);
      }
      await until(
        s,
        () => !s.realm.entityManager.entities.some((e) => e.workItem?.kind === "greens"),
      );
      expect(
        s.realm.entityManager.entities.reduce((n, e) => n + (e.animalWork?.eaten ?? 0), 0),
      ).toBe(3);
    } finally {
      await s.close();
    }
  },
  60000,
);
it("loose food does not dilute bounded predator prey acquisition", async () => {
  const outcomes = [];
  for (const resources of [0, 64]) {
    const recipe = meadowWorkRecipe("meerkat");
    recipe.actors = [
      createPredator("spider", 128, 128),
      createFauna("ant", 188, 128),
      ...Array.from({ length: resources }, (_, i) =>
        createForageItem("seed", 96 + (i % 8) * 8, 96 + Math.floor(i / 8) * 8),
      ),
    ];
    const s = await ScenarioSession.create(recipe);
    try {
      const hunter = required(s.realm.entityManager.entities.find((e) => e.predator));
      const frames = [];
      for (let i = 0; i < 600 && !hunter.predator?.meals; i++) {
        await s.step(idle, 1 / 30);
        frames.push({
          p: { ...hunter.position },
          state: hunter.predator?.state,
          meals: hunter.predator?.meals,
        });
      }
      expect(hunter.predator?.meals).toBe(1);
      outcomes.push(frames);
    } finally {
      await s.close();
    }
  }
  expect(outcomes[1]).toEqual(outcomes[0]);
}, 60000);
async function until(s: ScenarioSession, check: () => boolean, seconds = 45) {
  for (let i = 0; i < seconds * 30 && !check(); i++) await s.step(idle, 1 / 30);
  if (!check())
    throw Error(
      JSON.stringify(
        s.realm.entityManager.entities.map((e) => ({
          type: e.type,
          pos: e.position,
          z: e.wz,
          task: e.animalWork,
          ai: e.rabbit ?? e.robin ?? e.fauna,
          item: e.workItem,
        })),
        null,
        2,
      ),
    );
}
it("rabbit nibbles three actual plant units, checks for danger and preserves a mid-bite reload", async () => {
  const s = await ScenarioSession.create(meadowWorkRecipe("rabbit"));
  try {
    let rabbit = required(s.realm.entityManager.entities.find((e) => e.rabbit));
    await until(s, () => rabbit.animalWork?.state === "eat");
    const facing = rabbit.sprite?.direction;
    await s.reload();
    rabbit = required(s.realm.entityManager.entities.find((e) => e.rabbit));
    expect(rabbit.animalWork?.state).toBe("eat");
    expect(rabbit.sprite?.direction).toBe(facing);
    expect(rabbit.sprite?.clip).toBe(3);
    expect(deserializeEntity(serializeEntity(rabbit)).sprite?.clip).toBe(3);
    await until(s, () => rabbit.animalWork?.eaten === 1);
    const plant = required(
      s.realm.entityManager.entities.find((e) => e.workItem?.kind === "greens"),
    );
    expect(plant.workItem?.units).toBe(2);
    expect(plant.sprite?.clip).toBe(1);
    expect(rabbit.animalWork?.state).toBe("rest");
    await until(s, () => rabbit.animalWork?.eaten === 3);
    expect(s.realm.entityManager.entities.some((e) => e.workItem?.kind === "greens")).toBe(false);
    expect(s.realm.entityManager.spatialHash.queryRange(-1, -1, 2, 2)).not.toContain(plant);
    await s.reload();
    expect(s.realm.entityManager.entities.some((e) => e.workItem?.kind === "greens")).toBe(false);
  } finally {
    await s.close();
  }
}, 60000);

it("does not create resources for a manually placed animal and refuses unready or blocked goals", async () => {
  const s = await ScenarioSession.create(meadowWorkRecipe("rabbit"));
  try {
    const rabbit = required(s.realm.entityManager.entities.find((e) => e.rabbit));
    const plant = required(
      s.realm.entityManager.entities.find((e) => e.workItem?.kind === "greens"),
    );
    const context = {
      environment: { isWater: () => false, surfaceZ: () => 0, canOccupy: () => true },
      players: [],
      ready: () => false,
    };
    s.realm.animalWork.update(rabbit, 0.1, context);
    expect(plant.workItem?.claimedBy).toBeUndefined();
    if (rabbit.animalWork) rabbit.animalWork.cooldown = 0;
    s.realm.animalWork.update(rabbit, 0.1, {
      ...context,
      ready: () => true,
      environment: { ...context.environment, canOccupy: () => false },
    });
    expect(plant.workItem?.claimedBy).toBeUndefined();
    s.realm.entityManager.remove(plant.id);
    for (let i = 0; i < 120; i++) await s.step(idle, 1 / 30);
    expect(s.realm.entityManager.entities.some((e) => e.workItem)).toBe(false);
    expect(rabbit.animalWork?.eaten).toBe(0);
  } finally {
    await s.close();
  }
}, 60000);

it.each([false, true])(
  "a removed canopy cannot receive a robin (already returning=%s)",
  async (returning) => {
    const s = await ScenarioSession.create(meadowWorkRecipe("robin"));
    try {
      const bird = required(s.realm.entityManager.entities.find((e) => e.robin));
      await until(s, () =>
        returning
          ? !!bird.robin?.motion && bird.animalWork?.state === "return"
          : bird.animalWork?.state === "eat",
      );
      s.realm.propManager.remove(
        required(s.realm.propManager.props.find((p) => p.type === "prop-oak-tree")).id,
      );
      await until(s, () => !bird.robin?.motion && (bird.wz ?? 0) < 1);
      expect(bird.animalWork?.deliveries).toBe(0);
      await s.reload();
      expect(required(s.realm.entityManager.entities.find((e) => e.robin)).wz ?? 0).toBeLessThan(1);
    } finally {
      await s.close();
    }
  },
  60000,
);

it("deleting a feeding animal releases its claim without consuming the plant", async () => {
  const s = await ScenarioSession.create(meadowWorkRecipe("rabbit"));
  try {
    const rabbit = required(s.realm.entityManager.entities.find((e) => e.rabbit));
    await until(s, () => rabbit.animalWork?.state === "eat");
    s.realm.entityManager.remove(rabbit.id);
    const plant = required(
      s.realm.entityManager.entities.find((e) => e.workItem?.kind === "greens"),
    );
    expect(plant.workItem?.claimedBy).toBeUndefined();
    expect(plant.workItem?.units).toBe(3);
    await s.reload();
    expect(s.realm.entityManager.entities.some((e) => e.rabbit)).toBe(false);
  } finally {
    await s.close();
  }
}, 60000);

it("lookout alarms leave following companions protected and ignore harmless animals", async () => {
  const s = await ScenarioSession.create(meadowWorkRecipe("meerkat"));
  try {
    const group = s.realm.entityManager.entities.filter(
      (e) => e.fauna && e.type.includes("meerkat"),
    );
    await until(s, () => group.some((e) => e.animalWork?.state === "scan"));
    const watcher = required(group.find((e) => e.animalWork?.state === "scan"));
    s.realm.entityManager.spawn(createFauna("dog", watcher.position.wx + 100, watcher.position.wy));
    for (let i = 0; i < 45; i++) await s.step(idle, 1 / 30);
    expect(watcher.animalWork?.state).toBe("scan");
    const buddy = required(group.find((e) => e !== watcher));
    if (buddy.wanderAI) buddy.wanderAI.following = true;
    await s.command({
      kind: "place-entity",
      entityType: "wildlife-tiger-predator-v1",
      position: { wx: watcher.position.wx + 110, wy: watcher.position.wy },
    });
    await until(s, () => (watcher.animalWork?.alarms ?? 0) > 0);
    expect(buddy.fauna?.alarmFrom).toBeUndefined();
    expect(buddy.wanderAI?.following).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);

it("natural rabbit, robin and meerkat homes have finite stable food, independent of query order", () => {
  const generator = createGenerator(createDescriptor("regional", 2026), "thicket");
  for (const [kind, x, y] of [
    ["rabbit", -151, -529],
    ["robin", -163, -519],
    ["meerkat", ...required(faunaProfile("wildlife-meerkat-provisional-v1")).inspection],
  ] as const) {
    const cx = Math.floor(x / 16),
      cy = Math.floor(y / 16),
      coords = Array.from({ length: 25 }, (_, i) => ({
        x: cx - 2 + (i % 5),
        y: cy - 2 + Math.floor(i / 5),
      }));
    const collect = () => coords.flatMap((c) => generator.actors?.(c.x, c.y) ?? []);
    const actors = collect(),
      owners = actors.filter((a) => a.type.includes(kind));
    expect(owners.length).toBeGreaterThan(0);
    expect(
      owners.some((owner) =>
        actors.some((a) => a.featureId.startsWith(`${owner.featureId}:forage:`)),
      ),
    ).toBe(true);
    expect(
      actors.filter((a) =>
        owners.some((owner) => a.featureId.startsWith(`${owner.featureId}:forage:`)),
      ).length,
    ).toBeLessThanOrEqual(owners.length);
    coords.reverse();
    expect(collect().sort((a, b) => a.featureId.localeCompare(b.featureId))).toEqual(
      actors.sort((a, b) => a.featureId.localeCompare(b.featureId)),
    );
  }
});
it("robin descends, consumes ground food and returns to a real saved tree perch", async () => {
  const s = await ScenarioSession.create(meadowWorkRecipe("robin"));
  try {
    let bird = required(s.realm.entityManager.entities.find((e) => e.robin));
    await until(s, () => bird.animalWork?.state === "eat");
    expect(bird.wz ?? 0).toBeLessThan(1);
    await s.reload();
    bird = required(s.realm.entityManager.entities.find((e) => e.robin));
    await until(s, () => bird.animalWork?.deliveries === 1);
    expect(bird.animalWork?.eaten).toBe(1);
    expect(bird.wz).toBeGreaterThan(20);
    expect(s.realm.entityManager.entities.some((e) => e.workItem?.kind === "seed")).toBe(false);
  } finally {
    await s.close();
  }
}, 60000);
it("meerkats rotate lookout duty and a sentinel alarms its group about an actual predator", async () => {
  const s = await ScenarioSession.create(meadowWorkRecipe("meerkat"));
  try {
    const group = () =>
      s.realm.entityManager.entities.filter((e) => e.fauna && e.type.includes("meerkat"));
    await until(s, () => group().some((e) => e.animalWork?.deliveries === 1));
    const first = required(group().find((e) => e.animalWork?.deliveries === 1)).persistentId;
    await until(s, () =>
      group().some((e) => e.persistentId !== first && e.animalWork?.state === "scan"),
    );
    await s.reload();
    const watcher = required(group().find((e) => e.animalWork?.state === "scan"));
    const threat = createPredator("tiger", watcher.position.wx + 110, watcher.position.wy);
    if (threat.predator) threat.predator.cooldown = 20;
    s.realm.entityManager.spawn(threat);
    await until(s, () => watcher.animalWork?.state === "alarm");
    const from = watcher.animalWork?.threat;
    await until(s, () => (watcher.animalWork?.alarms ?? 0) >= 1);
    expect(group().every((e) => !!e.fauna?.alarmFrom || e.fauna?.state === "recover")).toBe(true);
    expect(from?.wx).toBeCloseTo(threat.position.wx, 0);
  } finally {
    await s.close();
  }
}, 60000);
it("rabbits release claimed food on a scare and competing animals cannot duplicate bites", async () => {
  const s = await ScenarioSession.create(meadowWorkRecipe("rabbit"));
  try {
    const rabbit = required(s.realm.entityManager.entities.find((e) => e.rabbit));
    await until(s, () => rabbit.animalWork?.state === "eat");
    s.player.player.position = { ...rabbit.position };
    await s.step(idle, 0.1);
    const plant = required(
      s.realm.entityManager.entities.find((e) => e.workItem?.kind === "greens"),
    );
    expect(plant.workItem?.claimedBy).toBeUndefined();
    expect(plant.workItem?.units).toBe(3);
    s.player.player.position = { wx: 288, wy: 280 };
    s.realm.entityManager.spawn(createRabbit(128, 196));
    await until(
      s,
      () => !s.realm.entityManager.entities.some((e) => e.workItem?.kind === "greens"),
    );
    expect(s.realm.entityManager.entities.reduce((n, e) => n + (e.animalWork?.eaten ?? 0), 0)).toBe(
      3,
    );
  } finally {
    await s.close();
  }
}, 60000);
