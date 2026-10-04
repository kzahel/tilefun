import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { CROSSING_STARTS, railCrossingRecipe } from "./RailCrossingRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("does not block a ground train on an actor entirely below the track", async () => {
  const s = await ScenarioSession.create(railCrossingRecipe());
  try {
    await s.command({ kind: "teleport", position: { wx: 0, wy: 8 }, z: -64 });
    const railway = required(s.realm.railway);
    // Isolate the railway overlap query: keep this actor at the supplied height
    // instead of letting the unrelated ground tracker return it to this flat fixture.
    for (let i = 0; i < 15; i++) railway.tick(1, () => true);
    expect(required(railway.services.get("crossing-shuttle")).entity.position.wx).toBeGreaterThan(
      300,
    );
  } finally {
    await s.close();
  }
});

it("walks both road approaches while the real train passes underneath and survives reload", async () => {
  const s = await ScenarioSession.create(railCrossingRecipe());
  try {
    let maxZ = 0;
    for (let i = 0; i < 350; i++) {
      await s.step({ ...idle, dy: -1 });
      maxZ = Math.max(maxZ, s.player.player.wz ?? 0);
      expect(s.player.player.jumpVZ).toBeUndefined();
    }
    expect(maxZ).toBe(64);
    expect(s.player.player.position.wy).toBeLessThan(-330);
    expect(s.player.player.wz).toBe(0);
    await s.command({ kind: "teleport", ...CROSSING_STARTS.bridge });
    const railway = required(s.realm.railway);
    const train = required(railway.services.get("crossing-shuttle"));
    let east = false,
      west = false;
    for (let i = 0; i < 450; i++) {
      await s.step(idle, 0.1);
      expect(train.entity.wz).toBe(0);
      expect(s.player.player.wz).toBe(64);
      if (train.record.target === 0) east = true;
      if (east && train.record.target === 1) {
        west = true;
        break;
      }
    }
    expect(east && west).toBe(true);
    const before = structuredClone(train.record);
    await s.reload();
    const restored = required(s.realm.railway?.services.get("crossing-shuttle"));
    expect(restored.record).toEqual(before);
    expect(s.realm.entityManager.entities.filter((e) => e.type === "train-local-v1")).toHaveLength(
      1,
    );
    expect(s.player.player.wz).toBe(64);
  } finally {
    await s.close();
  }
});

it("stops the train before an insufficient bridge clearance or a pedestrian at track height", async () => {
  for (const obstruction of ["low ceiling", "pedestrian"] as const) {
    const recipe = railCrossingRecipe();
    if (obstruction === "low ceiling") {
      const slab = required(recipe.props[1]?.collider?.surface);
      slab.z = 48; // underside 40 intersects the 44px train
    }
    const s = await ScenarioSession.create(recipe);
    try {
      if (obstruction === "pedestrian")
        await s.command({ kind: "teleport", position: { wx: 0, wy: 8 }, z: 0 });
      for (let i = 0; i < 160; i++) await s.step(idle, 0.1);
      const train = required(s.realm.railway?.services.get("crossing-shuttle"));
      expect(train.speed).toBe(0);
      expect(train.entity.position.wx).toBeLessThan(-220);
      expect(train.entity.position.wx).toBeGreaterThan(-384);
    } finally {
      await s.close();
    }
  }
});
