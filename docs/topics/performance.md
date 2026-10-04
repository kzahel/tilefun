# Streaming and gameplay performance

Topic: performance
Status: shared Worker authority and terrain preparation implemented; physical
Android traversal validated; renderer/allocation audit complete; grass cache
identity/lifetime fixed, gameplay grass frame storage and terrain scheduler records
reused; static prop depth and elevation metadata cached; Canvas terrain resources
removed from world chunks; neutral frame/backend separation delivered, with raster
scheduling and cold-entry presentation remaining as separate performance work.
Updated: 2026-10-04.

Owns current performance direction and the limits of the evidence.
[Rendering architecture](rendering-architecture.md) owns the desired backend
boundaries and incremental decoupling sequence. Detailed
captures and execution history live in
[Tactical 012](../tactical/012-streaming-performance-and-local-server-worker.md).
The [renderer/allocation audit](../tactical/013-renderer-boundary-and-allocation-audit.md)
owns the 2026-10-03 walking-hitch investigation, concrete allocation sites and
proposed renderer boundary. Its implementation record tracks completed slices;
the remaining recommendations are not implemented fixes.

## Current state and contracts

- Single player runs the shared server in a dedicated browser Worker.
  `src/server/LocalServerRuntime.ts` owns lifecycle; ordered, bounded
  `src/transport/WorkerClientTransport.ts` carries replicated state. Prediction
  and rendering stay on the main thread. P2P hosting still runs its authority
  on the main thread; dedicated hosts reuse the same server implementation.
- Terrain cache preparation runs ahead of the camera. Measure both visible
  readiness and frame pacing. Explicit progressive presentation may accept gaps
  to preserve responsiveness; report gap duration, backlog and catch-up alongside
  timing. Ordinary readiness and progressive-presentation gates are separate.
- Gameplay rooms cache native floor/wall layers per active room/plan. Furniture
  edits and actor depth remain live. See [Tactical 009](../tactical/009-city-places-and-indoor-performance.md)
  for cache parity and [011](../tactical/011-shared-pattern-brushes-and-room-drawing.md)
  for edited-room behavior.
- Keep benchmark overrides separate from production policies. WASM is conditional
  on measured compute need or an explicit native/browser sharing requirement.
- Grass placements are weakly cached by chunk object, revision and coordinates.
  The cache cannot retain discarded chunks or reuse another world's equal-revision
  chunk. Generated placement, animation and ordering stay unchanged.
- Each gameplay client owns a backend-independent `SceneFrame`: its sorted list
  and pooled grass records are borrowed for synchronous drawing. Release the
  list after drawing and clear storage on realm changes/teardown. Grass pools
  have retention caps and shrink after sustained underuse; excess still renders.
- Terrain preparation updates resident records in place and borrows them in a
  reusable job list. Visitation stamps replace the per-frame membership set.
  Membership and priorities still refresh every frame, including zero-work-budget
  frames; departing chunks and reset/error paths release references and surfaces.
  Visible holes, visible replacements and approaching halo work keep their order,
  under the selected shared policy: default 2 ms/128 rows, or experimental
  small batches at 2 ms/2 rows including visible holes. Visibility affects priority,
  never bypasses the cap. Old complete surfaces survive replacement builds.

- Each `SceneFrame` owns a prop depth cache. Object identity and scalar position/
  collider comparisons invalidate changed entries, including in-place edits.
  Each collection evicts props no longer supplied; realm reset/teardown clears
  all entries. The cache stores backend-independent bounds and height/depth data,
  and dynamic actor/ghost sorting still runs every frame. One-shot collectors
  retain their existing independent output ownership.

## Evidence and validation

Use the repository runners with isolated bundled Chromium before manual UI work:

```sh
npm run streaming:bench -- --assert-ready
npm run interiors:bench -- --headed
npm run gameplay:bench -- --headed
npm run gameplay:bench -- --headed --edited-room
```

Tactical 012 owns exact scenario definitions, measurement limits, CPU throttling,
physical-device `--cdp`/`--touch` setup and trace analysis commands. Its recorded
desktop v4/v10 ordinary traversal has no missing/unfinished visible chunks and
about 16.7–16.8 ms frame p95. Three Pixel 7a touch traversals per fixture have no
movement gaps and about 16.8 ms movement frame p95. These are device/scenario
measurements, not universal timing gates.

