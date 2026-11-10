# 235 — Crowd bench: remove unnecessary work

Status: shadows, measurement checkpoint and the first authority slice delivered (tick 6.6–6.7 → 4.0–4.1 ms; the 2 ms goal is not reached) · 2026-11-10. Owner: [performance](../topics/performance.md).

The owner asked for a repeatable bench with about 1,000 rabbits and 50 cars,
all within a few chunks and all in view. The goal is to remove all
unnecessary work there.

## Bench

`src/scenarios/CrowdBenchRecipe.ts` holds the fixed scene:
- flat ground (`FLAT_SCENARIO`);
- 50 parked cars in ten columns by five rows, cycling eight models from the
  compact to the garbage truck;
- 1,000 rabbits in a 40 × 25 grid at 24 px;
- the player between the cars and the rabbits.

The whole crowd (about 1,200 × 960 px) sits inside chunks 0–4, which is the
player's default 5×5-chunk view. Every actor is therefore in view and simulated.
These are ordinary Realm actors with ordinary vehicle records and AI; only the
placement is synthetic.

### Authority: `npm run crowd:bench`

The bench runs the recipe in a headless `ScenarioSession`. By default it does
180 warm-up ticks, then measures 600 ticks.

It reports:
- tick p50/p95/p99;
- `performanceMetrics` stage p50/p95;
- work counts per tick:
  - simulated actors and actors in motion;
  - physics bodies and awake cars;
  - wheel rays and wheel body tests;
  - support queries;
  - replication bytes.

Options:
- `--output=<file.json>` writes the report;
- `--compare=<earlier.json>` prints deltas against an earlier report;
- `--profile` records a CPU profile of the measured ticks only. Its frames are
  mapped back to source files, and the top self-time functions are printed;
- `--rabbits` and `--cars` scale the crowd down.

Two choices make the bench repeatable:
- **Fixed workload.** Randomness is the scenario's seeded source. A simulated
  wall clock advances 1/60 s per tick, because streaming interest leases and
  door timers read `Date.now()`. Work counts repeat exactly between runs; only
  the times vary with the machine and its load.
- **Production-like code.** `scripts/benchmark-crowd.mjs` compiles the bench
  with esbuild and runs it in plain Node. tsx compiles with keepNames, which
  wraps hot closures in `__name` calls. That added about 8% to the tick
  (rabbit AI 1.4 → 0.95 ms) and does not happen in the Vite build.

### Browser: the `crowd` world-geometry lab

The lab is at `workshop.html?geometry=crowd#/tool/world-geometry`. It uses a
fixed camera at zoom 0.2, so the whole crowd fits in the lab's 960×640 canvas.
To measure it:

```
npm run build && npx vite preview --port 4174
node scripts/benchmark-realm-physics-browser.mjs --fixture=crowd --headed --trials=1
```

The browser bench gains `--headed` and treats `crowd` like `traffic-crowd`:
one population.

## Baseline (2026-11-10, M4 Pro, f96952a2 plus this bench)

Authority, 1,000 rabbits and 50 parked cars:

| Measure | Value |
| --- | --- |
| Tick p50 / p95 | 6.4–6.6 / 7.4–7.7 ms |
| Physics (`realm.entityPhysics`) | 3.0–3.1 ms |
| Replication | 1.2–1.3 ms |
| AI | 0.93–0.96 ms |
| Save sweep | 0.04 ms |
| Simulated actors | 1,051 every tick |
| Physics bodies | 1,051 |
| Actors in motion | **64** (6%) |
| Awake cars, wheel rays | 0 (parked cars sleep on flat ground) |
| Replication | 9.1 KB per tick (~550 KB/s) |

The browser Worker tick matches (7.0–7.1 ms p50). **The lab draws only about
2.3 frames per second** (426–433 ms per frame), headed or headless.

## Unnecessary work found

Only about 64 actors move in a typical tick, yet all 1,051 get the full
per-tick treatment. From a source-mapped profile of the authority tick:

1. **Physics on idle bodies (≈40% of the tick).**
   - `readBody` (12%) copies pose and velocity out of Rapier for every body
     every tick. It includes a WASM contact-pair callback per body (7%).
   - `synchronize` (7%), `finish` (7%), `synchronizeForPublication` (6%) and
     `collectMotionIntents` walk all 1,051 bodies.
   - Rapier's own step is about 4.5%.
2. **Replication of unchanged entities (≈19%).** Each tick builds and compares
   every entity's snapshot (`reuseEntitySnapshot` 8%, `entitySnapshotMatches`
   3%, `mirroredFieldsMatch`) to find the few that changed.
3. **AI (≈13%).** Rabbit decisions (`chooseHop` gap checks), meadow work and
   threat/range/woodland worker kind checks each tick. `faunaProfile` lookups
   repeat for each kind test.
4. **Activity selection (≈8%).** `RealmActivity.select` and
   `WildlifeActivity.awake` re-prove "awake" for every rabbit every tick.
   Each rabbit's wake test runs twice.
5. **Gameplay resolution (≈5%)** over all simulated actors.

Lab frame (main thread, 4 s headed profile; the lab and the game share
`collectScene`):

