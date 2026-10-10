# Wildlife work budgets, sleep interest and local animation

Status: complete, 2026-10-10; physical moving-gameplay comparison remains follow-up.
Owners: [performance](../topics/performance.md), [activation](../topics/entity-activation.md),
[prediction](../topics/player-prediction.md), [wildlife](../topics/wildlife.md).

The owner authorized implementing and committing the investigated optimizations.
085 retains the earlier behavior-preserving robin allocation optimization.
This slice bounds planning work and offscreen wildlife motion, and gives predicted
player animation its own clock. Unrelated work in the shared checkout stays separate.

## Policy

- Keep nearby interaction/motion fixed-step. Wake wildlife for the union of each
  player's local visible area plus a margin or proximity; clamp camera activation
  to local player interest. Retain followers, attached groups and moving contact
  dependencies. Brief spatial/time hysteresis prevents boundary flicker.
- Frozen actors remain resident and collidable, retain their durable state and
  resume without accumulating elapsed time.
- Bound robin candidate and path-sample work per decision and across a shared AI
  pass, with greater local work allowance near players and fair admission. Commit
  only fully checked paths. Work quotas are deterministic and measured, not a
  promise that arbitrary geometry fits a hard wall-clock deadline.
- Advance locally controlled ordinary player/mount animation once per live input
  step; preserve phase through reconciliation. Timed authoritative clips keep
  their authority clock. Cover reset, model changes and replay.

## Validation / evidence

[Desktop authority results](../benchmarks/088-wildlife-work-budgets.json): two
original and two current sequential 15-second stationary runs in native Worker,
Canvas and IndexedDB, fresh thicket seed 2026/dog clearing, 411×789 viewport.
All 242 actors remain resident. Active actors fall **159 → 22**; full-interval
tick p95 falls **6.8–7.4 → 4.2–5.8ms**, physics p95 **2.4–2.6 → 0.8ms**, and the
longest measured robin AI call **3.1–3.2 → 0.7–0.8ms**. Whole-interval tick CPU falls
about 23–41%. Apple M4 Pro/bundled Chromium; instrumentation and run order remain
limits. This does not establish mobile headroom or moving-gameplay performance.
The attached phone is unlocked but in another foreground app; no fresh physical
comparison was completed and the user's app was left alone.

Production budgets are four admitted searches, 32 tested candidates and 256 route
samples per AI pass. Per search: eight candidates/64 samples within 192px of a
player, four/32 farther away. Alarms receive priority, then proximity, with rotating
admission within each class. Deferred searches do not consume activity/RNG;
accepted paths must be fully checked. Cheap geometry rejects unreachable chunk-query
crowns before applying the candidate quota, so a stable invalid prefix cannot
starve nearby perches. This deliberately reduces candidate choice
rather than persisting a resumable search; no wall-clock nondeterminism or pending
planning save format is introduced. Original candidate/RNG parity in 085 applies
to its unbudgeted comparison, not this policy.

Wildlife interest unions local player view/proximity, bounds extreme zoom, keeps
attachments/followers and moving-body contacts, and uses at most 0.5 seconds of
exit hysteresis. Fresh actors receive one grounding step before sleeping. Sleeping
motion/phase/RNG survives resident save/reload and resumes with one ordinary step.

[Production animation capture](../benchmarks/088-predicted-animation.json) runs
all seven real-Worker/main/delivery controls. A 750ms Worker stall now leaves the
longest unchanged walking frame at **137ms** (normal animation cadence), with all
four columns continuing. A 2.5-second Worker stall still fills the 128-command
history and produces a **24.5px backward step**; explicit overflow recovery is
remaining work. A main-thread stall necessarily also stops drawing.

All **2,133 units / 225 files**, all three typechecks and lint pass on an isolated
snapshot of this task's changes, with 118 existing warnings/34 infos. Build passes.
The catalog updates source-use line references. Manifest generation verifies all
761 identities across headless/full Chromium: 170 behavior review
fingerprints change because those reviews intentionally hash shared Realm/client
source. Their source-art fingerprints and every other candidate field
remain identical; exact asset banks and human review events are untouched.
A full 516-case browser run completes with 510 passes, one skip and five failures:
two missing historical fox review archives, two robin frozen/reloaded frame
mismatches, and one garage jump poll. The robin failures expose an existing local
clip lead at an explicit pause fence. This slice includes the already-present,
reviewed shared `RemoteStateView` phase-cache / `ScenarioClient` fence dependency
and its unit regression; unrelated checkout repairs remain separate. A valid
perch behind a long unreachable query prefix is now also covered by a work-budget
regression. All **18 focused browser reruns pass** on the final code: Canvas/GPU
robin crowns, contact and frozen trajectory reload; ordinary balls and durable
deletion; frog/rabbit motion and reload; scenario lifecycle/scheduling; both
garage renderers and phone controls. The garage jump poll passes without a garage
implementation change. The two missing-archive review checks remain outside this
runtime slice; registered feedback correctly fails closed on missing evidence.
The standard six-phase `streaming:bench -- --assert-ready` gate passes with zero
final missing/incomplete/stale terrain and no browser errors. Its low-population
city traversal does not establish countryside or phone headroom. Timing probes
are sequential; validation uses a temporary archive of the exact task tree so
unrelated checkout changes are neither committed nor required to pass.

Next: run moving native-phone countryside/contact checks when Chrome is available,
then implement explicit replay-history overflow recovery and profile remaining
support/broadphase work. Sleeping does not eliminate dense nearby physics costs.

The required wildlife production-table refresh was attempted after recording
progress, but the ignored campaign `data/wildlife-campaign-v2/progress.json` is
absent. The committed table is retained; no campaign state or approval is invented.
