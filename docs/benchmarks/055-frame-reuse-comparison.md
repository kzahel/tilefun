# Overview frame reuse comparison

[Interpretation and validation](../tactical/055-overview-frame-reuse.md). [Sanitized measurements](055-frame-reuse-comparison.json).

Fresh same-seed world/arrival per zoom; faster fill, real noclip sprint input, 20-second movement except the labelled 60-second Pixel sprint, 3-second warm samples and 30-second catch-up gates. Mac uses headed bundled full Chromium at 1280×900; Pixel uses physical Chrome and touch at its native viewport. Both GPU changes use the existing dimension cache. Canvas changes only through the shared grass pool.

`before` is the original 8,192-record pool/six-vertex quads; `pool` changes only grass retention; `after` and `repeat` include both changes. These are sequential observations, not randomized trials. Actor timing/routes may differ. Profiling is separate; retained Mac timings exclude concurrent tests/builds. Host checks sometimes overlap phone serving.

Phone remains charging. Each entry requires <=31°C and thermal status zero; before/after readings are shown. These are controlled entry conditions, not constant temperature. Slow intervals are rAF deltas >1.5× idle display cadence, not hardware presentation counters. A p95 jump across the slow-frame threshold does not mean every frame doubled in speed. Dynamic vertex bytes exclude initial/index-buffer uploads and are requested bytes, not measured bus traffic.

| Run | Zoom | Motion frame p95 ms | Render CPU p95 ms | Slow intervals / samples | Dynamic vertex MiB/frame | Travel px | Temperature °C / status before → after | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| gpu-before | 1 | 10.0 | 0.8 | 0 / 2400 | 0.039 | 2945 | — | pass |
| gpu-before | 0.1 | 16.7 | 10.1 | 274 / 2125 | 5.780 | 2945 | — | pass |
| canvas-before | 1 | 10.2 | 0.6 | 0 / 2400 | — | 2945 | — | pass |
| canvas-before | 0.1 | 50.4 | 46.1 | 461 / 461 | — | 2942 | — | pass |
| pixel-before | 0.1 | 33.4 | 10.4 | 104 / 1068 | 1.643 | 2945 | 28.5 / 0 → 28.5 / 0 | pass |
| gpu-pool | 0.1 | 10.4 | 9.4 | 111 / 2288 | 5.780 | 2945 | — | pass |
| pixel-after | 0.1 | 16.8 | 9.9 | 53 / 1122 | 1.083 | 2945 | 28.8 / 0 → 29.1 / 0 | pass |
| pixel-after | 1 | 16.8 | 3.2 | 8 / 1192 | 0.008 | 2945 | 29.2 / 0 → 29.3 / 0 | pass |
| pixel-sprint | 1 | 16.7 | 3.0 | 18 / 3583 | 0.008 | 8834 | 29.4 / 0 → 29.8 / 0 | pass |
| pixel-repeat | 0.1 | 33.3 | 9.9 | 66 / 1112 | 1.084 | 2945 | 30.3 / 0 → 30.5 / 0 | pass |
| gpu-after | 1 | 9.1 | 0.6 | 0 / 2400 | 0.026 | 2945 | — | pass |
| gpu-after | 0.1 | 9.3 | 8.5 | 25 / 2374 | 3.854 | 2945 | — | pass |
| canvas-after | 1 | 9.3 | 1.0 | 0 / 2400 | — | 2945 | — | pass |
| canvas-after | 0.1 | 50.1 | 46.4 | 456 / 456 | — | 2940 | — | pass |
| gpu-repeat | 0.1 | 9.3 | 8.5 | 27 / 2372 | 3.854 | 2942 | — | pass |

15 zoom cases are recorded. See JSON for entry/recovery stages, transient gaps, draw calls and frame tails; motion timing alone is not the readiness gate. This focused comparison does not rerun the 80-case matrix or compare phone Canvas anew. The Pixel one-minute traversal completes the outstanding long-run check on the newer renderer; it does not retroactively fill the unmeasured cache-only 052 case.
