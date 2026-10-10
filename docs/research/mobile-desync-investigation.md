# Mobile warping, stalled walking animation and frame drops

Investigation: 2026-10-10, runtime revision `2d8248e`. Historical measurements.
[088](../tactical/088-wildlife-work-budgets.md) records subsequent runtime sleep,
search-budget and local-animation delivery; its results are separate from these
baseline/prototype captures.
[Performance](../topics/performance.md), [prediction](../topics/player-prediction.md)
and [activation](../topics/entity-activation.md) own follow-up work.
[085](../tactical/085-robin-search-cost.md) records the subsequent delivered robin
CPU optimization; measurements in this investigation describe the original runtime.
[Sanitized measurements](../benchmarks/mobile-desync-investigation.json).
[Physical-phone controls](../benchmarks/mobile-authority-investigation.json).

The attached phone confirms excessive countryside authority work in an isolated
fresh world. Two client weaknesses reproduce independently of animal load.
The user's original world/session has not been captured, so these establish
mechanisms and optimization priorities rather than attribution of every reported warp.

## Attached phone: native Worker, rendering and IndexedDB

Pixel 7a, Android 17, Chrome 154, native portrait viewport, regional seed 2026,
thicket dog-clearing arrival. Each control creates a fresh isolated world, warms
for two seconds and samples stationary gameplay for 15 seconds. No desktop CPU
throttling or competing tests. Battery temperature stayed approximately 27–30°C;
Android thermal status stayed zero. These are instrumented samples, not acceptance
gates or a recording of the user's existing save.

| Diagnostic control | Active actors at end | Tick median / p95 | Physics median / p95 |
| --- | ---: | ---: | ---: |
| Native baseline, repeated | 158–159 | 11.1–11.3 / 22.9–26.4 ms | about 4.9 / 6.6–6.9 ms |
| Only visible/proximate AI decisions; physics unchanged | 167 | 10.5 / 13.5 ms | 6.2 / 7.1 ms |
| Freeze hidden wildlife beyond one-chunk view margin and proximity | 22 | 8.4 / 12.5 ms | 1.5 / 2.1 ms |
| Prop/perch query cache alone | 159 | 11.1 / 24.9 ms | 4.8 / 6.7 ms |
| Freeze hidden wildlife plus query cache | 22 | 8.3 / 13.5 ms | 1.5 / 2.2 ms |

Resident population stays 242, including **221 robins**; only about three actors
occupy visible chunks. The dog-clearing name does not identify its dominant load.
Current activation spans a four-chunk radius while the phone sees roughly two
chunks. Far-tier sleeping works, but the active area admits many offscreen birds.
Reducing decisions alone leaves 60 Hz movement/support work. Resting birds also
perform ground queries that airborne birds can skip, explaining why physics gets
more expensive in the decision-only control. Freeze both wildlife decisions and
motion when gameplay permits; do not apply this indiscriminately to players,
vehicles, projectiles, followers, attachments or contact/support dependencies.

In the final baseline/query-cache/sleep-with-cache/baseline sequence, native rAF intervals
stay near 16.7 ms p95 but baselines have six/eight frames over 25 ms, versus zero
in the sleeping control. Baseline acknowledgement maxima are 795/873 ms and
replay occupancy reaches 55/69 inputs; sleeping has a 57 ms maximum and two inputs.
Worker tick-start cadence measures 56–58 Hz baseline versus 60 Hz sleeping.
The authority recording window slightly exceeds the main-thread window. This
supports backlog risk without proving the cause of original walking corrections:
stationary controls have zero positional resimulation error. An earlier series
used callback wall time instead of native rAF timestamps; its frame timings are
excluded from committed comparisons.

### Specific remaining costs

Robin generation considers qualifying trees in a surrounding chunk halo and has
no population cap per chunk. Dense countryside therefore produces a large flock.
Its decision timers are already seeded; they are not all the same two-second timer.
Preserve existing individuals and save semantics. Any future density rule belongs
to generation work, separate from freezing existing wildlife safely.

