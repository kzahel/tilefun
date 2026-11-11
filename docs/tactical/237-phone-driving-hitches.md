# 237 — Dropped frames while driving on the phone

Status: delivered · 2026-11-10. Driving through the city on the Pixel 7a dropped
12–15 frames in 30 seconds; it now drops none.
Owner: [performance](../topics/performance.md); renderer contracts in
[rendering architecture](../topics/rendering-architecture.md).

The owner reported visible frame drops when driving around the city on the phone,
with traffic on the roads. Standing in the same city the phone held every frame
(0 of 300 missed, authority tick 3.6 ms), so the drops came from moving.

## Measurement: the `drive` scene

`npm run render:bench -- --scenes=drive` arrives in the seed-2026 city, puts the
player in a car and drives it with a small autopilot that runs in the page: it
holds the throttle, follows road tiles in the right-hand half of the street,
turns where the road ends and turns round after two seconds without progress.
The route is not a fixed replay: traffic differs between runs, and in about one
run in four the car is held up and covers under 1,000 px. Compare runs by
`drivenPx`.

The bench gained, for every scene:

- `slowFrames`: each frame interval over 25 ms, with the update and render time
  spent in it and the texture pages uploaded around it;
- `upload`: texture bytes and pages uploaded per frame;
- `--profile` now also saves the main-thread CPU profile and the page clock's
  origin, so profile samples can be assigned to individual slow frames;
- `--trace` saves a Chrome trace of every thread and the GPU process.

## What the drops were

Profile samples inside the slow frames, then a trace, showed three causes, all
in bringing new terrain and sprite pages onto the GPU as the car moves:

1. **A texture copy that waited for the GPU.** Each page upload went through
   three.js's `copyTextureToTexture`, which first reads five pixel-store
   parameters from the GL context. The depth-shadow pass resets three.js's
   cached state every frame, so those reads were real `gl.getParameter` calls,
   and each waits until the GPU process has finished the upload just issued:
   20–40 ms on the phone, inside the render callback. This was about two thirds
   of all time in slow frames.
2. **Terrain rasterized in the GPU process.** Chunk images were built on
   GPU-backed 2D canvases, where the tile blits are only recorded on the main
   thread and executed later in the GPU process. The builder's 2 ms time budget
   saw none of that cost; the trace showed 72 GPU-process flushes of 8–30 ms in
   45 seconds.
3. **Four-megabyte page uploads.** A sprite sheet was split into 1,024-texel
   pages, and a page uploads whole the first time a sprite in it is drawn. For
   the large building sheet (2,816 × 8,224) that was 4 MiB at once, up to 11 MiB
   in one frame.

A fourth, rarer cause remains: one 20 ms major garbage collection on the main
thread in the traced run.

## Changes

- `GpuPageAtlas.write` copies the staging texture into its atlas layer with
  plain GL (`copyTexSubImage3D` from a read framebuffer), reading nothing back.
- Terrain chunk canvases (`cpuRasterCanvas` in `RasterSurface.ts`) and page
  source canvases are CPU canvases: rasterized on the calling thread, inside
  the time budget, and uploaded as pixels.
- Pages are at most 512 texels a side (1 MiB). The atlas layer stays 1,024.

## Result

Pixel 7a, 30 seconds of driving at zoom 1, before and after runs alternated
([evidence](../benchmarks/237-phone-driving-hitches.json)):

| | Before (`085fe6fc`) | After |
| --- | ---: | ---: |
| Missed frames, runs that drove over 2,000 px | 15, 15, 12 of about 1,783 | 0, 0 of 1,800; two more runs of the final code: 0, 0 |
| Worst frame in those runs | 50–67 ms | 16.9–17.5 ms |
| Missed frames, car held up (under 1,000 px) | 1 | 1, 0 |
| Largest upload in one frame | 4–7 MiB | 1–2.5 MiB |
| Render p50 / p95 | 3.4–3.8 / 5.1–5.4 ms | 3.9–4.1 / 5.5–6.2 ms |

Render time per frame rose by about half a millisecond, because terrain is now
rasterized on the main thread instead of in the GPU process. (Distances in
these runs also count the bench's warm-up and finish windows, about 33.5 s in
all; the bench now reports the 30 s cadence window only.) Added one at a time
(not interleaved), the changes gave 8–19 missed frames at first, 4–8 with the
plain copy, 3 with CPU canvases and 0 with 512-texel pages.

Steady scenes on the phone (city, woods and crowd at zooms 1 and 0.25, one run
each side) and all scenes on the M4 Pro are unchanged within run-to-run
variation. The Steam Deck was not measured.

## Validation