Phone v4 zoom-out measured 33.3 ms p95; v10 measured 16.8 ms. Deferred cache raster
work explains the v4 stalls. A benchmark-only two-row limit after zoom restored
16.8 ms p95 while completing caches. Cold entry still showed unfinished-cache
frames. The room cache checks recorded exact pixel parity and responsive
ordinary/edited-room movement, but steady-state captures do not exclude initial
upload costs or device-specific problems.

## Next work

[Entity activation, AI and unloading](entity-activation.md) owns the separate
simulation-debt backlog: tick tiers do not eliminate all distant-entity work,
and placed entities remain resident after terrain unloads. Its source audit
does not establish the cause of observed frame hitches; measure dense local
scenes and distant populations separately before selecting fixes.

The grass-fix follow-up captured a 60-second Pixel 7a traversal with no visible
terrain gaps and two missed frames: one overlapping a 33 ms main-thread GC,
another overlapping about 20 ms of GPU-process work with no main-thread GC.
[Tactical 013](../tactical/013-renderer-boundary-and-allocation-audit.md#implementation-record-grass-cache-identity-and-lifetime)
owns the evidence and tracing/workload limits. Both allocation reduction and
raster scheduling remain justified; this is not a universal hitch diagnosis.

Grass position/item storage now reuses warm buffers. A fixed 600-frame synthetic
workload reduced sampled allocations from 64.3 MB to 13.5 MB (about 79%) with
identical grass output; this excludes rendering and is not a phone FPS claim.
Terrain scheduler bookkeeping now also reuses storage: an 80-chunk synthetic
probe reduced sampled allocations about 71% for ready chunks and 52% for pending
chunks, with identical job ordering. Coordinate strings, iteration and sorting
still allocate; these measurements exclude raster work.
Static prop depth metadata now reuses unchanged surfaces. A 400-prop synthetic
probe reduced sampled collection allocations from 81.0 MB to 12.4 MB (about 85%)
with identical metadata/depth hashes through edits. This excludes drawing and
simulation; scalar validation, output-list backing storage and iteration remain.
Elevation geometry now caches unchanged chunk descriptors and refers to backend
resource IDs. The synthetic nine-chunk sample reduced collection allocations
from 222.9 MB to 46.0 MB (about 79%) with identical geometry; output lists still
allocate. See [rendering architecture](rendering-architecture.md) for the completed
resource ownership, handles and completed frame/backend interface.
Continue with remaining scene allocations and measured raster submission. The grass cache lifetime
fix is complete; a synthetic post-GC probe verifies that discarded chunk placements no
longer accumulate. Phone traversal still has occasional missed frames, so this
does not resolve the reported hitch. Canvas resources now live in renderer-owned caches and elevation items carry
opaque handles. The complete frame/backend interface and asset metadata are separated; indoor
actor callbacks are replaced by ordered data. The audit records a reproducible stale-grass case and desktop
GC events; attribution of the user's intermittent phone hitch remains open.

Bound offscreen preparation work while keeping missing visible terrain first.
Validate movement, wide viewports, edits and cache catch-up before choosing a
production policy. Improve cold-entry presentation and broaden lower-end phone,
iOS and thermal coverage before setting timing gates. P2P can adopt the host
boundary when needed; moving authority again would not fix measured raster work.


## Renderer decoupling completion evidence

[Parent 022](../tactical/022-renderer-backend-decoupling.md) and
[final evidence](../benchmarks/034-renderer-completion.json) record the completed
boundary and integration checks. Shared terrain placement removes per-frame
coordinate/projection objects and a visibility set from the no-preparation path.
The matched 3,000-frame/27,000-placement sample fell from 4.53 MB to 1.69 MB;
geometry hashes match. This is sampled CPU allocation, not an FPS claim.
Elevation descriptor counts/hashes and scheduler order/record counts remain
unchanged; their allocation totals are close to the pre-series baseline.

Final Pixel 7a touch traversal covers v4, v10 and current v11: zero missing-data
or incomplete-cache frames in walking, sprinting, reversal and zoom-out. Movement
frame p95 is 16.7–16.8 ms. Cold entry retains 22–24 unfinished-cache frames and
0–3 missing-data frames. Ordinary and edited rooms both show 16.7 ms frame p95;
touch movement advances 12.8 pixels, and return to the street succeeds. No page
errors occurred. The phone was charging, about 30.5–30.8°C during traversal,
thermal status 0 afterward. This short run does not establish sustained thermal,
lower-end device or iOS performance, and does not close the intermittent-hitch issue.


## Optional GPU renderer comparison

[045](../tactical/045-gpu-measurement-decision.md) and its
[measurements](../benchmarks/045-gpu-comparison.json) compare the same traversal
with Canvas and optional WebGL2. All six runs pass movement terrain readiness.
On Pixel 7a, Canvas records 0/3 movement frames over 25 ms in two runs versus
GPU 19/13; desktop GPU submission also costs more CPU in movement. Canvas remains
the default. Warm standing uploads no new GPU page textures, but traversal staging,
texture uploads and draw submission need profiling before adoption. Live-heap
snapshots do not attribute allocation churn or close the intermittent-hitch issue.
The car also renders in native WebGPU, but this is an asset probe, not a complete
WebGPU game backend or proof that it will be faster.

## Traffic workshop cache churn

Investigation on 2026-10-04 against the live GPU + meshes Traffic playground
identified competing preparation policies in `TrafficPage`: budgeted surrounding
terrain preparation followed by visible-only preparation. The latter retains only
visible coordinates, discarding offscreen resources and partial builds prepared
by the former. The stationary scene repeatedly rebuilds unchanged terrain.

An isolated bundled full Chromium run (headless, Apple M4 Pro via ANGLE Metal,
1440 × 1000 browser viewport, 960 × 600 lab canvas) temporarily bypassed
`TileRenderer.prepareVisibleTerrain` in the page, then restored it. Each condition
had four seconds of settling and eight seconds of sampling, with meshes enabled:

| Condition | Mean frame rate | Median frame callback | Pending terrain jobs at sample end |
| --- | ---: | ---: | ---: |
| Original | 31.8 FPS | 4.4 ms | 8 |
| Bypass second pass | 60.0 FPS | 0.3 ms | 0 |
| Restore original | 37.6 FPS | 4.3 ms | 8 |

Prepared rows in the final sampled frame fell from 105 to zero and returned to
100 after restoration. This is a diagnostic browser intervention, not a shipped
fix, automated timing gate or proof of mobile/moving-camera performance. No raw
trace was retained. The browser was closed and repository runtime code unchanged.
Separate profiles showed terrain drawing dominating active main-thread work in
Canvas, GPU sprites and GPU + meshes; this issue is not specific to mesh drawing.

[Embedded engine labs](embedded-engine-labs.md) owns the resulting alignment
constraint and follow-up to consolidate lab presentation with the game.

The repository fix removes the visible-only pass and uses gameplay's default
2 ms/128-row scheduler budget. On-demand lab diagnostics expose residency, pending
work and prepared rows without collecting metrics each frame. Browser regressions
exercise Canvas, GPU sprites and GPU + meshes through the real scenario Worker:
each scene must settle with no pending builds or prepared rows for 60 consecutive
frames, retain stable residency/surface bytes, ride over 100 world pixels, settle
after pause and reset, and exit without page errors. Timing remains separate from
these behavioral assertions. Interpolation/camera-follow alignment was subsequently
delivered through the [embedded presentation host](../tactical/048-embedded-presentation-host.md);
its topic owns remaining lab migrations.
The reset coverage also reproduced an existing GPU failure: disposal loses the
WebGL context, but the lab reused that canvas. Reset now creates a fresh canvas
and removes diagnostics/readiness from the retired element.

Validation: typechecks, 1,444 unit tests, lint (existing warnings), catalog/manifest
verification and production build pass. All 299 existing browser cases passed in
the full run; after correcting the startup-settling assertion and GPU reset, all
17 traffic/GPU checks passed, including the three new renderer-mode regressions.
The isolated current-generator `streaming:bench -- --assert-ready` run passes with
zero missing-data or incomplete-cache frames across cold entry, standing, walking,
sprinting, reversal and zoom-out. This is desktop evidence, not a new phone claim.


## Longer GPU stutter investigation

[046](../tactical/046-gpu-stutter-investigation.md) records sixteen desktop/Pixel
runs and [sanitized trace evidence](../benchmarks/046-gpu-stutters.json). Ordinary
long phone sprints became blocked, so sustained rendering/streaming comparisons
use explicit noclip and record actual distance/stationary time. Desktop movement
is clean at roughly 120 Hz. Pixel continuous one-minute controls record 5 missed
intervals for Canvas and 18 for GPU sprites, with no visible terrain gaps.

Recorded hitches include a 42.3 ms main-thread GC event in the Canvas trace and
14–21 ms GPU-process raster requests in the GPU trace. Tracing perturbs timing and
allocation; neither observation attributes every ordinary-play hitch. A reversible
GPU terrain-budget test gives 20 → 6 → 23 missed intervals for default → two rows
→ default, while keeping movement ready. The two-row limit also raises initial
unfinished-cache frames from 9–10 to 26, so no blanket production cap is adopted.

Next: bound background/offscreen raster work through the shared preparation owner,
retain urgency for visible terrain, and validate entry/movement plus affected labs.
The Traffic lab's conflicting preparation policies were fixed separately; see above.
Production renderer behavior and Canvas default are unchanged by this investigation.


## Explicit terrain pacing and zoom workloads

[047](../tactical/047-terrain-pacing-and-zoom-stress.md) adds shared settings in
`PresentationSettings.ts`. **Debug → Terrain pacing → Small batches** permits
visible presentation debt: at most two terrain rows per preparation call under
an admission deadline of 2 ms. Completed chunks publish together, avoiding repeated
GPU texture uploads of partial builds. Existing complete terrain remains visible
until a replacement is complete. **Faster fill** retains the existing 128-row cap
and partial-chunk display. Canvas remains the default renderer; faster fill remains
the default policy. Settings are per view/session and survive live renderer swaps.

Play-mode shortcuts and **Debug → Zoom preset** share the same definitions:
**0 = 0.1× overview, 1 = ¼×, 2 = ½×, 3 = 1×, 4 = 2×**. The slider still allows
custom values. Observer mode is separate: leave it off for view-distance stress,
since it intentionally requests only the 1× world region. Traffic exposes the
same zoom presets and terrain policy, retaining its ¾× initial camera.

Use `--terrain-pacing=responsive --zoom-sweep --assert-bounded` with
`streaming:bench` to exercise ½× → ¼× → 0.1× → 1×. Each zoom allows up to
`--catchup-frames=7200` to reach 60 consecutive frames with complete visible
terrain and no pending/raster work, followed by a 120-frame warm sample. The
runner reports missing data separately from absent complete surfaces and stale
replacement surfaces, first visible-ready frame, catch-up time, prepared rows,
pending jobs and requested GPU upload bytes. The bounded gate enforces the row
cap, catch-up and warm-cache reuse; it deliberately does not require zero
transient gaps. `--assert-ready` remains the strict ordinary movement gate.

This bounds terrain raster submission, not the whole frame. Membership scans,
collection, entity counts, uploads and driver execution can still grow with the
view. A row is indivisible, so time deadlines may overshoot. Next boundaries are
separate GPU upload admission, persistent work queues and measured detail/LOD
policy if the warm overview itself exceeds the frame budget. Moving compilation
to another thread would not remove these costs.


047 evidence: one sequential Pixel GPU pair reduces missed intervals during
3,600-frame noclip sprints from 20 to 1, with no movement terrain gaps. Small
batches reduce overview catch-up frame p95 from 33.4 to 16.8 ms, but full terrain
quiescence (including halo and a 60-frame quiet window) takes 12.45 s versus
2.37 s; visible terrain also fills later. Requested overview upload falls from
19.0 to 10.75 MiB. This supports an explicit trade-off, not a default change.
Both policies settle with zero terrain rebuilding and texture uploads. Desktop
0.1× warm rendering still takes ~11 ms p95 and misses the ~120 Hz cadence despite
that reuse, so the next profiling target is shared collection/submission in the
warm overview. See 047 for device, workload, debt and measurement limits.


## Reusable renderer matrix

[049](../tactical/049-renderer-performance-matrix.md) owns the repeated device ×
renderer × pacing comparison. `npm run streaming:matrix -- --help` describes the
committed sequential runner. It supports desktop/phone, Canvas/GPU, both pacing
policies, reversed repeat order, source-checked resume and sanitized JSON/Markdown
reports. The default matrix is desktop only; explicitly include phone after
setting up the dedicated CDP endpoint and reverse port.

```sh
npm run streaming:matrix -- --targets=desktop,phone --cdp=http://127.0.0.1:9223 --port=4188 --device=Pixel-7a --output=/tmp/tilefun-matrix
```

The new single-run `streaming:bench -- --zoom-motion --noclip` workload starts a
fresh seeded world per zoom (1, 0.5, 0.25, 0.1, 2). Each measures entry catch-up,
stationary rendering, an 8-second sprint, recovery and warm reuse. Idle-page rAF
calibration precedes game load; `framesOverDisplayCadence` detects sustained slow
views that a per-stage median could normalize away. Existing cadence statistics
remain for historical comparisons. Start/end position and actual travel remain
visible; wall-time runs do not claim identical simulation trajectories.

Use `--movement-seconds`, `--settle-seconds`, `--warm-seconds`, `--zooms` and
`--repeats` for workload selection. `--resume` skips completed runs only when
settings and executable-input fingerprints match; interrupted entries rerun.
Use `--retry-failed` to rerun completed failures. Reports retain timeouts/missing
motion/page errors and the runner exits nonzero if any configuration fails.
Eight-second stages are broad coverage; use longer runs for infrequent hitches.
Raw per-run reports/logs can contain local world IDs; only `matrix.json` and
`comparison.md` use the sanitizer. Development serving, viewport differences,
post-ready entry and benchmark instrumentation remain explicit measurement limits.


049 completed evidence: [all 80 cases](../benchmarks/049-renderer-matrix.md)
cover both devices, both renderers, both policies, all five zooms and two repeats.
76 passed; Canvas small batches at 0.1× failed the 30-second entry/recovery gate
on both devices in both repeats. There were no page errors or row-cap violations.
GPU small batches allowed transient overview terrain gaps and then recovered.

With faster fill, 0.1× motion frame p95 was 50.4–51.1 ms Canvas versus 17.1 ms
GPU on Mac, and 66.7–99.9 ms Canvas versus 33.4–33.5 ms GPU on Pixel. Ordinary
zooms were much closer; GPU is not an across-the-board ordinary-play win. A
two-row preparation cap barely changes the expensive overview's frame p95 and
does not universally improve Canvas. The Pixel warmed from 26.6°C / thermal
status 0 to 35.9°C / status 1 while charging, without cooldown; later repeats
cannot isolate renderer effects from heat/order effects. Keep defaults unchanged.

Successful cases reached zero warm terrain rebuilding, but both Pixel GPU
small-batch overview samples still requested 2,064,384 texture-upload bytes in
two seconds. 052 attributes the reproduced uploads to three vehicle sprite
page allocations, with no terrain revision uploads or evictions during the
sample. Recurring overview collection/draw costs remain the main profiling thread. See 049 for
complete conditions, gates and measurement limits.


[052](../tactical/052-overview-draw-and-upload-profile.md) investigated those
costs and delivered the GPU dimension-cache fix. `streaming:bench -- --zoom-motion --zooms=0.1 --noclip
--profile-stage=recovery-warm` adds inclusive pass timings, GPU upload-source
attribution and a sampled CPU summary to that stage. Raw `.cpuprofile` files stay
local. Profiling changes timing; use separate runs for before/after comparison.

Physical-device runs can supply `--android-device-cli=/path/to/android-device`
(the machine-control Android adapter) and `--max-battery-c=29`. Before each fresh
world, the runner waits on the idle tools page until battery temperature is at or
below the threshold **and** thermal status is zero, with a bounded
`--cooldown-timeout-seconds=600`. It records before/after readings. Missing sensor
readings fail closed. This controls entry conditions, not temperature throughout
the run; keep charging state, workload and durations matched. The single runner
owns these optional flags; matrix-level forwarding is not implemented yet.


For a matched GPU counterfactual, `streaming:bench -- --renderer=gpu
--uncached-image-sizes` disables only the new dimension cache in that run's
isolated Vite transform. It uses the existing dynamic-source size lookup and
records `diagnosticUncachedImageSizes`; it never changes production source or
settings. Pair with identical movement/zoom/thermal flags. The transform fails
closed if its source branch changes. Sanitized summaries retain this control
marker and allowlisted before/after thermal readings.


The GPU adapter now reads decoded `ImageBitmap`/HTML-image dimensions once per
synchronous frame, instead of once per sprite/grass draw. Mutable canvases keep
live dimension reads; the weak cache resets with graphics resources and does not
retain unloaded sources. All game and lab GPU consumers share this adapter.
Canvas remains unchanged after its transform experiment failed to show a
consistent gain. The [completed comparison](../benchmarks/052-overview-comparison.md)
contains 18 passing zoom cases and explicitly records two unmeasured phone cases.
Matched Mac overview render CPU p95 improved from 11.6 to 10.0 ms, with calibrated
missed intervals falling from 534/1,864 to 217/2,183. Pixel samples show 14.0–14.8
ms uncached versus 11.3 ms cached, but frame p95 stays around 33 ms and end thermal
status differs. A one-minute Mac sprint had zero missed intervals or terrain gaps.
The extra Pixel overview repeat hit the 600-second cooldown deadline; its planned
one-minute sprint was canceled before measurement. Resume those cases on a cooled
phone, retaining the <=31°C/status-zero entry gate.

[055](../tactical/055-overview-frame-reuse.md) delivered overview frame reuse.
The shared grass pool now retains up to 65,536 scalar records on demand (formerly
8,192), with the same sustained-underuse shrink and realm/host teardown. A fixed
21,394-blade allocation probe reduces warm record creation from 1.58 million to
zero over 120 frames, with identical output hashes. Estimated pool retention is
1.14 MB versus 0.45 MB for that fixture; sampled allocations fall about 73% but
are not eliminated. This is allocation evidence, not a measured FPS claim.

The GPU raster adapter now submits four vertices with a persistent index buffer
per quad, preserving the original triangle order. Requested dynamic vertex data
is 128 bytes/quad versus 192, with the same batching and shader. Game and embedded
GPU consumers share it. Full-Chromium parity and multi-batch upload accounting
pass; this byte reduction is not a physical bandwidth measurement or FPS claim.


The [055 comparison](../benchmarks/055-frame-reuse-comparison.md) records 15
passing cases. Mac GPU overview render CPU p95 falls from 10.1 to 8.5 ms in two
final runs; slow intervals fall from 274/2,125 to 25/2,374 and 27/2,372. Dynamic
vertex requests fall from 5.78 to 3.85 MiB/frame. Canvas overview stays near
50 ms frame p95: its native submission bottleneck remains. Pixel GPU render CPU
p95 falls from 10.4 to 9.9 ms in two observations, with fewer slow intervals;
frame p95 varies between 16.8 and 33.3 ms after the change. Do not describe this
as a stutter cure. All phone starts/ends were thermal status zero, 28.5–30.5°C;
run order/temperature still vary. Current code also completes the one-minute
1× Pixel sprint: 8,834px, no terrain gaps, 18 slow intervals / 3,583 samples.
This supplies current long-run evidence without rewriting 052's unmeasured cases.


Next: measure cached grass depth order plus a stable merge with live scene items
in the shared collector. The post-change five-second GPU profile still attributes
1,218 ms to `collectScene` and 725 ms to its anonymous callbacks (including sort),
versus 303 ms to quad generation and 27 ms to GC. Inlining and instrumentation
limit attribution. Preserve equal-depth order, viewport/chunk invalidation and
independent host lifetimes, and retain the change only if comparison beats the
native sort. Keep Canvas drawing cost as a separate thread and renderer/pacing
defaults unchanged. [055](../tactical/055-overview-frame-reuse.md) records full
validation, memory tradeoffs, the new profile and measurement limits.
