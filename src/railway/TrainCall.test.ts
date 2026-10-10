import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { RoadType } from "../road/RoadType.js";
import { cityTrainRecipe } from "../scenarios/CityTrainRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createCurveTrain } from "./CurveTrain.js";
import { railAlignment } from "./RailPath.js";
import { nearestStationBench } from "./StationBench.js";

async function fixture() {
  const session = await ScenarioSession.create(cityTrainRecipe());
  const railway = required(session.realm.railway);
  const service = required([...railway.services.values()][0]);
  async function atStation(index: number) {
    const station = required(required(service.line.stations)[index]);
    await session.command({
      kind: "teleport",
      position: { wx: (station.x - 12) * 16, wy: (station.y - 3) * 16 },
    });
    return required(nearestStationBench(session.player.player, session.realm.propManager.props));
  }
  return { session, railway, service, atStation };
}

it("recalls the same curved consist to either station, dwells and persists its new destination", async () => {
  const f = await fixture();
  try {
    const ids = f.service.carriages.map((c) => c.id);
    const alignment = railAlignment(required(f.service.line.path));
    for (const index of [1, 0]) {
      const bench = await f.atStation(index);
      await f.session.command({ kind: "call-train", benchId: bench.id });
      const stop = required(alignment.path.stops[index]);
      expect(f.service.carriages.map((c) => c.id)).toEqual(ids);
      expect(f.service.record).toMatchObject({
        distance: stop.distance,
        target: index === 0 ? 1 : 0,
        nextStop: index === 0 ? 1 : 0,
        dwell: 8,
        speed: 0,
      });
      expect(f.service.carriages.map((c) => c.position)).toEqual(
        createCurveTrain(alignment, stop.distance).map((c) => c.position),
      );
      for (const car of f.service.carriages) {
        expect(car.prevPosition).toEqual(car.position);
        expect(car.velocity).toEqual({ vx: 0, vy: 0 });
        const cx = Math.floor(car.position.wx / 256),
          cy = Math.floor(car.position.wy / 256);
        expect(f.session.realm.entityManager.spatialHash.queryRange(cx, cy, cx, cy)).toContain(car);
      }
    }
    await f.session.reload();
    const restored = required([...required(f.session.realm.railway).services.values()][0]);
    expect(restored.record.distance).toBe(required(alignment.path.stops[0]).distance);
    expect(restored.record.dwell).toBe(8);
    expect(restored.carriages).toHaveLength(3);
    await f.session.step({ dx: 0, dy: 0, jump: false, sprinting: false }, 0.1);
    expect(restored.record.dwell).toBeCloseTo(7.9);
    expect(restored.speed).toBe(0);
  } finally {
    await f.session.close();
  }
}, 30000);

it("rejects calls from away, editing, moved benches, occupied trains and explicit deletion", async () => {
  const f = await fixture();
  try {
    const bench = await f.atStation(0);
    f.session.player.player.position.wx += 100;
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /bench/,
    );
    f.session.player.player.position.wx -= 100;
    f.session.player.editorEnabled = true;
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /unavailable/,
    );
    f.session.player.editorEnabled = false;
    bench.position.wx += 1;
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /station/,
    );
    bench.position.wx -= 1;
    const car = required(f.service.carriages[1]);
    const rider = f.session.realm.entityManager.spawn(
      createPlayer(car.position.wx, car.position.wy),
    );
    rider.wz = 44;
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /riding/,
    );
    rider.jumpVZ = 10;
    rider.wz = 60;
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /riding/,
    );
    f.session.realm.entityManager.remove(rider.id, false);
    f.service.driverId = 999;
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /riding/,
    );
    delete f.service.driverId;
    f.session.realm.entityManager.remove(car.id, true);
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /unavailable/,
    );
    expect(f.service.record.deleted).toBe(true);
  } finally {
    await f.session.close();
  }
}, 30000);

it("checks destination obstacles and edited rails before committing any carriage", async () => {
  const f = await fixture();
  try {
    const bench = await f.atStation(1);
    const station = required(required(f.service.line.stations)[1]);
    const before = f.service.carriages.map((c) => ({ ...c.position }));
    let active = true;
    const cancelled = f.railway.callTrain(f.session.player.player, bench.id, () => active);
    active = false;
    await expect(cancelled).rejects.toThrow(/unavailable/);
    expect(f.service.carriages.map((c) => c.position)).toEqual(before);
    const blocker = f.session.realm.entityManager.spawn(
      createPlayer(station.x * 16, station.y * 16),
    );
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /blocked/,
    );
    f.session.realm.entityManager.remove(blocker.id, false);
    const chunk = f.session.realm.world.getChunk(
      Math.floor(station.x / 16),
      Math.floor(station.y / 16),
    );
    const lx = ((station.x % 16) + 16) % 16,
      ly = ((station.y % 16) + 16) % 16;
    chunk.setRoad(lx, ly, RoadType.None);
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /repairing/,
    );
    expect(f.service.carriages.map((c) => c.position)).toEqual(before);
    chunk.setRoad(lx, ly, RoadType.RailCurveProof);
    chunk.setHeight(lx, ly, 1);
    await expect(f.session.command({ kind: "call-train", benchId: bench.id })).rejects.toThrow(
      /repairing/,
    );
    chunk.setHeight(lx, ly, 0);
    await f.session.command({ kind: "call-train", benchId: bench.id });
    expect(f.service.entity.position.wx).toBe(station.x * 16);
  } finally {
    await f.session.close();
  }
}, 30000);

it("offers the prompt on a generated bench seat, but not an ordinary placed bench", () => {
  const bench = createProp("prop-rail-bench", 100, 100);
  const player = createPlayer(100, 100);
  player.wz = 12;
  expect(nearestStationBench(player, [bench])).toBeUndefined();
  bench.proceduralId = "station:test:bench:-12";
  expect(nearestStationBench(player, [bench])).toBe(bench);
  player.wz = 44;
  expect(nearestStationBench(player, [bench])).toBeUndefined();
});