A browser test (`tests/gpu-renderer.spec.ts`, "page uploads read nothing back…")
resets the renderer state as the shadow pass does, re-uploads a 1,100 × 600
image and requires no `getParameter` call, six pages, and the same pixels as
separate page textures; with three.js's copy restored it fails with five reads.
The independent review found no rendering defect; it found the read framebuffer
left unbound after a copy into a non-default target (now both bindings are
released before the caller's target is restored) and three faults in the new
bench records (slow-frame work attributed one frame late, distance counted
outside the sample window, profiles running through the trace download), all
fixed. The existing atlas parity and growth tests pass unchanged, as do 513 rendering
unit tests and the streaming bench. Browser tests run against the production
build: rebuild before trusting them after a source change.

## Not done

- The remaining major garbage collection (about 20 ms, once in the traced run).
- The authority at 30 Hz, which the owner named as a reasonable option. It was
  not needed for this: the tick was 4–6 ms while driving.
- Chunk generation on the authority Worker is the largest stage while driving
  (about 5 ms p50) and showed Worker tasks of 17–27 ms. They did not drop frames
  here, but they delay the simulation by a tick or two.
- The autopilot is sometimes held up by traffic; a fixed route would make runs
  comparable without checking `drivenPx`.

## GC and generation follow-up (2026-11-11)

Re-inspected the saved Pixel driving trace and Worker CPU profile from the
investigation (`data/scratch/drive-240/phone-trace.drive-1.trace.json` and
`phone-prof2.drive-1.worker.cpuprofile`, ignored local evidence). These are
intermediate diagnostic captures, not new measurements of the final commit.

The trace spans 22.16 seconds (20-second cadence sample plus finish). On
`CrRendererMain` it contains 74 MinorGC events: 1.73 ms median, 4.93 ms maximum,
140.8 ms summed elapsed time. One MajorGC takes 21.51 ms, finalizing incremental
marking, with used JS heap falling from 76.79 to 56.78 MiB. The ordinary GC cost
is modest on average; the single long pause is the problem. This establishes
neither a leak nor which allocation sites caused the collection. Worker GC is
separate. Main-thread prediction, presentation and replica decoding still
allocate; chunk decoding still creates eight temporary number arrays before
copying into typed chunk grids. Allocation sampling on a moving workload is
needed before assigning the major collection to any one of these paths.

Before the benchmark expansion below, `npm run generation:bench` measured terrain,
prop placements and actor placements for four seed-2026 chunks. An unprofiled
Mac run of that old bench on `112ecc88`:

| Fixture | First invocation | Warm median | Warm p95 |
| --- | ---: | ---: | ---: |
| district | 135.57 ms | 3.83 ms | 4.16 ms |
| farm | 21.40 ms | 3.53 ms | 3.66 ms |
| woodland | 111.94 ms | 2.63 ms | 3.61 ms |
| negative-coast | 8.37 ms | 3.65 ms | 3.88 ms |

Each old fixture regenerated the same chunk 21 times, discarding its first timing
from the warm statistics. All four fixtures share a generator. Thus the first
column includes differing cache/JIT states, not four independent cold starts;
the warm columns miss exploration cache misses. The bench excludes durable
reads, live actor/prop admission, physics insertion, replication and rendering.
`explorer:bench` measures regional map queries; `streaming:bench` measures the
real traversal pipeline. `render:bench --scenes=drive --profile --trace` captures
physical-phone generation and Worker task tails, but has the route variability
described above. `server.generate` times terrain generation per invocation,
not the whole chunk lifecycle or a per-tick aggregate.

In the saved phone profile, selecting samples with a terrain `generate` ancestor
attributes about 30% of their self time to `fbm`, 15% to `settlementForOwner`,
and 13% to rail segment/distance functions. This is CPU sampling, not allocation
attribution. A chunk has only 16×16 tiles but 33×33 terrain samples; geography,
dense settlement, rail and natural overlays perform successive sampling passes.
Regional corridor queries repeat dry-land/elevation checks, and natural terrain
samples repeat elevation/water lookups. Plans have bounded caches, so first
visits can also construct surrounding plans. Chunk publication is synchronous
after async reads, with up to eight reads in flight and no elapsed-time limit on
generation/publication; clustered completions can create Worker bursts.

The following sections record the expanded benchmarks and subsequent physical-phone
allocation and unseen-chunk measurements.

## Benchmark expansion delivered (2026-11-11)

Commands and scope are owned by [performance](../topics/performance.md#chunk-generation-and-allocation-benchmarks-2026-11-11).
The old four-chunk repeat loop is replaced by a shared Node/browser-Worker
workload. Default: seed 2026, 7×7 adjacent chunks around each old fixture,
three fresh-generator trials with rotated fixture order. `generate` visits
every chunk once then repeats the coordinates; `streaming` publishes the same
unique coordinates through production `RealmStreaming`/procedural registries
and `RealmRecords`, in groups of up to eight, with empty memory storage.

Reports keep raw timings, exclusive phases, per-publication timings/coordinates,
counts, all eight chunk grids' bytes, startup samples and slowest chunks.
Generator/store setup has its own timer. No warmup is discarded. Esbuild removes
tsx's name-wrapper instrumentation; source hashes include transitive bundled
inputs and the dependency lock. Optional CPU profiles and FNV content verification
are separate diagnostic runs. Verification covers terrain/rail/placement plans in
`generate`, terrain/rail data in `streaming`; live admission also records counts.
Comparisons require matching configuration, runtime, generator version,
profiling mode and work/content records.

The browser harness serves a standalone bundle and runs it in a dedicated Worker,
through bundled Chromium or an owned CDP tab. It closes the Worker/tab/server
afterward. A CDP smoke exposed the shared navigation helper's uncancelled two-minute
timeout; the helper now clears it on completion and rejects timed-out navigation.

`render:bench --allocations` adds main-thread allocation sampling with collected
objects included, a top-site summary and raw `.main.heapprofile` files. It samples
normal cadence, skips the separate blocking GPU-finish window, and excludes
Worker heaps. Sampling and the bench's own records affect allocation and timing;
ordinary cadence comparisons reject mixing sampled and unsampled runs.

### Desktop baseline

[Sanitized evidence](../benchmarks/237-generation-and-allocation.json), full local
reports/profiles in ignored `data/scratch/generation-237/`. Mac Apple M4 Pro,
Node `v27.0.0-alpha.0.0.0`; timings below pool three trials (147 chunks each).
These are diagnostic desktop workloads, not phone results or full-game admission.

| Fixture | Unseen median / p95 | Regenerated p95 | Unseen max |
| --- | ---: | ---: | ---: |
| district | 3.48 / 4.86 ms | 3.92 ms | 137.06 ms |
| farm | 2.19 / 13.36 ms | 3.47 ms | 42.70 ms |
| woodland | 2.49 / 6.21 ms | 3.31 ms | 145.16 ms |
| negative coast | 2.97 / 6.13 ms | 3.74 ms | 47.62 ms |

Large maxima are not solely process startup: in trial two, the first district
chunk is 39.81 ms (38.77 ms terrain), and the first woodland chunk is 80.38 ms
(49.31 ms terrain, 22.03 ms prop plans). A later coastal chunk spends 46.33 of
47.53 ms in actor planning. In the production streaming core, individual
synchronous publication maxima are 42.70, 40.35, 82.41, 48.16 ms respectively;
batch wall times are a different metric and include several publications.

A bundled Chromium desktop allocation smoke (five seconds per scene, zoom 1)
estimates 148.7 MiB allocated standing in the city and 157.4 MiB while driving
422 px, including collected objects and benchmark overhead. The largest sampled
site is `SurfaceReceivers` (14.2/17.2 MiB), followed by vehicle chassis preparation,
wheel-grid construction and other prediction/presentation work. This is one
instrumented desktop run, not a phone allocation rate or attribution of the
saved phone major GC. It makes renderer/prediction allocation a more concrete
next candidate than assuming chunk decoding is the primary cause.

### Checks and next work

- Four Node harness tests: adjacent unique coordinates, tail/phase accounting,
  matching generated output through regeneration, complete production admission,
  invalid workloads, comparison compatibility and CPU-profile output.
- All four TypeScript projects, focused Biome checks and the existing
  `streaming:bench -- --assert-ready` gate pass.
- Browser-Worker smoke and CDP owned-tab smoke use bundled Chromium; the latter
  exits cleanly and preserves an unrelated test tab. Physical measurements follow below.
- Actual city/drive allocation smoke saves non-empty profiles, drives over 400 px,
  skips GPU finish, and cleans up the isolated browser/server.

The physical run below precedes the next bounded planner/allocation fix.
Generation is authority-Worker work;
the observed GC is in the client's separate main-thread heap.
A Rust/WASM numeric kernel is a possible experiment, not a prerequisite or a fix
for that main-thread collection. No gameplay or generator-output changes here.

## Physical Pixel 7a measurements (2026-11-11)

Ran the new generation workload and allocation benchmark on the actual Pixel 7a,
Chrome 156.0.8078.79, Android API 37, native portrait viewport, without CPU/viewport
emulation. Tests ran sequentially. Battery temperature 24.3 → 26.8 °C; thermal
status 0 at every checkpoint. Android reported external AC power, 80% battery
and status 4 (not charging). The common machine-control doctor passed before
and after; task-owned forwarding routes and tabs were removed. No game-code
changes or save migrations.

[Sanitized measurements](../benchmarks/237-phone-generation-and-allocation.json)
retain timings, worst coordinates/phases, allocation sites and GC censuses.
Full reports, heap profiles, traces and checkpoints remain in ignored
`data/scratch/generation-237/` (`phone-*`). Raw traces stay local.

### Generation

Default 7×7 routes, four fixtures, three fresh-generator trials, then the same
coordinates regenerated. Work counts/coordinates match desktop. Pools below
contain 147 chunks each; maxima include initial JIT/planner startup.

| Fixture | Unseen median / p95 | Regenerated p95 | Unseen max |
| --- | ---: | ---: | ---: |
| district | 6.1 / 10.3 ms | 7.3 ms | 328.2 ms |
| farm | 4.8 / 24.6 ms | 7.6 ms | 102.3 ms |
| woodland | 5.6 / 14.2 ms | 7.2 ms | 322.8 ms |
| negative coast | 6.7 / 13.4 ms | 7.8 ms | 98.0 ms |

Cold planner work persists after the first trial: trial two's first district
chunk costs 80.1 ms (77.9 ms terrain), and woodland costs 169.0 ms (102.2 ms
terrain, 47.7 ms prop planning, 19.1 ms actor planning). A later coastal chunk
costs 95.9 ms, including 93.5 ms actor planning. This plans spawn locations and
placements; it does not create live actors or run their simulation.

Streaming-core synchronous publication p95 is 10.2/25.0/15.0/14.5 ms for
district/farm/woodland/coast; maxima are 92.0/86.2/223.6/100.5 ms. These are
per-chunk publications, not batch wall times. The fixture excludes physical
storage, physics, autotiling, traffic/rail services and replication. It measures
cold planner caches, unlike driving inside an already warmed city. Do not equate
these maxima with ordinary city-driving tick cost.

### Main-thread allocation and cadence

Thirty-second allocation samples at normal zoom, with trace capture. Estimates
include collected objects and benchmark bookkeeping; the GPU-finish window
was skipped.

| Sample | Travel | Estimated allocated | Estimated rate |
| --- | ---: | ---: | ---: |
| Standing city | — | 546.6 MiB | 18.2 MiB/s |
| Moving drive | 2,462 px | 660.4 MiB | 22.0 MiB/s |

The first allocation drive covered only 158 px because of traffic and is
excluded from the moving comparison; its raw data remains. The repeat drove
sufficiently. Populations/view contents differ, so the two samples do not
isolate movement's incremental allocation.

In the moving sample, `SurfaceReceivers` stacks account for 169.3 MiB (25.6%),
physics paths 172.9 MiB (26.2%), and selected presentation paths 55.0 MiB (8.3%).
These are disjoint stack groups, not amounts to add to the top-site table.
The receiver constructor alone accounts for 122.7 MiB: it rebuilds prop bounds,
planes, polygons, closures and spatial buckets every render. Chassis preparation,
wheel grids, predictor cloning and presentation records also appear prominently.
Substantial churn exists standing still, outside new chunk generation. Allocated
volume is not live heap or a long-session leak measurement.

The ordinary benchmark (no trace/heap sampler) drove 2,665 px and missed 1 of
1,798 frames in 30 s; maximum interval 33.4 ms, render p50/p95 4.1/6.4 ms,
update median 2.8 ms, authority tick median 5.8 ms. The pause has no trace;
its cause remains unknown. The prior zero-miss result is not an absolute
guarantee against occasional pauses. Sampled/traced cadence is diagnostic,
not a clean regression comparison.

### GC and observer effects

- Standing allocation trace: 85 minor collections, 168 ms total; no natural
  major collection. The 47 ms MajorGC at sampler stop is labelled `sampling profiler`.
- Valid moving allocation trace: 101 minors, 177 ms total; no natural major.
  Its 55 ms sampler-stop MajorGC is also excluded from natural counts.
- The traffic-blocked sampled drive has two natural major finalizations of
  about 12 ms each, plus a separate profiler-induced collection.
- A trace without allocation sampling records 126 minors over about 32.2 s
  (30 s cadence plus GPU-finish window): median 1.44 ms, maximum 3.61 ms,
  192 ms total, and no major GC. Its car covered only 806 px; it is a GC
  observation, not a comparable traversal load. The 66.7 ms frame interval
  overlaps a 62 ms Chrome memory-instrumentation IPC task without GC. Whether
  that native task occurs without tracing was not measured. Another long render
  callback in this trace also has no GC overlap.

Sampler stop can collect the heap after the cadence window. Do not attribute
those 45–55 ms events to normal gameplay. These runs confirm allocation churn
and frequent short collections; they do not reproduce the older uninstrumented
21 ms major collection or establish GC as the current driving pause's cause.

Next measured fixes: retain static receiver data, reduce prediction/vehicle
vector and snapshot churn, and reuse regional planning work. Measure one slice
at a time. CPU-profile the remaining long render callback before assigning its
cause. Rust/WASM could target a numeric generation kernel; it does not replace
these main-thread fixes.
