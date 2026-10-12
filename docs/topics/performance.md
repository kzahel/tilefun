# Streaming and gameplay performance

Topic: performance
Status: shared Worker authority and terrain preparation implemented; physical
Android traversal validated; renderer/allocation audit complete; grass cache
identity/lifetime fixed, gameplay grass frame storage and terrain scheduler records
reused; static prop depth and elevation metadata cached; Canvas terrain resources
removed from world chunks; neutral frame/backend separation delivered, with raster
scheduling and cold-entry presentation remaining as separate performance work.
Wildlife sleep, shared bounded planning across all native families and ambient
wander, and local predicted animation are delivered.
Updated: 2026-10-12.

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

The isolated streaming runner now limits Vite dependency scanning to index.html;
ignored archived review HTML is not a benchmark entry. Windows revision/dirty
reads use Git through WSL. Failed game startup retains a screenshot, page errors
and visible text under the selected output directory before closing its owned
browser/server. Six runner-matrix checks pass; [084](../tactical/084-common-pets-and-variations.md)
records the pet-batch integration readiness run and its limits.

084's Windows browser regression run also finds two unchanged standalone GPU
diagnostic failures: interior comparison has six pixels outside the existing
tolerance, and translucent indexed rectangles reach channel error 2 against a
limit of 1. The fixture renderer does not load animal art. Pet Canvas/GPU
motion/contact/persistence checks pass; these diagnostic tolerances remain
unchanged and the platform discrepancy remains unresolved.
Both failures reproduce serially without competing browser tests.

- Single player runs the shared server in a dedicated browser Worker.
  `src/server/LocalServerRuntime.ts` owns lifecycle; ordered, bounded
  `src/transport/WorkerClientTransport.ts` carries replicated state. Prediction
  and rendering stay on the main thread. P2P hosting still runs its authority
  on the main thread; dedicated hosts reuse the same server implementation.
