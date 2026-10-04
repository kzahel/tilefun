# Renderer performance matrix

[Interpretation, validation and limits](../tactical/049-renderer-performance-matrix.md). Phone warmed from 26.6°C/status 0 to 35.9°C/status 1; later runs are warmed-device samples. No cooling interval was used.

Sanitized JSON: [Mac](049-renderer-matrix-desktop.json), [Pixel](049-renderer-matrix-phone.json). Files are split by device to keep each artifact below the repository formatter size limit; the original runner emits a single matrix.

Source fingerprint: `02119d3b309c8fd85bc3382cd4f8955a506d49ef0e57da8615d19eba1e02f01f`. 16/16 configurations recorded.

Sequential real-game runs; each zoom starts in a fresh seeded world. Motion uses noclip and a fixed wall duration. Misses are rAF intervals >1.5× the idle-page display cadence, not hardware presentation counts. Compare within device and zoom. Every repeat is shown separately; percentiles are not averaged. A failed row remains evidence, not a passed result.

| Device | Renderer | Pacing | Repeat | Zoom | Motion p95 / p99 ms | Misses / samples | Data-gap / terrain-gap frames | Travel px | Entry / recovery s | Result |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| desktop | canvas | throughput | 1 | 1 | 10.0 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 0.9 / 0.5 | pass |
| desktop | canvas | throughput | 1 | 0.5 | 9.7 / 10.2 | 0 / 960 | 0 / 0 | 1178 | 1.0 / 0.5 | pass |
| desktop | canvas | throughput | 1 | 0.25 | 10.1 / 10.4 | 0 / 959 | 0 / 0 | 1178 | 1.6 / 0.5 | pass |
| desktop | canvas | throughput | 1 | 0.1 | 51.1 / 58.3 | 173 / 173 | 0 / 0 | 1175 | 5.4 / 2.6 | pass |
| desktop | canvas | throughput | 1 | 2 | 9.8 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 0.9 / 0.5 | pass |
| desktop | gpu | throughput | 1 | 1 | 9.8 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 1.0 / 0.5 | pass |
| desktop | gpu | throughput | 1 | 0.5 | 10.1 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 1.1 / 0.5 | pass |
| desktop | gpu | throughput | 1 | 0.25 | 9.9 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 1.5 / 0.5 | pass |
| desktop | gpu | throughput | 1 | 0.1 | 17.1 / 18.5 | 263 / 695 | 0 / 0 | 1175 | 3.3 / 0.7 | pass |
| desktop | gpu | throughput | 1 | 2 | 9.9 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 0.9 / 0.5 | pass |
| desktop | canvas | responsive | 1 | 1 | 10.0 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 2.4 / 0.5 | pass |
| desktop | canvas | responsive | 1 | 0.5 | 10.1 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 2.7 / 0.5 | pass |
| desktop | canvas | responsive | 1 | 0.25 | 10.2 / 10.3 | 0 / 959 | 0 / 0 | 1175 | 5.4 / 0.8 | pass |
| desktop | canvas | responsive | 1 | 0.1 | 50.4 / 51.2 | 182 / 182 | 0 / 183 | 1170 | 30.0 (timeout) / 30.0 (timeout) | FAIL |
| desktop | canvas | responsive | 1 | 2 | 10.1 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 1.5 / 0.5 | pass |
| desktop | gpu | responsive | 1 | 1 | 10.2 / 10.4 | 0 / 960 | 0 / 0 | 1175 | 2.5 / 0.5 | pass |
| desktop | gpu | responsive | 1 | 0.5 | 10.2 / 10.4 | 0 / 960 | 0 / 0 | 1178 | 2.8 / 0.5 | pass |
| desktop | gpu | responsive | 1 | 0.25 | 10.2 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 5.5 / 0.7 | pass |
| desktop | gpu | responsive | 1 | 0.1 | 17.1 / 18.4 | 263 / 696 | 0 / 236 | 1180 | 27.5 / 3.5 | pass |
| desktop | gpu | responsive | 1 | 2 | 10.2 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 1.5 / 0.5 | pass |
| phone | canvas | throughput | 1 | 1 | 16.8 / 17.8 | 3 / 476 | 0 / 0 | 1178 | 1.9 / 1.0 | pass |
| phone | canvas | throughput | 1 | 0.5 | 16.8 / 33.3 | 6 / 474 | 0 / 0 | 1178 | 2.2 / 1.0 | pass |
| phone | canvas | throughput | 1 | 0.25 | 16.8 / 33.4 | 19 / 461 | 0 / 0 | 1178 | 4.1 / 1.3 | pass |
| phone | canvas | throughput | 1 | 0.1 | 66.7 / 66.9 | 154 / 154 | 0 / 0 | 1168 | 11.6 / 5.4 | pass |
| phone | canvas | throughput | 1 | 2 | 16.8 / 16.8 | 0 / 479 | 0 / 0 | 1173 | 1.7 / 1.1 | pass |
| phone | gpu | throughput | 1 | 1 | 16.8 / 33.2 | 7 / 473 | 0 / 0 | 1175 | 2.0 / 1.1 | pass |
| phone | gpu | throughput | 1 | 0.5 | 16.8 / 33.3 | 10 / 470 | 0 / 0 | 1178 | 2.5 / 1.0 | pass |
| phone | gpu | throughput | 1 | 0.25 | 16.8 / 33.3 | 8 / 472 | 0 / 0 | 1178 | 3.6 / 1.4 | pass |
| phone | gpu | throughput | 1 | 0.1 | 33.4 / 50.0 | 86 / 378 | 0 / 0 | 1178 | 7.6 / 1.8 | pass |
| phone | gpu | throughput | 1 | 2 | 16.8 / 33.3 | 6 / 474 | 0 / 0 | 1178 | 1.6 / 1.1 | pass |
| phone | canvas | responsive | 1 | 1 | 16.8 / 16.8 | 0 / 479 | 0 / 0 | 1175 | 3.4 / 1.8 | pass |
| phone | canvas | responsive | 1 | 0.5 | 16.7 / 16.8 | 0 / 480 | 0 / 0 | 1178 | 3.8 / 1.0 | pass |
| phone | canvas | responsive | 1 | 0.25 | 33.3 / 33.4 | 30 / 450 | 0 / 0 | 1178 | 7.3 / 2.0 | pass |
| phone | canvas | responsive | 1 | 0.1 | 66.8 / 83.4 | 135 / 135 | 0 / 114 | 1168 | 30.0 (timeout) / 29.9 (timeout) | FAIL |
| phone | canvas | responsive | 1 | 2 | 16.8 / 16.8 | 2 / 477 | 0 / 0 | 1178 | 2.3 / 1.3 | pass |
| phone | gpu | responsive | 1 | 1 | 16.8 / 16.8 | 1 / 479 | 0 / 0 | 1178 | 3.3 / 1.7 | pass |
| phone | gpu | responsive | 1 | 0.5 | 16.7 / 16.8 | 4 / 476 | 0 / 0 | 1178 | 3.8 / 1.0 | pass |
| phone | gpu | responsive | 1 | 0.25 | 16.8 / 16.8 | 3 / 477 | 0 / 0 | 1178 | 5.9 / 2.1 | pass |
| phone | gpu | responsive | 1 | 0.1 | 33.4 / 49.9 | 102 / 372 | 0 / 165 | 1175 | 19.7 / 8.4 | pass |
| phone | gpu | responsive | 1 | 2 | 16.7 / 16.8 | 0 / 480 | 0 / 0 | 1178 | 2.4 / 1.3 | pass |
| phone | gpu | responsive | 2 | 1 | 16.7 / 16.8 | 2 / 478 | 0 / 0 | 1178 | 3.3 / 1.7 | pass |
| phone | gpu | responsive | 2 | 0.5 | 16.8 / 16.8 | 1 / 477 | 0 / 0 | 1178 | 3.9 / 1.0 | pass |
| phone | gpu | responsive | 2 | 0.25 | 16.7 / 16.8 | 3 / 477 | 0 / 0 | 1178 | 5.9 / 2.1 | pass |
| phone | gpu | responsive | 2 | 0.1 | 33.4 / 33.4 | 111 / 366 | 0 / 182 | 1180 | 19.5 / 9.2 | pass |
| phone | gpu | responsive | 2 | 2 | 16.7 / 16.8 | 1 / 479 | 0 / 0 | 1178 | 2.3 / 1.3 | pass |
| phone | canvas | responsive | 2 | 1 | 16.7 / 16.8 | 0 / 480 | 0 / 0 | 1178 | 3.4 / 1.8 | pass |
| phone | canvas | responsive | 2 | 0.5 | 16.7 / 16.8 | 1 / 479 | 0 / 0 | 1178 | 3.8 / 1.0 | pass |
| phone | canvas | responsive | 2 | 0.25 | 33.3 / 33.4 | 37 / 443 | 0 / 0 | 1175 | 7.6 / 2.1 | pass |
| phone | canvas | responsive | 2 | 0.1 | 100.0 / 116.7 | 102 / 102 | 0 / 103 | 1166 | 30.0 (timeout) / 30.0 (timeout) | FAIL |
| phone | canvas | responsive | 2 | 2 | 16.7 / 16.8 | 0 / 480 | 0 / 0 | 1178 | 2.6 / 1.4 | pass |
| phone | gpu | throughput | 2 | 1 | 16.7 / 33.3 | 8 / 471 | 0 / 0 | 1180 | 2.1 / 1.1 | pass |
| phone | gpu | throughput | 2 | 0.5 | 16.7 / 33.3 | 13 / 466 | 0 / 0 | 1178 | 2.3 / 1.1 | pass |
| phone | gpu | throughput | 2 | 0.25 | 16.8 / 33.4 | 11 / 465 | 0 / 0 | 1178 | 3.6 / 1.3 | pass |
| phone | gpu | throughput | 2 | 0.1 | 33.5 / 66.5 | 109 / 353 | 0 / 0 | 1175 | 7.8 / 2.0 | pass |
| phone | gpu | throughput | 2 | 2 | 16.7 / 33.3 | 6 / 474 | 0 / 0 | 1178 | 1.9 / 1.1 | pass |
| phone | canvas | throughput | 2 | 1 | 16.7 / 16.8 | 3 / 476 | 0 / 0 | 1178 | 2.0 / 1.0 | pass |
| phone | canvas | throughput | 2 | 0.5 | 16.7 / 33.2 | 5 / 475 | 0 / 0 | 1178 | 2.2 / 1.0 | pass |
| phone | canvas | throughput | 2 | 0.25 | 33.3 / 33.4 | 32 / 446 | 0 / 0 | 1178 | 4.4 / 1.2 | pass |
| phone | canvas | throughput | 2 | 0.1 | 99.9 / 100.0 | 106 / 106 | 0 / 0 | 1166 | 18.7 / 10.5 | pass |
| phone | canvas | throughput | 2 | 2 | 16.7 / 16.8 | 3 / 477 | 0 / 0 | 1178 | 1.9 / 1.1 | pass |
| desktop | gpu | responsive | 2 | 1 | 10.2 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 2.5 / 0.5 | pass |
| desktop | gpu | responsive | 2 | 0.5 | 10.2 / 10.4 | 0 / 960 | 0 / 0 | 1178 | 2.7 / 0.5 | pass |
| desktop | gpu | responsive | 2 | 0.25 | 10.2 / 10.4 | 0 / 960 | 0 / 0 | 1180 | 5.4 / 0.7 | pass |
| desktop | gpu | responsive | 2 | 0.1 | 17.2 / 18.0 | 246 / 713 | 0 / 225 | 1178 | 27.2 / 3.4 | pass |
| desktop | gpu | responsive | 2 | 2 | 10.0 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 1.5 / 0.5 | pass |
| desktop | canvas | responsive | 2 | 1 | 10.3 / 10.4 | 0 / 960 | 0 / 0 | 1178 | 2.5 / 0.5 | pass |
| desktop | canvas | responsive | 2 | 0.5 | 10.2 / 10.4 | 0 / 960 | 0 / 0 | 1178 | 2.8 / 0.5 | pass |
| desktop | canvas | responsive | 2 | 0.25 | 10.1 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 5.5 / 0.7 | pass |
| desktop | canvas | responsive | 2 | 0.1 | 50.7 / 58.3 | 180 / 180 | 0 / 181 | 1175 | 30.0 (timeout) / 30.0 (timeout) | FAIL |
| desktop | canvas | responsive | 2 | 2 | 10.1 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 1.5 / 0.5 | pass |
| desktop | gpu | throughput | 2 | 1 | 10.1 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 1.0 / 0.5 | pass |
| desktop | gpu | throughput | 2 | 0.5 | 9.9 / 10.3 | 0 / 959 | 0 / 0 | 1175 | 1.1 / 0.5 | pass |
| desktop | gpu | throughput | 2 | 0.25 | 10.0 / 10.3 | 0 / 960 | 0 / 0 | 1175 | 1.6 / 0.5 | pass |
| desktop | gpu | throughput | 2 | 0.1 | 17.1 / 18.4 | 232 / 726 | 0 / 0 | 1178 | 3.3 / 0.6 | pass |
| desktop | gpu | throughput | 2 | 2 | 10.1 / 10.4 | 0 / 960 | 0 / 0 | 1178 | 0.9 / 0.5 | pass |
| desktop | canvas | throughput | 2 | 1 | 10.0 / 10.3 | 0 / 960 | 0 / 0 | 1180 | 1.0 / 0.5 | pass |
| desktop | canvas | throughput | 2 | 0.5 | 10.0 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 1.1 / 0.5 | pass |
| desktop | canvas | throughput | 2 | 0.25 | 10.0 / 10.3 | 0 / 959 | 0 / 0 | 1178 | 1.5 / 0.5 | pass |
| desktop | canvas | throughput | 2 | 0.1 | 50.4 / 51.0 | 181 / 181 | 0 / 0 | 1178 | 5.3 / 2.5 | pass |
| desktop | canvas | throughput | 2 | 2 | 10.1 / 10.3 | 0 / 960 | 0 / 0 | 1178 | 0.9 / 0.5 | pass |

