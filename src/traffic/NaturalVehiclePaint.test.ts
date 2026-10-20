import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TrafficTestHarness } from "./TrafficTestHarness.js";
import { trafficPaint, vehiclePaint } from "./VehiclePaint.js";

it.each(["beetle", "pickup", "rosso-coupe"])(
  "assigns an owned non-default paint when %s enters ordinary road traffic",
  (model) => {
    const scene = new TrafficTestHarness();
    for (const state of [...scene.traffic.states.values()])
      scene.entities.remove(state.entity.id, false);
    const graph = scene.strategy.trafficNetwork(4800, 8304);
    const positions = [
      { x: 4800, y: 8304 },
      ...[...graph.lanes.values()].slice(0, 64).map((lane) => lane.a),
      ...Array.from({ length: 33 }, (_, i) => (i - 16) * 4096).flatMap((dx) =>
        Array.from({ length: 33 }, (_, i) => ({ x: 4800 + dx, y: 8304 + (i - 16) * 4096 })),
      ),
    ];
    const ownedColoredIdentity = (identity: string) =>
      identity.includes(`:${model}:`) && trafficPaint(model, identity) !== undefined;
    for (const position of positions) {
      scene.player.position = { wx: position.x, wy: position.y };
      const cx = Math.floor(position.x / 256),
        cy = Math.floor(position.y / 256);
      scene.traffic.visibleRanges = [{ minCx: cx, maxCx: cx, minCy: cy, maxCy: cy }];
      const candidates: { wx: number; wy: number }[] = [];
      scene.traffic.canSpawn = (identity, wx, wy) => {
        if (ownedColoredIdentity(identity)) candidates.push({ wx, wy });
        return false;
      };
      scene.traffic.tick(2.1, [scene.player]);
      if (!candidates.length) continue;
      for (const point of candidates) {
        const px = Math.floor(point.wx / 256),
          py = Math.floor(point.wy / 256);
        for (let y = py - 2; y <= py + 2; y++)
          for (let x = px - 2; x <= px + 2; x++) scene.world.getChunk(x, y);
      }
      scene.traffic.canSpawn = ownedColoredIdentity;
      scene.traffic.tick(2.1, [scene.player]);
      if (scene.traffic.states.size) break;
    }
    const car = required([...scene.traffic.states.values()][0]);
    expect(car.entity.type).toBe(`vehicle-v1:${model}`);
    expect(car.entity.paintSchemeId).toBeDefined();
    expect(vehiclePaint(model, car.entity.paintSchemeId)).toBeDefined();
    expect(car.entity.sprite?.sheetKey).toBe(
      `${car.entity.type}:paint:${car.entity.paintSchemeId}`,
    );
    expect(car.placed).not.toBe(true);
    expect(scene.traffic.snapshot(car).paintSchemeId).toBe(car.entity.paintSchemeId);
  },
  20_000,
);
