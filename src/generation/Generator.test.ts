import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TerrainId, VariantId } from "../autotile/TerrainId.js";
import { Chunk } from "../world/Chunk.js";
import { chunkData, hydrateChunk } from "../world/ChunkData.js";
import { ChunkManager } from "../world/ChunkManager.js";
import fixtures from "./classic-fixtures.json" with { type: "json" };
import {
  createDescriptor,
  descriptorFromMetadata,
  descriptorKey,
  type GenerationDescriptor,
  type GeneratorChoice,
  resolveDescriptor,
  seedFromText,
} from "./GenerationDescriptor.js";
import { createGenerator } from "./Generator.js";

function hashChunk(chunk: Chunk): string {
  const hash = createHash("sha256");
  for (const field of [
    "subgrid",
    "terrain",
    "detail",
    "collision",
    "roadGrid",
    "heightGrid",
  ] as const)
    hash.update(new Uint8Array(chunk[field].buffer));
  return hash.digest("hex");
}
describe("frozen legacy generation", () => {
  for (const fixture of fixtures)
    it(`${fixture.type} seed ${fixture.seed} chunk ${fixture.cx},${fixture.cy}`, () => {
      const choice = fixture.type === "generated" ? "classic" : (fixture.type as GeneratorChoice);
      const generator = createGenerator(createDescriptor(choice, fixture.seed));
      const chunk = new Chunk();
      generator.terrain.generate(chunk, fixture.cx, fixture.cy);
      expect(hashChunk(chunk)).toBe(fixture.terrainHash);
      expect(
        createHash("sha256")
          .update(JSON.stringify(generator.placements(fixture.cx, fixture.cy, new Set())))
          .digest("hex"),
      ).toBe(fixture.placementHash);
    });
  it("hydrates transferred arrays without renderer state", () => {
    const chunk = new Chunk();
    createGenerator(createDescriptor("classic", 2026)).terrain.generate(chunk, -1, 2);
    const restored = hydrateChunk(structuredClone(chunkData(chunk)));
    expect(hashChunk(restored)).toBe(hashChunk(chunk));
    expect(restored).not.toHaveProperty("renderCache");
    expect(restored.autotileComputed).toBe(false);
  });
  it("resolves actual missing-field and legacy seed defaults", () => {
    expect(descriptorFromMetadata()).toEqual(createDescriptor("classic", 42));
    for (const seed of [-12.5, 4294967298])
      expect(descriptorFromMetadata({ seed }).seed).toBe(seed);
    expect(descriptorFromMetadata({ worldType: "island" })).toEqual(createDescriptor("island", 42));
    expect(descriptorFromMetadata({ roadParams: { density: 0 } })).toMatchObject({
      roads: { density: 0, spacing: 40 },
    });
  });
  it("restores edited variants through the shared terrain path", () => {
    const manager = new ChunkManager();
    const chunk = new Chunk();
    chunk.subgrid.fill(VariantId.ShallowWaterOnGrass);
    chunk.setSubgrid(1, 1, TerrainId.Grass);
    manager.setSavedData(
      new Map([["-1,2", { subgrid: chunk.subgrid, roadGrid: null, heightGrid: null }]]),
    );
    const restored = manager.getOrCreate(-1, 2);
    expect(restored.getTerrain(0, 0)).toBe(1);
    expect(restored.getCollision(1, 1)).toBe(2);
    expect(restored.getDetail(1, 1)).toBe(0);
  });
});
describe("generation identity", () => {
  it("pins versions and rejects unsupported external values", () => {
    const regional = createDescriptor("regional", 2026);
    expect(regional.version).toBe("regional-v4");
    expect(Object.isFrozen(regional)).toBe(true);
    expect(() =>
      resolveDescriptor({ ...regional, version: "future" } as unknown as GenerationDescriptor),
    ).toThrow(/Unsupported/);
    expect(() => descriptorFromMetadata({ worldType: "future" })).toThrow();
    expect(() => createDescriptor("classic", 42, { spacing: 0 } as never)).toThrow();
    expect(descriptorKey(regional)).toBe(descriptorKey(JSON.parse(JSON.stringify(regional))));
  });
  it("uses one deterministic text seed parser", () => {
    expect(seedFromText(" 2026 ")).toBe(2026);
    expect(seedFromText("woodland")).toBe(4238162456);
    expect(() => seedFromText("4294967296")).toThrow();
  });
});

it("keeps terrain-only Regional v1 frozen after adding districts", () => {
  for (const [seed, cx, cy, hash] of [
    [2026, 18, 32, "f995683a204d69ec394c4b7c74f4ac8d2e407e0772c08401d123ff03045b3264"],
    [42, -10, -10, "b374cb44f26dad7a00cc188dd0b0ad2f8026f9233cbdab459c4b830e0f1474bf"],
  ] as const) {
    const chunk = new Chunk();
    const generator = createGenerator({
      type: "regional",
      version: "regional-v1",
      seed,
      preset: "temperate-v1",
    });
    generator.terrain.generate(chunk, cx, cy);
    expect(hashChunk(chunk)).toBe(hash);
    expect(generator.placements(cx, cy, new Set()).placements).toEqual([]);
  }
});
