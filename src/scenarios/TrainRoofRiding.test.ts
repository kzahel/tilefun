import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { curvedTrainRecipe } from "./CurvedTrainRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it.each([false, true])(
  "carries an off-center roof passenger through every pose, stops and reload (%s)",
  async (reverse) => {
    const s = await ScenarioSession.create(curvedTrainRecipe(true, reverse));
    try {
      await s.command({ kind: "train-position", roof: true });
      let service = required(s.realm.railway?.services.get("curved-service"));
      if (reverse) s.player.player.position.wy += 35;
      else s.player.player.position.wx += 45;
      const headings = new Set<number>();
      let reloaded = false;
      for (let i = 0; i < 1300; i++) {
        await s.step(idle, 0.1);
        const car = required(service.carriages[1]);
        expect(s.player.player.wz).toBe(44);
        expect(roofSupport(s.player.player, s.realm.entityManager.entities)?.id).toBe(car.id);
        headings.add(Math.floor(((car.sprite?.frameRow ?? 0) + 32) / 64) % 4);
        if (!reloaded && headings.size > 1) {
          const saved = s.realm.playerData(s.player);
          expect(saved.roofRide?.identity).toBe(car.proceduralId);
          await s.reload();
          service = required(s.realm.railway?.services.get("curved-service"));
          expect(s.realm.playerData(s.player).roofRide).toEqual(saved.roofRide);
          reloaded = true;
        }
        if (headings.size === 4 && i > 900) break;
      }
      expect(headings.size).toBe(4);
      expect(reloaded).toBe(true);
      expect(s.player.player.parentId).toBeUndefined();
      expect(s.player.gameplaySession.mountId).toBeNull();
    } finally {
      await s.close();
    }
  },
  30000,
);
it("jumps from trackside onto a stopped train, walks the roof and jumps off with momentum", async () => {
  const s = await ScenarioSession.create(curvedTrainRecipe(false));
  try {
    await s.command({ kind: "train-position", roof: false });
    for (let i = 0; i < 65; i++) await s.step({ ...idle, dy: i < 40 ? -1 : 0, jump: i < 40 });
    expect(s.player.player.wz).toBe(44);
    expect(s.player.player.jumpVZ).toBeUndefined();
    const car = required(required(s.realm.railway?.services.get("curved-service")).carriages[1]);
    for (let i = 0; i < 100; i++) await s.step(idle, 0.1);
    expect(car.velocity?.vx).toBeGreaterThan(100);
    await s.step({ ...idle, jump: true });
    expect(s.player.player.jumpVZ).toBeGreaterThan(0);
    expect(s.player.player.velocity?.vx).toBeGreaterThan(100);
    for (let i = 0; i < 90; i++) await s.step({ ...idle, dy: 1 });
    expect(s.player.player.wz).toBe(0);
    expect(
      aabbsOverlap(
        getEntityAABB(s.player.player.position, required(s.player.player.collider)),
        getEntityAABB(car.position, required(car.collider)),
      ),
    ).toBe(false);
  } finally {
    await s.close();
  }
});
it("predicts a centered rider through bends and braking with bounded corrections", async () => {
  const s = await ScenarioSession.create(curvedTrainRecipe());
  try {
    await s.command({ kind: "train-position", roof: true });
    const client = new PlayerPredictor();
    client.reset(deserializeEntity(serializeEntity(s.player.player)));
    let maxError = 0;
    for (let i = 0; i < 2400; i++) {
      const replicas = s.realm.entityManager.entities.map((e) =>
        deserializeEntity(serializeEntity(e)),
      );
      client.storeInput(i + 1, idle, 1 / 60);
      client.update(1 / 60, idle, s.realm.world, s.realm.propManager.props, replicas);
      await s.step(idle);
      client.reconcile(s.player.player, i + 1, s.realm.world, s.realm.propManager.props, replicas);
      maxError = Math.max(maxError, required(client.lastReconcileDiagnostics).correctionPosErr);
      expect(client.player?.wz).toBe(44);
    }
    expect(maxError).toBeLessThan(0.15);
  } finally {
    await s.close();
  }
}, 30000);
it("stops before a low ceiling with a roof passenger, then continues without that passenger", async () => {
  const recipe = curvedTrainRecipe(false);
  recipe.props.push(
    surfaceProp(
      { left: -700, right: -500, top: 300, bottom: 470 },
      {
        id: "low-ceiling",
        spaceId: "outside",
        z: 56,
        riseX: 0,
        riseY: 0,
        thickness: 8,
        connectsTo: [],
      },
    ),
  );
  const s = await ScenarioSession.create(recipe);
  try {
    await s.command({ kind: "train-position", roof: true });
    const service = required(s.realm.railway?.services.get("curved-service"));
    service.record.dwell = 0;
    for (let i = 0; i < 70; i++) await s.step(idle, 0.1);
    expect(service.speed).toBe(0);
    expect(s.player.player.position.wx).toBeLessThan(-700);
    const before = required(service.record.distance);
    await s.command({ kind: "teleport", position: { wx: -900, wy: 550 } });
    for (let i = 0; i < 40; i++) await s.step(idle, 0.1);
    expect(required(service.record.distance)).toBeGreaterThan(before + 100);
  } finally {
    await s.close();
  }
});
