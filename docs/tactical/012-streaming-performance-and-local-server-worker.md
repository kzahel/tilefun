# Streaming performance and single player server worker

Status: implemented, 2026-10-03. The baseline, Worker authority and terrain
preparation shipped in separate commits, retaining the shared server model.

The player sometimes sees blank terrain while walking. The agreed starting
point is a repeatable performance baseline that measures terrain readiness as
well as frame pacing. The architectural follow-up moves the existing
single-player server into a dedicated browser Worker, keeping authoritative
simulation and generation off the render thread, with parity and lifecycle
checks. A WASM core remains conditional on measured need; these results do not
justify introducing it.

## Observed behavior and exploratory baseline

Before this implementation, inspection found two independent stages: chunk data
generation and construction of the chunk's Canvas2D render cache. In ordinary single-player gameplay both
execute on the browser main thread. The data loader includes a one-chunk halo,
but `TileRenderer.drawTerrain` starts cache construction only for chunks that
reach the viewport. Its global budget is four tile rows per rendered frame;
each chunk has sixteen rows. Fresh chunks display partially built canvases.
Multiple chunks compete in viewport scan order. An existing completed cache
can remain visible while its replacement is built.

The server also uses count limits: four chunk loads and two autotile chunks per
update, with an unlimited initial warm load. These are work-count bounds, not
elapsed-time guarantees. Generation, autotiling, placement reconciliation,
replication, cache preparation, and drawing need separate cost attribution.

On 2026-10-03, `npm run generation:bench` and `npm run gameplay:bench` completed.
The existing gameplay benchmark used isolated bundled headless Chromium,
a 1280 by 900 viewport, and the Vite development server. Stationary outdoor
render callback median/p95 was 1.9/4.5 ms; indoor was 0.5/2.0 ms. Both frame
interval median/p95 values were approximately 16.7/16.8 ms. The indoor movement
and return checks passed, with no page errors.

A temporary extension of the gameplay benchmark used the same regional-v10,
seed-2026 office arrival, then held Shift and ArrowLeft for 300 animation
frames after a 300-frame stationary sample. It inspected screen-intersecting
chunks after each render callback, distinguishing absent data from loaded
chunks without a completed render cache.

| Measurement | Movement sample |
|---|---:|
| Animation frames | 300 |
| Horizontal displacement | -738.6 world pixels |
| Frames with missing visible chunk data | 0 |
| Frames with unfinished visible chunk caches | 17 |
| Maximum simultaneous unfinished visible caches | 2 |
| Render callback median / p95 | 1.5 / 3.2 ms |
| Frame interval median / p95 | 16.7 / 16.7 ms |
| Page errors | 0 |

This establishes a useful hypothesis: incomplete presentation can coexist with
smooth frame pacing even when visible chunk data is present. It is not an
exact blank-pixel measurement, a GPU timing result, or an acceptance baseline.
Unfinished rows may be outside the visible portion of a chunk. The stationary
sample included initial cache warmup. One earlier probe was interrupted by a
development-page reload; the table is the subsequent completed run. The probe
was temporary and the checkout was not pinned against concurrent development.
Capture reproducible revision/browser/device metadata in the permanent harness
before using these numbers for regression decisions.

## Starting foundations and testing gaps

- Before this implementation, `main.ts` already created `GameClient` in
  serialized mode with no server reference. `SerializingTransport` binary-encodes and decodes each message,
  then invokes the other endpoint synchronously on the same thread.
- `GameServer` coordinates realms and connections. `Realm` owns authority,
  simulation, generation, edits, and saves. `RealmReplicator` owns client deltas.
- `RemoteStateView`, prediction, request correlation, and network transports
  already provide a client replica boundary. Preserve shared movement rules
  and prediction on the client for responsive input.
- World persistence uses injected store/registry interfaces. Browser defaults
  use IndexedDB. Audit their complete dependency graph and startup paths in a
  real Worker rather than assuming Node compatibility proves Worker support.
- The explorer and world map already use a generation Worker; live gameplay
  does not use that Worker for authoritative generation.
- CI runs typechecks, unit tests, build and browser tests. The current gameplay
  benchmark mainly measures stationary scenes; the generation benchmark covers
  regional-v1 through v3. TileRenderer unit tests cover water-frame selection,
  not progressive cache scheduling. Movement smoke tests do not enforce
  streaming coverage and frame-time requirements together.

## Delivery sequence

