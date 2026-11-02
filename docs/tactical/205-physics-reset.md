# Physics reset: one default shared simulation

Status: active autonomous implementation, 2026-11-02.
Owner: [physics engine](../topics/physics-engine.md).
Supersedes the implementation scope of [201](201-rapier-cutover-sequence.md) and
[204](204-unified-physics-architecture-audit.md); keeps their evidence/history.

## Authorization and end state

The owner explicitly authorized a large autonomous reset: purge unnecessary
physics commands/options and compatibility tests, keep gravity as the only exposed
physics tuning knob, simplify behavior, and refactor around one shared physics
step. Commit reviewable checkpoints and continue without another plan-approval
round. Exact old movement, specialized equipment behavior and experimental backend
permutations are not migration requirements. This does not authorize changes to
art approvals, user data, unrelated rendering/accessibility preferences or credentials.

Deliver one fixed 60Hz simulation kernel and one persistent Rapier world per active
realm. Gameplay supplies movement/trajectory/force intent; physics owns body poses;
post-step code owns derived seats/held items, events, animation and persistence.
Prediction uses that same kernel in a private bounded scene at explicit ticks.
No per-character world integration, separate legacy solver, permanent old/new mode,
configurable command clock, per-command subdivision or movement-parameter matrix.
One character preset, fixed upright player box, ordinary content shapes/masses as
body data. Keep keyboard/controller/touch, existing renderer, TypeScript gameplay,
Worker authority, ordinary saves and binary/P2P transport infrastructure.

## Concrete checkpoints

1. **Purge configuration and obsolete contracts.** Delete exposed backend, speed,
   tick/substep, time-scale, friction/acceleration, alternate jump/air, prediction
   override options and their wiring. Retain `sv_gravity`. Freeze the selected
   ordinary behavior temporarily where needed to keep intermediate code coherent;
   delete those transitional internals with the new kernel. Remove old algorithm/
   option-only tests and diagnostics that exist solely to compare retired modes.
   Keep useful contact/timing/performance counters and basic developer inspection.
2. **Shared closed-loop core.** Implement body registry/lifecycle, cached section
   geometry and one integration per physics tick. Players/NPCs submit desired
   movement, jumps are requests/impulses, balls are dynamic. Prove pushing/release,
   stable head standing, side jumping, walls/ramps/underpasses and crowd scaling.
   Reuse compiler/fixtures; no second pairwise solver or lab-only proxy world.
3. **Ordinary authority and prediction.** Replace per-input pose integration and
   EntityManager movement/ground/separation with intent collection/shared commit.
   Inputs map to fixed physics ticks, preserve edges, expire stale controls and
   acknowledge applied state coherently. Share kernel with bounded local-scene
   snapshot/replay and rendering interpolation. Prove actual Worker and independently
   scheduled delayed P2P; no entire-streamed-world snapshot/replay by default.
4. **Simplify remaining writers and delete old engines.** Basic car intent and
   prescribed moving bodies join the same world. Species movement becomes common
   intent/impulses/kinematic targets; ordinary AI decisions survive. Seats/held
   attachments are derived. For each peripheral subsystem choose shared adapter,
   explicit simplification or removal; record it here. No hidden legacy fallback.
   Remove old movement adapters, duplicate pose/carry corrections, backend dispatch,
   speculative compatibility fields and their obsolete tests. Align embedded labs.
5. **Qualify and deliver.** Focused native physics/input/lifecycle/replay tests,
   types/lint, ordinary Worker/P2P browser cases, current catalogs/manifest/build,
   streaming readiness and actual Chromebook CPU comparison. Use requested read-only
   Sol 6.1 high review via Yep Anywhere localhost3400. Fix findings, update owning
   docs, commit all changes, finish clean and run `npm run dev:ready` last.

## Tests: product outcomes, not legacy permutations

