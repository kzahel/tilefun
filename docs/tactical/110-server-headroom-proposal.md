# 110: Profile server work and propose more headroom

Status: investigation complete; proposed implementation sequence, no gameplay policy change.
Owner: [performance](../topics/performance.md).

## Question and boundary

Keep responsive 60Hz movement while reducing work that does not need that rate.
Audit actual AI search frequency, profile the current authority, and separate
recurring costs from rare tick/frame tails before choosing an implementation.

The Android adapter found no attached authorized physical handheld. Its doctor
also hit an adapter error while constructing the unavailable-device response;
the narrower probe confirms absence. No device was launched or modified. Fresh
measurements therefore use bundled full headless Chromium on Apple M4 Pro,
411x789 CSS pixels, native timers, Worker/Canvas/IndexedDB, fresh regional thicket
seed 2026. These are desktop attribution, not new phone acceptance.

Runtime is a frozen unregistered archive of `1f637fd` with shared dependencies.
Only temporary diagnostic transforms are overlaid for AI counters/timeline marks.
No heavy validation overlaps sampling. Existing probe wrappers remain in lighter
controls; they are not instrumentation-free. CPU sampling and tracing run in
separate captures. Raw browser profiles, trace and local paths remain temporary.

## What actually runs at 60Hz

Realm.decisionDts admits activity-2 actors every physics step. Lower activity
receives accumulated dt every four ticks (nominally 15Hz at 60Hz authority).
Sleep preserves state without catch-up; movement remains fixed-step. The name
“decisions” includes routine AI updates, not just choosing a new destination.

Fauna/deer build nearby herd and alarm facts before their motion/timer early-out.
They choose route candidates after waiting for a rest/action timer or finishing
motion. Rabbit/frog hop phases run in physics; AI returns during committed hops.
Robins return during motion and have a cheap idle timer branch, then perform a
quota-limited candidate search when due. Mallards mix timer-gated target selection
with per-update steering/clearance checks. Ordinary wander chooses a new direction
when its timer expires, while followers/chase logic refresh steering continuously.

Thus nearby AI functions do run at 60Hz, but expensive goal selection is not
unconditionally performed 60 times per second per animal. Current reduced-rate
admission does not separate urgent contact/sensing, routine steering and planning.
Robins have a shared deterministic quota (4 starts, 32 candidates, 256 route
samples per tick); other species do not share that planning budget.

## Measurements

[Sanitized evidence](../benchmarks/110-server-headroom-profile.json) retains thirteen
accepted captures: two 45-second Worker CPU profiles (idle/Right), three 20-second
AI censuses (dog/deer/pond), one separate 45-second browser timeline, two 30-second
lighter controls per motion, two 15-second walking controls and one 15-second deep
physics control, plus an eight-second Realm owner check. Three preliminary census captures are excluded: their AI source
counter edits were not returned by the Vite transform. The corrected probe returns
those edits and final readout asserts aggregate AI timing and actual search counters.
No cadence or state-machine branch is changed by the counters.

| 20-second stationary scene | AI updates | Candidate searches started |
| --- | ---: | ---: |
| Dog clearing: dog | 1,204 | 5 |
| Dog clearing: robin group | 25,424 | 101 |
| Deer clearing: two deer | 2,410 | 9 |
| Pond: three frogs | 3,612 | 16 |
| Pond: two ducks | 2,408 | 1 |

These count entry to route-candidate loops, including unsuccessful searches, not
accepted destinations or all state transitions. Robin counts are across the active
group, not one bird. Every admitted actor in these scenes is in the full-rate tier;
15Hz is established by the production admission policy, not this census. Aggregate
AI mean is 0.094ms dog, 0.076ms deer and 0.122ms pond (about 7–11% of measured whole
tick mean). Instrumentation/counter overhead is included; species/timer observations
cannot predict phone savings or synchronized crowd bursts.

Short walking controls advance about 624px with tick mean 1.214/1.308ms and p95
1.8/1.6ms. Thirty-/45-second Right-input controls encounter an obstacle around
620px, so later windows characterize blocked movement and cannot be described as
continuous traversal. Lighter idle mean is 1.079/1.369ms, p95 2.9/3.5ms; longer
Right mean is 1.356/1.369ms, p95 2.2/2.7ms. These are attribution controls, not
before/after comparisons. All captures have zero page errors, authority cadence
near 60Hz, frame p95 16.7–16.8ms and negligible resimulation; one longer lighter
Right capture has one frame interval over 25ms.

The 45-second Right CPU profile ranks serializeEntity and RealmReplicator.build
as the largest two self-time application rows (276/232ms sampled). ActorRecords
proxy reads (159ms), EntityManager, AABB work and dirty registration also appear.
These source lines are Vite-transformed; sampled self/inclusive times are not
expected savings. The short deep capture measures NPC movement mean 0.242ms,
ground 0.107ms, activity selection 0.230ms and snapshot construction 0.234ms.
Streaming mean is 0.069ms per update, with two updates per tick. Input-phase mean
is 0.073ms per recorded phase, also two phases per tick: the source transform measures every Realm tick, while most diagnostic method
wrappers measure only the active Realm. A separate eight-second owner check confirms
two streaming realms: one empty default and one active realm with
one session. Its empty-realm mean is recorded below; it does not duplicate player
input integration. Empty-realm tick mean is 0.0280ms,
so skipping empty realms is not selected as a material first optimization. Do not treat either per-call value as a per-tick
total or add nested phase percentiles. About 76% of NPC resolutions remain stationary.

