import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { threatWorkRecipe } from "../scenarios/ThreatWorkRecipe.js";
import type { WorkContext } from "./AnimalWorkSystem.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const actors = (s: ScenarioSession) => s.realm.entityManager.entities;
const subject = (s: ScenarioSession) =>
  required(
    actors(s).find(
      (e) =>
        e.fauna &&
        [
          "wildlife-hedgehog-provisional-v1",
          "wildlife-porcupine-provisional-v1",
          "wildlife-fox-provisional-v1",
        ].includes(e.type),
    ),
  );
const context: WorkContext = {
  players: [],
  ready: () => true,
  environment: { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 },
};
async function until(s: ScenarioSession, p: () => boolean, seconds = 30) {
  for (let i = 0; i < seconds * 30 && !p(); i++) await s.step(idle, 1 / 30);
  expect(
    actors(s).map((e) => ({ type: e.type, work: e.animalWork, ai: e.fauna, p: e.position })),
  ).toSatisfy(() => p());
}
it.each(["hedgehog", "porcupine"] as const)(
  "%s defends against an actual wolf and calmly exits after it leaves",
  async (kind) => {
    const s = await ScenarioSession.create(threatWorkRecipe(kind));
    try {
      let a = subject(s);
      const wolf = required(actors(s).find((e) => e.predator));
      await until(s, () => a.animalWork?.defenseReady === true);
      expect(canEat(wolf, a)).toBe(false);
      expect(canEat(createPredator("t-rex", a.position.wx + 20, a.position.wy), a)).toBe(true);
      const saved = JSON.parse(JSON.stringify(a.animalWork));
      await s.reload();
      a = subject(s);
      expect(a.animalWork).toEqual(saved);
      s.realm.entityManager.remove(required(actors(s).find((e) => e.predator)).id);
      await until(s, () => a.animalWork?.state === "idle");
      expect(a.animalWork?.defenseReady).toBeUndefined();
      expect(kind === "hedgehog" ? a.animalWork?.curls : a.animalWork?.warnings).toBe(1);
    } finally {
      await s.close();
    }
  },
  60000,
);
it("porcupine protection requires its quills to face the actual incoming hunter", async () => {
  const s = await ScenarioSession.create(threatWorkRecipe("porcupine"));
  try {
    const a = subject(s),
      wolf = required(actors(s).find((e) => e.predator));
    await until(s, () => a.animalWork?.defenseReady === true);
    expect(canEat(wolf, a)).toBe(false);
    wolf.position.wx = a.position.wx - 30;
    expect(canEat(wolf, a)).toBe(true);
  } finally {
    await s.close();
  }
}, 60000);
it("fox listens, approaches and physically pounces on real finite prey", async () => {
  const s = await ScenarioSession.create(threatWorkRecipe("fox"));
  try {
    let a = subject(s);
    await until(s, () => a.animalWork?.state === "listen");
    expect(a.animalWork?.targetId).toBeTruthy();
    await s.reload();
    a = subject(s);
    expect(a.animalWork?.state).toBe("listen");
    await until(s, () => a.animalWork?.state === "pounce");
    expect(a.fauna?.motion?.lift).toBe(7);
    await until(s, () => (a.wz ?? 0) > 2);
    expect(a.animalWork?.state).toBe("pounce");
    await until(s, () => a.animalWork?.eaten === 1);
    expect(actors(s).some((e) => e.type === "wildlife-mouse-provisional-v1")).toBe(false);
    expect(s.realm.entityManager.wildlifeRespawns.size).toBe(0);
    expect(a.animalWork?.state).toBe("eat");
  } finally {
    await s.close();
  }
}, 60000);
it.each(["hedgehog", "porcupine", "fox"] as const)(
  "manual %s makes no prey or supplies",
  async (kind) => {
    const r = threatWorkRecipe(kind);
    r.actors = required(r.actors).slice(0, 1);
    const s = await ScenarioSession.create(r);
    try {
      for (let i = 0; i < 150; i++) await s.step(idle, 1 / 30);
      expect(actors(s).filter((e) => e.fauna || e.predator)).toHaveLength(1);
      expect(actors(s).some((e) => e.workItem)).toBe(false);
    } finally {
      await s.close();
    }
  },
  60000,
);
it.each(["hedgehog", "porcupine", "fox"] as const)(
  "%s freezes work when terrain/actors are not ready",
  async (kind) => {
    const s = await ScenarioSession.create(threatWorkRecipe(kind));
    try {
      const a = subject(s);
      await until(s, () => !!a.animalWork && a.animalWork.state !== "idle");
      const saved = JSON.parse(JSON.stringify(a.animalWork));
      s.realm.animalWork.update(a, 10, {
        ...context,
        ready: () => false,
        environment: {
          ...context.environment,
          isWater: () => {
            throw Error("Unready terrain probe");
          },
        },
      });
      expect(a.animalWork).toEqual(saved);
    } finally {
      await s.close();
    }
  },
  60000,
);
it.each(["hedgehog", "porcupine"] as const)(
  "a raised %s loses its catch protection",
  async (kind) => {
    const s = await ScenarioSession.create(threatWorkRecipe(kind));
    try {
      const a = subject(s),
        wolf = required(actors(s).find((e) => e.predator));
      await until(s, () => a.animalWork?.defenseReady === true);
      a.wz = 12;
      expect(canEat(wolf, a)).toBe(true);
      s.realm.animalWork.update(a, 1, context);
      expect(a.animalWork?.defenseReady).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  60000,
);

it("porcupine warning makes the actual wolf retreat with its native escape", async () => {
  const s = await ScenarioSession.create(threatWorkRecipe("porcupine"));
  try {
    const a = subject(s),
      wolf = required(actors(s).find((e) => e.predator));
    const before = Math.hypot(wolf.position.wx - a.position.wx, wolf.position.wy - a.position.wy);
    await until(s, () => wolf.predator?.state === "evade");
    await until(
      s,
      () =>
        Math.hypot(wolf.position.wx - a.position.wx, wolf.position.wy - a.position.wy) >
        before + 30,
    );
    expect(a.animalWork?.repelled).toBe(1);
  } finally {
    await s.close();
  }
}, 60000);

it.each(["remove", "move", "raise", "carry"] as const)(
  "a committed fox leap lands after prey %s without a remote meal",
  async (change) => {
    const s = await ScenarioSession.create(threatWorkRecipe("fox"));
    try {
      const a = subject(s);
      await until(s, () => a.animalWork?.state === "pounce" && (a.wz ?? 0) > 2);
      const prey = required(actors(s).find((e) => e.persistentId === a.animalWork?.targetId));
      if (change === "remove") s.realm.entityManager.remove(prey.id);
      else if (change === "move") prey.position.wx += 150;
      else if (change === "raise") {
        prey.wz = 12;
        prey.jumpZ = 12;
        prey.jumpVZ = 60;
      } else prey.parentId = s.player.player.id;
      await s.step(idle, 1 / 30);
      expect(a.animalWork?.state).toBe("pounce");
      expect(a.fauna?.motion).toBeDefined();
      await until(s, () => !a.fauna?.motion);
      expect(a.wz ?? 0).toBe(0);
      expect(a.animalWork?.eaten).toBe(0);
    } finally {
      await s.close();
    }
  },
  60000,
);

it("a natural fox meal schedules the shared delayed distant replacement and survives reload", async () => {
  const s = await ScenarioSession.create(threatWorkRecipe("fox"));
  try {
    const prey = required(actors(s).find((e) => e.type === "wildlife-mouse-provisional-v1"));
    prey.naturalSpawnId = "natural-fox-mouse";
    await until(s, () => subject(s).animalWork?.eaten === 1);
    const pending = [...s.realm.entityManager.wildlifeRespawns.values()];
    expect(pending).toHaveLength(1);
    expect(pending[0]?.remaining).toBeGreaterThanOrEqual(59);
    await s.reload();
    expect([...s.realm.entityManager.wildlifeRespawns.values()]).toEqual(pending);
  } finally {
    await s.close();
  }
}, 60000);

it("fox reload preserves an airborne committed leap and completes one physical meal", async () => {
  const s = await ScenarioSession.create(threatWorkRecipe("fox"));
  try {
    let a = subject(s);
    await until(s, () => a.animalWork?.state === "pounce" && (a.wz ?? 0) > 2);
    const saved = {
      work: JSON.parse(JSON.stringify(a.animalWork)),
      motion: JSON.parse(JSON.stringify(a.fauna?.motion)),
      z: a.wz,
    };
    await s.reload();
    a = subject(s);
    expect(a.animalWork).toEqual(saved.work);
    expect(a.fauna?.motion).toEqual(saved.motion);
    expect(a.wz).toBe(saved.z);
    await until(s, () => a.animalWork?.eaten === 1);
    expect(a.wz ?? 0).toBe(0);
    expect(actors(s).some((e) => e.type === "wildlife-mouse-provisional-v1")).toBe(false);
  } finally {
    await s.close();
  }
}, 60000);
it.each(["hedgehog", "porcupine", "fox"] as const)(
  "controlled %s retains companion priority",
  async (kind) => {
    const s = await ScenarioSession.create(threatWorkRecipe(kind));
    try {
      const a = subject(s);
      await until(s, () => !!a.animalWork && a.animalWork.state !== "idle");
      required(a.wanderAI).following = true;
      s.realm.animalWork.update(a, 1, context);
      expect(a.animalWork?.state).toBe("idle");
      expect(a.animalWork?.defenseReady).toBeUndefined();
      expect(a.animalWork?.targetId).toBeUndefined();
      expect(a.wanderAI?.following).toBe(true);
    } finally {
      await s.close();
    }
  },
  60000,
);

it("the real warning-scene hunter preserves its heading and exact phase across reload", async () => {
  const s = await ScenarioSession.create(threatWorkRecipe("hedgehog"));
  try {
    const wolf = required(actors(s).find((e) => e.predator));
    await until(s, () => wolf.sprite?.direction === 3 && (wolf.sprite?.frameCol ?? 0) > 1);
    const pose = { row: wolf.sprite?.frameRow, column: wolf.sprite?.frameCol },
      id = wolf.persistentId;
    await s.reload();
    const restored = required(actors(s).find((e) => e.persistentId === id));
    expect({ row: restored.sprite?.frameRow, column: restored.sprite?.frameCol }).toEqual(pose);
  } finally {
    await s.close();
  }
}, 60000);