Delete tests requiring retired CVars/backends, Quake acceleration/bunnyhop variants,
30/60/120Hz command combinations, per-command travel catch-up, car pose freezes
between packets, alternate prediction disable modes, disposable character scenes
or exact old push/carry algorithms. Delete the corresponding implementation rather
than retaining it only for tests. Keep useful scenarios by expressing the basic
outcome against the new shared default; do not blanket-delete failing tests merely
to get green checks.

The compact basic contract covers move/stop/jump, body support/push/release, gravity,
static geometry/edit boundaries, bounded residency, save/reload/transition, input
edges and stale/late delivery, immutable replica/private prediction, delayed P2P
convergence, one integration per tick and representative crowds. Latency scenarios
are correctness conditions, not supported product-mode permutations. Browser
checks only for actual browser boundaries; exhaustive physics stays native.

## Scope dispositions

- Retain: ordinary movement, meaningful contacts/support/jumping, NPC AI intent,
  static authoring/ramps/bridges, ordinary balls, basic driving, usable saved worlds
  and browser multiplayer; exact old numerical feel may change.
- Simplify/defer: specialized wildlife trajectory rules, boats/rail/parking and
  vehicle roof/equipment behavior where retaining it would require old pose solvers.
  Record exact decisions before marking the reset complete. Preserve content/art.
- Defer: new suspension, fully tumbling car/render orientation, articulated vehicle
  simulation and new art. This reset supplies their future common foundation.
- Keep diagnostics/data needed to assess CPU, contacts, corrections and residency;
  remove alternate runtime physics control surfaces. No new generic engine framework.

## Progress and completion evidence

Goal created and plan recorded before implementation. Checkpoint commits, validation,
feature/test dispositions, review and device results are appended here. The old
202 failed game budget remains evidence; neither 203's simplified-model speed nor
one integration counter alone establishes positive game qualification.

Completion requires the shared normal startup path and legacy deletion, a coherent
playable baseline with explicit peripheral dispositions, passing relevant checks,
measured performance, review, clean commits and readiness. Do not call an isolated
lab, option purge alone, a failing build, or a temporary compatibility shim complete.


### Checkpoint 1a — public configuration purge

Removed all server physics CVars except `sv_gravity`; removed client time-scale,
prediction-disable and shadow extrapolation controls and their game/render wiring.
Normal game URL no longer selects the disposable/persistent experimental backends
or player hull. Network emulation, camera/render preferences and read-only
reconciliation diagnostics remain. Deleted `CharacterPhysics.test.ts`, whose sole
contract was lazy optional-backend selection. Shared contact/regression tests are
retained until replaced with the new core outcomes. Internal old settings/schema
and solver modules are transitional and must still be deleted later in this run;
this checkpoint is not the completed physics reset.

### Checkpoint 2a — shared body core and fixed-tick input admission

Added `PhysicsScene`: ordinary fixed-footprint characters, dynamic balls/loose
bodies and upright vehicle bodies share one persistent world and one integration
per 1/60s tick. Shape creation is per body identity/change, section geometry is
updated once per scene tick, and support/contact readback occurs after integration.
The player outer box stays fixed, with a built-in 0.01m-or-smaller bevel to prevent
subpixel ramp/slab seams from snagging its bottom edge. Normal contact projection
supports slope travel; CCD replaces soft-CCD's premature seam face constraints.
No user-facing shape/controller mode is added. Full orientation/suspension remains
outside the baseline. Static authored geometry compiles through the existing common
compiler, now independent of the old character-backend source interface.

Added `PlayerControls`: coalesce arrived held-state changes into one tick, retain
press/release jump edges, reject duplicate sequences and expire stale held controls
on simulation ticks. Command `dtMs` cannot add travel. This input policy deliberately
retires queued-duration travel and car pose freezing on missing-input ticks.

Seven shared-scene and two input tests pass, plus 24 retained authored-character
geometry checks (33 total); all three TypeScript projects pass at this checkpoint.
The scene tests use real body interaction, persistent 96-NPC stepping, pushing and
release, head standing/walking, side jumping/held-edge suppression, edited walls,
ramp-to-deck/underpass traversal and snapshot restore. This is still a native core;
ordinary Realm/prediction wiring and deletion of transitional engines are next.