6. **Projected shadows (~3.45 of 4.8 s).** At zoom ≥ 0.2
   (`PROJECTED_SHADOW_MIN_ZOOM`), every shadow goes through
   `SurfaceReceivers.project`. This was first read as rabbit shadows on flat
   ground; measurement showed six car shadows next to meshed cars instead
   (see [Item 1](#item-1-projected-shadows-delivered)).
7. **Per-frame UI and lab scans.**
   - `VehicleControl` → `vehicleChoice`/`driveCandidate` scans all vehicles for
     a drive prompt every frame.
   - `applyRecipeAppearances` re-applies recipe appearances to every entity
     every frame.

Separate observation: in the earlier regional stress world, 26–41 of 53 cars
applied wheel forces per tick (`VehicleChassis.prepare`) without a driver. A
later read of Rapier sleep state found only the 8 traffic cars awake. The flat
bench has none. That measurement needs a recheck before any wheel-ray work.

## Item 1: projected shadows (delivered)

**Cause.** Timing `project` per caster in the lab (3 s, about 40 frames):

| Casters | Faces per call | Cost per call | Total |
| --- | --- | --- | --- |
| 1,034 on terrain only (rabbits, most cars) | 2.3 | 0.003 ms | 129 ms |
| 6 cars beside a rally hatchback | 106 | 2.2 ms | 1,034 ms |

A rabbit shadow on flat ground was already cheap. The cost was six car
shadows whose footprints overlap a neighbouring rally hatchback by about a
pixel. That pulls in roughly 170 of its mesh triangles: mostly near-vertical
slivers with about 100 px² of clipped area in total. `subtract` split each
piece along the edge lines of every nearby triangle, even triangles that
missed the piece, so one call produced 3,776 fragments. The same happens for
any car shadow that reaches a meshed body, in traffic or in a car park.

**Fixes** (`src/rendering/SurfacePartition.ts`, split from `SurfaceReceivers`):
1. A cutter that misses a piece leaves it whole (3,776 → 198 fragments per
   call).
2. Cheap exact rejections. A piece is skipped when the cutter's box or one of
   its edges separates them, and the cutter's edges are computed once. Pairs
   are filtered on the clipped pieces' boxes rather than whole-face bounds.
3. Each caster's partition is remembered across frames, up to four per
   caster within 1M numbers (8 MB). A hit needs bit-equal receiver planes and
   clipped polygons, which are the partition's only inputs, so parked cars
   stop recomputing it. Fragments rebind to the current frame's faces.
4. `candidates` dedupes sources with a per-query stamp instead of a new `Set`,
   and the grid uses numeric cells instead of string keys. The visit order is
   unchanged. In Node, 1,000 rabbit shadows go from 3.45 to 2.59 ms per frame.

**Equivalence.** `SurfacePartition.test.ts` keeps the original algorithm as a
reference and runs both on seeded triangle soups over terrain tiles and a deck.
The soups include steep slivers and coplanar ties. Every sample point gets the
same receiver, and each receiver's area matches within 1e-4 px²: the original
also dropped sub-EPS slivers. UVs keep the caster's affine map. Memo hits,
misses and face rebinding are tested too.

The union per receiver is unchanged, but receivers that were split
needlessly now come out in fewer pieces. In those cases the decal's
first-fragment centre (its sort key) can move within the same shadow. World-depth
decals blend in a late pass where black shadow order commutes.

The existing `SurfaceReceivers` tests and the GPU surface-decal browser case
(ramps, crests and mesh roofs) pass.

**Result** (M4 Pro, headed, bundled Chromium):

| Measure | Before | After |
| --- | --- | --- |
| Crowd lab frame p50 | 426–433 ms (~2.3 fps) | 16.7 ms (p95 24–25 ms), two runs |

The main thread is now CPU-bound at about 15.7 ms per frame (production build,
231 frames in 4 s): 9.8 ms render and 5.9 ms update. A dev-build profile per
frame:
- shadows: about 3.7 ms in `projectShadow` plus 1.2 ms in `surfaceDecals`;
- `applyRecipeAppearances`: 3.3 ms;
- `vehicleChoice`: 1.1 ms;
- `structuredClone`: 0.8 ms.

Item 6 (lab per-frame scans) is now the largest step towards 120 Hz.

## Goal

**Per-tick and per-frame cost should follow what changes (actors in motion,
visible changes), not the population.**

Targets on this bench (M4 Pro):
- **Authority tick p50 ≤ 2 ms**, from 6.5 ms.
  - Idle grounded rabbits must not pay for physics reads, snapshot comparison
    or wake checks each tick.
  - Physics bodies read per tick should track actors in motion plus their
    contacts.
  - Replication cost should track changed entities.
- **Lab at zoom 0.2 holds 120 Hz** (the complete frame fits 8.3 ms), from about 430 ms.
  - Shadow cost follows overlapping receivers, not repeated frames (item 1).
  - Per-frame UI scans are bounded.

Each change keeps the bench's work counts identical unless it intends to
change them. Before and after reports are recorded here (`--compare`).
Timings remain machine-specific; track p95 as well as p50. Update and render
medians cannot be added to reconstruct a frame percentile.
Behaviour must stay the same:
- Physics wakes on contact.
- Riding, carrying and gameplay contacts are unchanged.
- Replicated motion stays identical for actors in motion.

The existing focused tests and `test:all` cover these.

## Measurement checkpoint (2026-11-10)

This checkpoint adds attribution and repeatability, without changing simulation,
AI, replication, appearance or prompt behavior. Optimization starts after review.

### Four measurement lanes

| Lane | Boundary | Execution |
| --- | --- | --- |
| Authority | Whole `ScenarioSession.tick(true)`, including replication construction and binary encoding | Plain Node |
| Client processing | Synchronous binary decode/apply, recipe appearances, empty-backlog reconciliation, animation and vehicle prompt at 60 Hz; presentation sampling at 120 Hz | Plain Node, saved binary recording |
| Render preparation | Shared `collectScene` and `collectSceneOrder`, including projected shadows and real car receiver meshes at 120 Hz | Plain Node, same recording |
| Integrated lab | Real Worker, client, lab UI and WebGL; update/render callback CPU costs and rAF cadence | Bundled Chromium; headed for target-display cadence |

Authority and client updates remain 60 Hz. A 120 Hz presentation schedule does
not double authority ticks. Client and render runs are sequential, with fixed
arrival/presentation times, not wall-time races between their lanes.

The client lane calls production processing functions, but deliberately excludes
Worker/channel admission budgets, DOM work, effects and local-input prediction.
Its reconciliation backlog is empty. It is a component benchmark, not a complete
lab update. The lab currently chooses vehicle prompts once per **update**, not
once per 120 Hz render. Appearances are applied when state arrives.

The render lane uses the actual recipe, camera (960×640, zoom 0.2), replica and
GLBs. Production `GLTFLoader` and `CarMeshAsset` compile the receiver geometry;
only image decoding is replaced with empty textures. Flat ground has no elevation
items, and grass is hidden at this zoom. Terrain raster preparation, particles,
WebGL submission, uploads and GPU execution are excluded. Replica processing and
presentation sampling happen outside its timer; their allocation/cache effects
can still affect collection. `--scene=frozen` holds the last warm-up snapshot and
animation phase; moving mode consumes every recorded tick.

### Commands and comparison rules

```sh
# Normal timing run: 180 warm-up ticks, 600 measured ticks.
npm run crowd:bench -- --output=/tmp/authority.json

# Separate untimed capture. Keep this file for comparisons across code changes.
npm run crowd:bench -- --lane=record --output=/tmp/crowd.tape
npm run crowd:bench -- --lane=client --replay=/tmp/crowd.tape --output=/tmp/client.json
npm run crowd:bench -- --lane=render --replay=/tmp/crowd.tape --output=/tmp/render.json
npm run crowd:bench -- --lane=render --scene=frozen --replay=/tmp/crowd.tape --output=/tmp/frozen.json

# Compare timing runs of the same lane/workload/runtime.
npm run crowd:bench -- --lane=client --replay=/tmp/crowd.tape --output=/tmp/client-after.json --compare=/tmp/client.json

# Separate verification runs: hash every measured state/collected scene.
npm run crowd:bench -- --lane=render --replay=/tmp/crowd.tape --verify --output=/tmp/verify-before.json
npm run crowd:bench -- --lane=render --replay=/tmp/crowd.tape --verify --output=/tmp/verify-after.json --compare=/tmp/verify-before.json --assert-equivalent

npm run test:crowd-bench
```

The recording owns replay population and warm-up/measurement lengths. It includes
initial syncs and all warm-up frames, so deltas never replay without their baselines.
Raw recordings and full reports stay in ignored local scratch storage; sanitized
checkpoint evidence belongs in `docs/benchmarks/`.

Report schema 2 checks lane, workload, runtime/machine and instrumentation before
comparing. Source revisions may differ: reports fingerprint the executable source
contents and dependency lock separately, including dirty/untracked build inputs.
Replay compatibility additionally requires the exact tape hash and, for rendering,
the GLB content hashes. `--allow-incompatible` explicitly labels a diagnostic
comparison; it does not make those measurements equivalent. Historical schema-1
reports require this override. Record a fresh matched baseline for an optimization.

Authority retains all measured stage samples (formerly the final 512 of 600),
and reports sample counts, totals and percentiles. Nested stages are inclusive.
Packet hashing and periodic work observation happen outside the tick timer;
the additional work can still affect GC/cache state. Authority wire digests cover
every measured packet. Replay reports always include final-state/scene hashes;
`--verify` additionally hashes every measured state and collected scene and must
be used for replay `--assert-equivalent`. These hashes supplement focused contact,
wake, lifecycle and replication tests; they do not replace them. Profile and
verification timings are not the unprofiled baseline.

The browser runner now calibrates idle cadence, records GPU identity, canvas/DPR,
served JavaScript content hashes and separate `lab.update`/`lab.render` CPU
timings. Timings are opt-in and retain up to 10,000 callback samples. Older
immutable `--reference-base` bundles may omit callback timings. Crowd samples
wait for terrain to settle and requested vehicle assets to load. The default
six-second Worker window fits its existing 512-sample recorder; longer windows
still expose rolling Worker percentiles through `retained`/`count` diagnostics.
Worker diagnostics are fetched separately and straddle the main-thread window;
their totals do not cover exactly the same interval. The browser workload
remains wall-time-driven and is not an exact replay of the
Node recording. Headless Chromium can check WebGL/Worker integration, but its rAF
cadence and software rendering cannot establish physical-display/GPU performance.

### Checkpoint baseline

[Sanitized evidence](../benchmarks/235-crowd-checkpoint.json) retains each trial,
work counts, hashes, runtime/build identity and browser conditions. Raw recordings,
full reports and screenshots are retained locally under the ignored
`data/scratch/crowd/checkpoint-235/`; keep its `crowd.tape` for follow-up comparisons.

M4 Pro, Node **24.22.1** (V8 13.6), three fresh sequential processes per Node
case, middle repetition in reverse case order. Each uses 180 warm-up and 600
measured ticks; replay collects 1,200 presentations. No timing run includes CPU
profiling or full verification hashing. Ranges below are the **per-trial** p50/p95
range, not pooled percentiles. There is no thermal control or OS-load isolation.

| Boundary | p50 range (ms) | p95 range (ms) |
| --- | ---: | ---: |
| Authority, empty (player only) | 0.060–0.062 | 0.100–0.126 |
| Authority, 1,000 rabbits only | 6.435–6.812 | 7.480–8.273 |
| Authority, 50 cars only | 0.234–0.241 | 0.320–0.373 |
| Authority, combined crowd | 6.770–7.608 | 7.824–9.247 |
| Combined physics stage (inclusive) | 3.157–3.536 | 3.674–4.231 |
| Combined replication construction | 1.321–1.482 | 1.513–1.841 |
| Client processing per 60 Hz update | 4.857–4.887 | 5.207–5.336 |
| Appearance application within that update | 3.458–3.482 | 3.578–3.671 |
| Vehicle prompt within that update | 0.860–0.888 | 1.013–1.110 |
| Presentation sampling per 120 Hz frame | 0.726–0.736 | 0.963–0.979 |
| Moving scene preparation per frame | 9.628–9.937 | 10.261–10.774 |
| Frozen scene preparation per frame | 8.765–8.890 | 9.251–9.548 |

All authority repetitions have identical work counts and measured wire digests
within each population. The combined crowd remains 1,051 bodies, 64.05 sampled
movers, zero awake cars/wheel rays and 9,135 replication bytes/tick. All rendering
repetitions retain identical item/work counts and outcomes. Two separate full-size
verification passes per replay lane match every measured state hash and every
collected scene hash; client and render also match each other's state stream.

Bundled full Chromium **156.0.8078.4**, ANGLE Metal / Apple M4 Pro, DPR 1,
1280×900 browser viewport and 960×640 canvas; four-second minimum warm-up, then
six-second samples after terrain/mesh readiness:

| Browser boundary | Headed, three trials | Headless, one integration control |
| --- | --- | --- |
| Idle rAF p50 | 8.3 ms (~120 Hz) | 16.7 ms (~60 Hz) |
| Crowd rAF p50 / p95 | 16.7 / 25.0–25.1 ms | 16.7 / 33.3 ms |
| Update callback p50 / p95 | 5.6–5.7 / 6.5–6.8 ms | 5.7 / 6.3 ms |
| Render callback p50 / p95 | 10.9–11.3 / 11.8–12.3 ms | 11.2 / 11.9 ms |
| Worker tick p50 / p95 | 6.8–6.9 / 7.6–7.8 ms | 6.7 / 7.6 ms |

All four runs use the same 77 served JavaScript/Worker resources and hardware
renderer, with 50 cars, ten requested mesh assets ready (including preload-only
families), no pending terrain/prepared rows at either endpoint and no page errors.
The headed crowd exceeds 1.5× idle cadence on 338/338, 331/347 and 334/344 sampled
intervals. CPU work already exceeds the 120 Hz budget; this is not qualification.
The headless control confirms why its cadence cannot qualify the 120 Hz goal even
though its WebGL backend is hardware accelerated on this machine.

The measurements support appearance/prompt cleanup as a bounded first slice,
but **render preparation already exceeds the entire 8.3 ms frame budget**, even
in the frozen Node control. Removing client-update work alone cannot establish
120 Hz. Authority spread (6.77–7.61 ms p50) also means small single-run gains are
not convincing. Historical timings above use a different harness/runtime context
and are not a matched before/after comparison with this checkpoint.

Validation: four native benchmark-harness checks, 13 affected Vitest checks,
typechecks, focused Biome checks, code-health ratchet, art catalog/manifest and
production build pass. The headless scenario-scheduling browser regression also
passes, including opt-in timing collection, client stalls and pause/visibility
lifecycle. The shell's Node 27 alpha failed the existing PNG decoder during the
initial build; validation and recorded baselines use installed Node 24 instead.
No full repository suite or streaming traversal gate was needed: simulation,
streaming, rendering algorithms and input behavior are unchanged.

## Authority slice: resting bodies and per-actor passes (delivered 2026-11-10)

The owner authorized the authority work (slices 2 and 3 of the review order).

**Result** (M4 Pro, Node 24.22.1, three interleaved fresh processes each, same
machine load; [evidence](../benchmarks/235-authority-rest.json)):

| Measure | Before (`17459f62`) | After |
| --- | ---: | ---: |
| Tick p50 | 6.61–6.74 ms | 4.01–4.13 ms |
| Tick p95 | 7.56–7.78 ms | 4.57–4.68 ms |
| Physics stage p50 / p95 | 3.04–3.15 / 3.43–3.61 ms | 1.47–1.50 / 1.69–1.70 ms |
| Replication p50 / p95 | 1.29 / 1.44–1.52 ms | 0.77–0.95 / 1.05–1.19 ms |
| AI p50 / p95 | 0.92–0.94 / 1.72–1.75 ms | 0.71–0.74 / 0.82–0.87 ms |
| Bodies read back per tick | 1,051 | 82 |
| Motors evaluated per tick | 1,051 | 144 |

The tick is 39% shorter at p50 and 40% at p95. **The 2 ms goal is not reached.**

In the real game (`render:bench` crowd scene in the seed-2026 city, about 890
rabbits and 49 cars, Vite dev modules):

| Device | Zoom | Worker tick p50 before | After |
| --- | --- | ---: | ---: |
| M4 Pro | 0.25 | 8.1–12.7 ms | 6.0–6.9 ms |
| Pixel 7a | 1 | 30.8–33.7 ms | 20.8–22.3 ms |
| Pixel 7a | 0.25 | 39.8–48.0 ms | 20.7–32.5 ms (three runs) |

The phone's "before" rows are the 236 scorecard runs from earlier the same day
at `17459f62`, not interleaved with the "after" runs. The phone tick is about a
third shorter but still above the 16.7 ms a 60 Hz authority needs, so its crowd
cell still misses frames. Physics is the largest phone stage (9.5–12.6 ms).
The Steam Deck was not re-measured.

### What the first profile showed

Idle rabbits were already asleep inside Rapier. The cost was the game's own
code around the solver: every tick it read every body's pose, velocity,
rotation and contact pairs back through WASM, re-ran every motor, and then
walked all 1,051 actors again in about a dozen further passes (body
synchronization twice, intents, activity selection, AI, gameplay, replication).
After this slice the profile is flat: each remaining pass costs 60–120 ns per
actor and none is above about 9% of the tick.

### Changes

Physics (`PhysicsScene`, new `BodyMotor.ts` and `BodyReadback.ts`):
- **Resting readback.** A body the solver reports asleep for two consecutive
  readbacks, grounded and without a dump bed or transporter deck, is not read
  again. Its cached state is exactly its state; its previous pose catches up and
  its own solved contacts are listed again from the last full read. The cached
  state is still published to the entity every tick, because other systems write
  pose arcs (`jumpZ`) onto those fields.
- **Dormant motors.** A character motor that found its body asleep on static
  ground, grounded, with an idle intent, is skipped while the intent stays idle.
  A full readback, an explicit edit, a restore or a replaced entity object ends it.
- **Noise no longer keeps bodies awake.** A grounded motor asking for no motion
  still clears velocity while awake, but stops resetting the solver's sleep timer
  once the last readback found the pose bit-identical to the tick before. Rabbits
  resting against or on top of each other carried 1e-5…1e-17 px/s solver noise
  and never slept.
- Support velocities are read only for bodies something stands on; section
  residency skips the velocity query for resting bodies and repeated chunk
  ranges; wheel queries keep the centre of a resting body; body shape is compared
  as numbers rather than a built string.
- `bodyReads` and `motorUpdates` are new scene counters and bench work counts.

Other passes, each with identical output:
- Publication synchronizes the step's own participant list unless a seat
  boarded, left or mounted since.
- Activity selection decides a wildlife group's interest once per tick (it ran
  the wake test twice) without per-call closures; wildlife-only membership is
  computed when groups rebuild.
- Chunk key strings are memoized (`chunkKey`); actor scope and streaming support
  built several per actor per tick.
- Replication compares mirrored fields by name instead of a keyed loop, and
  writes its maps only for changed entities. `MATCHED` fails to compile if a
  mirrored field is missing from the comparison; the reuse test changes every
  mirrored field.
- Hop planners (rabbit, frog, deer, fauna, robin) ask one shared grid of the
  pass's solid bodies (`SolidNeighbours.ts`) instead of scanning the population
  for each of up to 24 candidates. Outside `tickAllAI`'s pass the same question
  scans, with the same answer.
- `finishPhysics` asks for water only when a duck or frog lands, and skips
  attachment resolution when nothing is attached.

### What changed in behaviour

Everything after the physics change keeps the wire digest bit-identical
(`46beb807…` for every later step). The physics change itself moves the digest
from `0a8a22cc…`, for one reason:
- Bodies resting in contact now sleep, so their replicated velocity is exactly
  zero instead of solver noise. Sampled movers drop from 64 to 43 and
  replication from 9,135 to 9,100 bytes per tick.

A per-tick trace of every actor's pose over the 600 measured ticks, before and
after: every x and y is identical; z differs by at most 0.021 px, on rabbits
standing on another rabbit (the awake stack kept settling by fractions of a
micro-pixel; asleep, it stops). Hop counts and support queries are identical.

Not changed: a body already asleep in the solver stayed asleep through a
terrain edit under it before this slice, and still does.

### Wake paths tested

`RestingBodies.test.ts` settles bodies until a tick does zero reads, then checks:
- skipped reads and motors, with the cached pose still published (a stray
  `jumpZ` is cleared);
- a motion intent; a moving body running into a resting one, with the contact
  recorded; teleport and launch edits; a replacement entity object;
- a dynamic support that is removed, and one that starts to move;
- a collider change that rebuilds the body;
- a resting pair's contact listed both ways and kept in the prediction snapshot
  closure;
- an anchor (fixed body) is read every tick and lists what rests on it;
- an awake copy restored from the authority's snapshot, as client prediction
  does (only vehicles replicate sleep), follows the same 90-tick push through
  two resting bodies within 0.05 px of the asleep authority.

Not rested at all, so unchanged: fixed bodies, trains, and bodies with a dump
bed or transporter deck. Not covered by a new test: tow/carry joints forming on
a resting car, a train starting under a resting rider, and gravity changes.
The existing vehicle, coupling, railway and prediction tests pass.

`SolidNeighbours.test.ts` compares 2,000 indexed answers with scans. The index
assumes poses and solidity do not change during the decision pass; the
independent review found no stock path that breaks this (carried balls and
forage items are not solid). The 3,537 tests of the affected directories pass,
as do the crowd-bench harness tests, `streaming:bench -- --assert-ready` and 45
browser cases (physics, prediction recovery, riding, cars, wildlife species and
split screen).

The code-health baseline records one or two more lines in six files that gained
an import or a guard; `PhysicsScene.ts`, `RealmActivity.ts` and `tickAllAI.ts`
all shrink in size and worst-function complexity.

### What remained after this slice

Nothing marked an entity changed, so replication still compared all 1,051 each
tick, and a dozen flat per-actor passes remained. The next section takes idle
actors out of those passes.

## Authority slice: napping actors, a planner line and geometry rebuilds (delivered 2026-11-10)

The owner authorized taking idle actors out of the per-tick lists and asked for
an investigation of phone physics.

**Result** (M4 Pro, Node 24.22.1, three interleaved fresh processes each;
[evidence](../benchmarks/235-authority-naps.json)):

| Measure | Before (`536e7dbf`) | After |
| --- | ---: | ---: |
| Tick p50 | 4.03–4.08 ms | 2.56–2.88 ms |
| Tick p95 | 4.61–5.43 ms | 3.48–4.21 ms |
| Physics stage p50 / p95 | 1.50–1.51 / 1.75–2.13 ms | 0.94–1.01 / 1.35–1.62 ms |
| Replication p50 / p95 | 0.78–0.81 / 1.09–1.22 ms | 0.61–0.72 / 0.86–1.03 ms |
| AI p50 / p95 | 0.72–0.73 / 0.84–0.96 ms | 0.23–0.25 / 0.29–0.33 ms |
| Actors napping per tick | 0 | 777 of 1,051 |
| Actors in motion (sampled) | 42.8 | 50.5 |

The tick is about a third shorter at p50 and about a quarter at p95, while
slightly more rabbits move. **The 2 ms goal is not reached.** (The machine was
busier than for the previous slice; quieter runs of the same code gave
2.48–2.61 ms.)

Pixel 7a, `render:bench` crowd scene in the seed-2026 city (about 885 rabbits and
49 cars, Vite dev modules), before and after runs alternated:

| Zoom | Worker tick p50 / p95 before | After |
| --- | ---: | ---: |
| 1 | 25.2–26.7 / 33.4–37.8 ms | 11.0–14.3 / 17.7–21.8 ms |
| 0.25 | 27.0–34.2 / 43.5–48.5 ms | 14.3–17.7 / 24.1–28.2 ms |

Phone physics p50 went from 12.5–20.8 to 4.9–8.2 ms. The median phone tick now
fits a 60 Hz authority at zoom 1 and is at the limit at 0.25; p95 does not fit
in either. The phone's main thread still misses frames (its own `update` rose
from about 5.6 to 7–8 ms, since it now receives more ticks per second). The
Steam Deck was not re-measured.

