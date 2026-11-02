# Persistent realm collision proof

Status: early decision reached — no default cutover; migration paused on failed CPU gate, 2026-11-02.
Parent: [201](201-rapier-cutover-sequence.md); owner: [physics engine](../topics/physics-engine.md).

## Inventory and first baseline

| Current owner | Replacement boundary |
| --- | --- |
| Realm per-command player motor and missing-input gravity | Retain input admission/CVars/landing events; share a persistent query world with other actors |
| GameCharacterPhysics | Extract common geometry compilation; retain controlled support/push semantics; stop rebuilding whole scenes on the replacement path |
| EntityManager NPC movement, ground tracking and separation | Retain AI intent, travel preparation, animation, indexing and parenting; replacement contact phase owns pose/grounding |
| Driving/TrafficSystem | Retain steering, acceleration, routes and driver identity; replacement controlled-car collision must bypass old checkedCarPose/push geometry |
| BallPhysics / vehicle cargo | Qualify one ordinary ball first; other projectile/cargo behavior remains an explicit cutover gap |
| MovingSupport, roofs, mounts, railways, vehicle beds/towing | Inventory compatibility blockers; no silent collision fallback in replacement qualification scenes |
| AI canOccupy/navigation, editor placement, safe arrival | Read-only gameplay queries still need routing/qualification before default cutover; no hidden claim of all-query replacement |
| PlayerPredictor / collision timeline | Private per-predictor world and immutable replica inputs; rebuild actor poses on rebase without freeing reusable static geometry |
| Realm load/close, edits and streaming | Dispose/recreate physics with realm lifecycle; section cache invalidates from actual chunk identity/revision and prop geometry |

Frozen legacy baseline: `e59df9ca`; [native measurements](../benchmarks/201-native-legacy.json)
use the existing production Realm active-crowds runner (0/24/96/384 near actors,
384 far). Rendering and browser/Chromebook timing are absent from this lane.
The later paired runner must preserve these activation and content distinctions.

The implemented checkpoint and early decision below keep the default unchanged.
The frozen baseline remains immutable; final paired measurements use identical
current source for both modes to distinguish backend cost from intervening changes.

## Replacement proof checkpoint

Implemented opt-in modes 3/4 (fixed box / controlled capsule) behind ordinary
Worker startup `?physics=rapier-world&hull=box|capsule`. They select at startup;
console hot switching into/out of the realm backend rejects. Modes 0/1/2 retain
their previous behavior. `stepCharacterPhysics` refuses a missing realm owner,
and legacy movement contexts reject collision when a replacement world owns them.

Each Realm/private predictor owns and disposes its persistent world. Bounded
static sections reuse a common geometry compiler; chunk identity, edit/physical
revisions and prop geometry invalidate them. Section terrain is clipped to its
actual bounds. Actor shapes/poses update without recreating the world; idle
unchanged actor transforms are reused. Query broad-phase refreshes do not advance
a second rigid-body simulation: these are controlled colliders and retain explicit
motors. The ball is also a controlled bounce/rolling motor in this qualification
slice, not a general free rigid-body implementation.

NPC motion, support and side contacts use the shared motor, bypassing old ground
tracking/separation. AI intent, activation/travel preparation, animation, parenting
and spatial interest remain ordinary game code. Dense replacement movement reuses
the existing fine collision index, refreshed after each motor/push; ordinary balls
are included despite their legacy non-solid flag.

One upright controlled car retains steering/acceleration intent but uses the same
world for collision, gentle NPC pushes and gravity. Conservative padded angular
samples reject turning into walls and retain straight-roll recovery. Vertical
state commits with the authority pose. Controlled cars retain the existing admitted
command clock: empty input intervals hold their entire pose, and real neutral
commands brake/advance falling normally. Adding idle gravity without a shared time
budget would double-count later queued commands, so that attempt was removed.
Free-running vehicle gravity and its prediction timing remain future work.
Ordinary balls retain gameplay hit reactions/lifetime and bounce using Rapier
contact normals, including airborne or
unpushed recipients. No legacy ball contact pass also runs.