Snapshot state also retains desired horizontal control, prescribed altitude/heading,
ground/support normals and derived ground height so private replay can resume a
coupled scene rather than infer control from contact velocity. Input resets retain
the acknowledged sequence fence. The nine focused new tests and three typecheck
projects pass after these state additions.


### Checkpoint 3a — ordinary shared authority

Normal `Realm` startup now creates `PhysicsScene`; a tick admits held controls,
collects NPC/species intent, synchronizes body membership/explicit edits, integrates
once, then publishes poses and runs gameplay/attachments/persistence. Removed the
per-command player movement/idle-gravity phase and EntityManager's independent
movement, ground tracking, push and separation solver. AI has a distinct transient
`desiredVelocity`; measured `velocity` is physics readback. AI decision cadence can
remain slower without giving each actor a separate integration clock. Existing
flight/hop curves temporarily supply vertical motor targets rather than committing
another physical pose. This is transitional species adaptation, not a promise to
preserve every authored legacy trajectory.

Basic car input supplies velocity/heading intent. Canonical vehicle body dimensions
avoid recreating or double-rotating collision hulls as sprite facing changes. Seats
remain derived, and shared car readback is persisted through normal traffic records.
Balls use the same gravity/contact solver; hit reactions and lifetime run as gameplay
consequences, with no second bounce/push integration. Explicit velocity-only launches
are admitted by body synchronization. Character/vehicle zero-friction uses Rapier's
minimum combine rule so static material friction cannot silently slow the motor.
Support tests use relative contact velocity and tolerate small solver separation
velocities; jump requests still immediately leave support.

Seven ordinary `ScenarioSession`/Realm tests cover normal default player/NPC/ball,
packet bursts and gaps, NPC head standing/walking, multiple sessions in one step,
reload, car driving and persisted pose, actual AI intent/stop/removal and ball launch/
despawn. Together with core/input and retained AI scheduling tests, **45 focused
checks pass**. Eight retained Realm wildlife-landing cases also pass after connecting
support body identity to startle gameplay. A broader retained lifecycle/AI/content
run passed 674 cases and found four failures (three old velocity assertions, one
static-friction combine issue); all four pass in the focused rerun. Three TypeScript
projects pass. These are native authority checks, not browser/P2P qualification.

Test dispositions are intentional: removed 56 declarations coupled to deleted
`EntityManager.update` integration/ground/separation behavior and its private query
counters, three per-command driving/equipment scenarios, and the two all-profile
exact-pose/activity-cycle integration matrices. Removed the retired persistent
per-character backend test file. Keep entity lifecycle/index tests, AI decision and
scheduler tests, species/habitat/asset identity data checks, and basic shared outcome
coverage. Per-species exact resting zeroes, legacy catch-up trajectory timing and
full equipment compatibility are not reset requirements; no implementation shim was
added to preserve those APIs. Remaining old predictor/solver tests and experimental
lab ownership must still be retired/aligned in subsequent checkpoints.

**Not ready for playable delivery yet:** the ordinary client predictor is still the
old movement implementation, physics snapshots are not yet on the normal frame
protocol, and some peripheral commands still reject or reference retired equipment
behavior. Next replace prediction/protocol at shared ticks, then remove those old
engines/options and finish Worker/P2P/device qualification and review. Do not use
this checkpoint as evidence of a completed cutover or Chromebook budget recovery.


### Checkpoint 3b — bounded numerical state on ordinary frames

Normal replication now carries a bounded numerical `PhysicsState`: scene epoch,
physics tick, body kinds/poses/velocities, desired motor targets, jump latch and
support normal/identity. It prioritizes the anchor's connected contacts, then nearby
bodies within a 160px neighborhood (including body extent), and caps at 128 bodies.
An explicit omitted count reports overflow or unavailable entity baselines; the new
predictor must hold/recover rather than simulate through omitted contacts. Distant
players still replicate as location markers without joining this local scene.
No WASM full-world snapshots or entire streamed-world copies are added.

