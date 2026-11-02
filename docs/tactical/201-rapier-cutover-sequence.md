# Rapier replacement and early decision sequence

Status: slices 1–3 reached the early decision; cutover paused on failed Chromebook CPU gate, 2026-11-02.
Parent sequencing plan. Owner: [physics engine](../topics/physics-engine.md).

## Outcome and scope

The owner wants Rapier to replace the legacy collision implementation if basic
interactions work well enough and browser/Chromebook performance is acceptable.
The dual-backend period is temporary qualification, not a supported permanent
product choice. Reach a measured proceed/stop decision early, before new vehicle
features or exhaustive feature migration. A proceed decision commits to closing
the finite compatibility gaps, making Rapier the default and deleting superseded
legacy resolution. It is not itself permission to ship known gameplay blockers.

This supersedes the earlier sequence of patching NPC pushing independently and
then building a dynamic car. Existing 189–200 deliveries remain useful reference
and regression evidence; they are not proof of a complete game backend.

Keep TypeScript gameplay/AI, browser-first play, the existing renderer and Worker
authority. No Rust server rewrite, SharedArrayBuffer prerequisite, new art or
renderer replacement is needed. Tumbles and jump ramps are subsequent features,
not prerequisites for deciding whether Rapier can replace current collision.

## Architecture contract

- One persistent authoritative Rapier world per active realm. Fixed terrain,
  buildings, ramps and bridge colliders share it with controlled characters and
  vehicles and dynamic loose bodies. Separate realms may have separate worlds;
  static geometry and cars in the same realm do not have separate authorities.
- Compile existing authored geometry into bounded resident sections. Preserve
  over/under spaces and long-structure seams. Interest/readiness controls residency;
  do not simulate every NPC or load the entire world. Retain AI activation/tiering
  independently of physical contact updates.
- Select the backend at realm startup/reload for qualification. No hot per-object
  switches, silent legacy fallback or permanent backend choice in saved worlds.
  Unsupported collision consumers are reported explicitly. A contact has one owner.
- Gameplay supplies movement intent, motor parameters and explicit support/side
  policies. Rapier supplies collision geometry/queries and dynamic integration.
  Upright players/NPCs do not have to become free tumbling rigid bodies. Kinematic
  motors still need intentional pushing; shared geometry alone does not supply it.
- Old separation, ground tracking, roof carry, vehicle collision and query helpers
  cannot independently correct the same resolved pose. Preserve useful gameplay,
  authored shapes, spatial interest, navigation and support semantics; retire their
  superseded collision implementations rather than renaming them as adapters.
- Client prediction uses private nonauthoritative worlds and the same movement,
  geometry and time contracts. Server authority remains singular. Resolve physics
  once per agreed simulation interval; replay command timing must not cause an
  additional world step per player or a second gravity/contact pass.

## Implementation slices

### 1. Ownership inventory, baseline and persistent world

Identify every pose writer and collision consumer in Realm, EntityManager,
PlayerMovement, traffic/vehicles, loose objects, supports and prediction. Classify
each as retained gameplay, migrated collision or deferred new behavior. Include
mounted actors, trains, water/one-way rules, editing and streaming; do not discover
these only after declaring the backend complete.

Capture an immutable legacy revision and repeatable ordinary-game baseline inputs.
Establish measurements and workload sizes before tuning Rapier. Add the exclusive
experimental realm mode, persistent body identity/lifecycle, shared geometry
compiler and streamed fixed colliders. Hook ordinary player movement into it;
remove per-command scene reconstruction on this path. Keep unsupported cases
visible instead of quietly invoking legacy resolution.

Exit: flat ground, walls, ramp, bridge/underpass and section seams work through the
normal Realm/Worker and client prediction boundary. An initial on-device sparse/
crowd query smoke detects an architectural performance problem immediately.

### 2. Complete the smallest representative interaction loop

Migrate controlled NPC movement and player/NPC/NPC contact response onto the same
world. Restore positive bounded side pushing while retaining head standing,
jumping beside another actor, sliding and release without runaway motion. Keep
AI decisions and schedules. Add one ordinary loose-object type and a controlled,
upright car using existing driving intent but Rapier collision; car tumbling is
not part of this slice. Prove car/NPC, character/object, and character/vehicle
support and pushing without a legacy second response.

Use ordinary game entities and gameplay, not lab-only proxy replacements. Reuse
the native/shared scenario scripts and an embedded visual host. Add an actual
game test so a two-player lab cannot falsely qualify the NPC phase again. Include
basic edit/remove, chunk-boundary movement and save/reload body reconstruction.

Wire matching prediction/reconciliation as part of these interactions, not a later
project. Check local host and delayed guest walking, reversals, pushes, landing
and vehicle movement. The full-world lab's unresolved both-active cube corrections
are a risk to test early, not behavior already qualified by that lab.

Exit: a playable ordinary-world route demonstrates the representative loop with
both box and capsule available for comparison, plus a short explicit gap list.
It need not yet qualify every vehicle apparatus or creature behavior.

### 3. Early decision: gameplay and performance

