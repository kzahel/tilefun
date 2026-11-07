import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RoadType } from "../road/RoadType.js";
import { GENERATED_CROSSINGS } from "../scenarios/GeneratedCrossingRecipe.js";
import { required } from "../shared/required.js";
import { World } from "../world/World.js";
import { RailwayStrategy } from "./RailwayStrategy.js";

for (const c of GENERATED_CROSSINGS) {
  it(`${c.label}: deterministic bridge discovery and terrain across every footprint chunk`, () => {
    const a = new RailwayStrategy(regionalWorld(c.seed)),
      b = new RailwayStrategy(regionalWorld(c.seed));
    const line = required(a.railways.owner(c.cx, c.cy)),
      bridge = required(line.bridges[c.bridge]);
    const chunks: [number, number][] = [];
    for (let y = Math.floor(bridge.bounds.minY / 16); y <= Math.floor(bridge.bounds.maxY / 16); y++)
      for (
        let x = Math.floor(bridge.bounds.minX / 16);
        x <= Math.floor(bridge.bounds.maxX / 16);
        x++
      )
        chunks.push([x, y]);
    const capture = (s: RailwayStrategy, list: typeof chunks) => {
      const world = new World(s),
        result = new Map<string, string>();
      for (const [x, y] of list) {
        const chunk = world.getChunk(x, y);
        const props = s.placements(x, y).filter((p) => p.propType.startsWith("prop-road-rail-"));
        expect(props.length).toBeGreaterThan(0);
        result.set(
          `${x},${y}`,
          createHash("sha256")
            .update(JSON.stringify({ road: chunk.roadGrid, height: chunk.heightGrid, props }))
            .digest("hex"),
        );
      }
      // Track under the deck replaces the road cells; the road is carried above.
      expect(world.getRoadAt(bridge.x, bridge.y)).toBe(RoadType.RailCurveProof);
      expect(world.getRoadAt(bridge.x - 1, bridge.y - 1)).toBe(RoadType.RailCurveProof);
      expect(world.getHeightAt(bridge.x, bridge.y)).toBe(0);
      return [...result].sort();
    };
    expect(capture(a, chunks)).toEqual(capture(b, [...chunks].reverse()));
    // A different planner reaches the same line from a query around the bridge.
    expect(b.railways.query(bridge.bounds).find((l) => l.id === line.id)).toEqual(line);
    for (const station of line.stations)
      expect(Math.hypot(station.x - bridge.x, station.y - bridge.y)).toBeGreaterThan(40);
  });
}