World coordinates use Float64; motor/velocity/normal fields use Float32. The fixed
wire body is 81 bytes, plus a 14-byte snapshot header and one presence byte. Thus a
saturated 128-body snapshot adds about 10KB per frame; this is a bound, not a claim
that bandwidth or replay CPU is qualified. Ordinary sparse worlds send only nearby
physical bodies. Actual traffic, replay cost and Chromebook impact remain final gates.
Frame tag is now `0x0a`; older frames explicitly reject and matching builds are
required. Replicas cache the coherent state and clear it on world resets. Shared
scene restore preserves the authoritative epoch and body kind; private membership
can reconstruct body kinds without importing server-only AI/work components.

**61 focused native checks pass**, including normal-frame delivery, bounded snapshot
selection/overflow/isolation/epoch replacement, binary roundtrip and precise large
coordinates, malformed/truncated/duplicate/oversized state rejection, replica reset,
shared interactions, lifecycle/driving and existing entity codec/replication tests.
All three TypeScript projects pass. Source lint has no introduced diagnostics (the
existing binary entity codec still has its pre-existing non-null-assertion warnings).
The ordinary old client predictor does not consume this state yet; replacement and
latency/presentation qualification are next, with no readiness marker at this checkpoint.

### Checkpoint 3c — shared default client prediction and contact presentation

Replaced the 1,790-line per-command predictor with the ordinary shared kernel,
bounded numeric restore/replay and one local tick clock. An acknowledged input
anchors local input ticks to the snapshot's physics tick. Neither command duration
nor packet count adds authority integration time. Both ordinary PlayScene and
ScenarioClient consume normal frame physics; ScenarioClient now reconciles live
frames between control responses too. Client copies remain private and immutable
replicas are never moved by prediction.

History is capped at 120 input ticks (two seconds). Replay runs at most eight
steps/2ms per client update, with one whole physics step as the smallest work unit;
partially replayed poses are not published. A newer snapshot covering the pending
suffix supersedes unfinished work. Missing history or snapshot overflow explicitly
holds/rebases instead of falling through to another solver or omitting colliders.
The server's 15-tick control deadline is retained in body state and replay, so
restoring a snapshot cannot refresh abandoned controls. The additional uint32 makes
each wire body **85 bytes** and the current frame tag **0x0b**; prior tags reject.
Local diagonal prediction uses the same normalized input retained for replay.

Nearby contacts share a physics tick and one rigid display correction. Idle
observers keep buffered coherent scenes; local input, physical pushing/flight and
support activate the predicted contact component. Render interpolation uses the
same previous physics tick for the local player and its neighbors, including after
replay; it does not mix the last published player pose with a neighbor's last
physics step. Camera/root correction uses that same transform. Local animation
advances once per live input tick even when that update performs replay. Diagnostics
separate matching-past-tick error from current-pose rebase distance, and retain
body/overflow/replay/work/recovery counters without old parameter-revision causes.
Unknown future remote/AI inputs remain uncertain; this is not a bit-exact guarantee.

The garage traversal checks exposed actual duplicate geometry: excavated terrain
reached the slab's top, producing coplanar terrain/slab contacts and tile-boundary
kicks. Terrain now ends at the authored slab underside, leaving its surface to the
slab collider. The speculative extra support-normal ray was removed after this
actual geometry fix passed the original traversal checks without it. Geometry
assertions retain traversal, headroom, reload, fall and underpass outcomes, with
small rigid-body tolerances instead of legacy exact snap coordinates.

Test dispositions: retired 15 whole legacy predictor/rate/carry test files, 24
additional predictor-specific declarations in mixed files, and 14 obsolete matrix
CLIs/helpers. Kept standalone replica presentation, content/habitat/identity,
serialization and unrelated lifecycle cases in the mixed files. Removed commands
are no longer advertised by the diagnostics README. Basic outcomes are covered by
the shared default rather than compatibility constructors or old collision APIs.