World Geometry's **Realm physics replacement proof** uses ordinary Realm actors,
Worker, prediction and renderer. `?geometry=realm` stages a ramp/deck, NPCs, ball
and one car; `crowd=0|24|96|384` stages the seeded active-crowds workload instead.
The selector compares legacy and persistent modes without changing global CVars.
Explicit diagnostic sampling reports bounded Worker tick/AI/contact timings and
world residency. The paired browser runner is
`node scripts/benchmark-realm-physics-browser.mjs`; `--cdp` connects to an existing
dedicated device browser and owns/closes only its new tabs.

This is not full game parity. Autonomous traffic, parking maneuvers, mounted animal
controllers, train motion and moving roof passengers are unqualified and blocked
or recorded explicitly; no legacy solver silently handles them. Vehicle apparatus,
specialized wildlife movement, other loose cargo, editor/navigation/safe-arrival
query parity, and arbitrary initial-overlap recovery remain cutover gaps.

## Implementation and review history

The first physical Chromebook run completed two order-reversed pairs for each
0/24/96/384-NPC workload in Chrome 150. The initial 384-NPC Rapier p95 was
163–172ms versus legacy 22–22.5ms; normal rendering could remain near 60Hz while
authority processed far fewer ticks. This is a failed cutover budget, not an FPS
success. A bounded fine-index change reduced desktop 384-NPC p95 from about
99ms to 43ms, still above the frozen legacy 11ms. The final paired measurements below supersede those preliminary captures.

The requested read-only Sol 6.1 high review identified five issues: section spill,
unchecked car rotation, missing committed car vertical state, missing ball bounce
normal and missing hit reactions for unpushed recipients. Focused regressions and
fixes were added; subsequent review and final checks are recorded below.


Implementation checkpoint `2221278f` passes 264 focused native tests, all three
TypeScript projects and a production build with current catalogs/2119 identities.
Four distinct full-Chromium cases pass across the normal game, geometry lab,
replacement NPC contact and actual P2P host/delayed guest. The initial new game
fixture had sent editor commands while in Play; switching to Edit fixed the fixture
without a runtime change. The isolated default streaming runner reports no errors
or failures. Follow-up review found four additional issues: duplicated idle car
gravity, inconsistent mode-4 ball hulls, overwritten corner reflections and direct
apparatus command fallthrough. These were corrected in `b6532310` and validated before the final device decision.

The follow-up review is clean after those corrections. Device benchmark captures
now explicitly scroll the canvas into view before measuring. Earlier captures did
not enforce canvas visibility; use their authority timings as preliminary evidence,
not a rendering qualification. The final paired device run follows the corrected
source checkpoint and records the visible-canvas configuration.

Corrected checkpoint validation: 267 focused native tests in 21 files and all
three TypeScript projects pass. Current catalog/manifest verify 2119 candidate
identities in full Chromium at retina scale; production build passes. All four
selected browser cases pass on the corrected source: original opt-in/legacy
return, shared geometry, ordinary replacement NPC pushing and real P2P delayed
guest reversals/convergence. Changed-file Biome checks pass with only existing
non-null assertion warnings. Final read-only `gpt-6.1-sol` at verified high effort
reports no actionable findings in the correction paths.


## Early decision — stop the cutover, reconsider the NPC stepping approach

**Do not make Rapier the default or begin compatibility migration/legacy deletion.**
The representative controlled interaction loop works, but target-device authority
cost is substantially worse. The bounded fine-index repair helped native scaling
without closing the gap. This ends the currently authorized slices 1–3 at a
negative investment gate; slices 4–6 have not started. The opt-in proof is a
checkpoint for inspection, not a second supported physics product.

Final physical Chromebook GPU lane, whole Worker realm tick p95 in milliseconds.
Ranges are the two independent trials, with mode order reversed in trial two;
0 NPCs still includes the controlled player.

| Nearby NPCs | Legacy | Persistent Rapier |
| --- | ---: | ---: |
| 0 | 1.7–1.8 | 2.3 |
| 24 | 5.6–8.6 | 15.0–18.8 |
| 96 | 17.1–17.9 | 26.8–27.8 |
| 384 (stress) | 30.6–32.3 | 118.3–125.6 |

