# 119: Dense ground support candidates

Status: complete; delivered and measured, with existing GPU tap integration failures recorded.
Date: 2026-10-11.
Owner: [performance](../topics/performance.md).

## Boundary and implementation

Implement [118's proposal](118-phone-physics-headroom.md) in shared EntityManager.
The existing crowded-pass gate and resident-body index rebuild remain unchanged.
After movement, `CollisionIndex.finish()` stops XY refreshes; its membership stays
available as a read-only snapshot until ground tracking finishes. Dense ground
queries use the actor footprint against that index. Each resolver still reads
live support geometry/Z, including earlier snaps in the same pass.

No second index, extra resident scan or cross-tick support cache is introduced.
Dense passes retain per-exact-chunk-range prop candidate reuse while omitting
unused coarse entity queries. Sparse passes keep the original chunk candidate
cache. No-collider samples need no entity surfaces. Player input/jump/landing,
prediction, prop surfaces/excavation, separation, attachments, AI and publication
keep their existing owners and ordering. Fine queries stop before separation or
attachments move bodies again; the next crowded pass rebuilds all resident solid
bodies, including sleepers, skipped and parented supports and collider edits.

Both ordinary game and embedded ScenarioSession labs use this EntityManager.
There is no lab-specific implementation or renderer/input/recipe change.

The refreshed footprint also closes a dense-pass stale-origin case: a support
that moves across a chunk seam can support an actor at its new footprint before
the later coarse-hash refresh. This is an explicit live-geometry correction,
covered independently from flat-fixture parity. Sparse behavior is unchanged.

## Verification and measurement

Thirteen new dense-path unit checks cover candidate narrowing/prop reuse, sequential
height snaps, both sides of the step threshold, sleeping teleports and collider
edits, negative seams and oversized support, solidity/removal/restore, support
moving across fine/chunk seams, real vehicle/train roofs, airborne height,
excavated prop surfaces, skipped/parented supports and legacy-query live/durable
frame parity. An all-resident oracle also checks 100 varied footprints, offsets,
solidity and heights. Existing sparse ground and collision index checks remain intact.

Matched measurement sources are frozen `b2b52d3` plus only the two runtime files
for the candidate. Concurrent ambulance edits in the live checkout are excluded.
Phone controls use Pixel 7a dedicated production Realm/ScenarioSession Workers,
60 warmup/180 retained 1/60s steps with verified 0/88px native dog motion. Main
shallow lanes alternate before/after/after/before and reverse populations on the
second repeat; publication is separate. Phase/census/parity diagnostics are
separate from those timing lanes. Crowds exclude renderer, real IndexedDB,
network delivery and fresh AI planning. Ordinary Canvas/Worker/IndexedDB controls
include two 8-second continuous walks and two 12-second idle captures per source.
Thermal entry requires <=29°C/status zero; charging remains unchanged.

## Results

Matched clean physical-phone means and p95 in milliseconds, two repeats:

| Dogs / state | Tick mean before | Tick mean after | Tick p95 before | Tick p95 after |
| --- | --- | --- | --- | --- |
| 96 resting | 2.671–2.680 | 2.449–2.619 | 3.7–4.3 | 3.2–5.0 |
| 96 moving | 2.949–2.964 | 2.843–2.846 | 3.9–4.1 | 4.1–4.1 |
| 384 resting | 10.634–11.127 | 9.253–9.936 | 13.8–15.0 | 12.0–15.3 |
| 384 moving | 12.701–13.395 | 10.659–11.044 | 15.2–16.1 | 13.1–13.7 |

384 moving tick means improve 16.1–17.6% in matched repeats. Index build/refresh
costs are included. Separate publication means are 1.717–1.834ms before versus
1.663–1.732ms after; this does not include binary encoding, transport or rendering.
Rare moving ticks still exceed 16.67ms (delivered maxima 17.2/20.8ms). Resting and
96-actor p95 ranges overlap and sometimes worsen, so the mean improvement is not
uniform tail improvement or whole-game stable-60Hz proof.

### Separate attribution and parity

The first diagnostic-only cooling attempt timed out at 30°C without retaining
any cases. Its rerun uses <=31°C/status zero, with measured entry/end readings
30.2–30.7°C. The clean crowd controls above remain at exactly 27°C, and native
controls remain at 27.0–28.8°C. Warm diagnostics do not substitute for them.
All captures keep charging unchanged and thermal status zero.

Warm phase means at 384 actors: resting ground 3.522–3.962ms before versus
1.713–1.761ms after; moving ground 4.404–4.852ms versus 2.298–2.331ms (about
48–52% less in paired moving repeats). Moving NPC integration remains
3.942–4.168ms after and is now the largest physics phase. The raw phase evidence
retains an unexplained 161.8ms original moving tick and all other outliers;
phase-lane whole-tick statistics are excluded from clean performance claims.

Separate census lanes reduce 384 moving support candidates from 9,197,912 to
692,192 over 180 ticks (92.5% fewer, including the unchanged player-input ground
samples); resting falls from 8,481,780 to 749,700 (91.2% fewer). Resolution counts
remain 69,300 per case. No props exist in this fixture, so it makes no prop-index
claim. More fine queries replace the repeated broad-list scans; their costs are
included in clean timing lanes.

Four physical-phone parity pairs (96/384 actors × rest/travel) match SHA-256 of
all 180 retained full wire snapshots and durable actor records: 720 compared
frames. Persistent identifiers are omitted; each frame is digested outside
measurement timers, then the ordered frame digests are hashed. Digest awaits,
serialization and census counters add overhead, so those lane timings are not
clean controls. Every actor verifies expected native 0/88px travel.

### Ordinary game controls

Walking tick means overlap at 6.678–7.203ms before versus 6.739–6.871ms after;
p95 overlaps at 9.8–10.4ms versus 9.9–10.0ms. All four walks travel continuously
513.17px near 60Hz, with frame p95 16.7ms and maximum resimulation error below
0.00003px. There is no demonstrated sparse-play gain or warping reproduction.
Walking intervals >25ms total one before and two after across the short repeats;
this is too little evidence for a presentation regression/improvement claim.
Idle means are 6.448–6.872ms versus 6.081–6.415ms, with overlapping tail ranges;
all remain near 60Hz, frame p95 16.7–16.8ms, and one >25ms interval per source.
There are no page errors. These are Canvas/keyboard controls, not touch or the
actual GPU-renderer symptom reproduction proposed in 118.

Cleanup closes task-owned tabs/Workers, stops Vite/CDP proxy, removes only the
task's ADB routes, verifies original routes and restores the foreground app.
[Sanitized evidence](../benchmarks/119-dense-ground-support.json) owns source/probe
hashes, sixteen clean crowd/eight native/eight warm phase/eight census/eight parity
captures, order, thermal gates and limitations. Private raw host/device state
remains temporary.

## Validation and next step

Current checkout: all three typecheck configurations, 2,515 unit tests in 257
files, and lint pass (119 warnings / 34 infos, no errors). Frozen candidate build
passes after rebuilding the Workshop source digest and verifying all 763 review
candidate identities unchanged in normal Chromium at retina scale. Candidate
pixels, approvals, promoted banks and asset identities are unchanged; only the
broad `inputDigest` renews.

The frozen full browser run records 546 passes, one existing skipped atlas capture
and two GPU tap assertions failing with zero travel (23.3 minutes). Both checks
pass three consecutive candidate serial reruns (six passes). At the original
two-worker concurrency, candidate repeats record five passes / one driving
failure, and baseline repeats record six passes followed by 19 passes / one
identical driving failure in a longer run. The driving failure therefore predates
this change; the flat walking fixture uses the unchanged sparse path and does not
reproduce in any focused repeat. No simulation or test change hides these failures.
Canvas/GPU native roof, bridge/train, jumping wildlife, excavation, persistence,
shared-lab lifecycle and real touch/hold-input checks otherwise pass. The initial
failures remain an integration limitation, not evidence of complete browser-suite
success or a resolved tap issue. Frozen `npm run streaming:bench -- --assert-ready`
passes cold, standing, walk, sprint, reverse and zoom-out stages with zero missing
terrain, incomplete caches, readiness failures or page errors.

Next server investigation: profile the remaining NPC movement phase, especially
terrain/prop lookup work and transient candidate/box allocation, before selecting
a narrower query or reuse change. Dense moving ground is now smaller than movement.
Keep ordinary streaming/activation bookkeeping and actual-renderer/input stutter
reproduction as separate investigations; 118's unexplained frame hitch is not
established as a server or collector problem.

Separate integration follow-up: diagnose intermittent zero-travel GPU taps. The
driving assertion reproduces on the pre-change source; do not treat candidate
serial passes as a product fix or hide the initial full-suite failures.
