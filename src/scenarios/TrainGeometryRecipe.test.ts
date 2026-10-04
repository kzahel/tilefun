import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TRAIN_CARRIAGES } from "../railway/Train.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { trainGeometryRecipe } from "./TrainGeometryRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
for (const reverse of [false, true]) {
  it(`runs train grades ${reverse ? "west" : "east"}, reloads on a slope and reverses at both ends`, async () => {
    const s = await ScenarioSession.create(trainGeometryRecipe(reverse));
    try {
      let distinct = false,
        reloaded = false,
        endpoint = false,
        returned = false;
      let min = 0,
        max = -96;
      let previous = [reverse ? -96 : 0, reverse ? -96 : 0, reverse ? -96 : 0];
      for (let i = 0; i < 650; i++) {
        await s.step(idle, 0.1);
        const service = required(s.realm.railway?.services.get("grade-shuttle"));
        expect(service.carriages).toHaveLength(3);
        for (const [j, c] of service.carriages.entries()) {
          expect(c.position.wx - service.entity.position.wx).toBeCloseTo(
            required(TRAIN_CARRIAGES[j]).offset,
            6,
          );
          expect(Math.abs((c.wz ?? 0) - required(previous[j]))).toBeLessThanOrEqual(4.801);
          expect(c.sprite?.flipX ?? false).toBe(false);
          min = Math.min(min, c.wz ?? 0);
          max = Math.max(max, c.wz ?? 0);
        }
        previous = service.carriages.map((c) => c.wz ?? 0);
        if (Math.max(...previous) - Math.min(...previous) > 12) {
          distinct = true;
          if (!reloaded) {
            const before = structuredClone(service.record);
            await s.reload();
            const after = required(s.realm.railway?.services.get("grade-shuttle"));
            expect(after.record).toEqual(before);
            expect(after.speed).toBe(service.speed);
            expect(after.carriages.map((c) => c.wz)).toEqual(previous);
            expect(
              s.realm.entityManager.entities.filter((c) => c.type.startsWith("train-carriage-v1:")),
            ).toHaveLength(3);
            reloaded = true;
          }
        }
        if (service.record.target === (reverse ? 1 : 0) && service.record.dwell > 0)
          endpoint = true;
        if (endpoint && service.record.target === (reverse ? 0 : 1) && service.record.dwell > 0) {
          returned = true;
          break;
        }
      }
      expect({ distinct, reloaded, endpoint, returned }).toEqual({
        distinct: true,
        reloaded: true,
        endpoint: true,
        returned: true,
      });
      expect(min).toBe(-96);
      expect(max).toBe(64);
    } finally {
      await s.close();
    }
  }, 30000);
}

for (const obstacle of [
  "ceiling",
  "tunnel pedestrian",
  "street pedestrian",
  "bridge pedestrian",
  "underpass pedestrian",
  "track edit",
] as const) {
  it(`train body clearance respects ${obstacle}`, async () => {
    const recipe = trainGeometryRecipe();
    if (obstacle === "ceiling")
      required(
        recipe.props.find((p) => p.collider?.surface?.id === "rail-tunnel-roof")?.collider?.surface,
      ).thickness = 64;
    const s = await ScenarioSession.create(recipe);
    try {
      if (obstacle.includes("pedestrian")) {
        const bridge = obstacle.includes("bridge") || obstacle.includes("underpass");
        await s.command({
          kind: "teleport",
          position: { wx: bridge ? -544 : 1056, wy: 0 },
          z: bridge
            ? obstacle.includes("underpass")
              ? 0
              : 64
            : obstacle.includes("street")
              ? 0
              : -96,
        });
      }
      if (obstacle === "track edit") {
        await s.ready({ minCx: -4, maxCx: -4, minCy: 0, maxCy: 0 });
        required(s.realm.world.getChunkIfLoaded(-4, 0)).setRoad(8, 0, 0);
        s.realm.saveManager?.markChunkDirty("-4,0");
      }
      for (let i = 0; i < 260; i++) await s.step(idle, 0.1);
      const service = required(s.realm.railway?.services.get("grade-shuttle"));
      if (obstacle === "street pedestrian" || obstacle === "underpass pedestrian")
        expect(service.record.target).toBe(0);
      else {
        expect(service.speed).toBe(0);
        expect(service.record.target).toBe(1);
        expect(service.entity.position.wx).toBeLessThan(
          obstacle === "bridge pedestrian" ? -750 : obstacle === "track edit" ? -900 : 900,
        );
      }
    } finally {
      await s.close();
    }
  });
}

it("retires/restores all three bodies, freezes on unready chunks and deletes the whole service from a middle car", async () => {
  const s = await ScenarioSession.create(trainGeometryRecipe());
  try {
    for (let i = 0; i < 125; i++) await s.step(idle, 0.1);
    const railway = required(s.realm.railway),
      service = required(railway.services.get("grade-shuttle"));
    const before = service.carriages.map((c) => ({ ...c.position, z: c.wz }));
    railway.tick(1, () => false);
    expect(service.carriages.map((c) => ({ ...c.position, z: c.wz }))).toEqual(before);
    railway.update([]);
    await railway.settle();
    expect(
      s.realm.entityManager.entities.filter((c) => c.type.startsWith("train-carriage-v1:")),
    ).toHaveLength(0);
    railway.update([s.player.player]);
    await railway.settle();
    const restored = required(railway.services.get("grade-shuttle"));
    expect(restored.carriages.map((c) => ({ ...c.position, z: c.wz }))).toEqual(before);
    s.realm.entityManager.remove(restored.entity.id, true);
    railway.tick(0.1, () => true);
    expect(
      s.realm.entityManager.entities.filter((c) => c.type.startsWith("train-carriage-v1:")),
    ).toHaveLength(0);
    await s.reload();
    expect(required(s.realm.railway?.services.get("grade-shuttle")).record.deleted).toBe(true);
    expect(
      s.realm.entityManager.entities.filter((c) => c.type.startsWith("train-carriage-v1:")),
    ).toHaveLength(0);
  } finally {
    await s.close();
  }
});

it("paused inspection updates view coverage and reload retains the camera without advancing the train", async () => {
  const s = await ScenarioSession.create(trainGeometryRecipe());
  try {
    for (let i = 0; i < 120; i++) await s.step(idle, 0.1);
    const before = structuredClone(required(s.realm.railway?.services.get("grade-shuttle")).record);
    const range = { minCx: -7, maxCx: 7, minCy: -2, maxCy: 2 };
    await s.command({ kind: "view-range", range });
    expect(required(s.realm.railway?.services.get("grade-shuttle")).record).toEqual(before);
    const coverage = { ...s.player.visibleRange };
    await s.reload();
    expect(s.player.visibleRange).toEqual(coverage);
    expect(required(s.realm.railway?.services.get("grade-shuttle")).record).toEqual(before);
    expect(
      s.realm.entityManager.entities.filter((c) => c.type.startsWith("train-carriage-v1:")),
    ).toHaveLength(3);
  } finally {
    await s.close();
  }
});
