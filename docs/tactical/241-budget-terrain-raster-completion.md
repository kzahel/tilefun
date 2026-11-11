# 241 — Budget terrain raster completion

Status: delivered and physically measured · 2026-11-11.
Owner: [performance](../topics/performance.md).
Follows [240's attribution](240-phone-pause-attribution.md).

## Change and contract

Terrain preparation now materializes the entire row it just painted before
checking the next deadline or publishing its pixels. `finishTerrainRow` reads a
256×16 RGBA strip from the CPU-requested canvas; its return value is discarded,
with no write-back or color conversion applied to the source. Unlike the earlier
one-pixel diagnostic, the read covers every pixel the row's commands changed.

A row remains the atomic unit. The 2 ms budget can overrun by one completed row,
not a whole deferred chunk. Existing hard row caps, center-out order, visible-gap
priority, shared multi-view budget, retained old imagery and revision handling
remain intact. The read also completes partial images in the row-bounded reference
path. Warm terrain does no row reads or new uploads.

`TerrainRaster.ts` owns completion and the unchanged row-order helper, reducing
the large renderer file and tightening its health baseline. Game and embedded
labs share the same implementation. No authority, generation, input, GL-copy,
shader, asset-bank or page-size changes.

The read returns 16 KiB per completed row. This transient pixel data and native
read overhead are the explicit cost of materializing the raster within its
budget; physical measurements below record the tradeoff.

## Validation

- A native clock test makes drawing commands free and raster completion expensive:
  preparation stops after two 1.1 ms rows under a 2 ms budget. No work starts at
  zero time budget, and ready publication follows completion of all 16 rows.
- 517 rendering tests across 61 files pass, including multi-view scheduling,
  stale/partial images, edits, residency, warm reuse and shared review consumers.
- A real OffscreenCanvas byte oracle compares production painting with completion
  reads enabled/suppressed: identical partial, ready, retained-old and edited-ready
  images. It includes alpha, blend layers, roads, details and negative coordinates.
- Seven rebuilt-production browser checks pass: row pixel parity, zoom/pacing and
  warm-upload reuse, two lab lifecycle/scheduling checks, world registration,
  atlas pixel parity, and the no-GL-readback/page-splitting guard.
- Four TypeScript projects, focused Biome, six benchmark/capture/analysis tests,
  health and normal build pass. Art source locators and Workshop input digest are
  updated; all 2,130 candidate identities verify unchanged.
- `npm run streaming:bench -- --assert-ready` passes.

## Physical measurements

[Sanitized evidence](../benchmarks/241-terrain-raster-budget.json) records the
eight ordinary runs, separate native-operation probes and phone pixel oracle.
Raw records and isolated build setup stay in ignored `data/scratch/raster-241/`.

The before bundle uses the exact `32e2e176` terrain renderer source with the same
current benchmark harness and unchanged dependencies/assets as after. This keeps
both terrain policies available without comparing different input/measurement
programs. Both bundles use ordinary production compilation and separate isolated
preview origins. The original measured v2 production bundle is preserved too.
The checkout checksum in a `--base` report describes the measurement checkout,
not the baseline bundle: the evidence records the preserved renderer source hash
and actual served entry hashes to identify the comparison.

`driving:bench --pacing=responsive|throughput` now selects either existing policy;
its default stays responsive. Comparisons reject mismatched policies. Each has a
2 ms deadline; responsive caps work at two rows and draws completed imagery only,
while throughput is the game's default 128-row cap and permits partial imagery.

Two 30-second before/after pairs per policy ran in before/after/after/before
order, with fresh pages, worlds and Workers and the same 180 idle warmup ticks.
All eight ordinary workloads qualify: 1,799–1,801 simulation ticks and 3,324–3,328
pixels driven. All four compatibility checks pass, including initial poses,
viewport, capture mode and policy. Pixel 7a / Chrome 156 used its native 411×789
CSS viewport, DPR 2.625 and Mali-G710. Battery temperature stayed 25.1–26.2°C,
on external power, thermal status 0 throughout. Frequency/JIT and browser
scheduling were not frozen.

| Policy / render metric | Before runs a / b | After runs a / b |
| --- | ---: | ---: |
| Responsive median | 2.6 / 2.7 ms | 2.7 / 2.9 ms |
| Responsive worst | 21.9 / 22.0 ms | 10.5 / 12.0 ms |
| Responsive p95 | 3.9 / 3.9 ms | 4.8 / 4.8 ms |
| Responsive missed intervals | 1 / 1 | 1 / 1 |
| Throughput median | 2.6 / 2.8 ms | 2.8 / 2.8 ms |
| Throughput worst | 23.5 / 23.8 ms | 11.2 / 11.8 ms |
| Throughput p95 | 4.1 / 4.2 ms | 5.0 / 5.0 ms |
| Throughput missed intervals | 0 / 0 | 1 / 1 |

The normal game policy's worst render callback roughly halves. Median overhead
is about 0.1–0.2 ms; p95 rises as work is spread across more preparation frames.
**This does not establish a whole-run missed-frame improvement.** Both throughput
after runs miss one startup interval (66.7 / 83.3 ms into measurement); their
maximum update callbacks are 33.5 / 27.7 ms. Responsive after-a has a late interval
at 17.685 seconds and after-b a startup interval. These captures have no trace to
assign their causes. The prepared-road fixture excludes regional chunk generation
and city-art streaming, and this campaign does not measure the Steam Deck.

Separate native-operation probes use throughput and qualify with 26 identical
256×256 page copies each; source and destination request CPU canvases. Copy
median falls **5.2 → 0.1 ms**, max **7.3 → 0.2 ms**. Canvas upload max is
1.3 → 1.6 ms. The after probe records 832 full-row completion reads, median
0.5 ms, max 1.0 ms, requesting **13 MiB of transient pixel payload in 30 seconds**.
This is requested pixel payload, not retained heap or a total JS-allocation
measurement. Returned ImageData is discarded. Instrumented cadence is kept
separate from the ordinary runs; its after run also has a late 50.1 ms interval
whose cause is unassigned.

The phone pixel oracle completes 32 rows and compares 1,048,576 channel bytes
across four snapshots with **zero mismatches**, matching the desktop oracle.
Digests distinguish partial, complete and edited-complete images; the retained-old
snapshot exactly matches the previous complete one. All owned phone tabs,
Workers, preview servers and ADB routes were cleaned up; the final machine-control
doctor passes.

## Next work

Keep the startup and Chromium memory-footprint pauses identified in 240 separate
from terrain raster completion. Prediction snapshot allocation remains another
measured target; this change does not resolve all phone-frame causes.
