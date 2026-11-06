import { expect, it } from "vitest";
import { CityPlacesStrategy } from "../../art/studies/CityPlacesStrategy.js";
import { studyGenerator } from "../../art/studies/StudyGenerator.js";
import { required } from "../../shared/required.js";
import { cityPlacesSurfaceAt } from "./CityPlacesPlanner.js";
import { walkTrip } from "./CityWalkGraph.js";
import { regionalWorld } from "./WorldDescriptor.js";

const descriptor = {
  type: "regional",
  version: "regional-v10",
  seed: 2026,
  preset: "temperate-v1",
} as const;
it("admits crossings explicitly, reserves continuous access and serves four destination roles", () => {
  const g = studyGenerator(new CityPlacesStrategy(regionalWorld(descriptor.seed), 10));
  if (!(g.terrain instanceof CityPlacesStrategy)) throw Error();
  const p = required(g.terrain.districts.owner(0, 0)),
    graph = required(p.walkGraph);
  expect(graph.nodes.length).toBeLessThanOrEqual(64);
  expect(graph.edges.length).toBeLessThanOrEqual(96);
  expect(new Set(graph.nodes.map((n) => n.destination).filter(Boolean))).toEqual(
    new Set(["home", "shop", "park-seat", "square-seat"]),
  );
  expect(graph.edges.filter((e) => e.crossingId).map((e) => e.crossingId)).toEqual(
    p.commercial.crossings.map((c) => c.id),
  );
  for (const edge of graph.edges) {
    const a = required(graph.nodes.find((n) => n.id === edge.a)),
      b = required(graph.nodes.find((n) => n.id === edge.b));
    expect(a.wx === b.wx || a.wy === b.wy).toBe(true);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.wx - a.wx, b.wy - a.wy) / 4));
    for (let n = 0; n <= steps; n++)
      expect(
        cityPlacesSurfaceAt(
          p,
          Math.floor((a.wx + ((b.wx - a.wx) * n) / steps) / 16),
          Math.floor((a.wy + ((b.wy - a.wy) * n) / steps) / 16),
        ),
        `${edge.a} -> ${edge.b}`,
      ).toBeGreaterThan(0);
  }
  expect(() => walkTrip(graph, "unknown", "other")).toThrow("Disconnected");
});
