# Renderer boundary and walking allocation audit

Status: audit, grass/frame/scheduler/prop/elevation allocation slices and initial
renderer resource boundaries completed 2026-10-03; full frame/backend and raster
scheduling work remain follow-ups.
Owner: [performance](../topics/performance.md).

The report motivating this audit is an occasional phone hitch while walking,
roughly every ten seconds. GC is a hypothesis, not an established diagnosis.
The aim is to reduce avoidable churn and keep a future renderer replacement
possible without moving gameplay into a graphics backend.

## Findings, in recommended implementation order

### 1. Grass cache lifetime and identity are incorrect

At audit time, [`GrassBladeRenderer.ts`](../../src/rendering/GrassBladeRenderer.ts) had a
module-global `Map<string, ChunkBladeCache>` keyed by chunk coordinates. It had
no eviction or world-reset path and checked only `chunk.revision`. Exploration
therefore retained every visited entry, including empty blade arrays; a different
chunk/world at the same coordinates and revision could reuse the previous blades.

A deterministic process-local probe created a full-grass chunk and then a
water-only replacement at coordinate 0,0, both revision 0. Collection returned
338 blades for both. Incrementing the replacement revision returned zero.
This verifies stale identity independently of any performance claim. The
unbounded lifetime follows from inspection; a long-session retained-heap slope
has not yet been measured.

The proposed fix was a cache keyed by chunk identity (a WeakMap is a simple option),
or an explicitly bounded resident map with world/realm epoch and content version.
Do not let a scratch pool keep evicted chunks alive. Test replacement at equal
revision, edits, unloading/revisiting and world switching. Keep generated grass
placement and current draw order unchanged.

### 2. Reuse frame storage and stop rebuilding static metadata

There are direct allocation sites throughout steady rendering:

| Path | Current work | Bounded improvement |
| --- | --- | --- |
| `TileRenderer.prepareTerrain` | New wanted set, jobs array/records, camera record, coordinate strings, and replacement resident record for every loaded halo chunk every frame | Update resident entries in place; reuse jobs/wanted storage or visitation stamps; reconcile membership on range/content changes and refresh camera-dependent priorities separately |
| `collectGrassBladeItems` | Two new `Float64Array`s per collection, output array and one item per visible blade; scans all supplied entities for each blade | Capacity-managed position scratch and item storage; append directly into the frame buffer; profile a local entity spatial query before adding one |
| `collectScene`, `propDepthSurfaces` | New scene/items/interpolated positions; nested `flatMap` arrays and collision bounds for all props before visible actor collection | Retained item arena with active count; cache prop-depth metadata using explicit prop/content invalidation |
| `collectElevationItems` | Scan every visible height grid; allocate base and two draw records per raised tile each frame | Cache static raised-tile descriptors per content version; keep dynamic ordering in the frame list |
| `Camera.worldToScreen`, `Spritesheet.drawTile` | Coordinate/region objects in inner drawing loops | Scalar arithmetic or caller-owned output in measured hot loops |
| `RemoteStateView.entities` | Maps the entire entity array on every getter read when prediction is active | Build a presentation view once per update; preserve player/mount substitution and interpolation lifetimes |
| `RemoteStateView.applyFrame` | Fresh previous-position objects, entity array and extrapolation map each incoming frame | Reuse safe storage, rebuild membership only on baseline/exit changes; retain previous values until interpolation/reconciliation finishes |

For scale, the one-chunk grass probe creates 338 grass item records per
collection: 20,280/second at 60 Hz before other scene objects. This is an
allocation-site count, not measured allocated bytes or proof that every
temporary survives optimization. Simply clearing an array does not reuse its
item objects. Pool per renderer/client, track active length, clear stale
references, and cap/shrink retained capacity after large viewports or transitions.

Interiors also allocate unchanged data: `renderInterior` serializes room state,
rebuilds placements/filter sets and actor closures every render;
`CachedInteriorRenderer.draw` serializes placements to check its cache. Replace
these checks with explicit room/placement revisions in a separate indoor slice.

### 3. Bound raster submission and surface churn separately from JS time