[Raw GPU capture](../benchmarks/202-chromebook-physics-gpu.json): Chrome 150,
8 reported logical CPUs, 1600×721 CSS viewport, DPR 2.4. The browser reports an
8-GiB memory bucket; actual installed RAM was not measured. Frozen production
physics source is `b6532310`; driver revision `ee4196e6` explicitly verifies GPU
selection, visible canvas and actual elapsed capture windows. All 16 cases have
no browser errors. The common Machine Control ChromeOS guide was used for the
physical-device connection; no device login, power or browser ownership changed.

Each case uses the same seeded ordinary dog cohort, normal AI/activation and
4-second warmup followed by a requested 6-second sample. Actual elapsed includes
the diagnostic reply/authority catch-up: the two 384-NPC Rapier windows were
8.95/9.00 seconds for 83/82 ticks, roughly 9 authority ticks/sec. Do not divide
those counts by the requested six seconds. Legacy is also over budget at this
stress size; 384 active NPCs is not a newly promised supported population. Even
24/96-NPC relative costs prevent qualification under the provisional 201 budgets.

Main-thread frame interval p95 remains about 16.7–16.8ms, which hides the Worker
slowdown. The fixed lab camera culls offscreen actors; this is a collision/CPU
comparison with the renderer active, not proof of rendering all 384 NPCs at once.
The [paired Canvas capture](../benchmarks/202-chromebook-physics-canvas.json)
also fails: 384-NPC tick p95 is 111.3–113.4ms versus legacy 22.6–23.7ms. Its older
driver did not record actual elapsed or renderer identity; Canvas is inferred
from the then-default lab configuration. It is corroboration, not the primary
GPU evidence.

The final native pair ([legacy](../benchmarks/202-native-physics-legacy.json),
[Rapier](../benchmarks/202-native-physics-rapier.json)) on Apple M4 Pro gives
0/24/96/384-near p95 of 0.166/0.905/3.283/15.088ms versus
0.153/2.158/8.091/51.794ms. At 384 far, only the player remains active: 0.253
versus 0.330ms. This excludes browser/rendering and is one sequential pair, not
physical-device qualification. The immutable pre-change baseline above remains
separate from this same-current-source backend comparison.

At 384 in the GPU lane, `realm.entityPhysics` alone is 103.7–110.0ms p95;
`realm.ai` is 3.7–4.0ms. Persistent collider residency is 385 actors, 9 sections,
394 colliders, with no replaced actor shapes and only 9 lifetime section builds.
These are bounded residency counters, not a JS/WASM heap-growth measurement.
The evidence points to repeated controlled movement/query and broad-phase work,
not per-tick terrain reconstruction. It does not establish that Rapier's dynamic
solver itself is intrinsically unsuitable.

The next useful investment is a **separate bounded NPC stepping performance proof**:
profile per-motor query/refresh costs, prototype shared/batched scene updates or a
cheaper common grounded motor, then rerun the unchanged paired workloads. Keep
all active contacts and AI eligibility; no reduced-population shortcut. Exit only
with near-baseline representative p95 and 60Hz tail headroom on the Chromebook,
plus the current contact/prediction regressions. If that needs a major architecture
or still fails, shelve the replacement rather than extending dual maintenance.
Full compatibility and tumbling cars stay after a positive decision.

Desktop normal-game Worker and real P2P delayed-guest checks passed, including
reversals/convergence. Physical Chromebook P2P hosting, exhaustive contact piles,
long-run heap growth, maximum-visible rendering and the compatibility gaps above
are **not qualified**. They are not needed to reject this already failing CPU gate;
they remain requirements for any future positive cutover decision.

Play the isolated [ordinary Realm proof](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=realm#/tool/world-geometry)
(box/capsule selector; ramp, bridge, NPCs, ball, controlled car). For same-world
crowd inspection add `&crowd=24`, `96` or `384` before the hash; select legacy for
comparison. Normal game opt-in is `?physics=rapier-world&hull=box`; it has the
explicit compatibility limits above. Legacy remains the ordinary startup default.
