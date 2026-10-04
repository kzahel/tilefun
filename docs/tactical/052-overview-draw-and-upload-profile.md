# 052: Overview drawing and warm GPU uploads

Status: investigating. Owner: [performance](../topics/performance.md).

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