### What the profile showed first

Only about 80 of 1,000 rabbits were resting on a timer. About 670 had a finished
rest and were asking the AI planner for one of its four starts every tick, and
most starts went to food searches that found nothing (the bench has no food).
So the crowd was mostly a queue, polled every tick.

### Changes

1. **Naps** (`src/server/RealmNaps.ts`, `src/entities/naps.ts`). Each tick the
   admitted actors are split into those simulated and those napping. An actor
   naps while its brain only waits on clocks, its body rests on static ground
   (`PhysicsScene.restful`), its picture is still, no player is within 64 px and
   it decides every tick (the outer ring, which decides every fourth tick on
   accumulated time, stays awake, and a nap ends when its actor moves into
   that ring).
   Napping actors are left out of decisions, motion intents, the physics
   synchronize/motor/readback passes (`held` bodies), post-physics finish, work
   posing, the wildlife activity check and the replication comparison.
   - A nap ends when a clock is due, when the actor is disturbed (`wake`: the
     startle functions, `PhysicalEdits`, script handles, the planner, and the
     solver waking the body), when a player comes near, and in any case on the
     actor's own regular tick, once in nine. So an edit from a writer that does
     not call `wake` is admitted to physics and replication at most 8 ticks
     (133 ms) late, instead of never.
   - On waking, the skipped clock ticks are replayed with the arithmetic the
     decisions would have used, so a rest ends on the same tick as before.
     Only rabbits declare their waiting state so far
     (`src/wildlife/rabbitWaiting.ts`); another species opts in with `waits`
     and `idles` in `WILDLIFE_SPECIES`.
   - Replication skips the comparison only when some stream compared the actor
     on or after its last simulated tick and this stream already holds that
     snapshot, so a stream that fell behind (backpressure) still gets the change.
   - Physics learns that a held body woke from the solver's active set rather
     than by asking every body. Held bodies in resting contact keep their
     contact entries, and the ground under held bodies stays compiled.