### 1 Establish a reproducible traversal baseline

Create a bounded runner using bundled test Chromium and ephemeral test worlds.
Pin seed, generator revision, arrival, viewport, scale, movement sequence, and
sample windows. Record commit, dirty state, browser, OS/device, headed/headless
mode and any CPU throttling. Require actual displacement and visited chunk
counts so a blocked character cannot produce a misleadingly cheap result.

Cover cold entry, settled standing, walking/sprinting into new terrain,
reversal/revisit, zoom changes and interior entry/return. Exercise the current
default generator as well as the v10 dense-city fixture. Keep startup, warm
rendering and streaming measurements separate. Later add a physical-phone run;
desktop throttling is not phone validation.

Measure frame intervals p50/p95/p99/max, missed frame budgets, long tasks,
generation/autotile/placement/replication costs, client decode/apply/prediction,
cache construction and render submission. Track missing versus unfinished
visible terrain, dirty-to-drawable latency, queued work age/count/bytes, input
acknowledgment age and memory over a bounded traversal. Capture transition
frames to validate what readiness counters mean visually. Keep sampling bounded
and quantify instrumentation overhead.

Use deterministic tests for ordering, readiness and queue bounds in CI. Set
timing gates from repeated matched runs on identified hardware, with explicit
noise tolerance. Do not accept a frame-time improvement achieved by loading
less terrain, simulating fewer actors or failing to reach the destination.

### 2 Move single player authority into a Worker

Proposed ownership:

| Browser main thread | Dedicated local server Worker |
|---|---|
| Input, menus, camera, audio, Canvas2D rendering | Existing GameServer and Realm instances |
| Client replica, interpolation and player prediction | Authoritative physics, AI, gameplay and edits |
| Visual caches and presentation scheduling | Chunk generation, autotiling and placements |
| Profile selection and browser lifecycle signals | Realm replication, world registry and world saves |

Add a Worker host and a transport implementing the existing client/server
interfaces. Keep one authoritative implementation across Worker and dedicated
server hosts. Initially use the existing binary codec with transferable owned
message buffers; measure encoding, decoding and payload sizes before adding
another representation. Never transfer the live authoritative chunk arrays and
detach them from the server. No shared mutable world objects, shared WASM heap,
or new network server process is required.

The host needs explicit starting, ready, stopping, stopped and failed states.
Register handlers and complete initialization before connecting the client.
Surface initialization/runtime/message errors, reject pending requests on
failure, and prevent messages from an old Worker instance reaching a new
session. Define graceful shutdown as an acknowledged flush followed by destroy
and termination. Handle HMR, world switching and visibility changes explicitly;
page unload cannot be the only durability mechanism. Define single-player
hidden-tab pause/resume policy instead of inheriting timer behavior accidentally.

Retain input sequence ordering, request correlation, realm transition ordering,
generation identities and save semantics. Audit module-global physics settings:
separate heaps must receive explicit synchronized settings rather than relying
on incidental same-thread globals. Exercise real asynchronous delivery; the
current synchronous loopback can hide initialization and ordering assumptions.

Commands must not wait for all downstream generation/render work to finish.
Only supersedable interest updates may be coalesced, within realm/session
boundaries. Inputs, edits, events and durability fences retain their semantics.
Count work waiting in the transport as well as work admitted to the server.
Bound queues and client application cost; preserve delta dependencies when
batching updates. A Worker that floods the main thread with snapshots can still
cause stalls. Worker-local long generation tasks can still delay simulation;
measure that before deciding whether a separate generation worker is needed.

Validate deterministic authority/prediction parity, movement/jump/collision,
editing, doors and realm transitions, create/save/reopen, synchronized settings,
startup failure, shutdown and stale-instance handling. Use a controlled
server-heavy workload to verify rendering continues independently, while also
reporting authoritative simulation progress and correction/acknowledgment lag.
Compare ordinary gameplay on both hosts using the same traversal. Start with
single player; browser-hosted P2P can reuse the worker authority later with
browser networking bridged at the host boundary.

### 3 Prepare terrain visuals before they become visible

Treat visual readiness separately from data residency. Build caches within a
bounded camera halo, prioritize visible holes and approaching chunks, preserve
valid old imagery during rebuilds, and combine elapsed-time budgets with hard
work limits. Bound cache memory and discard stale jobs after edits, world
changes or rapid direction changes. Fix this independently of the Worker
transport so each improvement has attributable evidence.

