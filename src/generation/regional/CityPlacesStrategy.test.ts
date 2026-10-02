import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { required } from "../../art/ArtCatalog.js";
import { aabbOverlapsPropWalls, getEntityAABB } from "../../entities/collision.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createProp } from "../../entities/PropFactories.js";
import { Chunk } from "../../world/Chunk.js";
import { createGenerator } from "../Generator.js";
import { cityPlacesSurfaceAt } from "./CityPlacesPlanner.js";
import { CityPlacesStrategy } from "./CityPlacesStrategy.js";

const descriptor = {
  type: "regional",
  version: "regional-v7",
  seed: 2026,
  preset: "temperate-v1",
} as const;
it("realizes parking access, native bays and deterministic unique features across chunks", () => {
  for (const revision of ["regional-v7", "regional-v8"] as const)
    for (const seed of [2026, 42]) {
      const g = createGenerator({ ...descriptor, seed, version: revision });
      if (!(g.terrain instanceof CityPlacesStrategy)) throw Error("Wrong dispatch");
      for (const [cx, cy] of [
        [0, 0],
        [-1, -1],
      ] as const) {
        const plan = g.terrain.districts.owner(cx, cy);
        if (!plan) continue;
        const found = new Map<string, ReturnType<typeof createProp>>();
        for (let y = Math.floor(plan.bounds.minY / 16); y <= Math.floor(plan.bounds.maxY / 16); y++)
          for (
            let x = Math.floor(plan.bounds.minX / 16);
            x <= Math.floor(plan.bounds.maxX / 16);
            x++
          ) {
            const a = new Chunk(),
              b = new Chunk();
            g.terrain.generate(a, x, y);
            g.terrain.generate(b, x, y);
            expect(a.roadGrid).toEqual(b.roadGrid);
            for (const f of g.placements(x, y, new Set()).placements) {
              if (!f.featureId) throw Error("Missing identity");
              const prop = createProp(f.propType, f.wx, f.wy);
              if (found.has(f.featureId)) expect(prop).toEqual(found.get(f.featureId));
              found.set(f.featureId, prop);
            }
          }
        const lot = plan.places.find((p) => p.kind === "parking-lot");
        if (lot) {
          expect(lot.bays).toHaveLength(6);
          expect(
            [...found.keys()].filter((id) => id.includes(":bay:") && id.endsWith(":car")),
          ).toHaveLength(lot.bays.filter((b) => b.occupied).length);
        }
        for (const place of plan.places)
          for (const path of place.paths)
            for (let y = path.minY; y < path.maxY; y++)
              for (let x = path.minX; x < path.maxX; x++) {
                expect(cityPlacesSurfaceAt(plan, x, y)).toBeGreaterThan(0);
                const box = {
                  left: x * 16 + 3,
                  right: x * 16 + 13,
                  top: y * 16 + 3,
                  bottom: y * 16 + 13,
                };
                for (const p of found.values())
                  expect(
                    aabbOverlapsPropWalls(box, p.position, p),
                    `${p.type} blocks pedestrian access`,
                  ).toBe(false);
              }
        for (const actor of plan.actors) {
          const entity = required(ENTITY_FACTORIES[actor.type])(actor.wx, actor.wy);
          for (let i = 0; i < actor.route.length; i++) {
            const a = required(actor.route[i]),
              b = required(actor.route[(i + 1) % actor.route.length]);
            const steps = Math.ceil(Math.hypot(b.wx - a.wx, b.wy - a.wy) / 4);
            for (let n = 0; n <= steps; n++) {
              const pos = {
                wx: a.wx + ((b.wx - a.wx) * n) / steps,
                wy: a.wy + ((b.wy - a.wy) * n) / steps,
              };
              if (entity.collider)
                for (const p of found.values())
                  expect(
                    aabbOverlapsPropWalls(getEntityAABB(pos, entity.collider), p.position, p),
                    `${actor.featureId} blocked by ${p.type}`,
                  ).toBe(false);
            }
          }
        }
      }
    }
});
it("freezes the v7 owner-local plan independently of the approved v6", () => {
  const g = createGenerator(descriptor);
  if (!(g.terrain instanceof CityPlacesStrategy)) throw Error();
  expect(
    createHash("sha256")
      .update(JSON.stringify(g.terrain.districts.owner(0, 0)))
      .digest("hex"),
  ).toBe("bf76e197f45f653bec7711fd46ca1659101d19c490d4aa712279e94633f9da57");
});

it("freezes the v8 public-place plan", () => {
  const g = createGenerator({ ...descriptor, version: "regional-v8" });
  if (!(g.terrain instanceof CityPlacesStrategy)) throw Error();
  expect(
    createHash("sha256")
      .update(JSON.stringify(g.terrain.districts.owner(0, 0)))
      .digest("hex"),
  ).toBe("35c0dd381c1f13e10b09c21a0f514a4a82a8422b277dc02c1034ccab344f2f02");
});
