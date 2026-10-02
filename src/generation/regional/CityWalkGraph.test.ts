import { expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { aabbOverlapsPropWalls, resolveCollision } from "../../entities/collision.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createProp } from "../../entities/PropFactories.js";
import { updateRouteAI } from "../../entities/routeAI.js";
import { CollisionFlag } from "../../world/TileRegistry.js";
import { World } from "../../world/World.js";
import { createGenerator } from "../Generator.js";
import { cityPlacesSurfaceAt } from "./CityPlacesPlanner.js";
import { CityPlacesStrategy } from "./CityPlacesStrategy.js";
import { walkTrip } from "./CityWalkGraph.js";

const descriptor = {
  type: "regional",
  version: "regional-v10",
  seed: 2026,
  preset: "temperate-v1",
} as const;
it("admits crossings explicitly, reserves continuous access and serves four destination roles", () => {
  const g = createGenerator(descriptor);
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
it("completes every destination trip with real collision and waits; blocked trips pause and return", () => {
  const g = createGenerator(descriptor);
  if (!(g.terrain instanceof CityPlacesStrategy)) throw Error();
  const plan = required(g.terrain.districts.owner(0, 0)),
    world = new World(g.terrain),
    props = new Map<string, ReturnType<typeof createProp>>();
  for (
    let cy = Math.floor(plan.bounds.minY / 16) - 1;
    cy <= Math.floor(plan.bounds.maxY / 16) + 1;
    cy++
  )
    for (
      let cx = Math.floor(plan.bounds.minX / 16) - 1;
      cx <= Math.floor(plan.bounds.maxX / 16) + 1;
      cx++
    )
      for (const f of g.placements(cx, cy, new Set()).placements)
        props.set(required(f.featureId), createProp(f.propType, f.wx, f.wy));
  const visitors = plan.actors.filter((a) => a.featureId.includes(":visitor:"));
  expect(visitors).toHaveLength(8);
  for (const a of visitors) {
    const e = required(ENTITY_FACTORIES[a.type])(a.wx, a.wy);
    e.routeAI = { points: a.route, index: 1, pause: 0, blocked: 0, last: { ...e.position } };
    const visited = new Set<string>();
    const dt = 1 / 30;
    for (let tick = 0; tick < 180 / dt; tick++) {
      const target = required(e.routeAI.points[e.routeAI.index]);
      const prior = e.routeAI.index;
      updateRouteAI(e, dt);
      if (prior !== e.routeAI.index && target.destinationId) {
        visited.add(target.destinationId);
        expect(e.routeAI.pause).toBe(target.waitSeconds);
        expect(e.sprite?.moving).toBe(false);
      }
      if (e.velocity)
        expect(
          resolveCollision(
            e,
            e.velocity.vx * dt,
            e.velocity.vy * dt,
            (tx, ty) => world.getCollision(tx, ty),
            CollisionFlag.Solid | CollisionFlag.Water,
            (box) => [...props.values()].some((p) => aabbOverlapsPropWalls(box, p.position, p, 0)),
          ),
        ).toBe(false);
    }
    expect(visited.size, a.featureId).toBeGreaterThanOrEqual(2);
    // An edited blocker can stop movement. The AI reverses after a bounded wait;
    // it neither teleports nor retries forever on the obstructed segment.
    e.routeAI.pause = 0;
    e.routeAI.blocked = 0;
    e.routeAI.last = { ...e.position };
    const prior = e.routeAI.index,
      pos = { ...e.position };
    for (let tick = 0; tick < 65; tick++) updateRouteAI(e, dt);
    expect(e.position).toEqual(pos);
    expect(e.routeAI.index).not.toBe(prior);
    expect(e.routeAI.pause).toBeGreaterThan(0);
  }
});
