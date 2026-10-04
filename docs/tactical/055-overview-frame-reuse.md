# 055: Overview frame reuse

Status: complete (2026-10-04). Owner: [performance](../topics/performance.md).

Follow-up to 052's measured grass collection/sorting and vertex-generation costs.
Preserve density, animation, stable scene ordering, alpha composition and backend
boundaries. Shared grass storage reaches game and embedded scenario labs; GPU
submission changes belong solely to the common raster adapter.

## Slices

1. Measure wide-view grass allocation with the existing deterministic probe and
   capture uninstrumented Mac GPU/Canvas 1× and 0.1× movement baselines. The
   8,192-record pool currently overflows every wide frame. Increase its bounded,
   demand-allocated capacity if allocation evidence supports that tradeoff; keep
   sustained-underuse shrink and teardown. Validate exact output and overflow.
2. Replace duplicated quad vertices with four vertices plus a persistent index
   buffer, retaining the exact triangle order and CPU coordinate arithmetic.
   Check pixel parity, batch boundaries, clips, alpha and graphics recovery.
   This avoids a shader/instancing change while reducing dynamic upload bytes.
3. Repeat real movement measurements and attempt the temperature-gated Pixel
   overview/normal sprint. Run required validation, record sanitized evidence,
   limitations and next work. Commit each validated implementation slice.

Do not change renderer/pacing defaults or sorting as part of these two bounded
fixes. Profiling 052 already attributes significant collection/sort work; after
removing avoidable churn, use a new profile to decide whether its extra ordering
state is warranted. Requested upload bytes are not physical bus measurements.

## Slice 1: shared grass pool

The radius-five allocation fixture contains 21,394 blades. Over 120 warm frames,
created records fall from 1,584,240 to zero; sampled JS allocation falls from
122,547,688 to 32,799,696 bytes (about 73%). All three complete-output hashes
match, including animation and generation order. The estimated retained pool
heap increases from 453,928 to 1,137,884 bytes for this fixture, measured by
forced-GC heap usage before/after clear; this is an estimate, not object sizing.
The pool grows only on demand, caps at 65,536 records and retains the existing
60-frame shrink and explicit-clear behavior. Larger scenes still draw fully.

The probe now accepts `--radius=1..10 --frames=1..600` (defaults unchanged),
reports warm record creation and estimated retained storage. Reproduce with
`node scripts/instrumentation/grass-frame-allocation.mjs --radius=5 --frames=120`.
Ten grass tests pass, including 40,000-record reuse, oversized distinct output,
shrink/clear, revisions, culling and independent consumers. Full rendering and
integration validation follows both slices. No placement or sorting code changed.


## Slice 2: indexed GPU quads

`GpuRasterSurface` now writes four interleaved vertices per quad and uses a
persistent 24 KiB Uint16 index buffer for the original two triangles. Quad batch
capacity, texture/clip flushes, shader, CPU coordinate arithmetic and draw order
are unchanged. Recurring requested vertex bytes fall from 192 to 128 per quad;
initial/index-buffer uploads are not included in that existing dynamic counter.
The adapter's geometry disposal and Three context recovery own the index buffer.

Build/catalog/manifest generation and all 13 targeted full-Chromium GPU tests
pass. A new 4,101-quad regression spans two full batches plus a partial batch,
checks overlapping alpha/tints and transformed placement against Canvas, and
asserts three draws and exactly 128 dynamic bytes per quad. Existing tests cover
texture changes, union clips, shadows, mesh composition, shared Traffic, renderer
switches, fallback and real graphics recovery. Full suite and measured movement
comparisons follow; pixel parity alone does not establish a frame-pacing win.


## Validation

Typechecks, all 1,475 unit tests, all 317 browser tests, six benchmark-tooling
tests, catalog/manifest generation, production build and the ordinary
`streaming:bench -- --assert-ready` check pass. Lint passes with the existing
114 warnings / 32 infos. The browser suite includes game plus Traffic,
Character, Outdoor Geometry and World Geometry hosts, cached terrain settlement,
movement/reset and context recovery. Approved appearance checks remain unchanged.
One generated JSON newline was corrected after the first lint run.