`robinAI` discovers perches even before its timer expires. On a decision it builds
perch/ground candidates, scans active animals and walks candidate paths in three
pixel increments. Each path step spreads the observed bird into a temporary body
and invokes terrain/prop occupancy checks. Individual measured robin calls can
take about eight milliseconds. A time budget around whole decisions alone cannot
prevent that overrun: searches need bounded candidate/path work or a resumable
cursor. Cached chunk/perch queries alone did not materially improve whole ticks.

`EntityManager` repeatedly queries ground/support for resting NPCs and refreshes
spatial membership. Chunk-sized prop/actor candidate lists amplify local work.
Prioritize narrower collision candidates and reuse of unchanged support results,
with invalidation on edits, pose and movement. Persistent actor proxies also mark
and reindex state on individual field writes; investigate batching only with
save-barrier/revision coverage, rather than assuming it explains current spikes.

### Recommended implementation direction

1. Separate wildlife simulation interest from residency: union every player's
   visible area plus a margin and near-player interaction radius. Preserve contact,
   support, followers and attachment dependencies. Use wake/sleep hysteresis and
   freeze saved state without elapsed-time catch-up. Do not make authority depend
   exclusively on one host camera, or let extreme zoom admit unlimited work.
2. Keep immediate nearby motion/contact fixed-step. Admit expensive wander/path
   decisions by priority and distance under a measured CPU/work budget. Trial
   roughly 0.5–1.5 ms planning time per tick and lower perception frequency; split
   individual searches so one call cannot consume the entire budget. These are
   starting hypotheses, not established safe settings.
3. Improve resting-body support/broadphase work and defer unnecessary perch work
   until a decision is due. Account for shared game/lab and multiplayer consumers.
4. Give predicted player/mount animation a local phase and explicit history
   overflow recovery, as below. Keep presentation clocks independent of AI budgets.

Sleeping alone still leaves 12.5–13.5 ms tick p95; it is insufficient phone
headroom. Use a provisional **4–6 ms p95 authority CPU target**, then validate
moving/zooming, contact, wake transitions, two separated players, edits and
persistence on the phone. Main-thread terrain/GC/raster stalls remain separate.

## Controlled real-Worker reproduction

Bundled full Chromium, headless Canvas, Apple M4 Pro, 1280 × 900. Each case creates
an isolated flat world, enables noclip to exclude collision and holds Right.
After 300 ms of movement the diagnostic occupies only the Worker or main thread.
Separate controls delay outgoing commands while snapshots continue. Timers,
prediction, rendering, binary transport and authority code remain production code.
Samples read the predicted player after render restores its borrowed display pose;
backward distances below are sampled prediction, not pixel-tracked screen travel.

| Control | Longest unchanged walking frame | Largest backward position step | Maximum replay count |
| --- | ---: | ---: | ---: |
| Baseline | 165 ms | <0.001 px | 2 |
| Worker occupied 350 ms | 482 ms | <0.001 px | 22 |
| Worker occupied 750 ms | 867 ms | <0.001 px | 46 |
| Worker occupied 2,500 ms | 2,616 ms | 25.77 px | 128 |
| Main thread occupied 350 ms | 477 ms | <0.001 px | 1 |
| Outgoing commands delayed 750 ms | 902 ms | <0.001 px | 46 |
| Outgoing commands delayed 2,500 ms | 2,653 ms | 0 px | 128 |

The long Worker stall's post-replay displacement reaches 28.22 px, while its
largest render interval is only 23.1 ms. The main-thread stall instead produces
a 359.2 ms render interval. All cases have no page errors. Earlier independent
runs repeat the short-stall animation hold and long-Worker-stall backward step;
the exact distances depend on delivery phase. The final run has no competing
repository validation or crowd benchmark.

