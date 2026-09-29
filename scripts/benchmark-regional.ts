import {
  QUERY_LIMITS,
  queryRegion,
  type RegionalRequest,
} from "../src/generation/regional/RegionalPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

const world = regionalWorld(2026);
const fixtures: { name: string; request: RegionalRequest }[] = [
  {
    name: "initial-region",
    request: {
      bounds: { minX: -1024, minY: -512, maxX: 2048, maxY: 1536 },
      detail: "region",
      sampleStep: 16,
      limits: QUERY_LIMITS,
    },
  },
  {
    name: "negative-boundary",
    request: {
      bounds: { minX: -2048, minY: -1024, maxX: 0, maxY: 1024 },
      detail: "region",
      sampleStep: 16,
      limits: QUERY_LIMITS,
    },
  },
  {
    name: "million-tile-overview",
    request: {
      bounds: { minX: -500_000, minY: -500_000, maxX: 500_000, maxY: 500_000 },
      detail: "region",
      sampleStep: 4,
      limits: QUERY_LIMITS,
    },
  },
];
for (const { name, request } of fixtures) {
  const times: number[] = [];
  let stats: ReturnType<typeof queryRegion>["stats"] | undefined;
  for (let run = 0; run < 23; run++) {
    const start = performance.now();
    const result = queryRegion(world, request);
    if (run >= 3) times.push(performance.now() - start);
    stats = result.stats;
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      name,
      world,
      medianMs: Number(times[10]?.toFixed(2)),
      p95Ms: Number(times[18]?.toFixed(2)),
      stats,
    }),
  );
}