Validation at this checkpoint:

- **89 focused native checks pass** across ten files: shared authority/core/input,
  normal frame codec/replication, private prediction, standalone remote presentation,
  ramps/bridges/headroom/underpasses, excavation and reload. The ten new prediction
  cases cover coupled push/reversal with ordered delay/jitter, two real Realm
  sessions/views at fractional rendering, NPC head support/fresh jump, replay/history
  bounds, overflow/epoch fences, animation, replica immutability and basic diagonal
  car prediction/derived seat.
- All three TypeScript projects pass; changed-source lint has no introduced errors
  or warnings (existing entity-codec non-null warnings remain).
- `art:catalog`, `workshop:manifest` and production build pass. Only generated
  inventories/fingerprints changed; no asset/review pixels or approvals changed.
- The ordinary production **GPU/full-Chromium Worker** input-recovery case passes:
  three edit/play replacements, forward movement, release convergence and strictly
  increasing submitted sequences. This is one actual browser boundary, not delayed
  WebRTC, all peripherals, Chromebook performance or broad visual qualification.

Still incomplete: delete unused old engines/dispatch/internal timing schemas and
remaining peripheral pose writers; align/retire experimental labs and unsupported
controls; complete ordinary delayed P2P, streaming/device/performance and requested
final review. No dev-ready marker yet. The clean shared default does not justify
keeping dormant legacy implementations or declaring the reset complete.

### Checkpoint 4a — gravity-only schema and fixed clocks

Removed the remaining ordinary CVar schema/application for backend selection,
friction/acceleration/air/jump variants, time scale, server tick-rate and physics
multipliers. Normal frames sync only gravity through `Gravity.ts`; the ordinary
predictor and authority no longer import the legacy movement implementation.
Worker startup/transport has no backend selector. Realm has a gravity callback for
scoped scenarios rather than a movement-parameter matrix.

ServerLoop and GameLoop now have one fixed 60Hz clock and no rate/time-scale
setters. GameServer's rate accessors are read-only, and main-thread startup no
longer changes its clock from replication. Removed the obsolete speed multiplier,
post-landing Quake jump branch and remote presentation-rate override. The old
movement module still temporarily forwards gravity for its remaining retired
consumers; deleting that module and those consumers is the next step, not a second
supported configuration.

Kept fixed-clock cadence, bounded stall debt, lifecycle stop/resume/error handling,
120Hz display interpolation and sole-gravity replication tests. Retired the two
clock rate-switch cases and collapsed rate permutations to the fixed default.
Removed the old EntityActivation test fixture, which constructed an uninitialized
Realm and asserted the deleted per-tier separation algorithm/substep counts; real
shared residency/activation and streaming qualification remain required. The
existing authorization check now uses the sole gravity setting rather than deleted
speed tuning. It exposed unawaited console registration; GameServer startup now
awaits command registration before accepting a ready connection.

**95 focused native checks pass** (77 shared/clock/replica cases, 17 Worker transport/
watchdog cases, one administration case), and all three TypeScript projects pass.
No new lint diagnostics. No new browser/performance/readiness claim at this internal
checkpoint. Legacy solver modules, alternate lab owners, remaining equipment/AI pose
writers, obsolete commands/tests and final qualification still need removal/work.


### Checkpoint 4b — remove alternate engines and align the co-op lab

Deleted the old player integrator, movement-parameter schema, character backend
loader/dispatch, per-character Rapier worlds, speculative collision timeline,
whole-world lab authority/replay engines and `RealmSimulationOwner`. No Realm
option can replace its default physics owner. Removed the legacy ball/cargo travel
integrators and friction-option table; useful contact consequences remain after the
shared step. The old native adapter comparison and prototype benchmark CLIs retire
with their implementations; frozen research remains in 189–204 and benchmark data.
Vehicle/equipment collision/pose solvers still require the next cleanup slice.

