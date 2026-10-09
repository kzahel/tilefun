import { expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { TerrainId } from "../../autotile/TerrainId.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../../entities/collision.js";
import { EntityManager } from "../../entities/EntityManager.js";
import { createProp } from "../../entities/PropFactories.js";
import { PropManager } from "../../entities/PropManager.js";
import { decodeActor, encodeActor } from "../../persistence/ActorRecords.js";
import { nearestRail } from "../../railway/RailPath.js";
import { RailwayPlanner } from "../../railway/RailwayPlanner.js";
import { RoadType } from "../../road/RoadType.js";
import { naturalLandscapeRecipe } from "../../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { createFauna, faunaProfile } from "../../wildlife/Fauna.js";
import { faunaHabitatAllows, updateFaunaAI } from "../../wildlife/faunaAI.js";
import { startleFauna } from "../../wildlife/faunaInteractions.js";
import { Chunk } from "../../world/Chunk.js";
import { createDescriptor } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { DenseDistrictSource, denseDistrict, denseSurfaceAt } from "./DenseDistrictPlanner.js";
import { FarmsteadSource } from "./FarmsteadPlanner.js";
import { NaturalLandscape } from "./NaturalLandscape.js";
import { pathDistance } from "./PlanGeometry.js";
import { settlementForOwner } from "./RegionalPlanner.js";
import { settlementGreenProps, settlementPets } from "./SettlementPets.js";
import { regionalWorld } from "./WorldDescriptor.js";

it.each([7, 42, 2026, 98123])(
  "admits connected dry farmsteads with clear homes for seed %s",
  (seed) => {
    const source = new FarmsteadSource(regionalWorld(seed));
    const farms = [];
    for (let cy = -5; cy <= 5; cy++)
      for (let cx = -5; cx <= 5; cx++)
        for (const axis of ["east", "south"] as const) {
          const f = source.owner(cx, cy, axis);
          if (f) farms.push(f);
        }
    expect(farms.length).toBeGreaterThan(0);
    expect(source.cacheSize).toBeLessThanOrEqual(64);
    const other = new FarmsteadSource(regionalWorld(seed));
    for (const f of farms) {
      const [, sx, sy, axis] = f.id.split(":");
      expect(other.owner(Number(sx), Number(sy), axis as "east" | "south")).toEqual(f);
    }
    for (const f of farms) {
      expect(f.props.some((p) => p.propType === "prop-country-house")).toBe(true);
      expect(f.actors).toHaveLength(6);
      const props = f.props.map((p) => createProp(p.propType, p.wx, p.wy));
      for (const a of f.actors) {
        const e = createFauna(required(faunaProfile(a.type)).species, a.wx, a.wy);
        e.fauna = structuredClone(required(a.fauna));
        expect(
          faunaHabitatAllows(e, e.position, { canOccupy: () => true, isWater: () => false }),
        ).toBe(true);
        expect(
          props.some((p) =>
            aabbOverlapsPropWalls(
              getEntityAABB(e.position, required(e.collider)),
              p.position,
              p,
              0,
            ),
          ),
        ).toBe(false);
      }
    }
  },
  15000,
);

it("realizes the whole lane and crop ground, with matching chunk-edge subgrids and clear natural cover", () => {
  const world = regionalWorld(2026),
    nature = new NaturalLandscape(world, "thicket");
  const f = required(nature.farms.owner(0, 0, "south"));
  const g = createGenerator(createDescriptor("regional", 2026));
  const chunks = new Map<string, Chunk>();
  const chunk = (x: number, y: number) => {
    const cx = Math.floor(x / 16),
      cy = Math.floor(y / 16),
      key = `${cx},${cy}`;
    let c = chunks.get(key);
    if (!c) {
      c = new Chunk();
      g.terrain.generate(c, cx, cy);
      chunks.set(key, c);
    }
    return { c, cx, cy };
  };
  for (const path of f.paths)
    for (let i = 1; i < path.length; i++) {
      const a = required(path[i - 1]),
        b = required(path[i]),
        steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
      for (let j = 0; j <= steps; j++) {
        const x = Math.round((a.x + ((b.x - a.x) * j) / steps) * 2) / 2,
          y = Math.round((a.y + ((b.y - a.y) * j) / steps) * 2) / 2;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const { c, cx, cy } = chunk(x, y);
        expect(c.getSubgrid((x - cx * 16) * 2, (y - cy * 16) * 2)).toBe(TerrainId.DirtLight);
        expect(nature.reserved(x, y, 1)).toBe(true);
        const playerBox = {
          left: x * 16 - 4,
          right: x * 16 + 4,
          top: y * 16 - 4,
          bottom: y * 16 + 4,
        };
        expect(
          f.props
            .map((p) => createProp(p.propType, p.wx, p.wy))
            .some((p) => aabbOverlapsPropWalls(playerBox, p.position, p, 0)),
        ).toBe(false);
        expect(
          nature.placements(cx, cy).some((p) => Math.hypot(p.wx / 16 - x, p.wy / 16 - y) < 3),
        ).toBe(false);
      }
    }
  const { x, y } = f.center;
  const west = chunk(x, y),
    east = chunk(west.cx * 16 + 16, y);
  for (let sy = 0; sy < 33; sy++) expect(west.c.getSubgrid(32, sy)).toBe(east.c.getSubgrid(0, sy));
  expect(pathDistance(required(f.paths[0]), f.center.x, f.center.y + 12)).toBe(0);
}, 15000);

it("assigns each farm animal once to its actual spawn chunk, independently of query order", () => {
  const f = required(new FarmsteadSource(regionalWorld(2026)).owner(0, 0, "south"));
  const g = createGenerator(createDescriptor("regional", 2026));
  const coords = [
    ...new Set(f.actors.map((a) => `${Math.floor(a.wx / 256)},${Math.floor(a.wy / 256)}`)),
  ];
  const scan = (keys: string[]) =>
    keys
      .flatMap((key) => {
        const [cx = 0, cy = 0] = key.split(",").map(Number);
        return g.actors?.(cx, cy).filter((a) => a.featureId.startsWith(f.id)) ?? [];
      })
      .sort((a, b) => a.featureId.localeCompare(b.featureId));
  const result = scan(coords);
  expect(result).toHaveLength(6);
  expect(scan(coords.reverse())).toEqual(result);
});

it.each([2026, 42])(
  "gives both villages and cities clear durable cats/dogs outside traffic for seed %s",
  (seed) => {
    const s = new DenseDistrictSource(regionalWorld(seed), true);
    let count = 0;
    for (let cy = -3; cy <= 3; cy++)
      for (let cx = -3; cx <= 3; cx++) {
        const p = s.owner(cx, cy);
        if (!p) continue;
        const pets = settlementPets(p, seed),
          props = settlementGreenProps(p).map((a) => createProp(a.propType, a.wx, a.wy));
        expect(pets).toHaveLength(p.blocks.filter((b) => b.kind === "park").length * 2);
        expect(settlementPets(p, seed)).toEqual(pets);
        count += pets.length;
        for (const a of pets) {
          const e = createFauna(a.type.includes("cat") ? "cat" : "dog", a.wx, a.wy);
          e.fauna = structuredClone(required(a.fauna));
          expect(
            props.some((p) =>
              aabbOverlapsPropWalls(
                getEntityAABB(e.position, required(e.collider)),
                p.position,
                p,
                0,
              ),
            ),
          ).toBe(false);
          const b = required(e.fauna?.habitatBounds);
          for (let y = b.minY; y <= b.maxY; y += 16)
            for (let x = b.minX; x <= b.maxX; x += 16)
              expect([RoadType.None, RoadType.CityPavement]).toContain(
                denseSurfaceAt(p, x / 16, y / 16),
              );
          const restored = decodeActor(encodeActor(e));
          expect("fauna" in restored && restored.fauna).toEqual(e.fauna);
        }
      }
    expect(count).toBeGreaterThan(4);
  },
);

it.each(["cat", "dog", "cow"] as const)(
  "safe %s home constrains routine and scared physical motion without bouncing",
  (species) => {
    const m = new EntityManager(),
      props = new PropManager(),
      e = m.spawn(createFauna(species, 80, 80));
    const ai = required(e.fauna);
    ai.habitatBounds = { minX: 0, minY: 0, maxX: 160, maxY: 160 };
    ai.timer = 0;
    const env = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
    for (let i = 0; i < 5400; i++) {
      if (i === 600) startleFauna(e, { wx: 48, wy: 80 });
      updateFaunaAI(e, 1 / 60, env, [e], []);
      m.update(
        1 / 60,
        () => 0,
        [],
        props,
        undefined,
        () => 0,
      );
      expect(faunaHabitatAllows(e, e.position, env)).toBe(true);
      const box = getEntityAABB(e.position, required(e.collider));
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(160);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(160);
      expect(e.jumpVZ ?? 0).toBe(0);
    }
    expect(faunaHabitatAllows(e, { wx: 158, wy: 80 }, env)).toBe(false);
  },
);

it.each(["farmstead", "village-pets", "city-pets"])(
  "production %s retains resident phases and durable deletion on reload",
  async (id) => {
    const session = await ScenarioSession.create(naturalLandscapeRecipe(id, "thicket"));
    try {
      expect([...session.realm.world.chunks.entries()].every(([, c]) => c.autotileComputed)).toBe(
        true,
      );
      const prefix = id === "farmstead" ? "farmstead:" : "settlement-pet:";
      const residents = session.realm.entityManager.entities.filter(
        (e) =>
          e.proceduralId?.startsWith(prefix) &&
          Math.hypot(
            e.position.wx - session.player.player.position.wx,
            e.position.wy - session.player.player.position.wy,
          ) < 800,
      );
      expect(residents.length).toBeGreaterThanOrEqual(id === "farmstead" ? 6 : 2);
      const removed = required(residents[0]),
        kept = required(residents[1]);
      session.realm.entityManager.remove(removed.id);
      for (let i = 0; i < 240; i++)
        await session.step({ dx: 0, dy: 0, jump: false, sprinting: false });
      const before = encodeActor(kept);
      await session.reload();
      expect([...session.realm.world.chunks.entries()].every(([, c]) => c.autotileComputed)).toBe(
        true,
      );
      expect(
        session.realm.entityManager.entities.some((e) => e.proceduralId === removed.proceduralId),
      ).toBe(false);
      const after = required(
        session.realm.entityManager.entities.find((e) => e.proceduralId === kept.proceduralId),
      );
      expect(after.position).toEqual({ wx: before.wx, wy: before.wy });
      expect(after.fauna).toEqual(before.state.fauna);
      if (id === "farmstead")
        expect(
          session.realm.propManager.props.some(
            (p) => p.proceduralId?.startsWith(prefix) && p.type === "prop-country-house",
          ),
        ).toBe(true);
    } finally {
      await session.close();
    }
  },
  15000,
);

it("keeps villages compact while seeded cities gain dense cores, edges and two safe greens", () => {
  const sizes = new Set<number>();
  for (const seed of [7, 42, 2026, 98123]) {
    const world = regionalWorld(seed),
      source = new DenseDistrictSource(world, true);
    for (let cy = -2; cy <= 2; cy++)
      for (let cx = -2; cx <= 2; cx++) {
        const settlement = settlementForOwner(world, cx, cy),
          plan = source.owner(cx, cy);
        if (!settlement || !plan) continue;
        const frozen = denseDistrict(settlement, seed);
        expect(frozen.blocks).toHaveLength(4);
        expect(new DenseDistrictSource(world, false).owner(cx, cy)).toEqual(frozen);
        expect(new DenseDistrictSource(world, true).owner(cx, cy)).toEqual(plan);
        expect(plan.bounds.minX).toBeGreaterThanOrEqual(settlement.bounds.minX);
        expect(plan.bounds.maxX).toBeLessThanOrEqual(settlement.bounds.maxX);
        expect(plan.bounds.minY).toBeGreaterThanOrEqual(settlement.bounds.minY);
        expect(plan.bounds.maxY).toBeLessThanOrEqual(settlement.bounds.maxY);
        if (settlement.kind === "village") {
          expect(plan.blocks).toHaveLength(4);
          continue;
        }
        sizes.add(plan.blocks.length);
        expect([16, 24]).toContain(plan.blocks.length);
        expect(plan.blocks.filter((b) => b.kind === "park")).toHaveLength(2);
        expect(settlementPets(plan, seed)).toHaveLength(4);
        const lots = plan.blocks.flatMap((b) => b.lots);
        expect(lots.length).toBeGreaterThanOrEqual(36);
        expect(lots.some((l) => l.buildingType.endsWith("condo-bay-5"))).toBe(true);
        expect(lots.some((l) => l.buildingType.endsWith("condo-bay-3"))).toBe(true);
        expect(plan.actors).toHaveLength(plan.blocks.length + 1);
        for (const block of plan.blocks.filter((b) => b.kind === "park"))
          expect(
            denseSurfaceAt(
              plan,
              Math.floor((block.bounds.minX + block.bounds.maxX) / 2),
              Math.floor((block.bounds.minY + block.bounds.maxY) / 2),
            ),
          ).toBe(RoadType.CityPavement);
      }
  }
  expect([...sizes].sort()).toEqual([16, 24]);
});

it("arrives at the current city center with the ordinary production recipe", () => {
  const recipe = naturalLandscapeRecipe("city-center", "thicket");
  const plan = required(new DenseDistrictSource(regionalWorld(2026), true).owner(0, 0));
  expect(recipe.player.position.wx).toBe(plan.center.x * 16);
  expect(recipe.player.position.wy).toBe(plan.center.y * 16);
  expect(plan.recipe).toBe("current-dense-district-v1");
});

it("keeps expanded city walls and walking routes clear of native rail and station reservations", () => {
  let inspected = 0;
  for (const seed of [7, 42, 2026, 98123]) {
    const world = regionalWorld(seed),
      source = new DenseDistrictSource(world, true),
      rails = new RailwayPlanner(world);
    for (let cy = -4; cy <= 4; cy++)
      for (let cx = -4; cx <= 4; cx++) {
        const p = source.owner(cx, cy);
        if (p?.recipe !== "current-dense-district-v1") continue;
        expect(p.bounds.maxY).toBe(p.center.y + 44);
        const lines = rails.query(p.bounds);
        for (const line of lines) {
          inspected++;
          for (const lot of p.blocks.flatMap((b) => b.lots)) {
            const prop = createProp(lot.buildingType, lot.anchor.x * 16, lot.anchor.y * 16);
            for (let y = lot.bounds.minY; y <= lot.bounds.maxY; y += 1)
              for (let x = lot.bounds.minX; x <= lot.bounds.maxX; x += 1) {
                const box = {
                  left: x * 16 - 1,
                  right: x * 16 + 1,
                  top: y * 16 - 1,
                  bottom: y * 16 + 1,
                };
                if (!aabbOverlapsPropWalls(box, prop.position, prop, 0)) continue;
                expect(
                  line.path
                    ? nearestRail(line.path, x * 16, y * 16).distance
                    : Math.abs(y - line.y) * 16,
                  lot.id,
                ).toBeGreaterThan(112);
                for (const station of line.stations)
                  expect(
                    x >= station.platform.minX &&
                      x < station.platform.maxX &&
                      y >= station.platform.minY &&
                      y < station.platform.maxY,
                    lot.id,
                  ).toBe(false);
              }
          }
        }
      }
  }
  expect(inspected).toBeGreaterThan(0);
}, 15000);