2. **A first-come line in the AI planner** (`AiPlanningScheduler`). A goal refused
   for lack of budget joins a line; each tick the front of the line is offered
   that tick's ordinary starts and woken, so a waiting actor need not ask again.
   This replaces the per-tick priority sort and rotation. Urgent alarms still go
   first, and a request that waited half a second goes before alarms. Requests
   of actors the realm no longer simulates are dropped when they reach the
   front, a long line is swept of them, and closing a world clears the planner.
3. **Static geometry rebuilds no longer wake the scene** (`resettle` in
   `HeldBodies.ts`). Rebuilding the single static compound collider wakes every
   body resting on it, and each needed most of a second to sleep again. In the
   city that happened whenever a moving car changed the set of collision
   sections. Bodies that were asleep, that the new ground moved less than
   0.016 px in the following step and that are not falling (a falling body has
   one step of free-fall speed, however weak the gravity) are put back to sleep
   at once. With gravity switched off nothing shows whether a body is still
   carried, so nothing is put back to sleep.
4. **Wheel rays use a grid** (`WheelGrid.ts`). Each awake car's wheel rays tested
   every body's bounding sphere in JavaScript; they now look up the bodies in
   the ray's 2 m ground cells.

### What changed in behaviour

- **Planner order and rate.** Waiting goals are served first come, first served.
  A rabbit whose food search finds nothing may now hop on the same start, instead
  of the search using up its turn. That alone made the saturated crowd about
  2.5 times livelier (110 rabbits in motion instead of 43–51), so ordinary goals
  now get two of the four starts per tick (`ORDINARY_STARTS`), which keeps the
  crowd as lively as before (50.5 in motion). Alarms can still use all four. In
  a crowd of another species that saturates the planner, ordinary planning is
  half as fast as before; a world with fewer animals than the budget sees no
  difference. Raising `ORDINARY_STARTS` to 4 costs about 1 ms of tick on the Mac
  in this bench.