Scenario recipes retain scoped gravity only. Removed the geometry backend/hull
selector and recipe speed/frame-rate settings. Ordinary input packets now contain
only controls, edges and sequence: eight bytes, tag **0x81**; `dtMs` and its quantizer
are deleted throughout normal input, queues, tests and scenario wiring. Prior input
tags reject; matching updated builds are required. The frame remains **0x0b**.

Replaced the old cooperative lab engines with two ordinary sessions on the existing
ScenarioSession/ScenarioWorkerHost. Its authority uses the independent ServerLoop;
each view uses normal binary frames, RemoteStateView and PlayerPredictor. Binary
packets remain top-level transferable/countable channel messages, including the
guest. Bounded ordered delay/jitter applies to the guest's inputs and frames.
Control/replacement fences admit preceding inputs and deliver preceding frame deltas
rather than dropping dependencies. Save/reload/reset and pause/one-step use ordinary
Realm operations. Data-only fixtures/scripts cover pushing, opposed movement,
glancing, head standing and reversal; simple Three.js boxes visualize actual
collider data. Body IDs reused across reload update their presentation roles.
Keyboard, touch and controller movement/focus/confirm/back remain available.

Test dispositions: removed old backend/full-world replay/bridge-scale test files,
per-command cargo/roof integration and exact ricochet matrices. Kept geometry,
identity/serialization, AI decisions and unrelated lifecycle tests. Touch destination
arrival now exercises ordinary ScenarioSession; owned-toy/disposable water behavior
uses actual shared stepping. Shared default ball contact now checks hit reaction.
It exposed post-collision-speed filtering: the solver can remove incident speed
before gameplay reads it. The scene retains pre-step loose-body speed for gameplay
hit thresholds, with no separate bounce or position integration. Spectator backfill
checks durable identities/uniqueness instead of hard-coding an incidental loaded
crowd count. Failed-Worker lifecycle checks assert no publication/resumption; an
unrelated pending storage flush is not treated as a physics timer.

Validation at this checkpoint:

- **93 focused native checks across 13 files pass**, plus the ten shared-scene
  checks. These cover normal frames/input edges, two Worker-host sessions,
  save/reload/reset, ordered queue fences, touch arrival, shared ball reactions,
  owned water toys, geometry/headroom, private replay and clock replacement.
- All three TypeScript projects pass. Changed core/lab source lint has no new
  diagnostics; the binary codec retains its existing non-null warnings.
- Catalog generation, Workshop manifest (2,119 candidates) and production build
  pass. Generated inventories/fingerprints change; approved asset pixels do not.
- **Four full-Chromium browser checks pass**: the two-session lab with 200ms guest
  RTT, keyboard/controller/touch, pause/one-step, save/reload and Worker teardown;
  ordinary GPU Worker repeated edit/play input recovery; normal-game NPC push/
  prediction; actual P2P host/delayed guest reversal and release convergence.
  The lab browser check exposed a pointer-focus bug: touch direction lost its
  held input when default button focus blurred the canvas. Preventing that pointer
  focus transfer fixes the real input route, which passes on rerun.

The reset remains unfinished: simplify AI/work pose writers and old vehicle/
equipment/rail behavior and controls, then finish residency/streaming and the
post-cleanup browser checks, Chromebook CPU/render comparison and requested final
review. The basic P2P check above is evidence, not complete gameplay qualification.
No readiness marker.


### Checkpoint 4c — common AI intent and physical resource roles (2026-11-03)

All ordinary AI producers now share transient `motionIntent`, defined as data in
PhysicsState. Species flight/hop and woodland climb targets supply altitude without
writing body height. Removed EntityManager's save/restore-height shim: collecting
intent does not mutate physical poses. Actual velocity remains shared readback;
spawns, explicit launches/drops and derived held/cached attachments are lifecycle
operations. The remaining wildlife position writers were checked against those
roles. No second integration or per-species physics backend is added.

