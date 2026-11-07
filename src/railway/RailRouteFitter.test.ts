import { expect, it } from "vitest";
import { pathDistance } from "../generation/regional/PlanGeometry.js";
import {
  connectionForOwner,
  plannedElevation,
  settlementForOwner,
} from "../generation/regional/RegionalPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RoadType } from "../road/RoadType.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { required } from "../shared/required.js";
import { applyChunkSnapshot, serializeChunk } from "../shared/serialization.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { railAlignment } from "./RailPath.js";
import { STATION_BAND, STATION_SLOT, townCore } from "./RailRouteFitter.js";
import { RailwayPlanner } from "./RailwayPlanner.js";
import { RailwayStrategy } from "./RailwayStrategy.js";

it("generates deterministic S-bend links, bridged road crossings and identical replica geometry", () => {
  const strategy = new RailwayStrategy(regionalWorld(2026));
  // Seed 2026 west of the origin: a long vertical straight under an east/west road.
  const line = required(strategy.railways.owner(-1, 0)),
    path = line.path,
    alignment = railAlignment(path);
  expect(line.bridges.map((b) => b.axis)).toEqual(["east"]);
  const other = new RailwayStrategy(regionalWorld(2026));
  other.railways.owner(-4, -1);
  other.railways.query({ minX: -2048, minY: -1024, maxX: 1024, maxY: 1024 });
  expect(other.railways.owner(-1, 0)).toEqual(line);
  const world = new World(strategy);
  const roads = [];
  for (let cy = -1; cy <= 1; cy++)
    for (let cx = -2; cx <= 1; cx++)
      for (const axis of ["east", "south"] as const) {
        const road = connectionForOwner(strategy.world, cx, cy, axis);
        if (road) roads.push(road);
      }
  for (const p of alignment.samples(128)) {
    const tx = Math.floor(p.x / 16),
      ty = Math.floor(p.y / 16);
    const chunk = world.getChunk(Math.floor(tx / 16), Math.floor(ty / 16));
    expect(world.getRoadAt(tx, ty)).toBe(RoadType.RailCurveProof);
    expect(world.getHeightAt(tx, ty)).toBe(0);
    expect(plannedElevation(strategy.world, tx, ty)).toBeGreaterThanOrEqual(0.06);
    // Roads stay clear of the track except where a bridge carries them over.
    for (const road of roads)
      if (pathDistance(road.points, p.x / 16, p.y / 16) <= 15)
        expect(line.bridges.some((b) => Math.hypot(b.x - p.x / 16, b.y - p.y / 16) <= 23)).toBe(
          true,
        );
    const packet = decodeServerMessage(
      encodeServerMessage({
        type: "sync-chunks",
        chunkUpdates: [
          serializeChunk(Math.floor(tx / 16), Math.floor(ty / 16), chunk),
          serializeChunk(0, 0, new Chunk()),
        ],
      }),
    );
    if (packet.type !== "sync-chunks") throw Error("wrong packet");
    const replica = new Chunk();
    applyChunkSnapshot(replica, required(packet.chunkUpdates?.[0]));
    expect(replica.railPaths).toEqual([path]);
    expect(packet.chunkUpdates?.[1]?.railPaths).toBeUndefined();
  }
  for (const station of line.stations) {
    world.getChunk(Math.floor(station.x / 16), Math.floor((station.y - 4) / 16));
    expect(world.getRoadAt(station.x, station.y - 4)).toBe(RoadType.CityPavement);
    expect(station.access.minY).toBe(station.town.center.y + 44);
  }
  // Saved terrain edits keep their mask, but deterministically recover track geometry.
  const start = alignment.sample(0);
  const savedWorld = new World(strategy),
    cx = Math.floor(start.x / 256),
    cy = Math.floor(start.y / 256);
  const saved = world.getChunk(cx, cy);
  saved.setRoad(0, 0, 0);
  const restored = savedWorld.chunks.admit(cx, cy, {
    subgrid: saved.subgrid,
    roadGrid: saved.roadGrid,
    heightGrid: saved.heightGrid,
  });
  expect(restored.railPaths).toEqual([path]);
  expect(restored.roadGrid).toEqual(saved.roadGrid);
});

it("gives hub towns separate west and east platforms either side of a shared access", () => {
  const strategy = new RailwayStrategy(regionalWorld(2026));
  const west = required(strategy.railways.owner(-1, -1)),
    east = required(strategy.railways.owner(0, -1));
  const town = required(settlementForOwner(strategy.world, 0, -1));
  const arriving = west.stations[1],
    leaving = east.stations[0];
  expect([arriving.town.id, leaving.town.id]).toEqual([town.id, town.id]);
  expect(arriving.x).toBe(town.center.x - STATION_SLOT);
  expect(leaving.x).toBe(town.center.x + STATION_SLOT);
  expect(arriving.y).toBe(town.center.y + STATION_BAND);
  expect(arriving.access).toEqual(leaving.access);
  // The two buffer ends leave the town's own north/south road free between them.
  const a = railAlignment(west.path),
    b = railAlignment(east.path);
  expect(town.center.x * 16 - a.sample(a.length).x).toBeGreaterThanOrEqual(256);
  expect(b.sample(0).x - town.center.x * 16).toBeGreaterThanOrEqual(256);
  const world = new World(strategy);
  for (const x of [arriving.x, town.center.x, leaving.x]) {
    world.getChunk(Math.floor(x / 16), Math.floor((arriving.y - 4) / 16));
    const road = world.getRoadAt(x, arriving.y - 4);
    // Pavement, or the town road crossing the concourse where one passes.
    expect(road === RoadType.CityPavement || x === town.center.x).toBe(true);
  }
});

it("links most neighbouring towns without crossing any town core", () => {
  const world = regionalWorld(2026),
    planner = new RailwayPlanner(world);
  const served = new Set<string>();
  let towns = 0;
  for (let cy = -4; cy < 4; cy++)
    for (let cx = -4; cx < 4; cx++) {
      if (settlementForOwner(world, cx, cy)) towns++;
      const line = planner.owner(cx, cy);
      if (!line) continue;
      for (const s of line.stations) served.add(s.town.id);
      const cores = [-1, 0, 1, 2].flatMap((dx) =>
        [-1, 0, 1].flatMap((dy) => {
          const t = settlementForOwner(world, cx + dx, cy + dy);
          return t ? [townCore(t)] : [];
        }),
      );
      for (const p of railAlignment(line.path).samples(64))
        expect(
          cores.some(
            (c) =>
              p.x / 16 >= c.minX && p.x / 16 <= c.maxX && p.y / 16 >= c.minY && p.y / 16 <= c.maxY,
          ),
        ).toBe(false);
    }
  // Measured 2026-11-07: 10 of 139 towns had stations under the pair-only planner.
  expect(served.size / towns).toBeGreaterThan(0.5);
});