## Stationary cost and recovery reuse

| Device | Renderer | Pacing | Repeat | Zoom | Stationary render p95 ms | Recovery render p95 ms | Recovery raster rows | Recovery texture MiB |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | canvas | throughput | 1 | 1 | 0.4 | 0.3 | 0 | — |
| desktop | canvas | throughput | 1 | 0.5 | 1.3 | 0.9 | 0 | — |
| desktop | canvas | throughput | 1 | 0.25 | 3.9 | 6.8 | 0 | — |
| desktop | canvas | throughput | 1 | 0.1 | 50.3 | 47.1 | 0 | — |
| desktop | canvas | throughput | 1 | 2 | 0.2 | 0.2 | 0 | — |
| desktop | gpu | throughput | 1 | 1 | 0.4 | 0.3 | 0 | 0.00 |
| desktop | gpu | throughput | 1 | 0.5 | 0.6 | 0.7 | 0 | 0.66 |
| desktop | gpu | throughput | 1 | 0.25 | 1.5 | 1.9 | 0 | 0.00 |
| desktop | gpu | throughput | 1 | 0.1 | 12.3 | 11.9 | 0 | 0.00 |
| desktop | gpu | throughput | 1 | 2 | 0.5 | 0.2 | 0 | 0.00 |
| desktop | canvas | responsive | 1 | 1 | 0.6 | 0.4 | 0 | — |
| desktop | canvas | responsive | 1 | 0.5 | 1.5 | 0.9 | 0 | — |
| desktop | canvas | responsive | 1 | 0.25 | 3.8 | 6.4 | 0 | — |
| desktop | canvas | responsive | 1 | 0.1 | 46.8 | 45.7 | 92 | — |
| desktop | canvas | responsive | 1 | 2 | 0.2 | 0.4 | 0 | — |
| desktop | gpu | responsive | 1 | 1 | 0.4 | 0.3 | 0 | 0.00 |
| desktop | gpu | responsive | 1 | 0.5 | 1.0 | 0.9 | 0 | 0.00 |
| desktop | gpu | responsive | 1 | 0.25 | 2.1 | 2.2 | 0 | 0.00 |
| desktop | gpu | responsive | 1 | 0.1 | 12.2 | 12.0 | 0 | 0.00 |
| desktop | gpu | responsive | 1 | 2 | 0.3 | 0.5 | 0 | 0.00 |
| phone | canvas | throughput | 1 | 1 | 1.1 | 1.1 | 0 | — |
| phone | canvas | throughput | 1 | 0.5 | 3.6 | 3.2 | 0 | — |
| phone | canvas | throughput | 1 | 0.25 | 9.2 | 5.9 | 0 | — |
| phone | canvas | throughput | 1 | 0.1 | 31.9 | 58.1 | 0 | — |
| phone | canvas | throughput | 1 | 2 | 1.0 | 0.8 | 0 | — |
| phone | gpu | throughput | 1 | 1 | 1.4 | 1.6 | 0 | 0.00 |
| phone | gpu | throughput | 1 | 0.5 | 2.5 | 1.7 | 0 | 0.00 |
| phone | gpu | throughput | 1 | 0.25 | 3.8 | 4.0 | 0 | 0.00 |
| phone | gpu | throughput | 1 | 0.1 | 9.6 | 16.0 | 0 | 0.00 |
| phone | gpu | throughput | 1 | 2 | 1.3 | 1.5 | 0 | 0.00 |
| phone | canvas | responsive | 1 | 1 | 1.0 | 1.3 | 0 | — |
| phone | canvas | responsive | 1 | 0.5 | 3.8 | 3.1 | 0 | — |
| phone | canvas | responsive | 1 | 0.25 | 9.0 | 6.2 | 0 | — |
| phone | canvas | responsive | 1 | 0.1 | 35.1 | 73.5 | 46 | — |
| phone | canvas | responsive | 1 | 2 | 1.0 | 0.7 | 0 | — |
| phone | gpu | responsive | 1 | 1 | 1.2 | 1.7 | 0 | 0.00 |
| phone | gpu | responsive | 1 | 0.5 | 2.3 | 1.7 | 0 | 0.00 |
| phone | gpu | responsive | 1 | 0.25 | 4.2 | 4.1 | 0 | 0.00 |
| phone | gpu | responsive | 1 | 0.1 | 10.1 | 16.2 | 0 | 1.97 |
| phone | gpu | responsive | 1 | 2 | 1.2 | 1.3 | 0 | 0.00 |
| phone | gpu | responsive | 2 | 1 | 1.3 | 1.4 | 0 | 0.00 |
| phone | gpu | responsive | 2 | 0.5 | 2.3 | 1.7 | 0 | 0.00 |
| phone | gpu | responsive | 2 | 0.25 | 4.1 | 3.4 | 0 | 0.00 |
| phone | gpu | responsive | 2 | 0.1 | 10.0 | 18.2 | 0 | 1.97 |
| phone | gpu | responsive | 2 | 2 | 1.4 | 1.1 | 0 | 0.00 |
| phone | canvas | responsive | 2 | 1 | 0.9 | 1.2 | 0 | — |
| phone | canvas | responsive | 2 | 0.5 | 4.0 | 2.0 | 0 | — |
| phone | canvas | responsive | 2 | 0.25 | 8.9 | 6.1 | 0 | — |
| phone | canvas | responsive | 2 | 0.1 | 48.6 | 96.8 | 38 | — |
| phone | canvas | responsive | 2 | 2 | 0.8 | 1.0 | 0 | — |
| phone | gpu | throughput | 2 | 1 | 1.5 | 1.6 | 0 | 0.00 |
| phone | gpu | throughput | 2 | 0.5 | 2.6 | 1.8 | 0 | 0.00 |
| phone | gpu | throughput | 2 | 0.25 | 3.8 | 3.8 | 0 | 0.00 |
| phone | gpu | throughput | 2 | 0.1 | 10.1 | 17.3 | 0 | 0.00 |
| phone | gpu | throughput | 2 | 2 | 1.2 | 1.2 | 0 | 0.00 |
| phone | canvas | throughput | 2 | 1 | 1.0 | 1.1 | 0 | — |
| phone | canvas | throughput | 2 | 0.5 | 3.1 | 2.6 | 0 | — |
| phone | canvas | throughput | 2 | 0.25 | 9.1 | 6.1 | 0 | — |
| phone | canvas | throughput | 2 | 0.1 | 43.2 | 113.3 | 0 | — |
| phone | canvas | throughput | 2 | 2 | 0.9 | 0.9 | 0 | — |
| desktop | gpu | responsive | 2 | 1 | 0.8 | 0.7 | 0 | 0.00 |
| desktop | gpu | responsive | 2 | 0.5 | 1.3 | 1.4 | 0 | 0.00 |
| desktop | gpu | responsive | 2 | 0.25 | 1.3 | 1.8 | 0 | 0.00 |
| desktop | gpu | responsive | 2 | 0.1 | 12.1 | 11.6 | 0 | 0.00 |
| desktop | gpu | responsive | 2 | 2 | 0.3 | 0.3 | 0 | 0.00 |
| desktop | canvas | responsive | 2 | 1 | 0.5 | 0.4 | 0 | — |
| desktop | canvas | responsive | 2 | 0.5 | 1.6 | 1.1 | 0 | — |
| desktop | canvas | responsive | 2 | 0.25 | 3.7 | 6.3 | 0 | — |
| desktop | canvas | responsive | 2 | 0.1 | 47.3 | 46.0 | 92 | — |
| desktop | canvas | responsive | 2 | 2 | 0.3 | 0.4 | 0 | — |
| desktop | gpu | throughput | 2 | 1 | 0.7 | 0.7 | 0 | 0.00 |
| desktop | gpu | throughput | 2 | 0.5 | 1.2 | 1.3 | 0 | 0.66 |
| desktop | gpu | throughput | 2 | 0.25 | 2.2 | 2.2 | 0 | 0.00 |
| desktop | gpu | throughput | 2 | 0.1 | 11.9 | 11.5 | 0 | 0.00 |
| desktop | gpu | throughput | 2 | 2 | 0.5 | 0.5 | 0 | 0.00 |
| desktop | canvas | throughput | 2 | 1 | 0.6 | 0.5 | 0 | — |
| desktop | canvas | throughput | 2 | 0.5 | 1.4 | 0.9 | 0 | — |
| desktop | canvas | throughput | 2 | 0.25 | 3.7 | 6.4 | 0 | — |
| desktop | canvas | throughput | 2 | 0.1 | 47.1 | 44.8 | 0 | — |
| desktop | canvas | throughput | 2 | 2 | 0.3 | 0.4 | 0 | — |

See matrix.json for per-stage readiness, stale replacements, surface memory, uploads, frame counts, device viewports and validation failures. Raw reports/logs remain in each run directory and may contain private world IDs. Entry is post-ready, not navigation cold start.
