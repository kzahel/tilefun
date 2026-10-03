import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  getEntityAABB,
} from "../../entities/collision.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createProp } from "../../entities/PropFactories.js";
import { PropManager } from "../../entities/PropManager.js";
import { denseCitySurfacePieces } from "../../road/DenseCitySurface.js";
import { RoadType } from "../../road/RoadType.js";
import { Chunk } from "../../world/Chunk.js";
import { World } from "../../world/World.js";
import { actorPlacements } from "../ActorPlacements.js";
import { CURRENT_REGIONAL_VERSION } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { ProceduralProps } from "../ProceduralProps.js";
import { buildingRecipe, buildingVisualBounds } from "./BuildingRecipes.js";
import { DENSE_CITY_ASSETS, DENSE_CITY_BUILDINGS, denseBuilding } from "./DenseCityAssets.js";
import { DenseDistrictSource, denseSurfaceAt } from "./DenseDistrictPlanner.js";
import { DenseDistrictStrategy } from "./DenseDistrictStrategy.js";
import { denseDoorThresholds } from "./DenseDoorThresholds.js";
import { regionalWorld } from "./WorldDescriptor.js";

const generation = {
  type: "regional",
  version: CURRENT_REGIONAL_VERSION,
  seed: 2026,
  preset: "temperate-v1",
} as const;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
describe("current dense districts and approved art", () => {
  it("retains the exact promoted art bank", () => {
    expect(hash(DENSE_CITY_ASSETS)).toBe(
      "292d5025f800e99ad40a5e0788c7d36bf19849343b1c78589c6b78fda00e84c3",
    );
  });
  it("pins source choices for every surface neighbor combination", () => {
    const offsets = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
      ],
      pieces = [];
    for (let mask = 0; mask < 256; mask++)
      for (let type = 5; type <= 14; type++)
        pieces.push(
          denseCitySurfacePieces(type, 0, 0, (x, y) => {
            if (!x && !y) return type;
            const i = offsets.findIndex((p) => p[0] === x && p[1] === y);
            return i >= 0 && mask & (1 << i) ? 5 : 6;
          }),
        );
    expect(hash(pieces)).toBe("18fca98e3920375d48c131b22e8193727a648d30f7cbd3f87f6a7fc209b0af3f");
  });

  it("dispatches explicitly and promotes immutable facade definitions with shared factories", () => {
    expect(createGenerator(generation).terrain).toBeInstanceOf(DenseDistrictStrategy);
    expect(DENSE_CITY_ASSETS.version).toBe("dense-city-assets-v1");
    for (const p of DENSE_CITY_BUILDINGS) {
      expect(buildingRecipe(p.type)).toBe(p);
      const prop = createProp(p.type, 0, 0);
      expect(prop.sprite.parts).toBe(p.parts);
      expect(prop.walls?.[0]?.width).toBe(p.width);
      expect(prop.walls?.[0]?.height).toBe(p.groundDepth);
    }
  });
  it("reserves native art extents and unobstructed door approaches inside connected blocks", () => {
    const source = new DenseDistrictSource(regionalWorld(2026));
    for (const [cx, cy] of [
      [0, 0],
      [-1, -1],
      [1, 1],
    ] as const) {
      const plan = required(source.owner(cx, cy));
      expect(plan.blocks).toHaveLength(4);
      const lots = plan.blocks.flatMap((b) => b.lots);
      expect(lots).toHaveLength(8);
      const props = lots.map((l) => createProp(l.buildingType, l.anchor.x * 16, l.anchor.y * 16));
      for (const [i, l] of lots.entries()) {
        const recipe = required(buildingRecipe(l.buildingType)),
          art = buildingVisualBounds(recipe);
        expect(l.bounds.minY).toBeLessThanOrEqual(l.anchor.y + art.minY / 16);
        expect(l.entrance.y).toBeGreaterThan(l.anchor.y + recipe.groundDepth / 32);
        for (let y = l.entrance.y; y < l.entrance.y + 4; y += 0.25) {
          const b = {
            left: l.entrance.x * 16 - 4,
            right: l.entrance.x * 16 + 4,
            top: y * 16 - 4,
            bottom: y * 16 + 4,
          };
          expect(
            props.some((p) => aabbOverlapsPropWalls(b, p.position, p, 0)),
            `${l.id} door blocked by building ${i}`,
          ).toBe(false);
        }
      }
      const again = source.owner(cx, cy);
      expect(hash(again)).toBe(hash(plan));
    }
  });
  it("paves every door threshold through its interaction point to the street sidewalk", () => {
    for (const seed of [2026, 42]) {
      const source = new DenseDistrictSource(regionalWorld(seed), true);
      const g = createGenerator({ ...generation, seed, version: CURRENT_REGIONAL_VERSION });
      for (const [cx, cy] of [
        [0, 0],
        [-1, -1],
        [1, 1],
      ] as const) {
        const plan = source.owner(cx, cy);
        if (!plan) continue;
        expect(plan.recipe).toBe("dense-district-v2");
        const lots = plan.blocks.flatMap((b) => b.lots);
        expect(plan.entrancePaths).toHaveLength(
          lots.reduce((n, l) => n + denseDoorThresholds(denseBuilding(l.buildingType)).length, 0),
        );
        for (const path of plan.entrancePaths ?? []) {
          const lot = required(lots.find((l) => l.id === path.lotId));
          const x = Math.floor(path.threshold.x),
            firstY = Math.floor(path.threshold.y);
          // Inspect realized roadGrid cells, including chunk boundaries, rather
          // than only checking that the planner emits a connector rectangle.
          for (let y = firstY; y <= path.sidewalk.y + 1; y++) {
            const chunk = new Chunk();
            const chunkX = Math.floor(x / 16),
              chunkY = Math.floor(y / 16);
            g.terrain.generate(chunk, chunkX, chunkY);
            expect(
              chunk.getRoad(x - chunkX * 16, y - chunkY * 16),
              `${lot.id} gap at ${x},${y}`,
            ).toBe(RoadType.CityPavement);
          }
          expect(denseSurfaceAt(plan, Math.floor(lot.entrance.x), Math.floor(lot.entrance.y))).toBe(
            RoadType.CityPavement,
          );
          const prop = createProp(lot.buildingType, lot.anchor.x * 16, lot.anchor.y * 16);
          for (let y = lot.entrance.y; y <= path.sidewalk.y + 1; y += 0.25) {
            const player = {
              left: path.threshold.x * 16 - 4,
              right: path.threshold.x * 16 + 4,
              top: y * 16 - 4,
              bottom: y * 16 + 4,
            };
            expect(
              aabbOverlapsPropWalls(player, prop.position, prop, 0),
              `${lot.id} approach blocked`,
            ).toBe(false);
          }
        }
      }
    }
  });
  it("audits both condo doors from native ground modules instead of guessed interaction offsets", () => {
    expect(denseDoorThresholds(denseBuilding("prop-city-dense-v1-condo-bay-3"))).toEqual([
      { id: "bay", dx: -48, dy: 0, width: 32, primary: false },
      { id: "arched", dx: 40, dy: -16, width: 32, primary: true },
    ]);
    expect(denseDoorThresholds(denseBuilding("prop-city-dense-v1-condo-narrow-5"))).toEqual([
      { id: "bay", dx: -80, dy: 0, width: 32, primary: false },
      { id: "arched", dx: 72, dy: -16, width: 32, primary: true },
    ]);
    expect(denseDoorThresholds(denseBuilding("prop-city-dense-v1-butcher-2"))).toHaveLength(2);
    for (const recipe of DENSE_CITY_BUILDINGS)
      expect(denseDoorThresholds(recipe).filter((d) => d.primary)).toHaveLength(1);
  });
  it("routes people along physically clear sidewalks and a painted crossing", () => {
    const g = createGenerator(generation),
      world = new World(g.terrain),
      source = (g.terrain as DenseDistrictStrategy).districts;
    for (const [cx, cy] of [
      [0, 0],
      [-1, -1],
    ] as const) {
      const plan = required(source.owner(cx, cy)),
        props = new Map<string, ReturnType<typeof createProp>>();
      for (
        let y = Math.floor(plan.bounds.minY / 16) - 1;
        y <= Math.floor(plan.bounds.maxY / 16) + 1;
        y++
      )
        for (
          let x = Math.floor(plan.bounds.minX / 16) - 1;
          x <= Math.floor(plan.bounds.maxX / 16) + 1;
          x++
        )
          for (const p of g.placements(x, y, new Set()).placements)
            props.set(required(p.featureId), createProp(p.propType, p.wx, p.wy));
      const actors = actorPlacements(g, plan.bounds);
      expect(actors).toHaveLength(5);
      for (const a of actors) {
        const entity = required(ENTITY_FACTORIES[a.type])(a.wx, a.wy);
        for (let i = 0; i < a.route.length; i++) {
          const p = required(a.route[i]),
            q = required(a.route[(i + 1) % a.route.length]);
          const steps = Math.ceil(Math.hypot(q.wx - p.wx, q.wy - p.wy) / 4);
          for (let step = 0; step <= steps; step++) {
            entity.position.wx = p.wx + ((q.wx - p.wx) * step) / steps;
            entity.position.wy = p.wy + ((q.wy - p.wy) * step) / steps;
            const b = getEntityAABB(entity.position, required(entity.collider));
            expect(
              world.getCollision(
                Math.floor(entity.position.wx / 16),
                Math.floor(entity.position.wy / 16),
              ),
              `${a.featureId} terrain`,
            ).toBe(0);
            expect(
              [...props.values()].some(
                (p) =>
                  aabbOverlapsPropWalls(b, p.position, p, 0) ||
                  aabbOverlapsSolid(b, (x, y) => world.getCollision(x, y), 3),
              ),
              `${a.featureId} route collides`,
            ).toBe(false);
          }
        }
      }
      const cell = world.getRoadAt(plan.center.x, plan.center.y - 6);
      expect([RoadType.CityCrossVTop, RoadType.CityCrossVBottom]).toContain(cell);
    }
  });
  it("keeps chunk seams and cell-sized paint independent of render order", () => {
    const g = createGenerator(generation);
    for (const [cx, cy] of [
      [18, 32],
      [21, 35],
      [-40, -23],
    ] as const) {
      const a = new Chunk(),
        e = new Chunk(),
        s = new Chunk();
      g.terrain.generate(a, cx, cy);
      g.terrain.generate(e, cx + 1, cy);
      g.terrain.generate(s, cx, cy + 1);
      for (let i = 0; i < 33; i++) {
        expect(a.getSubgrid(32, i)).toBe(e.getSubgrid(0, i));
        expect(a.getSubgrid(i, 32)).toBe(s.getSubgrid(i, 0));
      }
    }
    for (let type = RoadType.CityAsphalt; type <= RoadType.CityCrossVBottom; type++) {
      const pieces = denseCitySurfacePieces(type, -1, 2, () => RoadType.CityAsphalt);
      for (const p of pieces) {
        expect(p.x).toBeGreaterThanOrEqual(-16);
        expect(p.y).toBeGreaterThanOrEqual(32);
        expect(p.x + p.rect[2]).toBeLessThanOrEqual(0);
        expect(p.y + p.rect[3]).toBeLessThanOrEqual(48);
      }
    }
  });
  it("uses stable IDs for tall cross-chunk residency and preserves tombstones and edits", () => {
    const g = createGenerator(generation),
      manager = new PropManager(),
      residency = new ProceduralProps(manager, () => {});
    const near = ["18,31", "18,32", "19,31", "19,32"];
    residency.reconcile(g, near);
    expect(manager.props.length).toBeGreaterThan(0);
    const p = required(manager.props.find((p) => p.type.startsWith("prop-city-dense"))),
      id = required(p.proceduralId);
    expect(manager.props.filter((p) => p.proceduralId === id)).toHaveLength(1);
    manager.remove(p.id, true);
    residency.reconcile(g, ["18,32"]);
    residency.reconcile(g, []);
    residency.reconcile(g, near);
    expect(manager.props.some((p) => p.proceduralId === id)).toBe(false);
    const state = residency.save();
    expect(state.deletedProceduralIds).toContain(id);
    const restored = new PropManager(),
      next = new ProceduralProps(restored, () => {});
    next.restore({
      playerX: 0,
      playerY: 0,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      entities: [],
      nextEntityId: 1,
      ...state,
    });
    next.reconcile(g, near);
    expect(restored.props.some((p) => p.proceduralId === id)).toBe(false);
  });
  it("returns park and street art from every chunk touched by its actual sprite bounds", () => {
    const g = createGenerator(generation),
      source = (g.terrain as DenseDistrictStrategy).districts;
    for (const [ox, oy] of [
      [0, 0],
      [-1, -1],
      [1, 1],
    ] as const) {
      const plan = required(source.owner(ox, oy)),
        props = new Map<string, ReturnType<typeof createProp>>();
      for (
        let cy = Math.floor(plan.bounds.minY / 16);
        cy <= Math.floor(plan.bounds.maxY / 16);
        cy++
      )
        for (
          let cx = Math.floor(plan.bounds.minX / 16);
          cx <= Math.floor(plan.bounds.maxX / 16);
          cx++
        )
          for (const p of g.placements(cx, cy, new Set()).placements)
            if (!p.propType.startsWith("prop-city-dense"))
              props.set(required(p.featureId), createProp(p.propType, p.wx, p.wy));
      for (const [id, p] of props) {
        const left = p.position.wx - p.sprite.spriteWidth / 2,
          right = p.position.wx + p.sprite.spriteWidth / 2,
          top = p.position.wy - p.sprite.spriteHeight,
          bottom = p.position.wy;
        for (let cy = Math.floor(top / 256); cy <= Math.floor((bottom - 0.001) / 256); cy++)
          for (let cx = Math.floor(left / 256); cx <= Math.floor((right - 0.001) / 256); cx++)
            expect(
              g.placements(cx, cy, new Set()).placements.some((p) => p.featureId === id),
              `${id} missing in ${cx},${cy}`,
            ).toBe(true);
      }
    }
  });
  it("pins the promoted atlas revision", () =>
    expect(
      createHash("sha256")
        .update(readFileSync("public/assets/tilesets/me-complete.png"))
        .digest("hex"),
    ).toBe(DENSE_CITY_ASSETS.source.fingerprint));
});
