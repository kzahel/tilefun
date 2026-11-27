import { describe, expect, it } from "vitest";
import { PropManager } from "../../entities/PropManager.js";
import { Chunk } from "../../world/Chunk.js";
import { CURRENT_REGIONAL_VERSION } from "../GenerationDescriptor.js";
import { createGenerator } from "../Generator.js";
import { ProceduralProps } from "../ProceduralProps.js";
import type { DenseDistrictStrategy } from "./DenseDistrictStrategy.js";

const generation = {
  type: "regional",
  version: CURRENT_REGIONAL_VERSION,
  seed: 2026,
  preset: "temperate-v1",
} as const;

describe("district realization", () => {
  it("has order-independent chunk borders and stable placement IDs", () => {
    const gen = createGenerator(generation);
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
    const gen = createGenerator(generation);
    const source = (gen.terrain as DenseDistrictStrategy).districts;
    const plan = source.owner(0, 0);
    if (!plan) throw new Error("Missing review district");
    const lot = plan.blocks.flatMap((b) => b.lots)[0];
    if (!lot) throw new Error("Missing lot");
    const keys = plan.blocks.flatMap((b) =>
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
    state.reconcile(gen, [
      ...keys,
      `${Math.floor(moved.position.wx / 256)},${Math.floor(moved.position.wy / 256)}`,
    ]);
    expect(restored.props.some((p) => p.proceduralId === lot.id)).toBe(false);
    expect(restored.props.find((p) => p.proceduralId === moved.proceduralId)?.position.wx).toBe(
      moved.position.wx,
    );
  });
});