- Timed authority uses ServerLoop's monotonic fixed-step deadlines, not repeating
  timer callback counts. Fractional timer rounding no longer produces ~62.5Hz
  simulation while advertising 60Hz. Catch-up is bounded to 250ms and lifecycle
  resume/rate changes reset the schedule. Native timing and roof-camera evidence
  are in [the prediction follow-up](../research/train-camera-and-jump-reproductions.md#shared-authority-timing-fix);
  the subsequent [shared presentation follow-up](../research/camera-basics-reproductions.md#shared-presentation-fix)
  adds pure basic-motion contracts and native approximately-120Hz straight-motion
  measurements. Benchmark render wrappers forward the actual render timestamp.
  Streaming readiness is not a frame-pacing proof; injected absent callbacks do
  not measure real GC, and variable motion/long authority debt remain outside acceptance.
- Interactive labs now use the production ServerLoop and OrderedWorkerChannel;
  a render stall no longer stops authority. Live Realm ticks use normal streaming
  admission rather than waiting for the entire view. Manual headless fixtures keep
  explicit readiness/steps. [Scheduling evidence](../tactical/069-interactive-authority-scheduling.md)
  distinguishes authority cadence, input submission and output backpressure;
  synthetic browser stalls establish independence, not physical-device pacing.
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

The streaming browser regression retains at least 210 sampled display frames per
direction and its existing travel/readiness/cache bounds, with a 20-second
elapsed-time limit to complete 450px of traversal. Display frames do not establish
simulation time; fixed-frame windows could return only 309px on hosted CI.
The 2026-10-12 CI run also stopped at 363px beside moving road traffic; this
terrain-only check now uses the existing debug noclip path to isolate traversal
from transient vehicle collisions. Native collision checks remain in their own
browser/unit suites. This is a traversal readiness check, not a frame-rate or
throughput benchmark.

CI harness validation (2026-10-11): typechecks, 2,520 units, 11 Worker tests,
Worker build, lint (existing warnings) and production build pass. The full browser
run passed 555 cases and exposed two touch failures; both were corrected and pass
the normal `--last-failed` rerun. Twelve final touch repeats pass, as do six aquatic
ball repeats at 4× CPU throttling and the earlier 18 throttled regression checks.
These checks cover all 557 browser scenarios across the full run and reruns.

The [local server recovery investigation](../research/local-server-recovery-investigation.md)
tracks the 2026-10-10 intermittent map/streaming report. Seeded pond arrival,
rejected open-water arrival and repeated distant travel have not reproduced the
failure. “Reconnecting…” previously described any failed map request; it now
says “Map unavailable”. Fatal Worker errors retain their authority stack and
diagnostics and require Reload; residency snapshots now expose pending/failed
holders and transitions. The original session remains uncaptured, and stalled
readiness/persistence awaits remain an investigation path.
[Game diagnostics](game-diagnostics.md) now owns automatic fault uploads and the
visible local-server watchdog added to capture the next occurrence.

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

[085](../tactical/085-robin-search-cost.md) removes whole-actor copies from robin
path samples and safe idle crown queries. Its 480-case unbudgeted parity lane
retains identical decisions/RNG; warmed desktop decision CPU falls about 42%.
[088](../tactical/088-wildlife-work-budgets.md) adds contact-aware wildlife sleep,
deterministic shared/per-decision planning quotas, and local predicted animation.
Its bounded candidate selection deliberately changes search choices. The owning
[activation](entity-activation.md) and [prediction](player-prediction.md) topics
specify behavior. [089](../tactical/089-prediction-backlog-recovery.md) adds
bounded client scratch replay and authority input-backlog admission, with explicit
history-gap recovery. Its isolated stall controls do not measure countryside AI
headroom or eliminate correction from newly available terrain/contacts.

[090](../tactical/090-incremental-simulation-membership.md) caches demanded actor
groups and checks wildlife sleep before trajectory readiness. Fresh phone
stationary selection p95 falls from 1.7ms to 1.0–1.1ms; walking selection falls
from 1.3–1.4ms to 1.1ms. Whole walking-tick p95 does not improve in these samples;
this is a phase-cost reduction, not a stutter cure. The tactical owns exact run
order, temperatures, workload and final checks.

[091](../tactical/091-static-prop-admission.md) caches static prop admission across
stable demand, readiness, membership and geometry. Native Pixel selection p95
falls from 2.1–2.9ms to 0.3–0.4ms stationary and 1.5–1.6ms to 0.3–0.4ms walking.
Whole walking-tick p95 stays near 11ms; this remains a phase saving. Live collision
queries are unchanged. Moving physics costs 3.2–3.7ms p95 in these samples. The
tactical records validation, concurrent checkout state, ACK/temperature variation
and measurement limits.

[092](../tactical/092-authority-physics-profile.md) profiles frozen 091 production
source on the phone. Walking NPC movement costs 2.5ms p95 versus 0.8ms ground
tracking; 76% of NPC collision resolutions have zero displacement. Full tick time
includes Realm player-input processing as well as EntityManager; phase p95s cannot
be added. The profile owns query counts, sampled CPU attribution and debugger/
temperature/window limitations.

[093](../tactical/093-identical-collision-probes.md) implements opt-in identical
per-call collision-probe reuse for shared EntityManager NPC movement. Both axis
outcomes, momentum clipping and blocked AI reactions remain unchanged; later
calls read fresh geometry, and generic callbacks retain both queries by default.
The phone's NPC prop query count falls about 38%; shallow EntityManager mean falls
about 15% idle/10% walking. Whole-tick p95 overlaps (walking 10.5–11.0ms original,
10.2–11.2ms reuse), so this is a phase saving, not a stutter/desync cure.

[094](../tactical/094-interest-demand-cache.md) reuses sorted interest demand when
ordered ticket values are stable, including repeated empty railway/attachment
submissions. Exact lease expiry and backwards clock changes across retained expiry
boundaries reassemble it; residency still reconciles every update with fresh maps/values. Native phone demand
assembly averages about 78% less walking/80% less idle; streaming mean falls from
0.70–0.84ms to 0.35–0.38ms per streaming update (two updates per tick). Walking
whole-tick p95 overlaps at
10.5–10.7ms; idle p95 falls from 10.0–10.4ms to 9.3–9.6ms in two samples each.
This is another phase saving, with rare spikes still present.

[107](../tactical/107-ground-query-reuse.md) profiles repeated NPC ground/support
ranges and reuses their candidate lists within one synchronous ground pass. Every
actor still resolves fresh terrain/support heights through live objects; nothing
survives the next movement, edit, readiness change or tick. Phone candidate queries
fall about 62%; a minimal timer pair measures walking
ground mean 0.516–0.536ms original versus 0.476–0.478ms reuse (about 9% less).
Whole-tick/EntityManager ranges overlap, including slightly higher idle means;
this is a modest phase saving, with no demonstrated stutter cure. The tactical
owns full results and validation. 115 below delivers NPC collision-blocker fusion
and adaptive fine collision buckets; ground/prop candidates remain separate work.

[110](../tactical/110-server-headroom-proposal.md) zooms out with thirteen current
frozen-source desktop captures, a separate timeline and exact AI search-entry counts.
Nearby routines are admitted at 60Hz, but goal searches are timer/motion gated:
one dog has 1,204 updates and five searches in 20 seconds; the robin group has
25,424 updates and 101 searches. Aggregate AI averages 0.076–0.122ms per desktop
tick across three scenes. Serialization/snapshot construction and mutation/dirty
bookkeeping remain material recurring costs. The trace has regular Worker GC,
but no overlap with its slowest ticks and no reproduction of the phone's large
spikes. The phone was unavailable; these are desktop attribution, not phone
headroom or an optimization result. Longer Right controls become obstacle-blocked;
short walking controls are reported separately. 110 owns the staged proposal;
[111](../tactical/111-server-snapshot-and-deer-scheduling.md) delivers its first
bookkeeping slice and a deer planning pilot on desktop.

111 reuses immutable entity snapshots after comparing every transmitted scalar,
including live tags, clips, support/attachment state, optional removals and
definition-relative duration. Each build checks live values, including edits
between clients within one tick; durable dirty observers alone are insufficient.
Unchanged snapshots skip allocation and delta comparison. Stable lazy actor save
callbacks and cached dirty keys avoid repeated callback/key creation; spatial
membership and descendant invalidation still run immediately, and flush barriers
retain later mutations. Persistence encoding was already lazy.

In a warm 20-second deer capture, snapshots fall from 102,255 constructions to
8,464 across 102,425 checks (91.7% reused), and new actor dirty callbacks fall
from 100,432 to zero despite 100,213 notifications. Deer cohort sensing happens
only on admitted goals: 2,406 herd-list builds become eight. Nearby deer timers,
alarms and committed motion still run at the existing full/reduced rate; ambient
goal eligibility cycles through staggered 100ms simulation-time slots, with one
decision/search start per Realm AI step. Alarms bypass cadence, but keep the
shared start cap; rotating threat/proximity classes provide admission fairness.
That slice retained the other species policies; 113 supersedes its deer-only scheduler.

Two shallow desktop walking repeats measure replication mean 0.214–0.278ms
before versus 0.175–0.182ms after, and tick p95 2.9–3.8ms versus 2.2–2.4ms.
Earlier deeper pairs have overlapping tick p95 ranges. All ten accepted captures
have zero page errors and authority near 60Hz; walking controls cover about 625px.
These are instrumented desktop results, not phone headroom or a demonstrated
stutter cure. Typechecks, 2,414 unit tests, lint, build and six streaming readiness
cases pass. The full browser run passes 543/skips one but has one intermittent
GPU tap-walk startup failure; the original source reproduces the same assertion
under matching two-worker concurrency. 111 retains the reruns and uncertainty;
this is not a clean full-suite or an established input diagnosis. [113](../tactical/113-shared-ai-planning.md) extends due-work admission to all
native wildlife families and generic ambient wander under shared start/candidate/
path quotas, with distance cadence and aging fairness. Fast reactions, timers and
native physics retain ownership; common fauna no longer allocates cohesion lists
during every rest/motion update. Distance classification runs at 10Hz and priority
sorting only happens for potential due goals. A 96-actor synthetic open-near wake reduces peak AI steps from 7.46–8.12ms to
0.44–0.53ms, while every actor receives planning admission by step 60. Ordinary
eight-second moving tick/p95 ranges overlap; this establishes peak work control,
not a general frame-rate or phone improvement. All 2,428 units, typechecks/lint,
build, final duck browser checks and six-case streaming readiness pass. The full
browser run passes 545/skips one; a GPU global upload-stability assertion fails
and reproduces on original source, with final isolated reruns passing. 113 owns
capture provenance, the final waterline correction and the test limitation.

[114](../tactical/114-authority-work-profile.md) follows with nine native desktop
captures and separate deep/shallow/sampled CPU crowd lanes against frozen 113
production source. At 96/384 stationary nearby dogs, movement probes evaluate
5,136/46,352 entity AABBs per tick despite no overlaps; chunk-sized candidates
and the global spanning-body supplement scale poorly. Separate Node CPU captures
attribute about half the 384-dog sampled active time to collision resolution.
These accelerated crowd controls exclude rendering/real IndexedDB and suppress
planning; they are attribution, not a native Worker/phone deadline result.
Ordinary native walking is continuously moving at about 60Hz with work spread
across physics, selection, snapshot validation, streaming and mutation reads.
Ground reuse remains effective (about 26 resolutions/10 candidate lookups per
tick); dirty handling receives about 145 notifications for 40 actors, but only
0.070ms measured nested time in that deep desktop capture. The resulting collision
prototype is delivered in 115 below; support queries and record fast paths remain
separate candidates.
114 owns counts, source/probe hashes, timings and measurement limits. No runtime
policy change or stutter cause is established by this profile.
Retain 60Hz player/contact physics and acknowledgement freshness; lower NPC
publication cadence and compute workers remain distinct later experiments.

[115](../tactical/115-collision-broad-phase.md) delivers a separate 32px footprint
grid for crowded EntityManager movement, refreshing every mover before later
queries and rebuilding all resident solid bodies, including sleepers. A cached
density guard retains coarse queries for sparse passes, after an always-on
prototype added overhead. The narrow blocker fuses exclusions, solidity, height
and overlap checks without temporary Set/filter allocation. Ground support,
replication, residency, separation and 60Hz player physics keep their owners.

Against frozen `e969d8a`, accelerated 384-dog travel whole-tick means fall from
25.06–25.52ms to 9.16–9.89ms, including index costs, with replication separate.
96-dog travel means fall from 2.65–2.80 to 1.59–1.71ms. 384-dog collision
candidates fall 92–93%; all eight full wire/durable traces match. Ordinary native
walking ranges overlap at 1.16–1.31 versus 1.22–1.29ms mean and 1.5–1.7 versus
1.6ms p95, with uninterrupted 512–513px travel near 60Hz. Idle ranges also overlap.
The desktop comparison establishes dense workload scaling; the phone follow-up
below supplies device evidence without an FPS/desync claim.

115's matched physical Pixel 7a follow-up records 384-dog travel tick means of
34.57–38.72ms original versus 13.52–14.84ms delivered, including index costs,
with publication separate. P95 falls from 40.1–44.1 to 16.4–18.0ms; 96-dog
travel means fall from 4.69–5.39 to 3.05–3.40ms. These accelerated phone Worker
controls exclude rendering/real IndexedDB/planning and do not prove whole-game
60Hz capacity. At 384 actors, delivered p95 still reaches 18ms before publication.
All entry/end readings are 25.1–28.0°C/status zero, with charging unchanged.

Ordinary Canvas/Worker/IndexedDB walking ranges overlap at 6.84–7.15 versus
6.80–6.95ms mean, and 9.9–10.3 versus 10.2–10.4ms p95. All four controls travel
continuously 512–513px near 60Hz with frame p95 16.8ms and no page errors.
Idle means overlap too; delivered idle p95 is slightly higher in these repeats.
There is no demonstrated sparse-play gain or desync/stutter reproduction.
[Phone evidence](../benchmarks/115-collision-broad-phase-phone.json) retains
matched source/probe hashes, sixteen shallow crowd/eight native/four counting
captures and thermal/order/diagnostic limits. Runtime source is unchanged.
[118](../tactical/118-phone-physics-headroom.md) completes the next physical-phone
profile on frozen 115 source. At 384 moving dogs, ground tracking takes
4.24–4.47ms mean (about 43% of physics), versus 3.78–3.86ms movement. The original
support census scans about 51,100 entity candidates per tick; this fixture has
no props. Separate read-only fine-index comparisons reduce matched dog candidates
from 132 to 9 per resolution with zero flat-fixture height mismatches. That is a
proposal and candidate-count result, not a shipped change or predicted saving.
[119](../tactical/119-dense-ground-support.md) delivers that slice through shared
EntityManager: the refreshed movement index is read-only through dense ground
tracking, while live support Z, sparse chunk candidates and per-range props retain
their contracts. A moving support is visible at its new footprint before the
coarse hash refresh. Adversarial dense tests cover roofs, sleepers/edits, negative
seams, oversized bodies, steps, jumps, excavations and all-resident support parity.

Clean matched Pixel 7a 384-dog moving tick means improve from 12.70–13.40ms to
10.66–11.04ms (16–18%), and p95 from 15.2–16.1ms to 13.1–13.7ms. Index costs are
included; publication remains separate. Moving support candidates fall 92.5%.
All four 180-frame phone wire/durable parity pairs match. Sparse native walking
means/p95 overlap, and there is no demonstrated ordinary-play gain or stable
whole-game 60Hz claim. Resting/smaller-population tails are mixed. Clean crowds
are 27°C; separate warmer attribution/census/parity diagnostics are explicitly
excluded from timing-gain claims. [119 evidence](../benchmarks/119-dense-ground-support.json)
retains all captures and thermal/order limits.
[123](../tactical/123-npc-movement-profile.md) follows that profile and indexes
static fauna profiles by type, preserving original object identity for every
species/coat. At 384 moving dogs, six lookups per actor/tick formerly perform
6,912 type comparisons per tick; the comparisons disappear with identical query
counts and full wire/durable frames. Four matched warmed phone repeats reduce
aggregate mean tick from 12.457ms to 11.369ms (8.7%), with paired improvements
5.7–15.7%. P95 remains mixed/overlapping and over-budget outliers remain. All
accepted timing readings are 33.0–33.3°C/status zero; this is not a comparison
against cooler 119 controls or whole-game 60Hz proof. Smaller/native walking
results overlap. A direct body-overlap prototype was slower and reverted.
123 retains its failures, thermal-stopped partial phone parity and full desktop
parity, diagnostics, [evidence](../benchmarks/123-npc-movement-profile.json) and
validation scope. Next: measure removal of ignored land/fully aquatic water reads
with unchanged shore transitions; GPU/touch symptom tracing remains separate.

[124](../tactical/124-city-workload-profile.md) zooms out to the real generated city,
normal traffic/pedestrians, Worker, IndexedDB, driving and GPU rendering. Separate
per-car/tick census records about 1,234 road and height reads each per standing
core tick, with 81.7% duplicate cells. Sparse body candidates make terrain reuse a
stronger first traffic candidate than another crowded-body change. Wide-view
player driving still scans full resident lists (roughly 700–1,100 props in the
captured neighborhoods); replication and interest/streaming also become material.
Shallow desktop 0.05 overview driving averages 1.76–1.86ms server/2.33–2.45ms
render CPU with about 617 raster draws/frame; camera residency grows while active
pedestrians stay bounded. Normal-width phone driving has 7.7ms tick p95/16.7ms
rAF p95 at 31.1–31.3°C/status zero. A 0.1 overview-driving warning lane reaches
50ms rAF p95 with only 5.5ms tick p95, but ends at thermal status one and is not
clean capacity acceptance. The fixed 32°C subsequent gate times out with zero
cases; no cool-phone 0.05/GLB-city result exists. Two explicit desktop compact
variants exercise actual mesh draws. [Evidence](../benchmarks/124-city-workload-profile.json)
retains all 30 cases, pilots, capture flaws, failures and source/probe hashes.
Next server slice: measure per-car lookahead road/height reuse with fresh live
obstacle checks; wide-view driving candidates, snapshot/interest costs and actual
phone main/GPU tracing are distinct follow-ups. 123's unused-water-read candidate
remains lower priority after this native city profile. No runtime policy changes
or original-desync explanation are established by 124.

[125](../tactical/125-traffic-lookahead-terrain-reuse.md) reuses successful flat-road
checks only within one car's synchronous lookahead/reservation. A fixed scratch
grid checks exact coordinates and resets per car; bodies, props and reservations
remain live, while bridge/garage grade queries retain the original path. Eight
shallow phone standing captures at 30.9–31.5°C/status zero reduce traffic mean
2.398→1.761ms (26.6%); total server mean 6.220→5.963ms (4.1%, noisy pairs).
This buys scoped headroom, not stable displayed-frame or desync acceptance.
The optimized native driving capture is not admitted after setup loses the fixed
32°C gate. Nine native deterministic flat/grade traces match state, binary frames,
flushed records and live body/prop query counts. Next: conservative swept local
candidates for player driving on authority and predictor, including rider support
and headroom; snapshot/interest and phone GPU/display tracing stay separate.

[126](../tactical/126-driving-collision-neighborhoods.md) narrows shared car prop
queries using live authority indexes and lazy immutable replica-snapshot indexes,
retained during queued replay. Ground queries keep all excavation metadata;
separate rider sweeps preserve headroom, and roof selection/history keep full
entity lists. Authority body queries include spanning footprints. Four cool-phone
0.1 overview drives with matching entry populations lower driving mean
0.541→0.154ms (71.5%) and whole-server mean 4.099→3.879ms (5.4%). Whole main-update
mean is 1.328→1.067ms; this includes work beyond prediction. Frame p95 remains
50ms, with about 234 authored mesh calls/frame and 8.1–8.3ms render means. Native
pose/authority/prediction parity and validation are recorded in 126.

[127](../tactical/127-wide-view-investigation.md) reproduces the remaining phone
wide-view cost with native GPU meshes, sprite controls and browser tracing.
Mesh submission averages 8.28ms versus 4.93–4.98ms with sprites, but callback
p95 remains 50ms. A stationary census records three body and three outline target
size changes/frame. All 45 models have 32–56 primitives sharing one opaque source
material. Exact-size target reuse has a modest, unproven timing result; it does
not restore 60Hz. A cool sprite-only drive still records about 12.4MiB of texture
uploads and 3,274 Canvas raster batches in eight seconds. GPU-service requests
overlap slow callbacks; their elapsed/thread CPU times are not hardware GPU or
physical-display timings. One stationary trace has a late thermal-status change
and is excluded from clean pacing comparisons. The next proposed slice is shared
runtime vehicle geometry batching with independent wheels/lights and native pixel
parity, followed by sprite submission and separately measured terrain pacing.
No production renderer/LOD/terrain policy changes in this investigation.
Snapshot/interest and historical body-query scale remain separate measured proposals.

Ordinary walking ground is only 0.55ms mean in 118's diagnostic control. Two
8-second Canvas traces maintain 16.7ms rAF p95 despite occasional long authority
ticks and acknowledgement tails; correction error stays below 0.00003px and
warping is not reproduced. A 45-second idle trace has one 33.4ms interval with
neither slow authority nor owned-thread GC overlapping it. Do not attribute that
hitch to server overload or GC. Reproducing the original symptom with the actual
renderer/input mode and GPU/presentation plus sequence/publication timing remains
separate work. [Evidence](../benchmarks/118-phone-physics-headroom.json) records
phase/count/CPU/timeline scope and 25.1–28.5°C/status-zero controls.

The [original mobile investigation](../research/mobile-desync-investigation.md)
measured 23–26ms tick p95 on a Pixel 7a with about 160 active countryside actors.
Its experimental sleeping control reduced membership to 22 and p95 to 12.5–13.5ms;
query caching alone offered little gain. These are pre-delivery measurements.
088 records its earlier desktop before/after timing separately. 090 supplies
fresh native-phone stationary and moving controls on the shipped policy. Use a provisional 4–6ms p95 CPU target, then profile remaining
support/collision and streaming work. The city traversal gate has much lower
actor load and does not establish countryside headroom. The user's original
session has not been captured.

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


## Earlier renderer stopping point

[059: Grass overview LOD](../tactical/059-grass-overview-lod.md) is the agreed
final small performance slice. Individual blades retain full detail at zoom
>=0.5, fade smoothly between 0.25 and 0.5, and disappear at <=0.25. The shared
scene collector skips their placement lookup, animation/push, item creation and
sorting when hidden, and releases its grass frame storage. Base terrain remains
visible. Optional grass opacity is backend-neutral scene data; the common raster
adapter preserves inherited alpha around each blade. Game and outdoor embedded
labs share the policy, independently of device pixel ratio. Assets, generation,
ordinary-zoom appearance and renderer/pacing defaults are unchanged.

Engine optimization paused at that checkpoint. The 2026-10-10 desync report
resumes bounded wildlife/prediction work through 088 above. Cached grass ordering,
nearby-entity filtering, deeper GPU instancing and normal-play hitch attribution
are deferred candidates, not an autonomous implementation queue. Resume when
ordinary play shows a material problem, sustained mobile heat/battery use needs
attention, or a feature consumes existing frame headroom. Keep the benchmark
runner available for those decisions. The 055 profile remains evidence for
future investigation; it does not require pursuing every remaining hot function.


The [059 Mac measurements](../benchmarks/059-grass-lod.md) show overview render
CPU p95 dropping from 47.4 to 1.6 ms on Canvas and 9.4 to 1.6 ms on GPU. Both
0.1× after runs record zero slow intervals over 20 seconds of movement, with
frame p95 near 9 ms on the 120 Hz Mac. Full-detail 1× controls remain healthy.
This gain deliberately trades distant blade detail for less work. Pixel timing
was not measured: its fixed <=31°C/status-zero gate expired at 32.6–32.7°C.

Validation for 059: typechecks, 1,505 unit tests, all 334 browser tests, lint,
asset inventories/build and ordinary streaming readiness pass. The embedded
hosts remain covered by the common engine suite. Grass cutoff/fade and re-entry
checks pass; fractional-scale sampling differences remain an explicitly recorded
renderer fidelity limitation rather than another performance task.


## Rotated vehicle collision prototype

[096](../tactical/096-rotated-vehicle-collision-benchmark.md) owns the isolated
cardinal-AABB versus continuous-yaw OBB benchmark and device results.
`npm run vehicle-collision:bench` runs identical prescribed motion and sweep
sampling in a dedicated Worker and a six-replay main-thread demand lane. It
uses native SpatialHash candidate queries with diagnostic shape/roof clearance
math. Sparse obstacles, dense tight turns and two roof-local occupants cover
1/8/32 vehicles and an explicit 128-vehicle stress case above the current cap.

Two captures each on M4 Pro and physical Pixel 7a cover 96 cases with matching
work counts/checksums and no page errors. At 32 cars, phone median diagnostic
Worker cost is 0.287–0.288ms AABB versus 0.299–0.311ms OBB for dense turns,
and 0.744–0.764 versus 0.772–0.805ms with roof occupants. The marginal shape
cost supports a bounded yaw pilot; it does not establish full-feature headroom.
Both policies already pay the same angular sampling cost, so the extra probes
relative to shipped cardinal movement remain unmeasured.

Adaptive identical batch sizes amortize browser timer precision; idle display
cadence, executable source hashes and hardware/run context are recorded.
Percentiles are of batch-amortized trace-step costs, not individual server tick
p95. This is no hardware-normalized CPU capacity score or universal timing gate.
The fixture excludes Realm, collision response, actual PlayerPredictor replay,
transport, streaming, rendering and mesh triangles. Sampled angular/translation
sweeps are not continuous collision detection and can miss sufficiently thin
obstacles. Gameplay retains cardinal collision and cosmetic mesh orientation.
Next: integrate one yaw-body prototype through shared authority/prediction,
including turn clearance and roof support, then measure whole-game device cost.
