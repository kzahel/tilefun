import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { nextLanes } from "./LaneGraph.js";
import { TrafficTestHarness } from "./TrafficTestHarness.js";
import { TRAFFIC_MODELS, vehicleRoadWidth } from "./Vehicle.js";

it("carries a passenger along an intercity corridor back into city streets with bounded residency", () => {
  const scene = new TrafficTestHarness();
  for (const s of scene.traffic.states.values()) scene.entities.remove(s.entity.id, false);
  scene.traffic.states.clear();
  const graph = scene.strategy.trafficNetwork(4800, 8304);
  const lane = required(
    [...graph.lanes.values()]
      .filter((l) => l.intercity && l.path.length > 5000)
      .sort((a, b) => a.path.length - b.path.length)[0],
  );
  const car = scene.traffic.add("compact-1", lane, 10);
  scene.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy + 3 };
  scene.player.wz = 24;
  // Isolate continuous corridor/streaming behavior from random ambient queues.
  const tick = scene.traffic.tick.bind(scene.traffic);
  scene.traffic.tick = (dt) => tick(dt, []);
  let peakChunks = 0;
  for (let i = 0; i < 50000; i++) {
    if (i % 60 === 0) {
      const cx = Math.floor(scene.player.position.wx / 256),
        cy = Math.floor(scene.player.position.wy / 256);
      scene.load({ minCx: cx - 3, maxCx: cx + 3, minCy: cy - 3, maxCy: cy + 3 });
      peakChunks = Math.max(peakChunks, scene.world.chunks.loadedCount);
      expect(scene.player.wz).toBe(24);
    }
    scene.step({ dx: 0, dy: 0, jump: false, sprinting: false });
  }
  expect(car.choices).toBeGreaterThan(3);
  expect(car.lane.intercity).toBe(false);
  expect(scene.player.wz).toBe(24);
  expect(peakChunks).toBeLessThan(150);
}, 60000);

it("all admitted vehicle families turn on actual generated roads with stable roof support", () => {
  let admitted = 0;
  for (const model of TRAFFIC_MODELS) {
    const scene = new TrafficTestHarness(),
      lane = scene.car.lane;
    const width = vehicleRoadWidth(`vehicle-v1:${model}`);
    const graph = scene.strategy.trafficNetwork(lane.a.x, lane.a.y);
    if (!nextLanes(graph, lane, width).some((l) => nextLanes(graph, l, width).length)) continue;
    admitted++;
    for (const s of scene.traffic.states.values()) scene.entities.remove(s.entity.id, false);
    scene.traffic.states.clear();
    const car = scene.traffic.add(model, lane, 80);
    const height = required(required(car.entity.collider).physicalHeight);
    scene.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy + 3 };
    scene.player.wz = height;
    scene.player.groundZ = height;
    const tick = scene.traffic.tick.bind(scene.traffic);
    scene.traffic.tick = (dt) => tick(dt, []);
    // Current cities span longer avenues. Exercise three completed choices rather
    // than assuming the compact authoring grid's fixed 100-second route length.
    for (let i = 0; i < 18000 && car.choices < 3; i++) {
      if (i % 60 === 0) {
        const cx = Math.floor(scene.player.position.wx / 256),
          cy = Math.floor(scene.player.position.wy / 256);
        scene.load({ minCx: cx - 3, maxCx: cx + 3, minCy: cy - 3, maxCy: cy + 3 });
        expect(scene.player.wz, model).toBe(height);
      }
      scene.step({ dx: 0, dy: 0, jump: false, sprinting: false });
    }
    expect(car.choices, model).toBeGreaterThan(2);
    expect(scene.player.wz, model).toBe(height);
  }
  // The current city boulevard admits the folded ladder truck as well.
  expect(admitted).toBe(44);
}, 120000);
