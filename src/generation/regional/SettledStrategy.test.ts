import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  getEntityAABB,
} from "../../entities/collision.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { EntityManager } from "../../entities/EntityManager.js";
import { createProp } from "../../entities/PropFactories.js";
import { PropManager } from "../../entities/PropManager.js";
import { updateRouteAI } from "../../entities/routeAI.js";
import { Chunk } from "../../world/Chunk.js";
import { World } from "../../world/World.js";
import { actorPlacements } from "../ActorPlacements.js";
import { createDescriptor, resolveDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { overviewSteps } from "../Overview.js";
import { ProceduralActors } from "../ProceduralActors.js";
import { CountrySource } from "./CountrysidePlanner.js";
import { DistrictSource } from "./DistrictStrategy.js";
import { QUERY_LIMITS } from "./RegionalPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

it("freezes v2 terrain and placements independently of the new default revision", () => {
  const generator = createGenerator(
    resolveDescriptor({ ...createDescriptor("regional", 2026), version: "regional-v2" } as never),
  );
  const h = createHash("sha256");
  for (const [cx = 0, cy = 0] of [
    [18, 32],
    [23, 32],
    [-4, -9],
    [0, 0],
  ]) {
    const c = new Chunk();
    generator.terrain.generate(c, cx, cy);
    h.update(c.subgrid);
    h.update(c.roadGrid);
    h.update(JSON.stringify(generator.placements(cx, cy, new Set())));
  }
  expect(h.digest("hex")).toBe("273effadf9e443e89923f716d1c2bf04e8e0b6de34ba19c9cca25b24b9307c17");
});
it("admitted country plans have deterministic owners, shared features, and bounded cheap overview", () => {
  const source = new CountrySource(regionalWorld(2026));
  const farm = source.farm(0, 1),
    wood = source.woodland(-8, -8);
  expect(farm?.actors.map((a) => a.type)).toContain("cow");
  expect(wood?.props.some((p) => p.propType === "prop-oak-tree")).toBe(true);
  for (const p of [farm, wood]) {
    if (!p) throw new Error("Missing country checkpoint");
    const first = source.query(p.bounds).find((v) => v.id === p.id);
    source.query({ minX: 3000, minY: 3000, maxX: 3040, maxY: 3040 });
    expect(source.query(p.bounds).find((v) => v.id === p.id)).toEqual(first);
    const steps = overviewSteps(createDescriptor("regional", 2026), {
      bounds: p.bounds,
      detail: "region",
      sampleStep: 4,
      limits: QUERY_LIMITS,
    });
    let step = steps.next();
    while (!step.done) step = steps.next();
    expect(step.value.countryside?.some((v) => v.id === p.id)).toBe(true);
    expect(step.value.stats.features).toBeLessThanOrEqual(QUERY_LIMITS.maxFeatures);
    expect(step.value.stats.detailedChunks).toBe(0);
  }
  const styles = new Set<string>();
  const districts = new DistrictSource(regionalWorld(2026), true);
  for (let cy = -4; cy <= 4; cy++)
    for (let cx = -4; cx <= 4; cx++) {
      const d = districts.owner(cx, cy);
      if (d?.style) styles.add(d.style);
    }
  expect([...styles].sort()).toEqual(["garden", "market", "residential"]);
});
it("v3 keeps shared half-tile borders at farms, woods, city edges, and negative coordinates", () => {
  const g = createGenerator(createDescriptor("regional", 2026));
  for (const [cx = 0, cy = 0] of [
    [42, 82],
    [-60, -60],
    [18, 32],
    [-4, -9],
  ]) {
    const a = new Chunk(),
      east = new Chunk(),
      south = new Chunk();
    g.terrain.generate(a, cx, cy);
    g.terrain.generate(east, cx + 1, cy);
    g.terrain.generate(south, cx, cy + 1);
    for (let i = 0; i < 33; i++) {
      expect(a.getSubgrid(32, i)).toBe(east.getSubgrid(0, i));
      expect(a.getSubgrid(i, 32)).toBe(south.getSubgrid(i, 0));
    }
  }
});
it("planned actor routes are navigable against the actual generated terrain and prop walls", () => {
  const g = createGenerator(createDescriptor("regional", 2026)),
    world = new World(g.terrain),
    props = new PropManager(),
    seen = new Set<string>();
  for (const bounds of [
    { minX: 648, minY: 1294, maxX: 706, maxY: 1350 },
    { minX: -1000, minY: -1000, maxX: -920, maxY: -920 },
    { minX: 255, minY: 500, maxX: 345, maxY: 550 },
  ]) {
    const actors = actorPlacements(g, bounds);
    expect(actors.length).toBeGreaterThan(0);
    for (const actor of actors) {
      const entity = ENTITY_FACTORIES[actor.type]?.(actor.wx, actor.wy);
      if (!entity?.collider) throw new Error("Missing actor collider");
      const xs = actor.route.map((p) => p.wx / 16),
        ys = actor.route.map((p) => p.wy / 16);
      for (
        let cy = Math.floor(Math.min(...ys) / 16) - 1;
        cy <= Math.floor(Math.max(...ys) / 16) + 1;
        cy++
      )
        for (
          let cx = Math.floor(Math.min(...xs) / 16) - 1;
          cx <= Math.floor(Math.max(...xs) / 16) + 1;
          cx++
        ) {
          world.getChunk(cx, cy);
          for (const p of g.placements(cx, cy, new Set()).placements)
            if (p.featureId && !seen.has(p.featureId)) {
              seen.add(p.featureId);
              props.add(createProp(p.propType, p.wx, p.wy));
            }
        }
      for (let i = 0; i < actor.route.length; i++) {
        const a = actor.route[i],
          b = actor.route[(i + 1) % actor.route.length];
        if (!a || !b) continue;
        const steps = Math.ceil(Math.hypot(b.wx - a.wx, b.wy - a.wy) / 4);
        for (let n = 0; n <= steps; n++) {
          const position = {
              wx: a.wx + ((b.wx - a.wx) * n) / steps,
              wy: a.wy + ((b.wy - a.wy) * n) / steps,
            },
            box = getEntityAABB(position, entity.collider);
          expect(
            aabbOverlapsSolid(box, (x, y) => world.getCollision(x, y), 3),
            `${actor.featureId} water`,
          ).toBe(false);
          expect(
            props.props.some((p) => aabbOverlapsPropWalls(box, p.position, p, 0, 24)),
            `${actor.featureId} wall at ${position.wx},${position.wy}`,
          ).toBe(false);
        }
      }
    }
  }
});
it("generated actor eviction is disposable, removal is durable, and routes use normal physics", () => {
  const g = createGenerator(createDescriptor("regional", 2026)),
    manager = new EntityManager(),
    deleted = new Set<string>();
  let dirty = 0;
  const actors = new ProceduralActors(manager, deleted, () => dirty++);
  actors.reconcile(g, ["41,82", "42,82", "41,83", "42,83"]);
  const farmer = manager.entities.find((e) => e.type.startsWith("person"));
  if (!farmer) throw new Error("Missing farmer");
  const start = { ...farmer.position },
    world = new World(g.terrain),
    props = new PropManager();
  for (let i = 0; i < 300; i++) {
    updateRouteAI(farmer, 1 / 60);
    manager.update(1 / 60, (x, y) => world.getCollision(x, y), [], props);
  }
  expect(Math.hypot(farmer.position.wx - start.wx, farmer.position.wy - start.wy)).toBeGreaterThan(
    50,
  );
  const id = farmer.proceduralId;
  manager.remove(farmer.id);
  expect(dirty).toBe(1);
  expect(deleted.has(id ?? "")).toBe(true);
  actors.reconcile(g, []);
  expect(manager.entities).toHaveLength(0);
  actors.reconcile(g, ["41,82", "42,82", "41,83", "42,83"]);
  expect(manager.entities.some((e) => e.proceduralId === id)).toBe(false);
  expect(new Set(manager.entities.map((e) => e.proceduralId)).size).toBe(manager.entities.length);
});

it("a newly obstructed loop reverses along its current leg rather than cutting across the interior", () => {
  const world = new World(createGenerator(createDescriptor("flat", 2026)).terrain),
    manager = new EntityManager(),
    props = new PropManager();
  const actor = ENTITY_FACTORIES.person1?.(0, 0);
  if (!actor) throw new Error("No actor");
  actor.routeAI = {
    points: [
      { wx: 0, wy: 0 },
      { wx: 100, wy: 0 },
      { wx: 100, wy: 100 },
      { wx: 0, wy: 100 },
    ],
    index: 1,
    pause: 0,
    blocked: 0,
    last: { wx: 0, wy: 0 },
  };
  manager.spawn(actor);
  props.add(createProp("prop-shed", 40, 0));
  let reversed = false;
  for (let i = 0; i < 600; i++) {
    updateRouteAI(actor, 1 / 60);
    manager.update(1 / 60, (x, y) => world.getCollision(x, y), [], props);
    if ((actor.velocity?.vx ?? 0) < 0) reversed = true;
    expect(actor.position.wy).toBe(0);
    expect(actor.position.wx).toBeLessThan(20);
  }
  expect(reversed).toBe(true);
});