Add scheduler tests for priority, revision changes, cancellation, eventual
completion and memory bounds. Verify pixels and terrain coverage during normal
movement, not only after settling. Target no exposed missing terrain on the
defined ordinary traversal while retaining the agreed frame-time budget;
measure cold entry and teleports separately.

### 4 Reassess remaining CPU costs and WASM

After the split and cache scheduling changes, profile the remaining hot stages.
Use additional generation/render preparation workers only where the evidence
supports them. Consider a bounded WASM kernel if compute remains dominant and a
prototype wins end-to-end including crossings, copies and startup, or if shared
native/browser execution becomes an explicit product requirement. A language
rewrite is not a substitute for readiness, bounded queues or lifecycle design.

## Mclone lessons

The local Mclone checkout provides useful references in
`docs/frame-pipeline-accounting.md`,
`docs/topics/web-worker-runtime-ownership.md`, and
`docs/tactical/303-web-integrated-runner-semantic-parity.md`.
Its useful precedent is explicit authority, execution and queue ownership.
Its browser history also records terrain holes when command admission waited
for downstream work to become quiescent and replayed outdated view requests.
Adopt those lessons without importing its Rust/WASM machinery or worker count.

## Completion criteria

Record baseline and candidate results with equal world coverage and workload.
Require both frame pacing and visual readiness, correct durable saves, bounded
queues/memory, and normal behavior across lifecycle transitions. Preserve saved
generation output and existing approved rendering identities. Run repository
typechecks, unit tests, lint, build and relevant browser coverage for runtime
slices. Record remaining hardware evidence and implementation decisions here.

## Implementation record

- Baseline harness: `npm run streaming:bench -- --output=/tmp/tilefun-streaming`
  owns an isolated Vite server and bundled Chromium; `--headed`, `--cpu=4`,
  `--versions=regional-v10` and `--no-metrics` select comparison lanes.
  `TILEFUN_DEV_URL` optionally selects an existing development server.
  Stage timings retain at most 512 samples per name and are disabled by default.
  `docs/benchmarks/012-streaming-before.json` records the instrumented baseline.
  Both fixtures traversed approximately 739 pixels during sprinting. V4/v10
  sprint samples had 36/17 frames without completed visible caches, with no
  missing chunk data and approximately 16.7/16.8 ms p95 frame intervals.
  Cold-entry counters include the transition from the initially loaded world;
  their displacement is a spawn transition, not walking throughput.
  Baseline validation: all three typechecks, 1,172 unit tests, production build,
  and 11 browser smoke tests passed. Rendered candidate identities were unchanged.

- Worker authority implemented with the shared `GameServer` and `Realm`, an
  ordered binary channel with one credited batch in flight per direction, bounded
  receive/apply work, and replication backpressure. Inputs and deltas are never
  dropped or reordered. Existing command admission already updates view interest
  without a worldgen drain; no speculative view-message coalescer was needed.
  Startup identity is supplied before player restore. Visibility pauses local
  simulation; a five-second checkpoint prevents continuously debounced saves
  from starving. Shutdown waits for admitted realm operations and durable saves.
  HMR waits for the prior host's shutdown before starting a replacement.
  Diagnostics distinguish main-thread and authority work and include queue bounds.
  All typechecks, 1,182 unit tests and 22 focused browser checks passed, including
  all generator reopen checks, interior movement/edit persistence, replicated
  physics settings, and render progress during a 350 ms authority-thread stall.
  The worker-only v10 traversal still showed unfinished caches, as expected;
  the following slice isolates cache scheduling's contribution.

- Terrain preparation now works in the loaded one-chunk halo before drawing,
  prioritizing visible gaps and then distance in the direction of travel.
  It checks a 2 ms deadline between rows and caps work at 128 rows per render.
  Completed surfaces remain visible during revision rebuilds; chunk object
  identity prevents stale partial surfaces crossing world/reload boundaries.
  Residency follows the camera halo and is released on realm changes/teardown.
  Tests cover timing/count bounds, prioritization, revisions, replacement chunk
  identities, eviction and completion. Both real-game traversal tests passed
  with zero missing or unfinished visible chunks while sprinting and returning.
  All 327 Workshop candidate records remain byte-equivalent after regeneration.
  Persistence checks freeze authority and consume its final replica before
  asserting exact restore, avoiding comparisons against an earlier predicted
  pose. Worker lifecycle checks passed across three repeated browser runs.

