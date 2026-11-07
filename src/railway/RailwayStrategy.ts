import { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import { createProp } from "../entities/PropFactories.js";
import { deriveTerrain } from "../generation/deriveTerrain.js";
import { insideDenseBounds } from "../generation/regional/DenseDistrictPlanner.js";
import { intersects } from "../generation/regional/RegionalPlanner.js";
import { RoadType } from "../road/RoadType.js";
import { required } from "../shared/required.js";
import { TrafficStrategy } from "../traffic/TrafficNetwork.js";
import { Chunk } from "../world/Chunk.js";
import { nearestRail } from "./RailPath.js";
import { RailwayPlanner } from "./RailwayPlanner.js";
import { bridgePlacements } from "./RoadRailBridge.js";

/** Realize planned track, station platforms and road-over-rail bridges in terrain. */
export class RailwayStrategy extends TrafficStrategy {
  private bridgeNetworks = new WeakSet<object>();
  readonly railways = new RailwayPlanner(this.world);
  railPathsForChunk(cx: number, cy: number) {
    return this.railways
      .query({ minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 })
      .flatMap((l) =>
        nearestRail(l.path, cx * CHUNK_SIZE_PX + 128, cy * CHUNK_SIZE_PX + 128).distance < 320
          ? [l.path]
          : [],
      );
  }
  override trafficNetwork(wx: number, wy: number) {
    const graph = super.trafficNetwork(wx, wy);
    if (this.bridgeNetworks.has(graph)) return graph;
    this.bridgeNetworks.add(graph);
    for (const lane of graph.lanes.values()) {
      const vertical = lane.a.x === lane.b.x;
      if (!vertical && lane.a.y !== lane.b.y) continue;
      const bounds = {
        minX: Math.min(lane.a.x, lane.b.x) / 16 - 6,
        maxX: Math.max(lane.a.x, lane.b.x) / 16 + 6,
        minY: Math.min(lane.a.y, lane.b.y) / 16 - 6,
        maxY: Math.max(lane.a.y, lane.b.y) / 16 + 6,
      };
      // Lanes run on the road centerline: x for north/south, y for east/west decks.
      const bridges = this.railways
        .query(bounds)
        .flatMap((line) => line.bridges)
        .filter(
          (b) =>
            (vertical
              ? b.axis === "south" && b.x * 16 === lane.a.x
              : b.axis === "east" && b.y * 16 === lane.a.y) && intersects(b.bounds, bounds),
        );
      if (bridges.length) {
        lane.surfaceFollowing = true;
        lane.requiredSurfaces = bridges.flatMap(bridgePlacements).map((p) => {
          const prop = createProp(p.propType, p.wx, p.wy),
            c = required(prop.collider);
          return { id: required(c.surface).id, bounds: getEntityAABB(prop.position, c) };
        });
      }
    }
    return graph;
  }
  override generate(chunk: Chunk, cx: number, cy: number) {
    super.generate(chunk, cx, cy);
    const lines = this.railways.query({
      minX: cx * 16 - 1,
      minY: cy * 16 - 1,
      maxX: cx * 16 + 17,
      maxY: cy * 16 + 17,
    });
    if (!lines.length) return;
    // Platforms sit inside the track reservation. Track overrides roads (bridges
    // carry them above); station paving keeps a town road passing between platforms.
    const surface = (x: number, y: number) => {
      for (const line of lines)
        for (const s of line.stations)
          if (insideDenseBounds(s.platform, x, y) || insideDenseBounds(s.access, x, y))
            return RoadType.CityPavement;
      for (const line of lines)
        if (nearestRail(line.path, (x + 0.5) * 16, (y + 0.5) * 16).distance <= 112)
          return RoadType.RailCurveProof;
      return 0;
    };
    for (let sy = 0; sy < Chunk.SUBGRID_SIZE; sy++)
      for (let sx = 0; sx < Chunk.SUBGRID_SIZE; sx++)
        if (surface(cx * 16 + sx / 2, cy * 16 + sy / 2)) chunk.setSubgrid(sx, sy, TerrainId.Grass);
    deriveTerrain(chunk);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const road = surface(cx * 16 + x, cy * 16 + y);
        if (road === RoadType.CityPavement && chunk.getRoad(x, y)) continue;
        if (road) {
          chunk.setRoad(x, y, road);
          chunk.setHeight(x, y, 0);
        }
      }
  }
  override placements(cx: number, cy: number) {
    const props = super.placements(cx, cy);
    const lines = this.railways.query({
      minX: cx * 16 - 4,
      minY: cy * 16 - 4,
      maxX: cx * 16 + 20,
      maxY: cy * 16 + 20,
    });
    const chunkBounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    for (const line of lines) {
      for (const bridge of line.bridges)
        for (const placement of bridgePlacements(bridge)) {
          const prop = createProp(placement.propType, placement.wx, placement.wy);
          const b = getEntityAABB(prop.position, required(prop.collider));
          // Include the anchor chunk as well as every intersecting footprint.
          if (
            intersects(chunkBounds, {
              minX: b.left / 16,
              minY: b.top / 16,
              maxX: b.right / 16,
              maxY: (b.bottom + 1) / 16,
            })
          )
            props.push(placement);
        }
      for (const s of line.stations) {
        const add = (suffix: string, type: string, x: number, y: number) => {
          if (
            x >= cx * 16 - 3 &&
            x < (cx + 1) * 16 + 3 &&
            y >= cy * 16 - 3 &&
            y < (cy + 1) * 16 + 3
          )
            props.push({ featureId: `${s.id}:${suffix}`, propType: type, wx: x * 16, wy: y * 16 });
        };
        for (let i = -18; i < 18; i++)
          add(`edge:${i}`, "prop-rail-platform-edge", s.x + i + 0.5, s.y - 2);
        for (const dx of [-12, 12]) add(`bench:${dx}`, "prop-rail-bench", s.x + dx, s.y - 4);
        add("lamp", "prop-street-lamp", s.x - 17, s.y - 5);
        add("bin", "prop-city-street-v1-bin-black", s.x + 16, s.y - 5);
      }
    }
    return props;
  }
}
