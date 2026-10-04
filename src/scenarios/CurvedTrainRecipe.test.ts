import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { CURVE_TRAIN } from "../railway/CurveTrain.js";
import { railAlignment } from "../railway/RailPath.js";
import { curvedTrainRecipe } from "./CurvedTrainRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
for (const loop of [true, false])
  for (const reverse of [false, true]) {
    it(`runs ${loop ? "loop" : "corridor"} ${reverse ? "backward" : "forward"}, serves every stop and reloads mid-bend`, async () => {
      const session = await ScenarioSession.create(curvedTrainRecipe(loop, reverse));
      try {
        const service = () => required(session.realm.railway?.services.get("curved-service"));
        const visited = new Set<number>();
        let wrapped = false,
          leftInitial = false,
          completedCircuit = false;
        const initialDistance = required(service().record.distance);
        let lastDistance = required(service().record.distance);
        let reloaded = false,
          independent = false,
          reversed = false;
        const initialDirection = service().record.target;
        let previous = service().carriages.map((c) => ({ ...c.position }));
        const headings = new Set<number>();
        for (let i = 0; i < 2000; i++) {
          await session.step(idle, 0.1);
          const s = service();
          if (loop && Math.abs(required(s.record.distance) - lastDistance) > 1000) wrapped = true;
          lastDistance = required(s.record.distance);
          if (Math.abs(lastDistance - initialDistance) > 1) leftInitial = true;
          if (leftInitial && s.record.dwell > 0 && Math.abs(lastDistance - initialDistance) < 0.01)
            completedCircuit = true;
          if (s.record.dwell > 0) visited.add(Math.round(required(s.record.distance)));
          if (s.record.target !== initialDirection) reversed = true;
          for (const [j, car] of s.carriages.entries()) {
            const last = required(previous[j]);
            expect(
              Math.hypot(car.position.wx - last.wx, car.position.wy - last.wy),
            ).toBeLessThanOrEqual(19.201);
            headings.add(required(car.sprite).frameRow);
          }
          previous = s.carriages.map((c) => ({ ...c.position }));
          const frames = s.carriages.map((c) => required(c.sprite).frameRow);
          if (new Set(frames).size > 1) independent = true;
          if (!reloaded && frames.some((f) => f % 64 > 12 && f % 64 < 52)) {
            const record = structuredClone(s.record);
            const poses = s.carriages.map((c) => ({
              position: { ...c.position },
              row: c.sprite?.frameRow,
              collider: { ...c.collider },
            }));
            await session.reload();
            expect(service().record).toEqual(record);
            expect(
              service().carriages.map((c) => ({
                position: c.position,
                row: c.sprite?.frameRow,
                collider: c.collider,
              })),
            ).toEqual(poses);
            expect(
              session.realm.entityManager.entities.filter((e) => e.type === CURVE_TRAIN),
            ).toHaveLength(3);
            reloaded = true;
          }
          if (i > 800 && visited.size === (loop ? 4 : 3) && (loop ? completedCircuit : reversed))
            break;
        }
        expect(visited.size).toBe(loop ? 4 : 3);
        expect(reloaded && independent).toBe(true);
        expect(headings.size).toBeGreaterThan(60);
        if (loop)
          for (const middle of [32, 96, 160, 224])
            expect([...headings].some((h) => Math.abs(h - middle) < 5)).toBe(true);
        expect(loop ? wrapped && completedCircuit && !reversed : reversed).toBe(true);
      } finally {
        await session.close();
      }
    }, 30000);
  }
it("stops for a child, missing rails or unready terrain; retires and deletes the whole group", async () => {
  const s = await ScenarioSession.create(curvedTrainRecipe());
  try {
    const railway = required(s.realm.railway);
    let service = required(railway.services.get("curved-service"));
    service.record.dwell = 0;
    const child = createPlayer(260, -512);
    const actor = s.realm.entityManager.spawn(child);
    for (let i = 0; i < 80; i++) await s.step(idle, 0.1);
    expect(service.speed).toBe(0);
    expect(service.entity.position.wx).toBeLessThan(105);
    s.realm.entityManager.remove(actor.id, false);
    const before = service.record.distance;
    railway.tick(1, () => false);
    expect(service.record.distance).toBe(before);
    const alignment = railAlignment(required(service.line.path));
    const p = alignment.sample(required(before) + 160);
    const tx = Math.floor(p.x / 16),
      ty = Math.floor(p.y / 16);
    const chunk = required(
      s.realm.world.getChunkIfLoaded(Math.floor(tx / 16), Math.floor(ty / 16)),
    );
    chunk.setRoad(((tx % 16) + 16) % 16, ((ty % 16) + 16) % 16, 0);
    s.realm.saveManager?.markChunkDirty(`${Math.floor(tx / 16)},${Math.floor(ty / 16)}`);
    for (let i = 0; i < 50; i++) await s.step(idle, 0.1);
    expect(service.speed).toBe(0);
    expect(required(service.record.distance) - required(before)).toBeLessThan(32);
    const record = structuredClone(service.record);
    railway.update([]);
    await railway.settle();
    expect(railway.services.size).toBe(0);
    railway.update([s.player.player]);
    await railway.settle();
    service = required(railway.services.get("curved-service"));
    expect(service.record).toEqual(record);
    s.realm.entityManager.remove(service.carriages[2]?.id ?? -1, true);
    railway.tick(0.1, () => true);
    expect(s.realm.entityManager.entities.filter((e) => e.type === CURVE_TRAIN)).toHaveLength(0);
    await s.reload();
    expect(required(s.realm.railway?.services.get("curved-service")).record.deleted).toBe(true);
  } finally {
    await s.close();
  }
}, 30000);