- **Decision order within a tick** is now offers, alarms, near, far, instead of a
  rotation that depended on how many actors decided.
- **Naps themselves are meant to change nothing a client receives**, and the
  evidence is the crowd fixture: its wire digest is identical with 8-tick and
  16-tick naps, and `RealmNaps.test.ts` compares a napping realm with one that
  never naps, tick by tick. That is one fixture, not a proof for every species
  and scene. The digest changed from `46beb807…` to `4fb15856…` because of the
  planner changes above.
- After a geometry rebuild a resting body's solver pose may differ from its
  cached pose by up to 0.016 px (measured: about 0.00002 px) until its next
  real readback.
- Known limit, unchanged in kind: an edit made by code that does not call `wake`
  on a napping actor is seen up to 8 ticks late.

### Phone physics: what it is made of

A Worker profile on the Pixel 7a (`render:bench --cdp … --profile`, now
supported over a phone's DevTools connection) showed physics at 44–48% of the
Worker. Within it, before the changes above:

| Part | Share of Worker time |
| --- | ---: |
| Rapier's own step | 12–13% |
| Reading bodies back (pose, velocity and contact callbacks) | 12% |
| Wheel rays scanning every body in JavaScript | 8–9% |
| Synchronize, motors, intents, finish | about 12% |

So the solver was about a quarter to a third of phone physics; the rest was our
code around it. The largest single cause was not visible in a flat profile: the
static geometry rebuild that woke every body (change 3), which kept most bodies
awake in the city and made every per-body pass run for all of them.

### Validation

3,562 native tests in the affected directories; the four crowd-bench tests;
`streaming:bench -- --assert-ready`; typecheck, lint and the code-health ratchet;
a production build; and the physics, prediction, riding, car, wildlife and
split-screen browser cases. New tests cover: whole-realm equivalence with and
without naps, exact clock catch-up, every wake path, the planner line, held
bodies (not read, woken by a collision, removed, contacts kept, ground kept,
falling when the ground goes, also at 1% gravity), a stream that fell behind,
departed planner requests and the wheel grid. An independent review found four
defects (re-settling at low gravity, the replication skip under backpressure,
reduced-rate decision timing and departed requests clogging the line) and, on
re-check, three leftovers (zero gravity, a tier change during a nap, clearing
the planner when a world closes); each is fixed, with a regression test where
one applies. Of 49 browser cases, the known flaky split-screen case and one fox
case needed a retry in one run; the fox spec then passed 52 of 52.

`PhysicsScene.ts` shrinks (edits moved to `BodyEdits.ts`); `Realm.ts` shrinks;
`EntityHandle.ts` and `RealmActivity.ts` gain two lines and one.

### What remained after this slice

The estimate made here (about 1.1 ms at rest plus 20 µs per moving rabbit) was
wrong: the next slice halved the actors awake and the tick fell by 13 %. See
"What remains for 2 ms" below it.

## Authority slice: fewer actors awake (delivered 2026-11-10)

The owner asked for the cost of moving actors to be reduced. A temporary counter
in `partitionNaps` showed who was awake each tick in the bench, and why:

| Awake per tick (of 1,051) | Before | After |
| --- | ---: | ---: |
| On the forced waking tick (one in nine) | 98 | 0 |
| Standing after a hop, waiting for the solver to sleep the body | 63 | about 10 |
| In a hop's gather or landing, standing | 36 | about 5 |
| In a hop's travel | 22 | 22 |
| Parked cars | 50 | 50 |
| Other (asking the planner, touching a neighbour, the player) | 5 | about 30 |
| **Total** | **274** | **about 120** |

Only the 22 were moving. ("Other" grew because rabbits that used to be counted
under the first rows now show up briefly as they change state.)

**Result** (M4 Pro, Node 24.22.1, three interleaved fresh processes each;
[evidence](../benchmarks/235-authority-hop-holds.json)):

| Measure | Before (`da8165be`) | After |
| --- | ---: | ---: |
| Tick p50 | 2.61–2.92 ms | 2.27–2.33 ms |
| Tick p95 | 3.16–3.78 ms | 3.16–3.32 ms |
| Physics stage p50 / p95 | 0.93–1.08 / 1.18–1.46 ms | 0.69–0.71 / 1.05–1.08 ms |
| Replication p50 / p95 | 0.64–0.67 / 0.75–0.89 ms | 0.62–0.64 / 0.85–0.89 ms |
| AI p50 / p95 | 0.23–0.24 / 0.28–0.31 ms | 0.18 / 0.23–0.25 ms |
| Actors napping per tick | 777 | 929 |
| Body reads / motor updates per tick | 102 / 171 | 68 / 115 |
| Replication bytes per tick | 9,756 | 8,892 |
| Actors in motion (sampled) | 50.5 | 49.7 |

The tick is about 13–15 % shorter at p50; p95 is at best slightly better.
**The 2 ms goal is not reached.** (Another project's test suite loaded the
machine for part of the session; these runs were taken at a load average near 3.)

**Pixel 7a: no measurable change.** Crowd scene in the seed-2026 city, run
after/before/before/after with 150 s pauses:

| Zoom | Worker tick p50 / p95 before | After |
| --- | ---: | ---: |
| 1 | 12.9–13.8 / 19.6–20.2 ms | 12.6–13.7 / 20.2–20.7 ms |
| 0.25 | 16.4–18.7 / 24.0–26.4 ms | 16.6–17.2 / 24.4 ms |

The phone's runs differ from each other by more than this change is worth, and a
first pass without pauses drifted by several milliseconds as the phone warmed.
(The phone runs predate the review fixes below, which do not touch the tick's cost.)
Its Worker profile is flat: Rapier's own step 8 %, body readback 7 %, choosing
who simulates 7 %, moving traffic (wheel contacts, route planning) about 10 %,
replication 16 %.

### Changes

- **Naps go straight on** (`RealmNaps.ts`). A nap that ran its length continues
  without a simulated tick in between while its conditions still hold; that tick
  would have changed nothing. `LONGEST_NAP` (8 ticks) is now only how often the
  conditions are looked at again and the actor is compared for replication.
  A nap ended from outside (`wake`, a player near, a tier change) is still
  followed by a simulated tick.
- **A hop's standing parts nap** (`rabbitWaiting.ts`, `rabbitInteractions.ts`).
  A hop lasts one second and travels only between 0.25 and 0.625 s. While the
  rabbit stands on the ground it starts from or lands on, `prepareRabbitHop`
  no longer prescribes a height (the motor ignored it there anyway), so the
  intent is idle and the body may sleep; the rabbit naps and its hop clock is
  replayed on waking. Clients run the hop clip themselves between frames, as
  they already did, so the authority no longer sends its phase every tick.
- **An actor that stops is put to sleep at once** (`restNow` in
  `HeldBodies.ts`). The solver waits half a second or more before sleeping a
  still body, and rabbits stayed awake about a second after each hop. A
  non-player character whose own motor asks for nothing, that the step left in
  place (within 0.016 px), on static ground with no other body in reach, now
  sleeps on that tick. A body something else woke is left to the solver.
- **A sleeper is woken before something lands on it** (`meetBody`, and the
  airborne ground probe in `BodyReadback.ts`). Landing on a sleeping body drove
  it about a pixel into the ground, because its own ground contact joins the
  solver one step late. That was already so for any animal at rest for a while;
  sleeping bodies sooner made it the common case and the raptor hunt test found
  it. The wake-ups are applied after all bodies are read, so the result does not
  depend on body order.

- **A nap never lags what is shown outside simulation** (`endNap`). A hop's
  clock is behind during a nap, which is invisible while clients run the clip
  themselves but not otherwise. So a nap ends, with its clocks replayed, when
  its actor is published without having been simulated that tick: a paused
  realm, a workshop clock stop or manual step (`ScenarioSession.publish`), an
  actor that left admission but is still in view. A viewer that takes a first
  baseline of a napping hop wakes it, so the current phase follows a tick later.

### What changed in behaviour

- Rabbits farther than 64 px from every player show their hop clip from the
  client's own clock for up to eight ticks at a time; the test holds it within
  2 ms of the authority's phase. A new viewer may see a hop up to eight ticks
  behind for one tick.
- Landing on an animal that had been resting for a while no longer sinks into
  it. Raptors therefore land cleanly on resting prey at the first approach; the
  prey may then startle and hop off, so a hunt can take a third approach (the
  realm hunt test allows 900 ticks instead of 600).
- A still actor's body sleeps within a few ticks instead of after about half a
  second. A sleeping body is woken by contact as before.
- The wire changes (fewer clip-phase updates, `jumpZ` stays 0 after a hop
  instead of being absent for one tick), so the bench digest changes.

### Validation

`RealmNaps.test.ts` compares a napping realm with one that never naps, tick by
tick, in everything but the clip phase of rabbits napping inside a hop, and
compares what two clients show (clip, phase within 2 ms, position).
`HeldBodies.test.ts` covers the early sleep, its exclusion with a neighbour in
reach, and landing on a sleeper (free and held); each was checked to fail with
its change removed. Further tests cover a late viewer, publication outside a
tick, an actor leaving admission mid-nap and 900 manually stepped ticks.
3,571 native tests pass.

The independent review found, over four passes: the airborne `jumpZ`
assignment dropped by accident (restored, with a test), stale hop phases for
late viewers, pauses and actors leaving admission (the `endNap` paths above),
and rabbits never hopping under manual stepping when ending a nap skipped the
planner clock (it is replayed now). Its last pass found nothing further.

### What remains for 2 ms

Halving the actors awake bought 13 %, so most of the 2.2 ms is not per moving
actor. It is steps that visit all 1,051 actors or bodies every tick whatever
they do: choosing who simulates (`RealmActivity.select`, about 7 %), the
napping split itself (about 6 %), the replication frame loop and interest list
(about 16 %), the prediction snapshot around the player (about 6 %), physics
`synchronize` over live and held bodies (about 5 %), and Rapier's own step
(about 10 %).
1. Make those whole-list steps follow changes instead of visiting everyone.
2. Parked cars (50 of the 120 still awake), residents, other species and the
   outer ring of actors that decide every fourth tick do not nap yet.
3. Fixed bodies (resources, anchors) are still read every tick; they are absent
   from this bench but common in the woods.

### Review boundary and next slices

First review the attributed baseline above. Proposed next order:

1. Remove repeated appearance application and vehicle prompt search work; keep
   arrival, animation and prompt behavior covered in native tests.
2. Reduce sleeping-body reads/contact queries; add only the counters needed to
   show reads following movers/contacts and test each wake path.
3. Change-tracked replication, including animation and non-motion gameplay edits.
4. Reprofile before choosing activity/AI work or further render preparation.
5. Confirm the combined improvement in the headed lab and a small real-game control.

For a later unattended goal, keep the frozen recording, source fingerprints and
matched repeated baseline; authorize bounded optimization slices with a commit
and evidence update per slice. Require native behavior/equivalence checks,
compatible timing comparisons and targeted browser validation at the affected
boundary. Stop for changed gameplay semantics, unexplained output differences,
measurement incompatibility or a redesign beyond the authorized slice. Do not
use tiny timing gains or the absolute 2 ms/120 Hz target alone as a completion test.

Initial suggested order (superseded by the checkpoint's review order above):
1. ~~Flat-ground shadow fast path~~: delivered as the receiver partition
   fixes above.
2. Skip physics reads and contact queries for sleeping bodies.
3. Change-tracked replication.
4. Incremental activity selection.
5. AI kind lookups.
6. Lab per-frame scans.