Run the same representative scripts/workloads against the frozen legacy revision
and exclusive Rapier mode. Include sparse play, increasing moving/idle NPC counts,
clustered contacts against walls, long/stacked geometry, streaming/edit churn,
one driven car and loose objects. Use the same activation rules and workloads;
do not achieve a faster result by silently updating fewer actors or removing
collision. Separate AI, collision and rendering costs in diagnostics.

Start with native correctness/scaling runs, then the actual browser Worker game
on the target Chromebook, including local P2P hosting and a delayed guest. Measure
whole authority tick p50/p95/p99, deadline misses, character queries, physics step,
geometry updates, prediction/replay, main-thread frames, corrections, allocations
and JS/WASM memory/residency. Dense moving crowds matter more than sleeping-body
counts. Repeat enough to distinguish noise and contention from a regression.

Provisional performance targets, to fix after slice 1's baseline and before tuning:
representative whole-tick p95 no more than roughly 10–15% worse where the baseline
is meaningfully above measurement noise; p99 comfortably within the 16.7ms 60Hz
deadline (aim for about 12ms or less), with bounded replay and no new visible frame
stalls, growing memory or contact corrections. Stress workloads locate the scaling
limit; arbitrary extreme counts are not a new promised supported population.
These are proposed qualification budgets, not owner-approved numeric thresholds
or existing performance claims. Absolute headroom and actual playability matter
alongside relative slowdown.

Produce a compact decision record with device/build/workloads, paired results,
playable links, regressions and the remaining deletion/compatibility checklist:

- **Proceed:** representative interactions are acceptable or have understood,
  bounded fixes, performance fits the agreed budget, and remaining compatibility
  work is finite. Commit to the replacement path and stop adding legacy features.
- **One bounded repair and remeasure:** a specific correctness or allocation/query
  problem has a plausible limited fix. Name the exit condition; do not enter an
  open-ended optimization or dual-backend project.
- **Stop/reconsider:** basic contact/prediction or target-device cost requires a
  major new architecture. Retain the legacy default and remove/shelve the failed
  migration path rather than maintain two implementations indefinitely.

This is the early investment decision, reached after slices 1–3. It precedes full
parity and dynamic-car development. Missing physical-device evidence stays explicit;
desktop numbers alone cannot establish Chromebook acceptance.

### 4. Close the finite cutover blockers

After a proceed decision, qualify current gameplay consumers from the slice 1
inventory: mounts, water/one-way surfaces, moving roofs/trains, vehicle beds,
towing/transporter apparatus, wildlife movement/contacts and existing loose cargo.
Keep current capabilities through shared Rapier queries/controllers where dynamic
simulation is unnecessary. Existing custom controllers may remain; alternative
collision authorities may not. No requirement for new suspension, ragdolls,
articulated rigid-body trucks or perfect numerical equivalence to legacy.

Check persistence, transitions, edits, bounded residency, actual multiplayer and
rendering/fallback support on the ordinary game path. Scope tests to distinct
contracts; reuse existing tests instead of permanently doubling every test matrix.
Any critical missing interaction blocks default cutover; minor intentional behavior
changes need an explicit recorded disposition rather than silent acceptance.

### 5. Default cutover and delete legacy resolution

Make Rapier the normal startup path after gameplay blockers and device gates pass.
Use a short, explicitly bounded owner playtest checkpoint. Remove legacy collision
dispatch, duplicate separation/ground/contact solvers, temporary comparison mode
and superseded tests as part of this replacement milestone. If deletion must be a
separate commit, its exact checklist is recorded before the default flip; do not
start dynamic-car expansion while cleanup remains open. Recovery can use the
previous release/revision instead of keeping two permanent runtime backends.

Retain shared shapes, AI/navigation, activation, motor CVars, gameplay events and
useful regression scenarios. Preserve save compatibility or document an explicit
conversion. Default startup, Worker/lab behavior and diagnostics must describe the
single current backend. Repeat the relevant acceptance gates after deletion.

### 6. Dynamic car on the replacement foundation

One existing car gets a dynamic chassis, suspension/steering forces and full
position/orientation/velocity state through authority, prediction, replication,
persistence and rendering. Prove takeoff, landing, sideways teeter, tumble and a
controller/touch/keyboard recovery action, then qualify latency and performance.
Broader traffic and articulated vehicle dynamics follow only after this proof.

## Current checkpoint

The owner authorized implementation through the early decision, with incremental
commits. [202](202-persistent-realm-collision-proof.md) records execution, baseline,
checks and remaining gaps. Default cutover/deletion and dynamic-car expansion are
later slices. The early decision is **no cutover**: the representative persistent
controlled-collision proof passes focused gameplay/prediction checks but its
Chromebook crowd CPU cost fails the provisional budget. A bounded NPC stepping
performance proof must precede any renewed compatibility/default investment; see
202 for raw paired GPU/Canvas/native captures and unqualified gates.

The follow-up [204 architecture audit](204-unified-physics-architecture-audit.md)
records the owner's clarification: exact legacy feel and command-clock behavior
need not survive. It recommends refactoring shared tick/input/intent/body ownership
before further compatibility migration, with a bounded coupled prediction proof.
This is an audit and effort estimate; the shared-tick implementation is not yet
started and no positive cutover decision replaces the 202 result.