Separated anchored nonblocking resource/site markers from loose food/toy bodies.
Previously every work item was dynamic, so foragers could push their cache away
and canopy crops fell. Anchored markers keep their authored height while loose
food falls in the shared scene. Real throws now start beyond the player hull;
spawn clearance queries the same Rapier world and rejects a hand blocked by a wall.
This avoids creating a projectile inside its thrower, without another collision
solver or thrower-only physics mode. Low throw range now follows the fixed physical
preset; the real hit fixture stages its target within that range.

A real canopy can block the old climbing route. Prescribed climb tasks now time
out, release claims/altitude and fall normally when their support is removed.
Full crown/perch traversal is explicitly deferred beyond the basic reset baseline;
no teleport or canopy collision exception preserves it. Reopened AI/integration/
validation for capuchin and the three cat coats in the behavior ledger; pending
human art-review states and pixel banks stay unchanged. Ground cat toy play,
raccoon cache/conservation, source renewal and held-item identity remain covered.

Retired the all-profile x input/idle wildlife landing matrix. Three shared contact
roles retain mounting, defense and ordinary startle/persisted-identity behavior;
profile/asset/data checks remain. Retained real source/carry/toy tests with fixed
60Hz helper time and physical tolerances. Removed assertions that every deer sits
at exact zero height or every authored animation cycle occurs in an incidental
number of physics steps. Replaced successful-through-canopy choreography with a
blocked-climb/cancellation/reload outcome and anchored natural crop checks.

The initial widened audit passed 1,255 of 1,270 checks and exposed physical-zero,
old duration/cycle assumptions and the resource/climb issues above. The focused
post-fix run passes **74 checks across ten files**, including shared scene/prediction,
ordinary authority, normal two-session Worker host and retained wildlife behavior.
All three TypeScript projects pass. Changed-source lint has no new diagnostics;
behavior-ledger freshness checks pass. Catalog generation, the 2,119-candidate
Workshop manifest and production build pass. Both full-Chromium follow-ups pass:
the ordinary two-session Worker lab (including controller/touch and replacement
fences) and GPU Worker repeated edit/play input recovery. These checks retain
prior P2P evidence without claiming post-vehicle-cleanup or device qualification. The reset is still active: remove old vehicle/
equipment solvers and controls, unused manual scenario timing parameters, then
finish residency/streaming, Chromebook measurements and final review/readiness.


The committed behavior ledger/report and current production-table behavior summary
were refreshed from canonical data. The historical `node scripts/wildlife/status.mjs`
runner cannot rebuild this checkout's old campaign queue because ignored
`data/wildlife-campaign-v2/progress.json` is absent. Its retained historical sections
were preserved; no campaign/session state or human approvals were invented.


### Checkpoint 4d — independent vehicles and fixed scenario clock (in progress)

Replaced TrafficSystem with a small VehicleRegistry: model placement, generated
saved depot identities, driver ownership and pose/paint/light persistence. Basic
land vehicles use ordinary shared velocity/heading intent and derived inside seats.
No route, parking, boat, train, towing, transporter or bed-equipment service owns
motion. Removed their authority/UI commands and executable scenario options;
static generation/layout/track planners, banks and exact art reviews remain.
Old durable traffic records read their absolute saved poses as independent bodies;
legacy route/coupling/apparatus fields are intentionally discarded. The collection
name remains traffic for save compatibility; new snapshots have version 2.

ScenarioSession now exposes exactly one fixed tick/step, without a duration argument
or per-recipe service matrix. The ordinary Worker owns continuous stepping. The
geometry lab offers actual controlled cars, authored ramps/bridges/garage, generated
crossings and the Realm crowd fixture; retired interactive bookmarks explain the
deferral. Basic driving opens through the old traffic tool URL. Candidate identities
and historical batches remain, with explicit deferred descriptions/exclusions.
Removed old service/equipment/per-model motion matrices; kept independent model,
source, appearance, geometry and codec checks. Main-game mobile GPU placement/seat/
save/delete and embedded Worker/GPU lifecycle checks replace traffic lab matrices.