The one-minute 1× Pixel GPU noclip sprint completed on the updated renderer:
8,834 pixels travelled, zero data/cache gap frames, 18 slow intervals out of
3,583 samples, 16.7 ms frame p95. Battery was 29.4 → 29.8°C, thermal status 0 → 0.
This closes the outstanding long-traversal check on current code, not the
historical 052 cache-only comparison. The additional Pixel overview repeat also
completed; no cooldown deadline failed during this work.


## Movement comparison

[All 15 cases](../benchmarks/055-frame-reuse-comparison.md) and their
[sanitized reports](../benchmarks/055-frame-reuse-comparison.json) are recorded.
All pass readiness/recovery with zero page errors. This is focused 1× / 0.1×
validation with faster fill, not a rerun of the 80-case matrix. Mac timings are
sequential headed full-Chromium runs without concurrent tests/builds. Phone
uses physical Chrome/touch; host checks sometimes overlap serving. Phone entries
and exits remain thermal status zero, at 28.5–30.5°C while charging. Temperature
and run order still vary; these are observations rather than randomized trials.

Mac GPU overview render CPU p95 is 10.1 ms before, 9.4 ms with only the pool fix,
and 8.5 ms in both final runs (about 16% below baseline). Slow rAF intervals
fall from 274/2,125 to 25/2,374 and 27/2,372. Frame p95 is 16.7 → 9.3 ms.
Requested dynamic vertex bytes are 5.780 → 3.854 MiB/frame. Mac Canvas overview
remains roughly 50 ms frame p95 and 46 ms render CPU p95; the pool reduces
allocation without solving native submission cost. All 1× Mac cases have zero
calibrated slow intervals, though small CPU timing variations remain.

Pixel GPU overview render CPU p95 is 10.4 → 9.9 ms in both final observations.
Slow intervals fall from 104/1,068 to 53/1,122 and 66/1,112. Frame p95 is
33.4 ms before, 16.8 ms first after, and 33.3 ms on repeat: the 5% quantile
threshold explains the large p95 jump; this does not demonstrate doubled frame
rate or a stutter cure. Requested dynamic vertex bytes are about 1.64 → 1.08
MiB/frame. The warmer repeat still has thermal status zero. Phone Canvas was not
rerun in this slice. Raw reports/profiles stay local; committed data is allowlisted.

Implementation commits: `04cd7ae` (grass pool), `a3ed665` (indexed GPU quads).
Renderer/pacing defaults, scene sorting, grass density/animation and artwork are
unchanged. The pool and raster adapter are shared by game and embedded labs.


## Remaining work

A separate [five-second warm GPU profile](../benchmarks/055-frame-reuse-profile.json)
contains 601 instrumented scene submissions, about 34,141 items each. Sampled
self time is 1,218 ms in `collectScene`, 725 ms in its anonymous callbacks
(including sorting), 778 ms in scene-entry drawing, 462 ms in `drawImage`,
303 ms in quad generation and 27 ms in GC. Instrumentation/inlining affect
attribution and the hooks span a slightly wider window than frame sampling;
these totals are not an uninstrumented speed comparison. No texture uploads
occurred during that warm window; old pages were evicted without reuploads.

Next recommended slice: prototype cached grass depth ordering and merge it with
the live entity/prop/elevation/particle order in the shared collector. Compare
exact final item order, especially equal-depth ties, across viewport motion,
chunk replacement/revisions and independent hosts. Measure against native stable
sort before keeping the extra state. Nearby-entity filtering is another candidate
for the per-blade loop, but the profile does not isolate its cost yet. Further
instancing is lower priority than the now-prominent collector work. Canvas needs
a separately measured drawing/batching strategy; these fixes do not solve its
native per-blade cost or establish a need for Rust/WebGPU.

All owned benchmark/test browsers, phone tabs and servers were closed; temporary
Android forwarding/reverse ports were removed. Unrelated in-progress docs were
preserved. No incomplete measurement cases remain in this tactical's scope.
