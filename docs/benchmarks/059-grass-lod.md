# Grass overview LOD comparison

[Implementation and validation](../tactical/059-grass-overview-lod.md). [Sanitized measurements](059-grass-lod.json).

Sequential Mac observations, not randomized trials. Each case starts a fresh same-seed world with real noclip sprint input, 20-second movement, 3-second warm windows and faster-fill terrain.

Mac uses headed bundled Chromium at 1280x900; retained timings exclude concurrent test/build suites. Normal-zoom after cases are controls, not a new before/after ordinary-play comparison.

Other surface-cutaway work was developed concurrently, outside this seeded outdoor fixture; source revision/dirty metadata is preserved.

Pixel movement was not measured because the fixed <=31 C / status zero entry gate timed out after 120 seconds at 32.6–32.7 C; GPU phone run was not attempted after the same blocker.

| Mac run | Zoom | Motion frame p95 ms | Render CPU p95 ms | Slow intervals / samples | Travel px | Readiness |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| canvas-before | 0.1 | 50.5 | 47.4 | 448 / 448 | 2937 | pass |
| gpu-before | 0.1 | 16.6 | 9.4 | 160 / 2240 | 2942 | pass |
| canvas-after | 0.1 | 9.2 | 1.6 | 0 / 2399 | 2945 | pass |
| canvas-after | 1 | 9.3 | 0.5 | 0 / 2399 | 2945 | pass |
| gpu-after | 0.1 | 9.1 | 1.6 | 0 / 2400 | 2945 | pass |
| gpu-after | 1 | 9.2 | 0.5 | 0 / 2400 | 2945 | pass |

Slow intervals are rAF deltas >1.5× the idle display cadence, not hardware presentation counts. See JSON for terrain gaps, catch-up stages and frame tails. No renderer/pacing defaults changed.
