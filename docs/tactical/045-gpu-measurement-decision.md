# 045 — GPU measurement and adoption decision

Status: complete, 2026-10-04. Parent: [039](039-fixed-view-gpu-parent.md).

Use the existing isolated traversal runner for matched Canvas/GPU runs in full
Chromium, then on the attached Android device when available. Record pacing,
render CPU duration, terrain readiness, heap snapshots, texture/vertex upload
estimates and resource residency. Distinguish cold traversal from navigation and
asset startup; these are not interchangeable. Repeat device runs to expose noise.

Probe the shared car geometry/material with Three's WebGPU renderer and forced
WebGL2 fallback. This is an asset portability check, not an implemented WebGPU
sprite backend. Record the actual backend, initialization and first render/readback
cost. Keep Canvas default unless measured compatibility and performance justify
changing it. Summarize evidence, remaining limitations and next work in the owning
topics; no Rust port or artwork promotion is part of this slice.

## Evidence and decision

[Structured results](../benchmarks/045-gpu-comparison.json) retain per-stage
measurements without raw browser traces, device identifiers or saved-world IDs.
Six traversals pass `--assert-ready`: one matched desktop pair, two phone pairs
in Canvas/GPU/GPU/Canvas order. Walking, sprinting and reversal have zero missing
data or incomplete visible terrain in every run. First-entry incompleteness remains.

| Pixel 7a movement stages | Canvas run 1 / 2 | GPU run 1 / 2 |
| --- | --- | --- |
| Frames over 25 ms, 780 sampled per run | 0 / 3 | 19 / 13 |
| Walking render CPU p95, ms | 2.7 / 2.7 | 3.0 / 2.7 |
| Sprint render CPU p95, ms | 3.0 / 2.9 | 3.2 / 3.2 |
| Reversal render CPU p95, ms | 3.6 / 3.7 | 3.4 / 3.5 |

Desktop pacing was 16.8 ms frame p99 in all stages for both backends, with no
frames over 25 ms. GPU movement render CPU p95 was 0.9–1.1 ms versus Canvas
0.4–0.5 ms. These short runs establish no GPU performance win. **Keep Canvas as
the default**, and expose GPU/meshes explicitly for experimentation.

Phone standing GPU stages upload no new page textures. Traversal causes expected
page uploads/evictions: run 2 ends stages with about 1.1–20.5 MB of estimated GPU
page residency. Its reversal stage requests 21.0 MB of page uploads and 4.23 MB
of sprite vertex uploads across 301 rendered frames. These counters exclude
model textures, driver memory and CPU staging/source images. The live-heap reading
is coarse on Android and is not evidence about allocation rate or GC attribution.

The portable car renders with actual `WebGPUBackend` and forced `WebGLBackend`
on desktop and Pixel 7a. Phone initialization takes 31 / 22.5 ms; first render plus
readback 242.1 / 172.1 ms. The first asset load takes 836.2 ms and the following
warm load 5.6 ms: these sequential probes are not an API performance comparison.
They expose a useful next target: stop decoding the full source atlas for one car.
Occupancy differs (4,848 vs 4,944 pixels), so only renderability is established.
The game sprite ShaderMaterial still needs a WebGPU/node-material adapter.

Reproduction uses `npm run streaming:bench -- --renderer=canvas --assert-ready`
and `--renderer=gpu`, with `--output=...`. Physical runs add the existing isolated
`--cdp`, dedicated `--port`, `--touch` and descriptive `--device` options after
forwarding/reversing the test connection. Do not benchmark in the user's game tab.
The comparison lab exposes both asset-probe buttons and the shared mesh pose.

Limits: development-source serving, short runs, one phone, no sustained thermal
or iOS evidence. Phone was charging, observed 25.8°C/thermal status 0. The desktop
regression suite ran during phone traversals; host serving contention can affect
startup. “Cold” traversal samples start after readiness, not navigation start.
No claim is made to have eliminated the original intermittent hitch.

Next: profile GPU page staging/upload stalls and draw submission on the phone;
reduce those measured costs before a default switch. Separately improve the car
using directional artwork/landmarks and a compact derived texture, then test a
second asset. Rust is not justified by these results.


Validation: typechecks, 1,444 unit tests, lint (124 existing warnings/32 infos),
catalog generation, all 552 immutable candidate identities and production build
pass. The full browser run passed all 296 existing cases; the added probe test
caught minified constructor names in its backend report. Using explicit backend
flags fixes that production-only diagnostic. All ten GPU tests then pass,
including the probe and an added unavailable-WebGL2 → usable-Canvas test.
Six isolated traversal runs pass readiness. Test tabs and device forwards are
removed; raw captures remain local. No source artwork or candidate approvals change.