**Animation:** `RemoteStateView.tickAnimations` ticks replica sprites, not the
predictor's cloned player. `PlayerPredictor.reconcile` copies replica
`frameCol`/`animTimer` while preserving locally predicted `moving`/direction.
Without reconciliation the predicted sprite's phase stays fixed. With delayed
outgoing movement the authority still reports idle, so its replica clock stays
zero and reconciliation repeatedly supplies zero phase. Thus walking can freeze
under sub-second delays without exceeding the input buffer or dropping renders.
Give the predicted player's animation an explicit local clock; preserve its phase
through reconciliation while still applying authoritative structural/model changes.
Account for predicted mounts and shared game/lab consumers.

The attached phone's flat-world A/B applies a diagnostic Vite transform, leaving
runtime source unchanged. It advances player/mount sprite phase once per live
prediction step (not during replay) and retains local phase when the authoritative
sheet/clip structure matches.

| Phone control | Native longest unchanged walk frame | Local-phase prototype |
| --- | ---: | ---: |
| Baseline | 182 ms | 137 ms |
| Worker occupied 350 ms | 381 ms | 155 ms |
| Worker occupied 750 ms | 882 ms | 137 ms |
| Worker occupied 2,500 ms | 2,563 ms | 135 ms |
| Outgoing commands delayed 750 ms | 899 ms | 138 ms |
| Outgoing commands delayed 2,500 ms | 2,649 ms | 138 ms |

This validates the animation mechanism. Main-thread pauses still prevent frames
from drawing, and the long Worker stall still causes a sampled backward step:
27 px native and 33 px with local animation, both at 128 replay entries. The
animation control does not repair movement history. Before production delivery,
cover mounts, idle/direction transitions, model swaps, timed authoritative clips,
teleports/reset and shared embedded consumers. Controlled keyboard movement on
the phone is not a touch-input performance test.

**History exhaustion:** `storeInput` silently shifts the oldest entry once its
128-command buffer is full. At 60 Hz this covers about 2.13 seconds. Reconciliation
restores the authoritative state and replays the remaining commands, so a sufficiently
old acknowledgement cannot reconstruct all locally predicted movement. A long
Worker stall reproduces that loss and a backward correction. Merely increasing
the buffer extends the window and replay cost. Add overflow/old-ack diagnostics
and an explicit bounded recovery policy; measure acknowledgement age in seconds
as well as sequence distance. The outgoing-delay control reaches the same limit
without the same large backward step, so delay placement matters.

## Actual generated countryside workload

Production Realm/streaming/native AI/persistence records through ScenarioSession,
regional seed 2026, thicket profile, six existing inspected arrivals. Each runs
240 idle input/tick pairs; the first 60 warm up, then 180 measure ticks and separate
replication. There is no renderer, live ServerLoop or IndexedDB in this lane.
Each 20 ticks yields to async fixture work; this measures admitted CPU work,
not real timer lag or phone FPS. Animals move and make native decisions.

| Scene | Resident actors | Active actors | Resident props | Tick median / p95 | AI + prop admission p95 | EntityManager physics p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| City pets | 19 | 12 | 110 | 0.25 / 0.43 ms | 0.08 ms | 0.11 ms |
| Farmstead | 134 | 94 | 620 | 1.53 / 9.24 ms | 6.25 ms | 1.16 ms |
| Pond | 207 | 123 | 895 | 2.93 / 10.78 ms | 7.56 ms | 2.05 ms |
| Dog clearing | 248 | 165 | 991 | 4.38 / 15.41 ms | 10.80 ms | 2.65 ms |
| Deer glade | 249 | 173 | 971 | 4.54 / 15.32 ms | 9.11 ms | 2.72 ms |
| Forest | 212 | 136 | 960 | 3.82 / 11.86 ms | 7.97 ms | 2.18 ms |

Active counts include the controlled player, not only wildlife. Prop counts are
resident, not visible. The AI/admission phase starts after decision selection and
ends at `firePre`, including `simulationProps` filtering and `tickAllAI`. Physics
includes NPC movement, ground/support queries, spatial updates, separation and
animation. Dirty-record timings nest within other phases; do not sum them.
Phase percentiles are independent and do not sum to whole-tick percentiles.

