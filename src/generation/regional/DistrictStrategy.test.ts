import { describe, expect, it } from "vitest";
import { aabbOverlapsPropWalls, getEntityAABB } from "../../entities/collision.js";
import { createPlayer } from "../../entities/Player.js";
import { createProp } from "../../entities/PropFactories.js";
import { PropManager } from "../../entities/PropManager.js";
import { Chunk } from "../../world/Chunk.js";
import { CURRENT_REGIONAL_VERSION } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { ProceduralProps } from "../ProceduralProps.js";
import type { DenseDistrictStrategy } from "./DenseDistrictStrategy.js";
import { DistrictSource, streetDistance } from "./DistrictStrategy.js";
import { regionalWorld } from "./WorldDescriptor.js";

const settledGeneration = {
  type: "regional",
  version: CURRENT_REGIONAL_VERSION,
  seed: 2026,
  preset: "temperate-v1",
} as const;

describe("district realization", () => {
  it("plans dry connected streets and accessible, nonoverlapping ground footprints across owners", () => {
    let cities = 0,
      villages = 0;
    for (const seed of [2026, 42, 81]) {
      const source = new DistrictSource(regionalWorld(seed));
      for (let cy = -3; cy <= 3; cy++)
        for (let cx = -3; cx <= 3; cx++) {
          const plan = source.owner(cx, cy);
          if (!plan) continue;
          const lots = plan.blocks.flatMap((b) => b.lots);
          if (lots[0]?.buildingType === "prop-country-house") villages++;
          else cities++;
          for (const street of plan.streets)
            expect(
              plan.streets.some(
                (other) =>
                  (other !== street &&
                    street.points.some((p) => streetDistance(other, p.x, p.y) < 0.01)) ||
                  (other !== street &&
                    other.points.some((p) => streetDistance(street, p.x, p.y) < 0.01)),
              ),
            ).toBe(true);
          const props = lots.map((l) =>
            createProp(l.buildingType, l.anchor.x * 16, l.anchor.y * 16),
          );
          for (const lot of lots) {
            const player = createPlayer(lot.entrance.x * 16, lot.entrance.y * 16);
            const collider = player.collider;
            if (!collider) throw new Error("Missing collider");
            expect(
              props.some((prop) =>
                aabbOverlapsPropWalls(
                  getEntityAABB(player.position, collider),
                  prop.position,
                  prop,
                ),
              ),
            ).toBe(false);
          }
          for (let i = 0; i < props.length; i++)
            for (let j = i + 1; j < props.length; j++) {
              const a = props[i],
                b = props[j];
              if (!a || !b) continue;
              for (const wall of a.walls ?? [])
                expect(aabbOverlapsPropWalls(getEntityAABB(a.position, wall), b.position, b)).toBe(
                  false,
                );
            }
        }
    }
    expect(cities).toBeGreaterThan(0);
    expect(villages).toBeGreaterThan(0);
  });
  it("has order-independent chunk borders and stable placement IDs", () => {
    const gen = createGenerator(settledGeneration);
    for (const [cx, cy] of [
      [18, 32],
      [-18, -32],
      [0, 0],
    ]) {
      const a = new Chunk(),
        b = new Chunk();
      gen.terrain.generate(b, (cx ?? 0) + 1, cy ?? 0);
      gen.terrain.generate(a, cx ?? 0, cy ?? 0);
      for (let i = 0; i < 33; i++) expect(a.getSubgrid(32, i)).toBe(b.getSubgrid(0, i));
      expect(
        gen.placements(cx ?? 0, cy ?? 0, new Set()).placements.every((p) => !!p.featureId),
      ).toBe(true);
    }
  });
  it("deduplicates, evicts, and restores deleted/moved procedural props without serializing the generated world", () => {
    const gen = createGenerator(settledGeneration);
    const source = (gen.terrain as DenseDistrictStrategy).districts;
    const plan = source.owner(0, 0);
    if (!plan) throw new Error("Missing review district");
    const lot = plan.blocks.flatMap((b) => b.lots)[0];
    if (!lot) throw new Error("Missing lot");
    const cx = Math.floor(lot.anchor.x / 16),
      cy = Math.floor(lot.anchor.y / 16),
      keys = plan.blocks.flatMap((b) =>
        b.lots.map((l) => `${Math.floor(l.anchor.x / 16)},${Math.floor(l.anchor.y / 16)}`),
      );
    const manager = new PropManager(),
      overlay = new ProceduralProps(manager, () => {});
    overlay.reconcile(gen, keys);
    overlay.reconcile(gen, keys);
    expect(new Set(manager.props.map((p) => p.proceduralId)).size).toBe(manager.props.length);
    const deleted = manager.props.find((p) => p.proceduralId === lot.id);
    if (!deleted) throw new Error("Missing realized lot");
    manager.remove(deleted.id);
    const moved = manager.props[0];
    if (!moved) throw new Error("Missing park or neighbor");
    manager.move(moved.id, lot.anchor.x * 16 + 320, lot.anchor.y * 16);
    overlay.reconcile(gen, []);
    expect(manager.props.length).toBe(0);
    const restored = new PropManager(),
      state = new ProceduralProps(restored, () => {});
    state.restore({
      playerX: 0,
      playerY: 0,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      entities: [],
      nextEntityId: 1,
      ...overlay.save(),
    });
    state.reconcile(gen, [...keys, `${cx + 20},${cy}`]);
    expect(restored.props.some((p) => p.proceduralId === lot.id)).toBe(false);
    expect(restored.props.find((p) => p.proceduralId === moved.proceduralId)?.position.wx).toBe(
      moved.position.wx,
    );
  });
});
