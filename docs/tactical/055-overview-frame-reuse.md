# 055: Overview frame reuse

Status: in progress (2026-10-04). Owner: [performance](../topics/performance.md).

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