The original baseline's zoom sample directly assigned camera zoom, which the
play scene overwrites. Its zoom row is not valid zoom-transition evidence.
The permanent runner now uses the gameplay zoom control. Movement comparisons
use the same seed, arrival, viewport, input and sample windows as before.

## Final evidence and limits

Final captures use clean revision `3b8c2bd`, Apple M4 Pro / macOS and bundled
Chromium 153.0.8010.12, at 1280 by 900. Full environment details and samples are
in the committed JSON. Performance captures ran sequentially, outside the test
suite. The normal headless before/after sprint covers approximately 739 world
pixels, 15/10 visible chunks for v4/v10, and the same endpoint entity/prop counts.

| Fixture / lane | Sprint unfinished frames before → after | Sprint frame p95 | Sprint input acknowledgment p95 |
|---|---:|---:|---:|
| v4, headless | 36 → 0 | 16.7 ms | 51.6 ms |
| v10, headless | 17 → 0 | 16.7 ms | 51.4 ms |
| v10, 4× page CPU throttling | — → 0 | 16.7 ms | 55.7 ms |
| v10, diagnostics disabled | — → 0 | 16.8 ms | 51.9 ms |
| v10, headed | — → 0 | 9.3 ms | 42.2 ms |

All final lanes also have zero missing data or unfinished visible caches during
walking and reversal. The headed lane samples the same frame count at a faster
display cadence, so its sprint covers 368 pixels; it is presentation evidence,
not a matched throughput comparison. The final zoom-out samples have no gaps.
Cold entry still exposes short readiness gaps: v4 has three frames with missing
data and three with unfinished caches; v10 has two unfinished-cache frames in
the normal lane. At 4× page throttling v10 has three missing-data frames and
eleven unfinished-cache frames. These categories can overlap.

- [Before](../benchmarks/012-streaming-before.json) and
  [after](../benchmarks/012-streaming-after.json): matching normal traversal.
- [Page CPU throttling](../benchmarks/012-streaming-cpu4.json),
  [diagnostics disabled](../benchmarks/012-streaming-no-metrics.json), and
  [headed presentation](../benchmarks/012-streaming-headed.json).
- [Interior entry/edit/return](../benchmarks/012-gameplay-after.json): outdoor,
  indoor and edited-room frame p95 all approximately 16.8 ms; indoor movement
  and return succeeded, with no browser errors.

The normal sprint's authority tick p95 is 0.5 ms in both fixtures; generation
samples are at most 1.4 ms. Those timings now live in the Worker. A deliberate
350 ms Worker stall in the browser integration test leaves main-thread animation
frames advancing and verifies authority recovers afterward. Normal sprint input
sequence lag peaks at three, and sampled prediction resimulation error stays
below 0.001 world pixels. This supports the split without a WASM rewrite or an
additional generation Worker pool.

Queue high-water marks include browser delivery ownership, not just local
arrays. Normal captures stay below 0.6 MiB and 20 messages on the authority
side, against hard bounds of 16 MiB and 1,024 messages per outbound direction.
One batch per direction is in flight. Replica application and transport pumps
use 2 ms / 64-message budgets; individual messages are atomic. Terrain
preparation uses 2 ms / 128-row budgets with an atomic row, so elapsed limits
are soft at that granularity. Cache residency follows the viewport plus one
chunk of halo and releases surfaces outside it. Sampled completed cache
surfaces occupy roughly 4–8 MiB of logical RGBA storage; this is not process or
GPU memory. Pending replacements can temporarily add a second surface.

Timing diagnostics are disabled by default (`?perf` enables them), bounded to
32 timing names and 512 retained samples per name. Counts, totals and maxima
cover the sample window; stage percentiles cover retained samples. The
diagnostics-disabled lane retains the external traversal sampler and shows
similar frame pacing. Its render timings are noisier than the enabled run,
so one pair does not establish a precise instrumentation overhead percentage.
Readiness counters describe whole chunk caches, not exact blank pixel area.
CDP page throttling does not establish equivalent Worker throttling or physical
phone performance, and none of these measurements captures GPU completion.

Functional checks cover ordering, credit and memory bounds, delta preservation
under backpressure, physics synchronization and prediction, real Worker startup
and failure, pause/resume, durable shutdown/reopen, terrain scheduling and
revision cancellation, all saved generator revisions, and interior edits.
Approved assets and all 327 Workshop candidate records are unchanged.

