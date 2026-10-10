# Static prop admission cache

Status: complete, 2026-10-10.
Owners: [activation](../topics/entity-activation.md), [performance](../topics/performance.md).

The user authorized the next measured server optimization and commit after 090.
Cache the repeated activity/readiness filter for resident static scenery in the
shared Realm, preserving its exact ordered result and live collision behavior.

## Contract

`RealmPropActivity` snapshots active demand keys, all ready residency keys and
ordered prop identity/position/collider width/height. Every simulation substep
compares those keys/scalars; unchanged state borrows the previous selected array
without per-prop scope strings, attachment projection/root sets or support queries.
Changes rebuild through the original `RealmStreaming.supported` policy. Halo
readiness matters even without activity demand. Loading, saving, failed, removed
and newly ready chunks invalidate the result. Same-cell and direct in-place edits
are detected, including unobserved procedural props. Spawn timers do not affect
admission; collider offsets/walls do not affect the existing support policy.

Props have no velocity or attachment fields in the production model. Moving a prop
changes its compared position, so its new pose receives fresh support checks in
that substep. Moving entities, players, vehicles and wildlife retain live readiness
checks. There is no movement-rate reduction, collision proxy or changed save format.

Prop removal clears cached references immediately through PropManager removal
listeners, even while paused. Replacement managers, world loads and successful
teardown clear the owner/listener. Both ordinary game and embedded ScenarioSession
use this Realm path. Collision/support spatial queries still use live PropManager
geometry; only gameplay API simulation admission reuses this result.

This deliberately retains cheap scalar and chunk-key scans instead of adding broad
mutation observers. It avoids coupling admission invalidation to persistence and
catches direct geometry edits. Topology churn can still cause a full rebuild.

## Measurement

Fresh regional thicket seed 2026/dog clearing, native Worker/Canvas/IndexedDB,
two-second warmup and 15-second samples. Two repeats per device/policy/motion,
sequential desktop idle before/after, desktop walking before/after, then the same
phone order. Before replaces only Realm with the captured pre-change source from
`b957d05`, against identical companion modules; concurrent touch-control work is
present in both lanes. Phase instrumentation changes timing. No CPU throttle.
[Sanitized captures](../benchmarks/091-static-prop-admission.json) retain source
hashes, sixteen samples, actual travel, errors and temperatures. Initial exploratory
captures begun before source substitution were explicit are excluded.

| Device / motion | Prop admission p95 before → after | Whole tick p95 before → after |
| --- | --- | --- |
| M4 Pro stationary | 0.8–0.9 → 0.2–0.3ms | 4.8–4.9 → 3.8ms |
| M4 Pro walking | 0.5–0.6 → 0.1–0.2ms | 3.1 → 2.8–4.0ms |
| Pixel stationary | 2.1–2.9 → 0.3–0.4ms | 10.6–11.1 → 10.3–10.5ms |
| Pixel walking | 1.5–1.6 → 0.3–0.4ms | 11.0–11.2 → 10.9ms |

Phone mean selection cost falls from 1.71–1.98ms to 0.22–0.23ms stationary and
1.20–1.22ms to 0.22–0.24ms walking. Whole walking-tick gains are small; moving
physics instead rises from 3.2 to 3.7ms p95 in later samples. This supports the
phase saving, not attributing all CPU differences or claiming a stutter cure.
Phone input ACK p95 is 38.4–38.5ms before stationary and 50.4–52.2ms after;
walking is 53.5–55.2ms before and 53.4–53.6ms after. The capture does not attribute
that scheduling variation. Position resimulation remains below 0.001px. Walking
Worker tick maxima still reach 32–42ms before and 36–45ms after, despite zero
phone walking rAF intervals over 25ms. This does not close intermittent hitch
attribution or establish the provisional 4–6ms p95 authority target.

Stationary actors remain 242 resident/22 active with 964 initial props; walking
covers 624–625px and ends with 241 resident/43 active. All sixteen samples have
zero page errors. Phone rAF p95 stays 16.7–16.8ms; phone battery readings span
27.6–28.6°C with thermal status zero. Sequential charging, background desktop
load and wall-time trajectory variation limit whole-tick comparisons. Keyboard
movement is not a native touch acceptance test; the original user save is unmeasured.
Owned tabs/origins/USB routes are released and the prior phone app restored.

## Validation

All 2,191 unit tests in 232 files, three typechecks and lint pass (118 existing
warnings/34 infos). Shared-scenario focused regressions cover:
ordered admission oracle through demand/halo readiness/failure/recovery; direct
position/collider/membership edits; 1,000 warm props over 120 steps with zero support
queries and the same borrowed result, plus paused removal and explicit owner reset.

Catalog/manifest generation and production build pass. Streaming readiness passes
with no missing-data/incomplete-cache frames or browser errors in any stage.
The full normal-config browser run finishes 529 cases: 527 pass, with one fish
ball-reaction timeout and one development-reload position assertion reading the
placeholder (0,0) instead of the saved arrival (72,248). Client `data-ready` marks
loop startup, while RemoteStateView returns a placeholder until its first entity
frame. The reload regression now explicitly waits for an authoritative player ID
before retaining the exact saved-arrival assertion. Runtime startup behavior,
position tolerance and the fish test are unchanged. Three serial repeats of both
reload cases and the unchanged fish reaction all pass (nine cases, 1.6 minutes).
The original fish timeout remains recorded; its cause is not established. No
claim that the original full run passed every case is made. Typechecks and lint
pass again after the test fence and benchmark JSON formatting.

The normal checks exercise the combined checkout including
concurrent touch-control changes. A separate frozen HEAD archive with only this
slice also passes inventory generation and production build, verifying the exact
commit's generated files without staging other work. It changes only catalog source
line references, six character behavior fingerprints and the manifest input digest;
all 761 candidate identities, source art and other candidate fields stay identical.
No immutable art, approval event or wildlife campaign state is changed.

Next: profile resting-body ground/support and broadphase queries within moving
physics before choosing support caching versus a finer spatial index. That phase
costs 3.2–3.7ms p95 on this phone; the whole authority tick remains around 11ms.
