import { CHUNK_SIZE_PX, ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { chunkKey } from "../world/types.js";
import { type Lane, type LaneGraph, samplePath } from "./LaneGraph.js";
import { populateRacers } from "./RaceTraffic.js";
import { TRAFFIC_MODELS, vehicleRoadWidth, vehicleTurningRadius } from "./Vehicle.js";
import type { VehicleRegistry } from "./VehicleRegistry.js";

export interface RoadSpawnOptions {
  /** Ordinary road search can extend beyond the fixed fixture search. */
  ranges?: readonly ChunkRange[];
  /** Buffered camera ranges that must not receive new ordinary traffic. */
  excluded?: readonly ChunkRange[];
}

const ROAD_POPULATION_LIMIT = 32;

export function trafficHash(text: string): number {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
}

function covers(view: ChunkRange, range: ChunkRange): boolean {
  return (
    view.minCx <= range.minCx &&
    view.maxCx >= range.maxCx &&
    view.minCy <= range.minCy &&
    view.maxCy >= range.maxCy
  );
}

function laneIntersects(lane: Lane, range: ChunkRange): boolean {
  return (
    Math.max(lane.a.x, lane.b.x) + lane.width >= range.minCx * CHUNK_SIZE_PX &&
    Math.min(lane.a.x, lane.b.x) - lane.width < (range.maxCx + 1) * CHUNK_SIZE_PX &&
    Math.max(lane.a.y, lane.b.y) + lane.width >= range.minCy * CHUNK_SIZE_PX &&
    Math.min(lane.a.y, lane.b.y) - lane.width < (range.maxCy + 1) * CHUNK_SIZE_PX
  );
}

function* populationChunks(ranges: readonly ChunkRange[]) {
  const seen = new Set<string>();
  for (const range of ranges)
    for (let cy = range.minCy; cy <= range.maxCy; cy++)
      for (let cx = range.minCx; cx <= range.maxCx; cx++) {
        const key = chunkKey(cx, cy);
        if (seen.has(key)) continue;
        seen.add(key);
        yield { cx, cy };
      }
}

/** Opens deterministic road slots and the fixed racers on already loaded roads. */
export class TrafficPopulation {
  private readonly models = new Map<number, string[]>();

  constructor(private readonly registry: VehicleRegistry) {}

  populate(
    fixtureRanges: readonly ChunkRange[],
    { ranges = fixtureRanges, excluded = [] }: RoadSpawnOptions = {},
  ): void {
    const r = this.registry;
    if (!this.populateDepots(fixtureRanges) || !r.source.trafficNetwork) return;
    let slotsLeft =
      ROAD_POPULATION_LIMIT - [...r.states.values()].filter((s) => s.autonomous).length;
    if (slotsLeft <= 0) return;
    const identities = new Set([...r.states.values()].map((s) => s.entity.proceduralId));
    const roadRanges = ranges.filter((range) => !excluded.some((view) => covers(view, range)));
    const search = ranges === fixtureRanges ? fixtureRanges : [...fixtureRanges, ...roadRanges];
    for (const graph of this.graphs(search)) {
      populateRacers(r, graph, fixtureRanges, identities);
      if (!roadRanges.length) continue;
      for (const lane of graph.lanes.values()) {
        if (lane.race || !roadRanges.some((range) => laneIntersects(lane, range))) continue;
        slotsLeft = this.seedLane(lane, roadRanges, excluded, identities, slotsLeft);
        if (slotsLeft === 0) return;
      }
    }
  }

  /** Keep the generated depot models' durable identities and tombstones. */
  private populateDepots(ranges: readonly ChunkRange[]): boolean {
    const r = this.registry;
    if (!r.source.depotVehicles) return true;
    for (const { cx, cy } of populationChunks(ranges))
      for (const p of r.source.depotVehicles(cx, cy)) {
        if (r.states.size >= 1024) return false;
        if (
          [...r.states.values()].some((s) => s.entity.proceduralId === p.identity) ||
          !r.canSpawn(p.identity, p.wx, p.wy)
        )
          continue;
        r.place(p.model, p.wx, p.wy, p.facing, undefined, p.identity);
      }
    return true;
  }

  private *graphs(ranges: readonly ChunkRange[]): Iterable<LaneGraph> {
    const { source, world } = this.registry;
    if (!source.trafficNetwork) return;
    const seen = new Set<LaneGraph>();
    for (const { cx, cy } of populationChunks(ranges)) {
      if (!world.getChunkIfLoaded(cx, cy)) continue;
      const graph = source.trafficNetwork((cx + 0.5) * CHUNK_SIZE_PX, (cy + 0.5) * CHUNK_SIZE_PX);
      if (seen.has(graph)) continue;
      seen.add(graph);
      yield graph;
    }
  }

  private modelsFor(width: number): readonly string[] {
    let models = this.models.get(width);
    if (!models) {
      models = TRAFFIC_MODELS.filter(
        (model) =>
          vehicleRoadWidth(`vehicle-v1:${model}`) <= width &&
          vehicleTurningRadius(`vehicle-v1:${model}`) <= width / 2,
      );
      this.models.set(width, models);
    }
    return models;
  }

  private seedLane(
    lane: Lane,
    ranges: readonly ChunkRange[],
    excluded: readonly ChunkRange[],
    identities: Set<string | undefined>,
    slotsLeft: number,
  ): number {
    const models = this.modelsFor(lane.width);
    if (!models.length) return slotsLeft;
    for (let slot = 0; slot * 256 + 128 < lane.path.length - 64; slot++) {
      const p = samplePath(lane.path, slot * 256 + 128);
      const cx = Math.floor(p.x / CHUNK_SIZE_PX),
        cy = Math.floor(p.y / CHUNK_SIZE_PX);
      const chunk = { minCx: cx, maxCx: cx, minCy: cy, maxCy: cy };
      if (!ranges.some((range) => covers(range, chunk))) continue;
      if (excluded.some((view) => covers(view, chunk))) continue;
      if (this.seedSlot(lane, slot, p, models, identities) && --slotsLeft === 0) return 0;
    }
    return slotsLeft;
  }

  private seedSlot(
    lane: Lane,
    slot: number,
    p: ReturnType<typeof samplePath>,
    models: readonly string[],
    identities: Set<string | undefined>,
  ): boolean {
    const r = this.registry;
    const tx = Math.floor(p.x / TILE_SIZE),
      ty = Math.floor(p.y / TILE_SIZE);
    if (!r.world.getRoadAt(tx, ty)) return false;
    const identity = `traffic-v1:${lane.id}:slot-${slot}`;
    const hash = trafficHash(identity);
    if (hash % 3 !== 0 || identities.has(identity) || !r.canSpawn(identity, p.x, p.y)) return false;
    const model = models[hash % models.length];
    if (!model) return false;
    const ground = lane.surfaceFollowing ? undefined : r.world.getHeightAt(tx, ty) * ELEVATION_PX;
    const state = r.place(model, p.x, p.y, p.direction, undefined, identity, ground);
    if (!state) return false;
    state.autonomous = true;
    identities.add(identity);
    state.route = { laneId: lane.id, choices: 0 };
    r.onChange?.(state, false);
    return true;
  }
}