Final validation: all three TypeScript projects pass; 1,192 unit tests across
116 files pass; production build and all 235 browser tests pass. Biome passes
with the repository's existing 122 warnings and 32 informational findings.
The pattern editor browser assertion now polls committed camera state after
input rather than racing React's update; its 15 checks also passed across
three repeated runs. Every streaming lane passes `--assert-ready`.

The CI traversal assertions enforce coverage and bounds. Browser-hosted P2P
still uses its existing host; moving it across the same boundary is a future
extension, not needed for the completed single-player split.

## Physical Android follow-up

The user supplied attached phones for real-device validation. On 2026-10-03,
the Machine Control Android handheld doctor confirmed an authorized, awake,
unlocked Pixel 7a. The test used Android 17 (API 37), Chrome 154.0.8037.57,
portrait orientation, a native 411 × 789 CSS-pixel game viewport and DPR 2.625.
There was no viewport or CPU emulation. The device was charging; battery
temperature was 25°C before and 28.5°C afterward, with thermal status 0 afterward.
This is short-run, plugged-in evidence, not a sustained thermal/battery test.

The runner now accepts `--cdp`, a dedicated `--port`, `--device` and `--touch`.
It attaches with Playwright's `noDefaults` option, opens only its own test tab,
preserves the native viewport and drives the real joystick and sprint button
with CDP touch gestures. It owns an isolated Vite origin, clears only that
origin's test storage, closes its tab and disconnects without closing Chrome.
Task-owned USB forwarding was removed afterward; the final device doctor was
ready. No browser profile, device settings or installed applications changed.

After selecting and checking the phone through Machine Control, arrange private
ADB reverse forwarding for the benchmark HTTP port and forwarding for Chrome's
DevTools socket, then run:

```bash
npm run streaming:bench -- --cdp="$PHONE_CDP_URL" --port="$PHONE_HTTP_PORT" \
  --device="model / OS" --touch --assert-ready --output="$PHONE_REPORT_DIR"
```

The USB endpoints and exact device selector stay in local controller state,
not benchmark reports or Git. Remove those task-owned routes after the run.
Add `--no-metrics` for the instrumentation comparison. The browser's reduced
user-agent reports Android 10; the OS version above came from the device's
system property, not that user-agent.

Three consecutive instrumented captures of both fixtures and a separate v10
diagnostics-disabled capture ran on clean revision `d8fe0a4`. The
[complete phone evidence](../benchmarks/012-streaming-android.json) includes
native display metadata, all stage samples, and the interior check.

| Scenario | v4, three runs | v10, three runs |
|---|---:|---:|
| Walking / sprinting / reversal visible gaps | 0 in every sample | 0 in every sample |
| Movement frame p95 | about 16.8 ms | about 16.8 ms |
| Sprint render callback p95 | 3.2–3.5 ms | 3.2–3.3 ms |
| Zoom-out frame p95 | 33.3 ms | 16.8 ms |
| Cold-entry unfinished-cache frames | 24–28 | 19–20 |

Sprints cover approximately 741–751 world pixels. The diagnostics-disabled v10
run also has no movement gaps and 16.8 ms movement frame p95; its sprint render
p95 is 3.3 ms. The existing interior benchmark, adapted temporarily to the same
native CDP connection and touch input, successfully enters, edits, moves 12.8
pixels inside, and returns to the street. Outdoor, indoor and edited-room frame
p95 are 16.7–16.8 ms, with no browser errors. Gameplay screenshots were inspected.

The v4 zoom-out result is repeatable: 10–13 of 180 frame intervals exceed 25 ms,
with no missing terrain or long tasks. Render callback p95 is only 4.1–4.3 ms
and update p95 is below 1 ms in those samples. These counters do not identify
the cause; targeted frame/compositor tracing is the next performance task.
Cold entry also remains visible work, including 0–3 missing-data frames. It
should get a separate readiness/presentation treatment. The development server's
startup/module loading is not a production cold-start benchmark.

Phone and desktop timings are not a matched speed comparison: viewport, input,
browser and scene population differ. This validates native Android touch play
and streaming coverage. It does not establish iOS parity, landscape behavior,
performance on lower-end phones or a universal frame-time gate. No new runtime
optimization or WASM work was justified by this check.

The runner extension passed all three typechecks, 1,192 unit tests, Biome
(existing warnings), and an isolated desktop touch traversal in addition to
the physical-device runs. Runtime sources and approved rendering assets did
not change in this follow-up.