Gameplay calls `prepareTerrain` with a 2 ms CPU deadline and a 128-row ceiling.
The older four-row constant is the fallback in `drawTerrain`; gameplay passes
zero there. A quick series of canvas commands can therefore queue substantially
more raster work than the apparent 2 ms suggests. The phone zoom trace and
two-row diagnostic control in [012](012-streaming-performance-and-local-server-worker.md#zoom-out-trace-diagnosis)
already support this mechanism for zoom; ordinary walking still needs attribution.

`advanceCacheBuild` creates a new 256×256 OffscreenCanvas for each fresh build.
`prepareTerrain` drops surfaces outside its one-chunk halo; crossing back can
rebuild them. Server chunk residency has a larger three-chunk unload margin,
but replication/client render residency does not automatically inherit that
hysteresis. Each surface represents 256 KiB of nominal RGBA pixels; old plus
replacement represents 512 KiB per chunk, excluding browser/GPU overhead.

Keep visible holes first, then visible replacements, then approaching work.
Combine CPU deadline with a conservative submission/work cap and measure
catch-up. Consider a small bounded surface pool and byte-budgeted revisit cache
only after ownership is explicit. Clear reused surfaces/context state; never
recycle a surface still referenced by an old frame or partial replacement.
Pooling allocations alone does not eliminate repainting or GPU upload work.

### 4. Remove chunk serialization intermediates when profiling justifies it

The grids are already flat typed arrays, and updates to existing client chunks
use `.set()` into their existing grids. They are not recreated every frame.
The streaming path does create avoidable intermediates:

`Chunk typed arrays → serializeChunk number[] → binary buffer → readChunkSnapshot
number[] → client Chunk typed arrays`.

The encoder/decoder live in `shared/binaryCodec.ts`; the decoder allocates eight
number arrays per chunk. Start with typed byte views/direct destination copies
where ownership permits. Preserve wire bytes, endianness, unaligned field
handling, ordered deltas and buffer lifetime. Never transfer live authority
arrays or return a transferred buffer to a pool before ownership returns.
Only add a chunk-grid pool if traversal allocation profiles still justify it;
reset every grid, revision, autotile flag and identity on reuse.

Worker channel queues are bounded and `GameClient` stops pumping while decoded
state is pending. Keep this backpressure. Decode and apply each have a 2 ms
budget checked between atomic messages; neither guarantees an entire frame
fits its deadline, especially with several catch-up simulation ticks.

## Renderer replacement boundary

The strongest existing separation is authority versus client: Worker authority,
replicated `ClientStateView`, shared prediction physics, and independent render
collection. Preserve it. The backend seam is incomplete:

- `Chunk` owns `OffscreenCanvas renderCache` and backend dirtiness.
- `ElevationItem` embeds an OffscreenCanvas, so `SceneItem` is not fully backend
  neutral despite its comment. `collectScene` depends on concrete `TileRenderer`.
- `GameContext`, scene rendering, `Spritesheet` and indoor actor callbacks expose
  Canvas2D. A different sprite drawer alone would not replace the whole renderer.
- The Three.js debug view independently reads entities/world; it demonstrates
  reusable state, but is not a second implementation of the production renderer.

Recommended target, introduced incrementally behind the existing Canvas backend:

```text
Worker authority → client replica + prediction
                             ↓ read-only presentation inputs
              frame builder / terrain change feed
                             ↓ reusable frame data + stable resource IDs
                 renderer backend owns resources
                    Canvas2D | future GPU backend
```

Move surfaces/jobs to a renderer-owned terrain resource cache. Identify content
with realm epoch, chunk identity and a visual content version; an edit revision
alone must not miss derived/autotile, atlas or asset changes. Elevation commands
refer to terrain resource IDs/source rectangles, not canvas instances. The
backend resolves those IDs and owns upload, eviction, resize, device/context
loss and teardown. Separate asset metadata (IDs, dimensions, rectangles) from
browser image objects and drawing methods.

Use a small frame contract for camera, terrain layers, ordered sprite/elevation/
grass/particle data, plus explicit editor/overlay phases. Specify frame-buffer
lifetime: synchronous consumption or an acknowledged ring for asynchronous use.
Static chunk data changes on revisions; moving the camera does not rebuild tile
grids. The renderer must not mutate gameplay, decide collisions, or advance AI.
Preserve stable equal-depth ordering, clipping, nearest-neighbor sampling,
shadows, seams, multipart sprites and indoor wall/actor interleaving.

Do not route every individual Canvas call through a generic wrapper. A future
GPU backend should receive batches and retain tile/instance buffers, updating
changed ranges. A future WASM boundary should similarly exchange coarse typed
buffers rather than one JS/Rust call per tile or sprite. WASM changes CPU
execution; choosing WebGPU changes graphics submission. These are separate
decisions and neither inherently fixes a growing cache or excess uploads.

Rust/wgpu remains a viable later implementation: its official
[web documentation](https://wgpu.rs/doc/wgpu/documentation/platforms/web/index.html)
describes WASM targets using WebGPU or a less feature-complete WebGL2 backend.
This does not establish support/performance on the user's phone. A prototype
must measure crossings, copies, startup, memory, device recovery and actual
frame presentation before becoming a migration decision. No Rust dependency or
second engine is needed for the cleanup above.

## Evidence and measurement limits

Audit checkout: `d91ded6c02faae1d755028d12edeea6e0cc17f1a`, dirty with existing
launcher/PWA work. No production code changed for this audit. Bundled full
Chromium 153.0.8010.12, headed, Apple M4 Pro/macOS Darwin 25.6.0, 1280×900,
no CPU throttling, isolated temporary worlds, seed 2026. Raw traces stay local.
The [sanitized benchmark summary](../benchmarks/013-renderer-allocation-audit.json)
retains runner metadata, workload, timing and trace totals for both runs.

The existing runner used 1,200 traced sprint frames per v4/v10 fixture, plus
cold, standing, walk, reverse and zoom samples. At this display cadence the
sprint windows lasted about ten seconds, not twenty.

| Sprint measurement | regional-v4 | regional-v10 |
| --- | ---: | ---: |
| Displacement / distinct visible chunks | 1,472 px / 27 | 1,394 px / 18 |
| rAF interval p95 / maximum | 10.2 / 10.4 ms | 10.0 / 17.4 ms |
| Render callback p95 / maximum | 0.5 / 2.9 ms | 0.6 / 2.7 ms |
| Main-thread MinorGC/MajorGC events | 6 | 8 |
| Largest GC event elapsed time | 3.359 ms | 20.092 ms |
| Missing / unfinished visible terrain frames | 0 / 0 | 0 / 0 |

The v10 major collection used about 19.285 ms of thread CPU. This is a real
allocation/GC investigation lead, not a reproduction of the reported phone
hitch. Neither sprint had rAF intervals over 25 ms. rAF timestamps, callback
arrival and actual displayed frames are different measurements; the existing
analyzer's 25 ms cutoff also misses a dropped 120 Hz frame. Cold entry still
had missing/unfinished frames, consistent with the existing open issue.
Tracing and the benchmark's own arrays/records allocate; neither these GC
counts nor end-of-sample heap size measure production allocation rate.

A second v10 run disabled application metrics (`--no-metrics`) and extended the
traced sprint to 3,600 frames / 30 seconds. It traversed 3,956 px and 38 distinct
visible chunks, with zero movement readiness gaps, interval p95/max 10.1/10.5 ms,
and 21 GC events (largest 5.456 ms). The 20 ms event did not recur. This longer
route ended outside the dense city with one entity and no props, so it is not a
sustained dense-city stress test or a matched instrumentation-overhead control.
Both complete benchmark runs passed `--assert-ready` and had no page errors.

Reproduce with:

```sh
npm run streaming:bench -- --assert-ready --headed \
  --trace-stage=sprint --trace-frames=1200 --output=/tmp/tilefun-performance-audit
node scripts/analyze-streaming-trace.mjs \
  /tmp/tilefun-performance-audit/regional-v10-sprint-trace.json
```

## Proposed delivery and acceptance

1. **Completed:** fix grass cache identity/lifetime with deterministic regression
   coverage and a forced-GC retention probe. A WeakMap cannot enumerate live
   entries; use post-GC heap evidence rather than adding a strong diagnostic
   collection that would itself retain discarded chunks. Multi-minute gameplay
   memory and thermal coverage remain follow-up work.
2. **Partially completed:** gameplay scene-list and grass frame storage reuse.
   Continue with scheduler storage and static prop/elevation metadata, one
   attributable change at a time. Measure allocation sampling separately from
   pacing runs; compare standing, sustained travel and revisits.
3. Extract Canvas terrain resource ownership and backend-neutral elevation
   handles, then frame/backend contracts covering both indoor and outdoor scenes.
   Exercise the same contracts in gameplay, editor, explorer and review tools.
4. Tune submission limits on the affected phone with the same world/viewport,
   normal play first, followed by zoom, cold entry and rapid reversal. Profile
   decode copies next if chunk arrival remains expensive.
5. Prototype GPU batching or a WASM compute kernel only against a measured
   remaining bottleneck or an explicit native-platform requirement.

Phone diagnosis needs a 60–120 second movement capture plus stationary and
revisit controls. Correlate GC, callback arrival, raster/submission, chunk
creation, input acknowledgments and periodic saves; LocalServerRuntime's save
checkpoint is every five seconds in the Worker, not evidence of a ten-second
main-thread save pause. Test thermal/long-session behavior separately. Require
equal displacement, visible terrain readiness, entity workload and viewport.
Measure p99/max and missed refresh deadlines, not just average FPS/p95.

For implementation slices run typechecks, unit tests and lint; render/integration
changes also require build and Playwright, regenerated art/workshop inventories
where applicable, visual parity and `streaming:bench -- --assert-ready` for
streaming/execution changes. New pixels require the existing human art review
process; optimization must not change promoted art or saved generation output.

Audit validation: `npm run typecheck` passed; `npm test` passed all 1,192 tests
in 116 files; `npm run check` exited successfully with 122 existing warnings and
32 informational diagnostics. This delivery changes documentation/evidence only;
no runtime optimization or rendered output changed, so build/Playwright and
art inventory regeneration were not required for this slice.

## Implementation record: grass cache identity and lifetime

The user authorized implementation and direct commits. This first slice changes
only cache ownership/invalidation, leaving frame-buffer reuse and backend
extraction for independently measurable follow-ups.

`GrassBladeRenderer` now uses `WeakMap<Chunk, ChunkBladeCache>`; each value checks
revision and coordinates because placements are world-space. The module-level
cache contains only derived data and adds no strong root to discarded chunks or
their blades. An unloaded chunk still retained elsewhere keeps its valid cache
until that owner releases it; reclamation is GC-driven, not an immediate unload
callback. Existing autotile recomputation increments chunk revision.

Six unit regressions cover equal-revision world separation, unload/replacement,
edit invalidation and stable reuse, unfinished autotiles, coordinate relocation,
and an exact pre-change hash of generated position/variant ordering. The two
replacement regressions failed against the old implementation and all six pass
with the fix. Sway/push math and generated placement were not changed.

The reproducible
[`grass-cache-retention.mjs`](../../scripts/instrumentation/grass-cache-retention.mjs)
probe creates and discards two sequential batches of 1,000 full-grass chunks in
isolated bundled Chromium, forcing GC after each batch. Both implementations
collect 179,761 then 178,903 blades. Old code retains 11,116,380 then 10,992,832
additional heap bytes; the checked-in probe with the fix retains 12,348 then
2,664 bytes. Browser/JIT bookkeeping accounts for some residual changes; this
is retained JS memory for a synthetic workload, not total allocation rate,
GPU memory, phone timing or a production forced-GC policy.

One before/after touch traversal pair on the attached Pixel 7a (Android 17,
Chrome 154.0.8037.57, native portrait viewport) passes `--assert-ready` for both
v4/v10. Walking, sprinting and reversing have zero missing/unfinished visible
terrain in both runs and about 16.8 ms p95 intervals. Occasional 33–50 ms
intervals remain. Cold entry still exposes unfinished terrain. These are smoke
checks, not a statistically controlled performance win; v10 reverse displacement
also differs between runs. Test tabs/worlds use the runner's isolated origin.

A subsequent 3,600-frame / 60-second v4 phone sprint traversed 8,841 px and 72
visible chunks, with no readiness gaps. It recorded two 33.3 ms intervals:

- At 4.79 seconds, the interval overlapped no main-thread GC; the largest
  overlapping GPU-process request was 20.061 ms (19.548 ms thread CPU).
- At 36.85 seconds, the interval overlapped a 32.989 ms main-thread GC event
  inside a 33.283 ms task; the largest GPU-process request was 3.030 ms.

This capture supplies a concrete GC-aligned phone hitch and another raster/
submission lead. It supports reducing frame allocation next, while retaining
the independent raster-scheduling follow-up. Overlap is not proof that all
user-reported hitches have either cause. The route ended with one entity and
no props; tracing adds overhead, and GPU-process request time is not a GPU
hardware counter. The frame interval p95 was 16.7 ms, illustrating why p95 alone
misses these occasional stalls. There were 24 main-thread GC events overall.

[Sanitized validation results](../benchmarks/013-grass-cache-validation.json)
retain the memory probe, phone smoke pair and long trace summary. Raw device
traces remain local. The device was charging (27.2°C before, 28.5°C after;
final thermal status 0). Test tabs, isolated test-origin data and task-owned USB
routes were cleaned up; the final handheld doctor reported ready/unlocked.

Validation: all three typechecks pass; the unit suite reports 1,202 passing tests
and five existing expected failures. Biome passes with the existing 122 warnings
and 32 informational diagnostics. Art catalog regeneration leaves its output
unchanged; Workshop regeneration changes only its source-input digest. The
production build passes. No art source, promoted bank, generator or approved
review reference was modified.

The full browser run passed 242 tests and hit one intermittent v10 streaming
residency assertion; the unchanged streaming tests then passed six serial
repeats. Inspection found that the test sampled the restored simulation camera
against residency prepared for the interpolated render camera: their halo widths
can differ by a column at a chunk edge. The test now measures the last rendered
view and includes range/residency values on failure, preserving the existing
work and residency bounds. All six v4/v10 checks pass again after that correction
(three serial repetitions per fixture). The full suite was not rerun after this
test-only correction; its other 242 tests already passed against the same build.

## Implementation record: grass frame storage reuse

The second slice introduces a backend-independent `SceneFrame` owned by each
`GameClient`. Outdoor and indoor gameplay borrow its scene list for synchronous
drawing and release it afterward, including draw exceptions. World/realm reset
and client teardown clear the frame storage. Existing one-shot collector callers
(including review/explorer callers) keep ownership of their returned records.
This is a small presentation ownership step; Canvas surfaces still live in
chunks/elevation items, and sprite/elevation records still allocate.

`GrassFrameBuffer` keeps position arrays and a separate pool of grass records.
The sorted scene list never reorders the pool. The collector appends grass
directly into that list, overwrites every scalar of reused records and reads
only the active entity count. It retains at most 8,192 grass records and position
buffers for 1,024 entities. Larger workloads draw completely using temporary
overflow storage. After 60 consecutive underused collections, retained capacity
shrinks (floors of 256 grass records / 32 entity positions); frames without grass
release the grass pool immediately. The pool holds no chunk/entity/canvas
references. Diagnostics allocate only when explicitly read and count storage
creation to distinguish warm reuse from retained capacity.

Four additional tests cover fresh-versus-reused output through movement,
shrinking entity lists, culling and edits; warm identity reuse and consumer
isolation; over-capacity output, shrink and clear; and sorted mixed scene parity
with particles/elevation plus release and grass-to-indoor transitions. Existing
placement/order regression coverage remains in place.

The reproducible
[`grass-frame-allocation.mjs`](../../scripts/instrumentation/grass-frame-allocation.mjs)
probe warms 60 collections of nine full-grass chunks with 16 entities, then
samples 600 collections in isolated bundled Chromium 153.0.8010.12. Both versions
collect 1,055,400 items. Sampling with collected objects included estimates
64,292,776 bytes before and 13,455,072 bytes after (about 79% less). The after run
creates only its initial 1,759 grass records and two position buffers, with no
additional creation during the measured warm frames. Exact full-output hashes
at three fixed animation times match the old collector, including positions,
variants, push/sway angles and iteration order. Small metadata/array/iteration
allocations remain; this is not a zero-allocation path. Reusing a JS array object
also does not guarantee reuse of its engine-managed backing storage.

One before/after touch pair on Pixel 7a / Android 17 / Chrome 154.0.8037.57 passes
`--assert-ready` for both v4 and v10 with zero movement readiness gaps and no
page errors. V10 sprint has eight intervals over 25 ms in both runs, and reverse
has fourteen in both; its movement p95 ranges from 16.7 to 22.8 ms. V4 reverse
displacement differs (621 versus 409 px), so fewer slow frames there cannot be
credited to the optimization. No end-to-end FPS improvement is established.
Test tabs, isolated origin data and task-owned USB routes were cleaned up; the
final device doctor reports ready/unlocked.

[Sanitized results](../benchmarks/013-grass-frame-reuse.json) retain allocation
estimates, parity hashes, storage counters and phone movement summaries. Baseline
revision is `f7c8300`; the new implementation was measured in the dirty checkout.
Next slice: reuse terrain-scheduler job/set/resident bookkeeping while preserving
priority and readiness; then address static prop/elevation data and independently
measure raster submission policy. No promoted pixels or generation identities
change in this slice.

Validation: all three typechecks and 1,211 unit tests pass. Biome passes with
the existing 122 warnings / 32 informational diagnostics. Art catalog and
Workshop inventory regeneration plus production build pass; Workshop candidate
metadata is unchanged, with only the input digest updated. The full browser run
passed 248 checks and blocked one standalone Workshop vote because a source API
comment added during validation made its manifest digest stale. After final
inventory regeneration/build, that isolated check passes (1.8 seconds). The full
suite was not repeated after the digest refresh; runtime behavior is unchanged
from the build used by the other 248 passing checks.


## Implementation record: terrain scheduler storage reuse

The third slice keeps one mutable record per resident coordinate. Pending jobs
borrow these records in one renderer-owned array; completed/evicted records are
not retained in a separate pool. An alternating visitation stamp replaces the
per-frame wanted set, and scalar camera history replaces the camera object.
The job list drops references after each preparation, including exceptions;
reset clears resident and partial-build state. An interrupted scan clears
residency so a stale stamp cannot keep a departed chunk on a later pass.

Every frame still scans the loaded camera halo and updates pending state and
camera-dependent distance. Chunk arrivals, unloads, replacement objects, edits,
and direction reversals are detected even when the visible range stays fixed.
Replacement resets pending age and cancels old partial work; continuing work
keeps its age. Priority tiers, distance/tie ordering, the 2 ms CPU deadline,
128-row cap and canvas creation policy are unchanged. The additional diagnostics
count lifetime resident-record creation and current borrowed jobs; after a
preparation the borrowed count is zero. Records remain bounded by the loaded
visible range plus halo, with no evicted-chunk free list.

Five new unit cases cover warm reuse and membership changes at zero budget,
pending age through replacement/edits, reversal and priority tiers, fallback
partial-work cleanup, and drawing-error recovery/reset. Existing row-budget,
deadline, revision restart and residency-bound cases remain in place.

The reproducible
[`terrain-scheduler-allocation.mjs`](../../scripts/instrumentation/terrain-scheduler-allocation.mjs)
probe warms 60 frames across 80 loaded chunks, then samples 3,000 frames in
bundled Chromium 153.0.8010.12. Ready chunks fall from 38,329,772 to 11,014,520
sampled bytes (71% less); all-pending chunks fall from 71,556,060 to 34,643,372
(52% less). Both after scenarios create exactly 80 resident records including
warmup. A separate 20-frame priority probe changes camera direction and old
imagery availability; its complete ordered-job hash matches the baseline.
Sampling includes collected objects and is approximate. A zero row budget
isolates bookkeeping from raster work; coordinate strings, iteration, sort
scratch/comparisons and JS array backing storage can still allocate. These
numbers establish no phone FPS gain or complete hitch fix.

[Sanitized evidence](../benchmarks/013-terrain-scheduler-reuse.json) records the
allocation samples and traversal summaries. Baseline revision is `8a058ca`;
the candidate is that revision plus this scheduler slice. Shared-checkout
vehicle/Workshop edits interrupted the first typecheck/build attempt, so the
final code checks and browser/phone validation use a temporary detached checkout
of that baseline plus only this change. The first desktop traversal used the
shared checkout and passed; its context is recorded separately in the evidence.

Next: cache static prop depth/collision and elevation descriptors with explicit
content invalidation, keeping dynamic depth sorting intact. Raster submission
limits remain a separate measured follow-up; this slice changes no production
work policy or promoted pixels.

The post-change Pixel 7a / Android 17 / Chrome 154.0.8037.57 touch smoke passes
`--assert-ready` on v4 and v10. Walk/sprint/reverse have zero missing or unfinished
visible terrain frames and 16.7–16.8 ms interval p95. There are still individual
intervals over 25 ms (v4: 1/1/6; v10: 1/1/9 for walk/sprint/reverse). Cold entry
has missing/unfinished terrain (v4: 3/18 frames; v10: 3/22), consistent with the
separate cold-entry follow-up. This is one post-change run, with host validation
running concurrently, not a controlled before/after timing experiment. The
runner removed its test tab/origin data; task USB routes were removed and the
final device doctor reported ready/unlocked.

Validation: all three typechecks, 1,221 unit tests, and Biome pass (the existing
122 warnings / 32 informational diagnostics remain). Art catalog and Workshop
manifest regeneration plus production build pass; the isolated inventory changes
only its source digest, with identical candidate metadata. The complete browser
suite passes 256 checks with one existing skip. Desktop and physical-phone
streaming runners both pass `--assert-ready`. No shared vehicle/Workshop source
or candidate changes are included in this slice's commit.


## Implementation record: static prop depth metadata

`SceneFrame` now owns a `PropDepthCache` for gameplay's outdoor and indoor
collection paths. Each cached prop holds scalar geometry snapshots and the same
backend-independent world bounds, top Z and depth values previously rebuilt by
`propDepthSurfaces` every frame. Cache hits reuse those surfaces; collection
borrows one reusable flat output list. One-shot callers retain the fresh helper
and own their results. Physics collision queries and gameplay authority are
unchanged: this caches the collision-derived metadata used for presentation.

Invalidation uses prop object identity plus explicit scalar comparisons of
position, collider offsets, width/height, base Z and height Z. This catches
in-place editor changes without relying on a revision that preview/local callers
do not supply. Compound-wall count/order/content and transitions to/from a
single collider are checked, including empty walls suppressing the fallback.
Irrelevant sprite/passability/walkability fields do not rebuild depth metadata.
The original finite-positive-height rule and array order/duplicates are intact.
Scalar validation still scans current geometry each frame; a prop sync that
replaces objects rebuilds those entries, even at equal geometry.

Every collection removes entries for props no longer supplied; there is no free
list of unloaded props. Reset/teardown clears the map, and a collection error
clears partial state. Ordinary frame release empties borrowed output but retains
current metadata. Entries and collider snapshots are bounded by the latest
supplied prop population/geometry, not a fixed prop count or all historically
visited chunks. Replacement same-ID props cannot reuse old-world metadata.
Actor/ghost interpolation, overlap checks and final scene sorting remain dynamic.

Four new tests cover warm surface reuse and independent fresh output; all scalar
edits, wall changes and finite/infinite/undefined heights; order, duplicates,
unload/revisit and same-ID replacements; and full scene/ghost parity across
movement, edits, hidden interior furniture and realm reset. Existing long-bed,
raised-base, edge-overlap and mixed scene tests continue to cover the depth rule.

[`prop-depth-allocation.mjs`](../../scripts/instrumentation/prop-depth-allocation.mjs)
compares the unchanged fresh helper (`--fresh`) with the cache, using 400 props
with two finite surfaces and one infinite wall each. After 60 warmup collections,
600 sampled collections return 480,000 surfaces in both modes. Bundled Chromium
153.0.8010.12 estimates 81,021,888 fresh versus 12,360,748 cached allocated bytes
(about 85% less), including objects collected during sampling. The cache creates
400 entries and 800 surfaces during warmup and none during the measured steady
frames. Eight exact output/depth hashes match through position/width/height edits
and reversed ordering. Five unprofiled batches of 600 collections take
25.0–28.4 ms fresh and 8.4–8.9 ms cached on this host. Sampling is approximate;
these synthetic measurements exclude rendering, streaming and simulation and
do not establish a phone FPS improvement. List backing storage and iteration
still allocate. [Sanitized evidence](../benchmarks/013-prop-depth-cache.json)
records the results and base revision.

Validation uses an isolated checkout of `3e4a8e0` plus this slice because the
shared checkout has concurrent character/Workshop edits. The Android doctor
reported no attached authorized physical handheld (and its unavailable-device
reporting path raised an unrelated error), so this slice has no phone capture.
Next: cache static elevation descriptors per chunk/content version, preserving
live surface ownership and depth ordering; then revisit remaining scene records
and measured raster submission limits separately.

The isolated desktop v4/v10 traversal passes `--assert-ready`, with no page
errors or missing/unfinished visible terrain during walk/sprint/reverse and
16.7–16.8 ms frame-interval p95. Cold-entry gaps remain (v4: 0 missing/3 unfinished
frames; v10: 3 missing/2 unfinished). This is a readiness smoke with other host
validation running concurrently, not a paired end-to-end timing experiment.

Validation: all three typechecks, 1,238 unit tests, and Biome pass. The full lint
run retains 123 warnings / 32 informational diagnostics; all files changed by this
slice pass without diagnostics. Art catalog, Workshop manifest and production
build pass, with identical review candidates and only a changed input digest.
The complete browser suite passes 268 checks with one existing skip. Desktop
streaming passes `--assert-ready`; physical Android was unavailable as noted above.


## Implementation record: renderer resource boundaries

The [rendering architecture topic](../topics/rendering-architecture.md) now owns
the target shape and current contracts. This series records the target, extracts
Canvas terrain ownership from world chunks, replaces elevation canvases with
opaque handles, and caches backend-independent elevation geometry. `Chunk` has
local visual-content versions rather than renderer-written dirty state. Asset
changes invalidate each backend independently; old completed imagery remains
available while replacements prepare. Readiness probes and explorer lifecycle
use renderer APIs. The preparation deadline and row cap are unchanged.

Resource handles are never recycled across renderer instances or resets during
the runtime. Rebuild/eviction retires the old image mapping; stale handles skip
rather than drawing another chunk. `collectScene` consumes `TerrainPresentation`
instead of importing concrete `TileRenderer`. The complete backend/frame and
asset metadata interfaces, Canvas access in `GameContext`, and indoor draw
callbacks remain follow-ups; this is not a complete renderer swap or Rust port.

The independent `ElevationDescriptorCache` keeps weak chunk keys and immutable
scalar layout records. Content versions and placement invalidate geometry; a
changed image handle only rebinds output records. It caches empty chunks too and
never retains canvas objects. Four dedicated layout cases cover warm reuse,
source rectangles/depth order, edits/replacement/placement/reset, empty/missing
chunks and imagery rebinding. Terrain ownership tests cover independent
renderers, local-version restart, asset changes mid-build and fallback eviction.
Two handle cases cover actual Canvas source resolution and stale/cross-renderer
identity safety.

The reproducible
[`elevation-allocation.mjs`](../../scripts/instrumentation/elevation-allocation.mjs)
probe warms 60 collections of nine chunks with 192 raised tiles per chunk, then
samples 600 collections in bundled Chromium 153.0.8010.12. Both paths collect
2,073,600 items. Sampled allocations fall from 222,895,820 to 45,961,768 bytes
(about 79%). The new path builds nine layouts, 3,456 descriptors and 3,456 bound
items during warmup, with no additional creation in the steady measured frames.
Five full-geometry hashes match across unchanged content, edits, imagery
replacement, eviction and same-coordinate chunk replacement; every emitted handle
also resolves in the probe. The output list still allocates, and these estimates
exclude raster, simulation and frame presentation. No FPS gain is established.
[Sanitized results](../benchmarks/013-elevation-descriptor-cache.json) preserve
samples and traversal evidence. Baseline for the descriptor comparison is
`c471375`, after resource ownership/handle extraction.

Post-extraction desktop v4/v10 traversal passes `--assert-ready`, with no page
errors and zero missing/unfinished visible terrain during walking, sprinting or
reversal. Movement interval p95 is 16.7–16.8 ms in this smoke run. Cold entry still
has gaps (v4: 0 missing/3 unfinished frames; v10: 2 missing/2 unfinished). Host
validation ran concurrently, so this is a readiness check, not an end-to-end
before/after timing comparison. No physical-phone claim is made for this series.
The updated scheduler probe also reproduces the previously recorded complete
priority-order hash after resource ownership extraction; no scheduling-policy
change is hidden in this refactor.


Final integrated validation: all three typechecks, 1,328 unit tests, lint and
production build pass. Lint retains 123 existing warnings / 32 informational
diagnostics. Catalog and Workshop manifest regeneration pass; the final candidate
list and fingerprints match the pre-series inventory, with only input digests
changing. The full browser suite passes all 282 tests, including normal Chromium
review parity, explorer readiness, indoor ordering, traffic and realm transitions.
The desktop streaming runner passes `--assert-ready`. No promotion bank, saved
generator identity or approval record is changed.
