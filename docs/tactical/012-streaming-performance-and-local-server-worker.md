# Streaming performance and single player server worker

Status: implementation authorized, 2026-10-03. Deliver both plans autonomously
end to end, committing coherent slices and retaining the shared server model.

The player sometimes sees blank terrain while walking. The agreed starting
point is a repeatable performance baseline that measures terrain readiness as
well as frame pacing. The proposed highest-value architectural follow-up is to
move the existing single-player server into a dedicated browser Worker, keeping
authoritative simulation and generation off the render thread. Implement that boundary with parity and lifecycle checks. A WASM core remains conditional on
measured need; it is not required for this split.

## Observed behavior and exploratory baseline

Inspection found two independent stages: chunk data generation and construction
of the chunk's Canvas2D render cache. In ordinary single-player gameplay both
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

## Existing foundations and testing gaps

- `main.ts` already creates `GameClient` in serialized mode with no server
  reference. `SerializingTransport` binary-encodes and decodes each message,
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
