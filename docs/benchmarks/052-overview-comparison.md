# Overview dimension-cache comparison

[Interpretation and validation](../tactical/052-overview-draw-and-upload-profile.md). [Sanitized measurements](052-overview-comparison.json).

Fresh same-seed world/arrival per zoom, faster fill, actual noclip movement, 20 seconds except the labelled 60-second sprint, 3-second warm samples, 30-second catch-up gate.

Not a rerun of all 80 matrix cases. Thermal gates control entry only; rAF misses are not hardware presentation counters. Actor time/routes can differ. The matched uncached control disables only the cache branch at Vite transform time; it does not modify production files.

Phone is charging; all starts are at thermal status zero and <=31°C. End readings can rise; temperature/order effects remain. Host browser validation sometimes overlaps phone tests, never the retained Mac timings.

| Run | Zoom | Motion frame p95 ms | Render CPU p95 ms | Misses / samples | Travel px | Temperature °C / status before → after | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| before-mac-canvas-clean | 1 | 10.1 | 0.6 | 0 / 2400 | 2945 | — | pass |
| before-mac-canvas-clean | 0.1 | 50.6 | 47.7 | 450 / 450 | 2942 | — | pass |
| before-mac-gpu-clean | 1 | 9.9 | 0.7 | 0 / 2400 | 2945 | — | pass |
| before-mac-gpu-clean | 0.1 | 17.1 | 11.5 | 554 / 1845 | 2945 | — | pass |
| before-phone-canvas-30 | 1 | 16.7 | 3.0 | 3 / 1196 | 2945 | 29.5 / 0 → 29.7 / 0 | pass |
| before-phone-canvas-30 | 0.1 | 83.3 | 60.0 | 327 / 327 | 2937 | 29.7 / 0 → 29.8 / 0 | pass |
| before-phone-gpu-31 | 1 | 16.7 | 3.1 | 8 / 1191 | 2945 | 30.7 / 0 → 31.0 / 0 | pass |
| before-phone-gpu-31 | 0.1 | 33.4 | 14.0 | 123 / 1045 | 2942 | 31.0 / 0 → 31.0 / 1 | pass |
| after-mac-gpu-bitmap | 1 | 10.1 | 0.7 | 0 / 2400 | 2945 | — | pass |
| after-mac-gpu-bitmap | 0.1 | 16.8 | 10.5 | 328 / 2070 | 2945 | — | pass |
| after-phone-gpu | 1 | 16.7 | 3.1 | 8 / 1192 | 2945 | 30.9 / 0 → 30.7 / 0 | pass |
| after-phone-gpu | 0.1 | 33.3 | 11.3 | 114 / 1061 | 2942 | 30.7 / 0 → 30.6 / 0 | pass |
| after-phone-canvas | 1 | 16.7 | 3.0 | 4 / 1196 | 2945 | 30.6 / 0 → 30.6 / 0 | pass |
| after-phone-canvas | 0.1 | 83.3 | 61.5 | 315 / 315 | 2935 | 30.6 / 0 → 30.7 / 1 | pass |
| control-mac-gpu | 0.1 | 17.1 | 11.6 | 534 / 1864 | 2942 | — | pass |
| repeat-mac-gpu | 0.1 | 16.7 | 10.0 | 217 / 2183 | 2942 | — | pass |
| control-phone-gpu | 0.1 | 33.3 | 14.8 | 146 / 1021 | 2942 | 31.0 / 0 → 31.6 / 1 | pass |
| long-mac-gpu | 1 | 10.0 | 0.7 | 0 / 7200 | 8834 | — | pass |

18 completed zoom cases passed readiness/recovery and recorded no page errors. The additional cached Pixel overview repeat exceeded its 600-second cooldown deadline (peak 32.8°C, final 31.6°C). The planned one-minute Pixel sprint was canceled before measurement. Neither is counted as a passed run.

