# Incremental simulation membership

Status: complete, 2026-10-10.
Owners: [activation](../topics/entity-activation.md), [performance](../topics/performance.md).

The user authorized measurement, the next server optimization and a commit.
The bounded slice caches demanded attachment groups and avoids readiness work for
sleeping wildlife. It keeps simulation interest exact rather than reducing its
frequency or changing population, path budgets, motion, contacts or save format.

## Contract

`RealmRecords.membershipRevision` changes on actual spatial membership and
attachment topology changes, not ordinary timer/RNG/within-chunk pose writes.
`RealmActivity` caches demanded ready group membership until that revision,
record owner or ordered activity-ready chunk set changes. Wake eligibility is
still evaluated every simulation step against current player positions/views,
followers, attachments, freshness and moving contact bodies. Active bodies retain
live trajectory/terrain readiness checks; sleeping residents skip those queries.

Ordinary supported bodies and fixed player/traffic members establish contacts
before wildlife selection. An interest preview cannot renew exit hysteresis until
terrain is ready. Native bucket/group ordering and fixed-step dt are preserved;
fresh actors get their usual grounding step. Sleeping does not accumulate elapsed
time. Eviction invalidates cached references immediately, including paused realms;
world replacement and successful teardown clear the cache and interest clock.
Game and ScenarioClient share the same Realm owner.

This is incremental membership caching, not a completely event-driven wake list.
Cheap live sleep eligibility scans remain so same-cell edits, moving contacts and
player-radius crossings wake immediately without a new mutation subscription.
Support caching and incremental prop/streaming selection are separate next slices.

## Measurement

Fresh thicket seed 2026/dog clearing, native Worker/Canvas/IndexedDB, two seconds
warmup and 15 seconds per sample, before/current stationary and keyboard walking
on desktop and the attached Pixel 7a. The before source is a frozen archive of
`bab1e07`; timing probes are sequential. No desktop CPU throttling, user save or
arbitrary AI-disable control. Native phase wrappers add instrumentation overhead;
run order, temperatures and timers remain limits.
[Sanitized comparison](../benchmarks/090-incremental-membership.json) retains 16
samples (two per device/policy/motion), source hashes and phase summaries.

| Device / motion | Selection p95 before → current | Whole tick p95 before → current |
| --- | --- | --- |
| M4 Pro stationary | 0.3 → 0.2–0.3ms | 1.5–1.8 → 1.8–2.3ms |
| M4 Pro walking | 0.3–0.4 → 0.2–0.3ms | 2.0–2.3 → 1.9–2.2ms |
| Pixel stationary | 1.7 → 1.0–1.1ms | 10.8–11.6 → 10.8–11.0ms |
| Pixel walking | 1.3–1.4 → 1.1ms | 11.3–11.5 → 11.4–12.0ms |

Stationary membership stays 242 resident/22 active; the walking controls cross
624–625px and finish with 241 resident/43 active. Maximum positional resimulation
error stays below 0.001px in all cases; no browser errors occur. Phone rAF p95
stays about 16.7–16.8ms. Entry/end battery readings span 27.4–28.9°C, thermal
status zero. Current stationary selection mean falls about 34–44%; walking mean
falls about 17–26%. Whole moving-tick p95 does **not** improve. These measurements
support reduced selection work, not a general FPS/headroom claim. An earlier
prototype stationary capture observed 0.9ms selection p95; the final comparison
uses the later complete code and is the acceptance record.

## Validation

Six new oracle/work-count regressions compare the pre-change admission policy
through view/proximity/hysteresis, followers/riding, solid moving contacts,
unsupported contacts, spawn/removal/reparenting, same-cell and cross-chunk edits,
fresh grounding, demand/readiness changes, collider reach, separated observers
and explicit clearing. Two hundred sleeping actors over 60 steps cause zero
attachment-group rebuilds or readiness calls after warmup; a view change wakes
all immediately with live readiness checks. Existing save/reload/phase/RNG tests
remain passing. All 2,171 units in 229 files, all three typechecks and lint pass
(118 existing warnings/34 infos). Catalog generation reports 245 sheets/1,086
source uses; manifest generation verifies all 761 identities, with only six
behavior fingerprints plus the input digest changing. Candidate IDs, source art,
batches and every other candidate field stay identical. Build and
`streaming:bench -- --assert-ready` pass with no browser errors or readiness/
traversal failures. The full normal-config browser run finishes 522 cases: 521 pass and one Canvas
car-driving tap produces zero displacement at the existing >16px assertion.
That unchanged car-boarding/tap/save/exit case then passes all six serial reruns
(three per renderer). No input test, tolerance or driving implementation is
changed. The cause of the intermittent tap failure is not established; investigate
boarding/presentation/input timing if it recurs. All other wildlife, contact,
pause/reload, multiplayer, streaming, train/car and embedded lifecycle checks pass.
An initial browser startup port-availability failure resolves on retry without
reusing another server or changing the normal test configuration.

The wildlife production-table refresh was attempted after recording progress;
the ignored `data/wildlife-campaign-v2/progress.json` is absent. The existing table
is retained; no campaign state or approval is invented.

Next candidate: static prop activity/readiness selection. Its final phone p95 is
1.9ms walking and 2.1–2.3ms stationary, with 964 initial resident props. Cache stable
membership/readiness with correct edits, residency and attachment invalidation;
retain live checks for moving props. Moving physics still costs 3.1–3.3ms p95 and
needs more detailed attribution after this bounded selection slice.

No immutable art source or approval event is changed.
