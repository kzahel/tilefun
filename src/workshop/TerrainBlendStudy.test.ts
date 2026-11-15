import { expect, it } from "vitest";
import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { TerrainId, VariantId } from "../autotile/TerrainId.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { Chunk } from "../world/Chunk.js";
import { inspectStudyTile, studySample, terrainStudy } from "./TerrainBlendStudy.js";

it("uses actual regional pond samples, including a negative-coordinate chunk seam", () => {
  const study = terrainStudy("pond");
  const generator = createGenerator(createDescriptor("regional", 2026));
  const chunk = new Chunk();
  generator.terrain.generate(chunk, 14, -13);
  for (let sy = 0; sy <= 32; sy++)
    for (let sx = 0; sx <= 32; sx++)
      expect(studySample(study, 14 * 32 + sx, -13 * 32 + sy)).toBe(chunk.getSubgrid(sx, sy));
  expect(studySample(study, 227 * 2 + 1, -196 * 2 + 1)).toBe(TerrainId.DeepWater);
});

it("inspector layer order and base match the production chunk's packed output", () => {
  for (const study of [
    terrainStudy("pond"),
    terrainStudy("diagonal", VariantId.ShallowWaterOnGrass),
  ]) {
    for (let y = study.y; y < study.y + study.size; y++)
      for (let x = study.x; x < study.x + study.size; x++) {
        const cx = Math.floor(x / 16),
          cy = Math.floor(y / 16);
        const chunk = study.world.getChunk(cx, cy);
        const tile = (y - cy * 16) * 16 + x - cx * 16;
        const inspected = inspectStudyTile(study, x, y);
        expect(inspected.base).toBe(chunk.blendBase[tile]);
        const packed = Array.from(
          chunk.blendLayers.slice(tile * MAX_BLEND_LAYERS, (tile + 1) * MAX_BLEND_LAYERS),
        ).filter(Boolean);
        expect(inspected.layers.map((l) => (l.sheetIndex << 16) | (l.col << 8) | l.row)).toEqual(
          packed,
        );
      }
  }
});

it("editor demonstration exposes bridge-inserted materials rather than drawing pretend bands", () => {
  const raw = terrainStudy("paint", TerrainId.DeepWater, TerrainId.DirtWarm, 0);
  const bridged = terrainStudy("paint", TerrainId.DeepWater, TerrainId.DirtWarm, 2);
  const materials = (study: typeof raw) =>
    new Set(
      Array.from({ length: 48 * 48 }, (_, i) => studySample(study, i % 48, Math.floor(i / 48))),
    );
  expect(materials(raw)).toEqual(new Set([TerrainId.DeepWater, TerrainId.DirtWarm]));
  expect(materials(bridged).has(TerrainId.ShallowWater)).toBe(true);
  expect(materials(bridged).has(TerrainId.Grass)).toBe(true);
});
