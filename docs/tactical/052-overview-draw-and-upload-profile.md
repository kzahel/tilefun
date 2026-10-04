# 052: Overview drawing and warm GPU uploads

Status: complete (2026-10-04), with two extra phone cases unmeasured after a cooldown failure. Owner: [performance](../topics/performance.md).

## Slices

1. Add opt-in stage CPU/submit/upload attribution to the reusable streaming
   runner. Capture Mac Canvas/GPU warm 0.1× and reproduce the Pixel upload report.
   Distinguish changing overlay, terrain revisions and texture eviction.
2. Select a focused shared/backend fix from measured evidence. Preserve visual
   parity and game/lab ownership; record findings even if no safe fix is justified.
3. Validate with ordinary/overview repeated movement and temperature-gated Pixel
   runs. Keep profiles separate from uninstrumented comparison. Run required
   repository and browser checks, record sanitized evidence and commit.

No default renderer or pacing change is planned. Raw profiles stay local.

## Initial attribution

A five-second warm Mac overview contains about 30,000 scene items per frame.
Canvas scene submission accounts for 4,585 ms across 122 frames; sampled native
`restore` alone accounts for 2,741 ms. Terrain submission totals 48.5 ms and
preparation 12.4 ms. GPU spends less on submission but repeated decoded-image
size reads are a prominent sampled cost (542 ms on Mac, 997 ms on Pixel).
Profiling itself adds overhead; these are attribution, not before/after FPS.

The Pixel small-batch overview reproduced exactly 2,064,384 warm upload bytes:
three 688,128-byte vehicle sprite allocations (`bus-5`, `unindexed-sedan-cyan`,
`car-24`), with no upload revisions or evictions during the sampled stage.
This is distinct from repeated terrain rebuilding. A stationary camera does not
freeze actors or establish residency for every sprite that later becomes visible.
The capture does not establish whether a newly allocated page was evicted in an
earlier stage.

Selected slice: avoid Canvas whole-state save/restore for each grass transform,
while preserving the inherited matrix/clip/alpha; cache decoded-image dimensions
within a GPU frame rather than querying DOM getters for every blade. Keep dynamic
canvas dimensions live. Both changes belong to shared drawing adapters and reach
game and embedded labs; they do not reduce grass density or change animation.

A concurrent unrelated browser suite overlapped the first unprofiled Mac baseline;
that run is excluded and will be repeated after the suite exits. Phone timings
execute on the physical device; host concurrency during serving is recorded.


## Candidate selection

The Canvas transform shortcut is **not retained**. Its matrix-object variant
was slower despite passing ten exact-pixel fixtures (zoom, rotated/scaled
parent, clip, mixed particles). A subsequent numeric identity-reset experiment
only moved Mac overview motion render p95 from 47.7 to 42.8 ms, with worse
stationary recovery timing; it was discarded before broader validation. That is insufficient evidence for extending the shared drawing
surface. Canvas keeps the original implementation. This suggests native draw
submission cost needs a more substantial batching/detail strategy, measured
separately before changing visual policy.

The GPU candidate caches both `ImageBitmap` (the gameplay loader's decoded
source) and `HTMLImageElement` dimensions once per synchronous frame. A first
HTML-image-only control had no meaningful improvement because gameplay uses
bitmaps. Mutable canvases still read dimensions at every draw; weak keys and
resource reset prevent adding another source-retention owner.


## Validation checkpoint

Typechecks, 1,462 unit tests, six benchmark-tooling tests and lint pass (114
existing warnings / 32 infos). Catalog/manifest generation and production build
pass. All 312 browser tests pass, including native/GPU parity, the new decoded
bitmap getter-count/recovery regression, graphics loss, renderer switching,
Traffic and Outdoor Geometry lab behavior. The legacy streaming `--assert-ready`
check passes. No artwork or Canvas rendering policy changed.

The matched Mac 0.1× control uses identical code and a benchmark-only Vite
transform to disable just the decoded-image dimension-cache branch. Over 20
seconds of noclip motion, render CPU p95 is 11.6 ms uncached versus 10.0 ms cached;
calibrated missed intervals are 534/1,864 versus 217/2,183. Frame-interval p95 is
17.1 versus 16.7 ms, still above the approximately 8.3 ms display target.

## Interpretation and next work

The initial Mac pair measured GPU overview render CPU p95 at 11.5 ms before and
10.5 ms after caching. The matched cache-off/on pair repeats the direction at
11.6 → 10.0 ms (about 14% lower). The completed Pixel samples measure 14.0 ms
before, 11.3 ms cached and 14.8 ms in the uncached control. Pixel overview frame
p95 remains approximately 33.3–33.4 ms; the change does not establish a stutter
cure or justify changing renderer/pacing defaults.

All phone entries were thermal status zero and <=31°C (the first Canvas run
used <=30°C). The cached Pixel overview ran 30.7 → 30.6°C, status 0 → 0. Its
uncached control ran 31.0 → 31.6°C, status 0 → 1. These are controlled entry
conditions, not constant temperatures or evidence isolating thermal effects.
The unchanged Canvas phone control retained 83.3 ms overview frame p95 in both
runs. Host tests sometimes overlapped phone serving; retained Mac timing runs
exclude concurrent host tests/builds. The Mac one-minute 1× GPU sprint travelled
8,834 pixels with zero calibrated missed intervals out of 7,200 samples and no
terrain gaps.

Next, profile shared grass collection/sorting and per-frame vertex construction.
The cached Mac overview still requests approximately 5.78 MiB of vertex uploads
and 300 draw calls per render frame; Pixel requests approximately 1.64 MiB and
93 draws. These are requested bytes/calls, not measured bus traffic or proof of
a GPU bandwidth bottleneck. Persistent ordering or instanced quad submission
are candidates to test behind the existing shared/backend boundaries. Do not
infer a need for a Rust/WebGPU migration from these measurements.


## Completed evidence and limits

[Full comparison](../benchmarks/052-overview-comparison.md),
[sanitized measurements](../benchmarks/052-overview-comparison.json) and
[profile attribution](../benchmarks/052-overview-profile.json) are committed.
Profiling/thermal tooling is `65347ad`; the GPU fix, matched controls and
validation are `aa0068a`.

18 completed zoom cases passed readiness/recovery with zero page errors. This
is focused 1× / 0.1× validation, not a rerun of 049's entire matrix. There are
repeated Mac overview measurements, two uncached Pixel observations and one
completed cached Pixel overview. The requested extra cached Pixel repeat did
not run: its 600-second entry cooldown gate expired at 31.6°C after peaking at
32.8°C while idle. The queued one-minute Pixel sprint was canceled before
measurement once that failure was established. Neither counts as a passed case;
the JSON retains the gate readings and incomplete-case reasons. Initial 29°C
and 30°C attempts were interrupted because the phone's idle charging temperature
exceeded those limits; retained comparisons use <=31°C/status zero, with the
first Canvas pair satisfying the stricter <=30°C gate.

Remaining device evidence: repeat the cached Pixel overview and one-minute
normal-zoom sprint after the phone can satisfy the fixed entry gate. Constant
charging/ambient conditions and temperature stabilization matter; do not relax
the gate merely to obtain a result. The completed cases already support a modest
CPU-work reduction, with phone temperature/order uncertainty retained.

All owned test tabs, Chromium instances and Vite servers were closed. Temporary
Android forwarding/reverse ports were removed. Raw profiles, screenshots, reports
and logs remain local; public summaries contain no realm IDs or private device
identifiers. Canvas, artwork and production renderer/pacing defaults are unchanged.
