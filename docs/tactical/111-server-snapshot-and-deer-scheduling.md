# 111: Snapshot reuse and staggered deer planning

Status: delivered and validated on desktop; pre-existing intermittent GPU tap-test failure recorded.
Date: 2026-10-11.
Owner: [performance](../topics/performance.md), with
[entity activation](../topics/entity-activation.md) and
[embedded labs](../topics/embedded-engine-labs.md).

The user authorized the first stages of [110](110-server-headroom-proposal.md)
on desktop and a commit. The phone is not attached. This slice removes repeated
replication/save allocations and separates one species' due planning from its
fast reactions and native motion. It does not implement the later proposal stages.

## Delivered contracts

- RealmReplicator owns weakly keyed immutable snapshots. Reuse checks every value
  sent by serializeEntity, including sprite/clip/model state, live befriendable
  tags, velocities, support/attachment state, optional removals and relative frame
  duration defaults. Every client build checks live state, even within the same
  tick. Unchanged snapshots skip allocation and diff; changed snapshots never
  mutate older baselines. Clear resets the cache; weak keys avoid retaining dead
  actors or confusing recycled numeric IDs. Outgoing snapshots remain borrowed
  read-only values, as required by the existing per-client delta baseline contract.
- Complete scalar comparison is deliberately used instead of a new mutation
  revision. Existing durable observation omits wire fields; maintaining a second
  observer over every network mutation would be a more invasive first slice.
  New serialized fields must be added to the match predicate and invalidation
  tests together. Uncached serializeEntity retains its existing callback API.
- RealmRecords reuses one lazy snapshot callback per actor/durable key.
  SaveManager caches its composite key and avoids overwriting an identical dirty
  callback. Index/scope checks and attached-child propagation remain immediate.
  Snapshots read current values at capture; later changes still enter the next
  finite flush batch, including during a blocked write. Repeated notifications
  still ensure a debounce timer after a synchronous flush. Saves already encoded
  actors lazily; this is registration/allocation reuse, not deferred encoding.
- Shared Realm owns a DeerPlanningScheduler. Ambient goal eligibility cycles
  through seeded, staggered 100ms simulation-time slots. Native committed walking,
  timers, player proximity and live herd alarms retain the admitted tick rate.
  Alarm goals bypass the cadence; all deer share one decision/search start per
  AI step, with stable alarm/near-player/distant classes and rotating admission.
  One search examines at most 24 candidates and 480 path sample points. This
  bounds deer starts, not every terrain-query call or all wildlife work.
- Herd cohesion is evaluated only on admitted goals. Alarm sensing keeps live
  actor checks every update, without constructing the whole herd list. Ordinary
  rests and committed movement need no periodic ambient cohort scan.
- Quota denial precedes new-goal activity/RNG decisions. Pending due goals can use a later
  fast tick; no catch-up loop runs on a 100ms boundary. Sleeping actors add no
  wall time. These transient cadence phases are not saved; committed movement,
  timers and RNG remain durable. Future goal timing/RNG draw order can change
  deliberately after scheduling/reload, within cadence and quota waits.
- Other species keep their policies, including the existing robin budget.
  Shared 60/15Hz activity admission, player physics, contacts, native motion,
  frame publication and input acknowledgements keep their current rates.

## Desktop measurements

[Sanitized evidence](../benchmarks/111-server-scheduling.json) retains ten accepted
captures from frozen source based on `075188b`, M4 Pro, bundled full headless
Chromium, native Worker/Canvas/IndexedDB, 411×789 viewport, fresh thicket seed
2026, no CPU throttle. Root rendering/XR work was excluded. Before/after captures
were serial; timing probes add overhead and timer resolution is coarse. The
corrected uncached serializer API is used in the accepted stage-one captures.
That intermediate deep lane used an early return for identical dirty callbacks;
the final implementation also preserves debounce scheduling after a synchronous
flush during another write.
Preliminary captures are excluded. Heavy validation begins after captures.

Warm 20-second deer work counts:

