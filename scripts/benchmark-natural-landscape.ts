import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { createGenerator } from "../src/generation/Generator.js";
import { overviewSteps } from "../src/generation/Overview.js";
import { LANDSCAPE_PROFILES } from "../src/generation/regional/NaturalLandscape.js";
import { QUERY_LIMITS } from "../src/generation/regional/RegionalPlanner.js";
import { NATURAL_CASES } from "../src/scenarios/NaturalLandscapeRecipe.js";
import { Chunk } from "../src/world/Chunk.js";

for (const c of NATURAL_CASES)
  for (const profile of [undefined, ...LANDSCAPE_PROFILES]) {
    const g = createGenerator(createDescriptor("regional", c.seed), profile);
    const times: number[] = [];
    const ids = new Set<string>();
    const trees = new Set<string>(),
      thicketRows = new Set<string>();
    for (let cy = Math.floor(c.y / 16) - 3; cy <= Math.floor(c.y / 16) + 3; cy++)
      for (let cx = Math.floor(c.x / 16) - 3; cx <= Math.floor(c.x / 16) + 3; cx++) {
        const begin = performance.now();
        g.terrain.generate(new Chunk(), cx, cy);
        for (const p of g.placements(cx, cy, new Set()).placements)
          if (p.featureId) {
            ids.add(p.featureId);
            if (p.propType === "prop-oak-tree") trees.add(p.featureId);
            if (p.propType.startsWith("pattern:forest-thicket-v1:")) thicketRows.add(p.featureId);
          }
        times.push(performance.now() - begin);
      }
    times.sort((a, b) => a - b);
    const begin = performance.now();
    const q = overviewSteps(
      g.descriptor,
      {
        bounds: { minX: c.x - 512, minY: c.y - 384, maxX: c.x + 512, maxY: c.y + 384 },
        detail: "region",
        sampleStep: 8,
        limits: QUERY_LIMITS,
      },
      profile,
    );
    let result = q.next();
    while (!result.done) result = q.next();
    console.log(
      JSON.stringify({
        case: c.id,
        profile: profile ?? "current",
        chunks: 49,
        props: ids.size,
        trees: trees.size,
        thicketRows: thicketRows.size,
        p50Ms: times[24],
        p95Ms: times[46],
        maxMs: times[48],
        overviewMs: performance.now() - begin,
        ponds: result.value.ponds?.length ?? 0,
      }),
    );
  }