The timeline contains 2,705 fully enclosed tick measures over 45.072 seconds:
p95 3.4ms, maximum 11.101ms, zero tick durations above 16.67ms. Start intervals
reach 32.9ms; intervals alone do not measure deadline lateness. The owned authority
Worker has 76 MinorGC and six MajorGC events, totaling 54.585/11.009ms. None overlaps
the ten slowest tick measures. The main thread has 23/17 MinorGC/MajorGC events,
maxima 2.602/3.390ms. This confirms recurring allocation/GC activity without proving
it causes hitches. CPU sampling is absent from this trace; tracing/timing wrappers
still perturb the workload. The phone's earlier 40–50ms tails remain unreproduced.

## Proposed scheduling and implementation order

1. **Reduce repeated replication/bookkeeping before changing gameplay cadence.**
   First measure snapshot/diff/encode allocations and repeated persistence dirty
   notifications, then prototype revision-aware snapshot reuse for unchanged
   actors. Sleeping collision bodies still replicate on entry/exit or an edit.
   An explicit network-state revision must cover every serialized field, including
   sprite/contact/attachment changes; durable-record observation alone is not an
   adequate network invalidation contract. Reuse per-tick snapshots across clients
   where safe. Coalesce repeated dirty registration while keeping spatial scope,
   attachment dependencies and save/eviction barriers immediately correct.

2. **Separate fast reactions/motion from slow sensing and planning.** Keep player
   input integration, active collision, ground/support, gravity, native hop/flight
   progress, mounts/vehicles and attachment motion at 60Hz. Prototype staggered
   10Hz ambient perception/goal eligibility, with expensive searches submitted
   only when due. Immediate contact/terrain invalidation and simple alarm/stop
   reactions remain on the fast path. Followers/close pursuit need a faster
   steering path than ordinary wander. Timers use simulation deadlines or exact
   accumulated duration; sleeping animals acquire no wall-time debt.
   Search execution has deterministic per-Realm starts/candidate/sample quotas
   shared across species and fair priority for threats, proximity and waiting
   age. Spread searches across fast ticks instead of batching all actors on each
   sixth tick. Measure dense synchronized wake/rest fixtures before setting quotas.
   This deliberately changes decision timing and may change RNG draw order; test
   behavioral contracts and reproducibility, rather than promise identical old
   trajectories. Begin with one species whose motion already belongs to physics.

3. **Separate replication cadence only after contact freshness is characterized.**
   Prototype ordinary distant NPC updates at 20Hz while keeping local-player
   acknowledgements and nearby collision/support motion at 60Hz. Remote presentation
   already has interpolation/history, but prediction also consumes authoritative
   collision history: thinning nearby updates can increase corrections. Immediate
   entry/exit, edits, mounts and gameplay events must retain their ordering and
   reliability. This is a distinct experiment from cheaper snapshot construction.

4. **Make chunk/persistence maintenance depend on changes and bounded due work.**
   Streaming currently runs twice per ordinary broadcasting tick. Measure equivalent
   work before coalescing it; ticket/readiness changes, completed loads, lease expiry,
   pressure recovery and traversal safety cannot wait behind a blind 20Hz gate.
   Keep a cheap fast path for urgent readiness and process independent background
   work under explicit admission limits. Persistence snapshots still use finite
   flush/eviction barriers; delayed registration must not lose mutations.

5. **Add compute workers only for a measured independent job.** Terrain generation
   or bounded planning over immutable inputs are plausible jobs. Keep one serial
   authority to validate result revisions and commit world changes. Never wait
   synchronously for a helper Worker inside player physics, and bound queued input,
   output, stale jobs and lifetime. Live collision partitioning is not the first slice.

## Acceptance and next step

Compare work per simulated second, tick mean/p95/p99, deadline misses, input/ack
latency, replay/corrections, allocations/GC, queue depths and conservation counts.
Use sequential matched controls, sustained phone runs, and dense wake/search cases.
Preserve immediate collision/support safety, deterministic quotas, sleep semantics,
multiplayer activity unions, durable saves and native motion timelines. Exercise
normal game plus embedded ScenarioSession Workers, Canvas/GPU contacts, moving
roofs/mounts, edits, reload and streaming readiness for any accepted implementation.

Recommended first implementation: measure snapshot/diff/encode allocation on the
phone, then reduce repeated snapshot/dirty-registration work with explicit
invalidation and state/output parity. AI sensing/planning separation follows as a
bounded one-species experiment, with dense-search burst controls. No global server
rate reduction, AI throttle or Worker split is delivered here.

All three typechecks, 2,371 unit tests in 245 files and lint pass on the exact
frozen runtime (118 existing warnings, 34 infos). Temporary probes are removed from
the validation archive after captures; their hashes and source remain in the local
artifact directory. Game/lab behavior is unchanged, so full browser/build/streaming
acceptance is required for a later implementation rather than claimed here. The
native phone profile and original save remain outstanding measurement limits.


The user authorized desktop implementation after this investigation. See
[111](111-server-snapshot-and-deer-scheduling.md) for delivered snapshot/dirty
reuse and the first deer cadence/quota pilot. The later multispecies, publication,
streaming and compute-worker experiments remain proposals.
