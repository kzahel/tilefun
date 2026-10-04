import { TerrainId } from "../autotile/TerrainId.js";
import { deriveTerrain } from "../generation/deriveTerrain.js";
import { insideDenseBounds } from "../generation/regional/DenseDistrictPlanner.js";
import { RoadType } from "../road/RoadType.js";
import { TrafficStrategy } from "../traffic/TrafficNetwork.js";
import { Chunk } from "../world/Chunk.js";
import { RailwayPlanner } from "./RailwayPlanner.js";

/** Reserve stations outside town blocks; admit only dry, crossing-free straight services. */
export class RailwayStrategy extends TrafficStrategy {
  readonly railways = new RailwayPlanner(this.world);
  override generate(chunk: Chunk, cx: number, cy: number) {
    super.generate(chunk, cx, cy);
    const lines = this.railways.query({
      minX: cx * 16 - 1,
      minY: cy * 16 - 1,
      maxX: cx * 16 + 17,
      maxY: cy * 16 + 17,
    });
    if (!lines.length) return;
    const surface = (x: number, y: number) => {
      for (const line of lines) {
        if (x >= line.bounds.minX && x < line.bounds.maxX && y >= line.y - 1 && y < line.y + 1)
          return y < line.y ? RoadType.RailHorizontalTop : RoadType.RailHorizontalBottom;
        for (const s of line.stations)
          if (insideDenseBounds(s.platform, x, y) || insideDenseBounds(s.access, x, y))
            return RoadType.CityPavement;
      }
      return 0;
    };
    for (let sy = 0; sy < Chunk.SUBGRID_SIZE; sy++)
      for (let sx = 0; sx < Chunk.SUBGRID_SIZE; sx++)
        if (surface(cx * 16 + sx / 2, cy * 16 + sy / 2)) chunk.setSubgrid(sx, sy, TerrainId.Grass);
    deriveTerrain(chunk);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const road = surface(cx * 16 + x, cy * 16 + y);
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
    for (const line of lines)
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
    return props;
  }
}
