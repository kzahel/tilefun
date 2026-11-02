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