Dog/deer scene tick maxima reach 23.72/27.06 ms on this fast desktop before
replication, output encoding, persistence adapter and renderer costs. This warrants
physical-mobile profiling, now recorded above. Source inspection finds fauna decision candidate/path checks,
group/nearby scans and repeated prop/collision queries; measure them individually
before selecting an optimization. Newly created fauna start with the same two-second
decision timer, and reduced-tier decisions are admitted in common four-tick batches;
these provide concrete opportunities to stagger work, without claiming that they
explain every measured spike. The long-tail generated workload differs from
the synthetic crowd's predominantly steady physics cost.

## Synthetic near/far population control

Flat production Realm with 0/24/96/384 native dogs on a 24 × 18 px grid. The far
control moves the 384 dogs nine chunks east but deliberately keeps them resident
with camera demand. It reports 385 resident actors and only one active actor.
Consequently this is not an unloading test: it proves frozen resident actors avoid
AI/physics. Far actors still cost replication when the camera requests them.
The full population matrix and phase timings are in the measurement file.

The final independent run measures 384 nearby dogs at 32.31 ms median
(36.55 ms p95), versus 0.17 ms median (0.35 ms p95) far away. Nearby physics takes
29.60 ms median. This artificial density exceeds the normal scenes above; it
establishes scaling risk, not the user's animal population.

Streaming already selects actors from active record buckets. Full decisions extend
two chunks around the player, reduced decisions four, and support residency five.
Movement in both active tiers stays fixed-step; camera-only residency does not
activate distant AI. NPCs pay repeated chunk-level collision/support queries and
spatial updates; dense nearby populations need a separate broadphase investigation.
Adding species definitions alone does not tick every species everywhere.

## Existing traversal gate and recommended next work

The ordinary city traversal passes `streaming:bench -- --assert-ready --cpu=4`:
standing/walking/sprint/reversal/zoom have no visible missing or incomplete terrain;
movement frame p95 is approximately 16.7 ms and resimulation error is below
0.001 px. Its movement scene has only about 15–19 replicated entities. CDP CPU
throttling is a desktop diagnostic; Worker throttling was not independently
verified. This gate does not establish countryside or phone headroom.

1. Fix the local predicted animation clock with short Worker/delivery-gap regression
   cases in both game and shared embedded consumers.
2. Add per-phase authority timing, acknowledgement age, replay occupancy/overflow,
   streaming support blocks and active/resident counts to an opt-in bounded capture.
   Extend the isolated physical-phone capture to the user's actual world and moving
   gameplay alongside main-thread frame/GC/raster data.
3. Implement the contact-safe wildlife sleep and resumable decision budget described
   above, then optimize collision/support broadphase. Preserve nearby fixed-step
   motion/contact and measure the phone again.
4. Specify bounded history-exhaustion recovery, including queued-input admission
   during unavailable terrain. Do not hide unrecoverable missing history solely
   with visual smoothing.

Prior phone evidence separately identifies GC/raster hitches. The new authority
findings do not attribute every frame drop to the server. Runtime is unchanged;
the new CLIs are characterization probes, not passing performance gates.

## Rerun

Run timing probes sequentially, without tests/builds competing for CPU:

```sh
node scripts/instrumentation/desync-stalls.mjs --output=/tmp/tilefun-desync-stalls
node --import tsx scripts/instrumentation/active-crowds.mjs --natural --output=/tmp/tilefun-natural-load
node --import tsx scripts/instrumentation/active-crowds.mjs --output=/tmp/tilefun-active-crowds
npm run streaming:bench -- --assert-ready --cpu=4 --output=/tmp/tilefun-streaming-cpu4
```

The browser probe owns ephemeral auth/data, bundled Chromium and a private Vite
origin, then closes its browser/server. Raw per-frame samples and host diagnostics
stay under the selected output directory; committed evidence omits ephemeral IDs.
Population probes use in-memory persistence. Instrumentation itself adds allocation
and timing overhead. Validation: typechecks, 2,105 unit tests and lint; no runtime
change requiring new rendering/browser regression assertions is delivered.
