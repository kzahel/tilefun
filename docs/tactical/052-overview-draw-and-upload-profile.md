# 052: Overview drawing and warm GPU uploads

Status: validating (GPU fix and browser checks complete; final phone repeats pending). Owner: [performance](../topics/performance.md).

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