The focused 50-case core/authority/prediction/registry/seat/placement/depot/garage/
bridge run passes. The wider initial audit passed 599/644 checks and exposed an
obsolete 33-model steering/roof matrix, retired boat/train lifecycle assertions,
legacy scenario duration helpers, exact kinematic zeroes and two real issues.
Cars now use the same fixed subpixel edge bevel as characters to cross the garage
ramp seam. Rounded resting balls can retain positive raw manifold distances after sleeping;
support/contact classification now uses the constraints Rapier actually solves,
with normal/separating-velocity checks intact. Projectile hit reactions use their
pre-solver velocity towards the actual contact normal, so pushing a resting ball
does not count as that ball striking its pusher. Lab appearance reapplication preserves saved
animation clips/phase. Work pickup/deposit/retrieve arrivals clear the travel motor,
so a dog can pick up a physical ball rather than continue pushing it during its
pickup animation. Post-fix evidence and final commit are recorded below.

Still incomplete: remove now-unneeded mixed rendering/query/legacy pose helpers,
finish residency/streaming and Chromebook evidence, final requested review and
readiness. This checkpoint does not claim a completed reset or vehicle tumbling.

Post-fix native checkpoint: **108 checks pass in 15 files**, covering common
contacts/prediction, ordinary authority, placement/seat/save/paint/registry migration,
car bridge/garage/depot traversal and tombstones, Worker parity, repeated fetch
through reload, pasture support/removal and keyboard/controller hints. All three
TypeScript projects pass. The canonical wildlife behavior-ledger freshness check
passes; the historical production queue still cannot rebuild without ignored
`data/wildlife-campaign-v2/progress.json` (same documented checkout limitation).
No human review/approval state or asset pixels changed. Browser/build qualification
is recorded separately after the final source inventory is generated.

Next cleanup audit: CollisionIndex is still maintained by EntityManager; the old
`resolveCollision`/ground-tracking/air-momentum exports remain alongside their
retired helpers. CollisionDebug and scene collection still expose old equipment/
cosmetic grade geometry. Remove those remaining consumers/pose writers rather than
keeping a misleading second collision description. Also qualify sleeping loose
bodies when their support geometry is edited: static section removal currently
passes `wakeUp=false`; establish the actual outcome and correct it before the
save/edit/lifecycle gate is called complete.

The first full-Chromium boundary run passed six of seven checks (ordinary GPU
Worker contacts, delayed P2P, mobile game placement/seat/save/delete, co-op lab,
Worker client-stall/lifecycle fences and GPU context replacement). It exposed a
real manual-lab boarding mismatch: the immediate response paired a new seat parent
baseline with the preceding physics membership. Shared Realm replication now
refreshes membership/explicit edits before capture, without integrating or advancing
the clock. A native predictor regression covers enter/exit at an unchanged tick;
this is shared publication behavior, not a lab-only physics path. The bounded
Chromebook gate must include this registry pass's cost. Vehicle records also retain
vertical velocity, with a real falling-car reload/continuation regression.
Both new boundaries pass with 33 related cases (35 total across six files).

Delivery evidence for this checkpoint: **110 focused native checks pass across
15 files**, all three TypeScript projects pass, and changed-source lint has no
introduced diagnostics (two existing warnings remain). Fresh art catalog, the
2,119-candidate Workshop manifest and production build pass. **All seven full-
Chromium checks pass** on the finished bundle: ordinary Worker NPC/prediction,
delayed P2P reversal/convergence, two-seat Worker lab/fences/reload, real-time
Worker client-stall/lifecycle behavior, embedded GPU resize/context recovery/
teardown, controlled car garage traversal/seat reload, and mobile game car
placement/driving/save/delete. The mobile editor capture was visually inspected.
No promoted assets, source pixels or review approvals changed. This remains an
unfinished reset checkpoint: no dev-ready marker and no Chromebook performance
claim. Continue the remaining helper/residency/edit cleanup, then the device gate
and requested final review.
