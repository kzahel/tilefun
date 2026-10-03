import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { CommercialDistrictStrategy } from "../../art/studies/CommercialDistrictStrategy.js";
import { studyGenerator } from "../../art/studies/StudyGenerator.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../../entities/collision.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createProp } from "../../entities/PropFactories.js";
import { commercialSurfacePieces, isCommercialSurface } from "../../road/CommercialCitySurface.js";
import { Chunk } from "../../world/Chunk.js";
import { World } from "../../world/World.js";
import { resolveDescriptor } from "../GenerationDescriptor.js";
import { COMMERCIAL_CITY_ASSETS as bank, COMMERCIAL_STREET_PROPS } from "./CommercialCityAssets.js";
import { commercialDistrictSurfaceAt } from "./CommercialDistrictPlanner.js";
import { regionalWorld } from "./WorldDescriptor.js";

const generation = resolveDescriptor({
  type: "regional",
  version: "regional-v6",
  seed: 2026,
  preset: "temperate-v1",
});
const overlap = (a: { minX: number; maxX: number; minY: number; maxY: number }, b: typeof a) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
describe("promoted commercial streets", () => {
  it("preserves the promoted art bank", () => {
    const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
    expect(hash(readFileSync("src/generation/regional/commercial-city-assets-v1.json"))).toBe(
      "7c6a499b3954e67cdd99656b9c3b6b1525c6417cb8e4d5f812212d55512db2fa",
    );
  });
  it("pins original opaque source clips, approved identities and persistent cell IDs", () => {
    const bytes = readFileSync("public/assets/tilesets/me-complete.png"),
      image = PNG.sync.read(bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(bank.source.fingerprint);
    expect(bank.approvals).toHaveLength(10);
    expect(bank.roadStart).toBe(15);
    expect(bank.cells).toHaveLength(61);
    for (let id = 15; id < 76; id++) {
      expect(isCommercialSurface(id)).toBe(true);
      for (const p of commercialSurfacePieces(id, -2, 32)) {
        expect(p.x).toBeGreaterThanOrEqual(-32);
        expect(p.x + p.rect[2]).toBeLessThanOrEqual(-16);
        expect(p.y).toBeGreaterThanOrEqual(512);
        expect(p.y + p.rect[3]).toBeLessThanOrEqual(528);
        const [x, y, w, h] = p.rect;
        for (let py = y; py < y + h; py++)
          for (let px = x; px < x + w; px++)
            expect(image.data[(py * image.width + px) * 4 + 3]).toBe(255);
      }
    }
    for (const r of COMMERCIAL_STREET_PROPS) {
      const p = createProp(r.type, 0, 0);
      expect(p.collider).toEqual(r.collider);
      expect([
        p.sprite.frameCol * 16,
        p.sprite.frameRow * 16,
        p.sprite.spriteWidth,
        p.sprite.spriteHeight,
      ]).toEqual(r.rect);
    }
  });
  it("keeps parked cars inside bays and furniture out of doors, crossings and walking strips", () => {
    for (const seed of [2026, 42]) {
      const g = studyGenerator(new CommercialDistrictStrategy(regionalWorld(seed)));
      if (!(g.terrain instanceof CommercialDistrictStrategy)) throw Error("Wrong strategy");
      for (const [cx, cy] of [
        [0, 0],
        [-1, -1],
        [1, 1],
      ] as const) {
        const p = g.terrain.districts.owner(cx, cy);
        if (!p) continue;
        expect(p.commercial.parking.filter((b) => b.occupied)).toHaveLength(2);
        const colliders = p.commercial.furniture.map((f) => {
          const prop = createProp(f.propType, f.wx, f.wy),
            c = required(prop.collider);
          return {
            feature: f,
            bounds: {
              minX: (f.wx + c.offsetX - c.width / 2) / 16,
              maxX: (f.wx + c.offsetX + c.width / 2) / 16,
              minY: (f.wy + c.offsetY - c.height / 2) / 16,
              maxY: (f.wy + c.offsetY + c.height / 2) / 16,
            },
          };
        });
        for (const [index, { feature, bounds }] of colliders.entries()) {
          expect(
            colliders.slice(0, index).some((c) => overlap(bounds, c.bounds)),
            feature.featureId,
          ).toBe(false);
          expect(
            p.commercial.walkways.some((b) => overlap(bounds, b)),
            feature.featureId,
          ).toBe(false);
          expect(
            p.commercial.crossings.some((c) => overlap(bounds, c.bounds)),
            feature.featureId,
          ).toBe(false);
          expect(
            p.entrancePaths?.some((c) => overlap(bounds, c.bounds)),
            feature.featureId,
          ).toBe(false);
          if (feature.propType.includes("-car-"))
            expect(
              p.commercial.parking.some(
                (b) =>
                  bounds.minX >= b.bounds.minX &&
                  bounds.maxX <= b.bounds.maxX &&
                  bounds.minY >= b.bounds.minY &&
                  bounds.maxY <= b.bounds.maxY,
              ),
            ).toBe(true);
        }
        for (const path of p.entrancePaths ?? [])
          for (let y = Math.floor(path.threshold.y); y <= path.sidewalk.y; y++)
            expect(
              isCommercialSurface(commercialDistrictSurfaceAt(p, Math.floor(path.threshold.x), y)),
              path.doorId,
            ).toBe(true);
      }
    }
  });
  it("realizes deterministic seams and unique feature identities from the same shared plan", () => {
    const g = studyGenerator(new CommercialDistrictStrategy(regionalWorld(generation.seed)));
    if (!(g.terrain instanceof CommercialDistrictStrategy)) throw Error("Wrong strategy");
    const plan = required(g.terrain.districts.owner(0, 0)),
      features = new Map<string, string>();
    for (let cy = Math.floor(plan.bounds.minY / 16); cy <= Math.floor(plan.bounds.maxY / 16); cy++)
      for (
        let cx = Math.floor(plan.bounds.minX / 16);
        cx <= Math.floor(plan.bounds.maxX / 16);
        cx++
      ) {
        const a = new Chunk(),
          b = new Chunk();
        g.terrain.generate(a, cx, cy);
        g.terrain.generate(b, cx, cy);
        expect(a.roadGrid).toEqual(b.roadGrid);
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++)
            if (
              cx * 16 + x >= plan.bounds.minX &&
              cx * 16 + x < plan.bounds.maxX &&
              cy * 16 + y >= plan.bounds.minY &&
              cy * 16 + y < plan.bounds.maxY
            )
              expect(a.getRoad(x, y)).toBe(
                commercialDistrictSurfaceAt(plan, cx * 16 + x, cy * 16 + y),
              );
        for (const p of g.placements(cx, cy, new Set()).placements) {
          const id = required(p.featureId),
            key = JSON.stringify(p);
          if (features.has(id)) expect(features.get(id)).toBe(key);
          features.set(id, key);
        }
      }
    expect(features.size).toBe(21);
    for (const f of plan.commercial.furniture) expect(features.has(f.featureId)).toBe(true);
  });
  it("routes every walker past real colliders and across only the planned crossings", () => {
    for (const seed of [2026, 42]) {
      const g = studyGenerator(new CommercialDistrictStrategy(regionalWorld(seed)));
      if (!(g.terrain instanceof CommercialDistrictStrategy)) throw Error("Wrong strategy");
      const plan = required(
          g.terrain.districts.owner(0, 0) ??
            g.terrain.districts.owner(-1, -1) ??
            g.terrain.districts.owner(1, 1),
        ),
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
          for (const p of g.placements(cx, cy, new Set()).placements)
            props.set(required(p.featureId), createProp(p.propType, p.wx, p.wy));
      expect(plan.actors).toHaveLength(6);
      for (const a of plan.actors) {
        const entity = required(ENTITY_FACTORIES[a.type])(a.wx, a.wy);
        for (let i = 0; i < a.route.length; i++) {
          const p = required(a.route[i]),
            q = required(a.route[(i + 1) % a.route.length]),
            steps = Math.ceil(Math.hypot(q.wx - p.wx, q.wy - p.wy) / 4);
          for (let step = 0; step <= steps; step++) {
            entity.position.wx = p.wx + ((q.wx - p.wx) * step) / steps;
            entity.position.wy = p.wy + ((q.wy - p.wy) * step) / steps;
            const b = getEntityAABB(entity.position, required(entity.collider));
            expect(
              [...props.values()].some((p) => aabbOverlapsPropWalls(b, p.position, p, 0)),
              a.featureId,
            ).toBe(false);
            expect(
              world.getCollision(
                Math.floor(entity.position.wx / 16),
                Math.floor(entity.position.wy / 16),
              ),
              a.featureId,
            ).toBe(0);
          }
        }
      }
    }
  });
});
