import { DenseDistrictStrategy } from "../generation/regional/DenseDistrictStrategy.js";
import {
  type Bounds,
  connectionForOwner,
  REGION_SIZE,
} from "../generation/regional/RegionalPlanner.js";
import { buildLaneGraph, generatedSegments, type LaneGraph } from "./LaneGraph.js";

/** New identity, frozen v5 terrain/art plus generated traffic. No prior output changes. */
export class TrafficStrategy extends DenseDistrictStrategy {
  private networks = new Map<string, LaneGraph>();
  constructor(world: ConstructorParameters<typeof DenseDistrictStrategy>[0]) {
    super(world, true);
  }
  trafficNetwork(wx: number, wy: number): LaneGraph {
    const cx = Math.floor(wx / 16 / REGION_SIZE),
      cy = Math.floor(wy / 16 / REGION_SIZE),
      key = `${cx},${cy}`;
    const cached = this.networks.get(key);
    if (cached) return cached;
    const bounds: Bounds = {
      minX: (cx - 1) * REGION_SIZE,
      minY: (cy - 1) * REGION_SIZE,
      maxX: (cx + 2) * REGION_SIZE - 1,
      maxY: (cy + 2) * REGION_SIZE - 1,
    };
    const plans = this.districts.query(bounds),
      connections = [];
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++)
        for (const axis of ["east", "south"] as const) {
          const c = connectionForOwner(this.world, x, y, axis);
          if (c) connections.push(c);
        }
    const network = buildLaneGraph(generatedSegments(plans, connections));
    this.networks.set(key, network);
    if (this.networks.size > 8) this.networks.delete(this.networks.keys().next().value ?? "");
    return network;
  }
}