| Work | Before | After |
| --- | ---: | ---: |
| Authority steps | 1,203 | 1,205 |
| Deer AI routine calls | 2,406 | 2,410 |
| Herd cohort/list builds | 2,406 | 8 |
| Deer search starts | 9 | 8 |
| Snapshot checks | 102,255 | 102,425 |
| Fresh snapshots | 102,255 | 8,464 |
| Dirty notifications | 100,432 | 100,213 |
| New actor snapshot callbacks | 100,432 | 0 |

About 91.7% of after snapshot checks reuse the same immutable object. Zero new
callbacks describes the warmed measurement window; actors receive a callback on
first registration. Dirty notifications and live scalar reads are still paid.
Search count variation reflects intentional scheduling and the finite window;
this does not eliminate useful decisions or reduce physics updates.

| Lane | Tick mean before → after | Tick p95 before → after | Replication mean before → after |
| --- | --- | --- | --- |
| Deep short walk, two repeats | 1.670–1.907 → 1.281–1.823ms | 2.7–3.3 → 1.8–4.1ms | 0.229–0.271 → 0.150–0.194ms |
| Shallow short walk, two repeats | 1.560–1.983 → 1.491–1.520ms | 2.9–3.8 → 2.2–2.4ms | 0.214–0.278 → 0.175–0.182ms |
| Counted deer idle, one pair | 2.074 → 1.705ms | 4.2 → 3.2ms | 0.362 → 0.232ms |

The deep after lane measures only snapshot/dirty reuse; shallow after and deer
census include scheduling. The shallow pair runs after-before, while deep runs
before-after. All captures have zero page errors, authority about 60Hz and frame
p95 16.7–16.8ms; walking covers about 625px. Replication means fall in each lane,
but deep whole-tick p95 overlaps and unrelated phases also vary with host load.
Work removal is established; these few desktop captures do not establish mobile
headroom, a universal percentage saving, GC reduction or a stutter cure.

The deterministic 18-deer synchronized-wake regression admits all actors within
24 steps, allows at most one search per step and repeats the same state/RNG
sequence. Separate tests exercise repeating 100ms slots, urgent herd/player
alarms, exact timer dt, 60Hz committed movement and a long inactive interval.

## Validation and inventory

- Typechecks, 2,414 unit tests in 248 files and lint pass. Lint retains the
  baseline 118 warnings and 34 infos, with no new diagnostics.
- Art catalog and Workshop manifest regenerate; build passes. Catalog updates
  consumer source locations. All 761 candidate identities match full Chromium
  at retina scale. Six character-lab fingerprints renew because their contract
  includes raw Realm source, while source art and wildlife identities remain
  unchanged. Existing approval records and historical snapshots are untouched.
- Streaming readiness passes all six ordinary cases. The first attempt in the
  archive lacked Git metadata and exited before running a case; a detached
  temporary metadata view of the exact base enabled the normal runner unchanged.
- Full bundled-Chromium browser suite: 543 pass, one skip and one failure in
  22 minutes. The failed GPU tap-walk case intermittently receives a correct
  screen coordinate but never starts the first movement (position stays zero).
  Serial traced repeats on optimized code pass four/fail one; original code
  passes five serial repeats, then passes 18/fails two at the suite's two-worker
  concurrency, reproducing the same first-tap assertion. Event logging passes
  ten repeats on both versions and shows successful taps reaching normal input
  with no gate blocking. This is a pre-existing timing-sensitive input/test
  failure, not a green full-suite claim or an established root cause. The
  scheduling slice does not alter input routing or relax assertions.
- Final uninstrumented serial rerun of that case: all five pass (24 seconds).

## Next bounded work

Extend the fast-reaction/due-planning split to one more native species and build
shared multispecies admission quotas, with dense mixed alarms/wakes, reproducible
fairness and actual phone measurements when available. Track the intermittent GPU tap startup/redirect test separately with native
input/fullscreen/focus traces; event logging changes its timing and does not
identify the cause. Retain contact, support, player motion and acknowledgement
freshness. Lower remote NPC publication and
extra compute workers remain separate experiments after profiling their costs.
