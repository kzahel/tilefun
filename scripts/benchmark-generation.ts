import {
  createDescriptor,
  type GenerationDescriptor,
  resolveDescriptor,
} from "../src/generation/GenerationDescriptor.js";
import { createGenerator } from "../src/generation/Generator.js";
import { Chunk } from "../src/world/Chunk.js";

for (const version of [createDescriptor("regional", 2026).version]) {
  const descriptor = resolveDescriptor({
    ...createDescriptor("regional", 2026),
    version,
  } as GenerationDescriptor);
  const generator = createGenerator(descriptor);
  for (const [name, cx, cy] of [
    ["district", 18, 32],
    ["farm", 42, 82],
    ["woodland", -60, -60],
    ["negative-coast", -4, -9],
  ] as const) {
    const times: number[] = [];
    let props = 0,
      actors = 0,
      bytes = 0;
    for (let run = 0; run < 21; run++) {
      const start = performance.now(),
        chunk = new Chunk();
      generator.terrain.generate(chunk, cx, cy);
      props = generator.placements(cx, cy, new Set()).placements.length;
      actors = generator.actors?.(cx, cy).length ?? 0;
      times.push(performance.now() - start);
      bytes =
        chunk.subgrid.byteLength +
        chunk.roadGrid.byteLength +
        chunk.heightGrid.byteLength +
        chunk.terrain.byteLength +
        chunk.detail.byteLength +
        chunk.collision.byteLength +
        chunk.blendLayers.byteLength;
    }
    const cold = times.shift() ?? 0;
    times.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        descriptor,
        fixture: name,
        coldMs: +cold.toFixed(2),
        medianMs: +(times[10] ?? 0).toFixed(2),
        p95Ms: +(times[18] ?? 0).toFixed(2),
        props,
        actors,
        bytes,
      }),
    );
  }
}
