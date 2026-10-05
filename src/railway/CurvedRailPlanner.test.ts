import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { pathDistance } from "../generation/regional/PlanGeometry.js";
import { connectionForOwner, plannedElevation } from "../generation/regional/RegionalPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RoadType } from "../road/RoadType.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyChunkSnapshot, serializeChunk } from "../shared/serialization.js";
import { Chunk } from "../world/Chunk.js";
import { World } from "../world/World.js";
import { railAlignment } from "./RailPath.js";
import { RailwayStrategy } from "./RailwayStrategy.js";

it("generates deterministic broad city curves, usable platforms, and identical replica geometry", () => {
  const strategy = new RailwayStrategy(regionalWorld(2026));
  const line = required(strategy.railways.owner(2, -3)),
    path = required(line.path),
    alignment = railAlignment(path);
  const other = new RailwayStrategy(regionalWorld(2026));
  other.railways.owner(-4, -1);
  other.railways.query({ minX: 2048, minY: -3072, maxX: 4096, maxY: -2048 });
  expect(other.railways.owner(3, -3)).toEqual(line);
  const world = new World(strategy);
  for (const p of alignment.samples(128)) {
    const tx = Math.floor(p.x / 16),
      ty = Math.floor(p.y / 16);
    const chunk = world.getChunk(Math.floor(tx / 16), Math.floor(ty / 16));
    expect(world.getRoadAt(tx, ty)).toBe(RoadType.RailCurveProof);
    expect(world.getHeightAt(tx, ty)).toBe(0);
    expect(plannedElevation(strategy.world, tx, ty)).toBeGreaterThanOrEqual(0.06);
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
    for (let cy = -4; cy <= -2; cy++)
      for (let cx = 1; cx <= 4; cx++)
        for (const axis of ["east", "south"] as const) {
          const road = connectionForOwner(strategy.world, cx, cy, axis);
          if (road) expect(pathDistance(road.points, p.x / 16, p.y / 16)).toBeGreaterThan(15);
        }
  }
  for (const station of line.stations) {
    world.getChunk(Math.floor(station.x / 16), Math.floor((station.y - 4) / 16));
    expect(world.getRoadAt(station.x, station.y - 4)).toBe(RoadType.CityPavement);
    expect(station.access.minY).toBe(station.town.center.y + 44);
  }
  // Saved terrain edits keep their mask, but deterministically recover track geometry.
  const savedWorld = new World(strategy),
    cx = Math.floor(line.start / 16),
    cy = Math.floor(line.y / 16);
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
