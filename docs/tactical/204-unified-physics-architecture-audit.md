# Unified physics architecture: audit and effort estimate

Status: audit complete; implementation not started, 2026-11-02.
Owner: [physics engine](../topics/physics-engine.md).
Evidence: [201 sequence](201-rapier-cutover-sequence.md),
[202 ordinary-game gate](202-persistent-realm-collision-proof.md),
[203 simplified models](203-physics-copy-and-model-comparison.md).
Audited source: `f3bab6c0`.

## Owner direction and scope

The owner wants a normal shared physics architecture and explicitly does **not**
require exact legacy movement/contact behavior. Audit and estimate before starting
that refactor. This changes the compatibility assumption in 201: preserve useful
gameplay outcomes, not old command-time travel, numeric tuning, push algorithms,
roof-carry implementation or every historical workaround. This audit authorizes
no runtime change and does not overturn the failed Chromebook game gate.

Recommend refactoring simulation ownership in place. Keep the browser/Chromebook
product, TypeScript gameplay, existing renderer, Worker/P2P transport, persistence
infrastructure and world authoring. Keep Rapier/WASM inside the existing authority
Worker; a Rust server, SharedArrayBuffer or extra physics Worker is unnecessary.

The minimum product outcomes remain responsive keyboard/touch/controller movement,
fixed nonrotating player box with an optional capsule, understandable pushing,
standing on bodies without runaway movement, usable jumps, ramps/bridges/underpasses,
normal animal intent, driving and usable current equipment. Those features may be
implemented more simply and feel different. This is not permission to silently
remove whole gameplay features to call the backend finished.

## Source audit

| Boundary inspected | Current coupling | Required change |
| --- | --- | --- |
| `ServerLoop`, `GameServer` | Monotonic fixed-step authority already exists; default 60Hz; configurable tick rate/substeps | Retain scheduler. Explicit global physics interval/substeps, shared with prediction; no extra world integration for an input or body |
| `Realm.tick`, `PlayerSession`, `PlayScene`, `ScenarioClient` | Player queues drain into full per-command movement using `dtMs`; idle branch is different; queued car commands each add travel | Admit input into a common tick timeline, latch held controls and discrete edges, then collect intent; packet count/duration must not advance one body extra times |
| `EntityManager.update`, `PlayerMovement`, `SimulationEnvironment` | Intent, pose integration, ground tracking, push/separation, attachments and animation are intertwined | Extract intent and gameplay events; physics owns collidable poses; derived attachments/animation/index updates run after committed readback |
| `PersistentCollisionWorld`, `GameCharacterPhysics` | Persistent section/collider caching exists, but neighbors/descriptors/maps and world refresh repeat per motor | Body registry updated once at tick boundaries; one shared integration/contact phase; remove per-motor `world.step` and repeated full actor scans |
| `CollisionGeometry`, chunk revisions, props/editor | Shared compiler already covers bounded terrain sections, slabs, ramps, excavation and water/one-way metadata | Reuse compiler; admit/remove/update sections independently of character queries; edits/spawns/teleports become explicit body mutations |
| `RealmActivity`, `WildlifeActivity`, `decisionDts` | Production streaming separates AI decision tiering in places; nonstreaming mid-tier still returns accumulated movement dt; sleepers can be skipped as whole groups | Separate AI cadence, physics participation and residency. Active contact bodies advance every physics tick; slow AI retains last intent; no accumulated physics catch-up for a single animal |
| `PlayerPredictor`, `PredictionCollisionTimeline`, client state view | Local-player/mount command replay against sampled neighbors and private pushed-body copies | Reconcile a bounded set of interacting body states at a defined physics tick, replay the same shared kernel, bound work/history and keep replica/display poses separate |
| `protocol`, binary codec, serialization/deltas, `RealmReplicator` | Inputs have sequence and duration, no effective shared physics tick; frames have server tick/time and last consumed sequence; actor state has XY velocity plus vertical jump state | Define input-to-tick mapping and acknowledgment of applied input at snapshot tick. Replicate the body/motor state needed to resume local coupled simulation; extend codec/version coherently |
| `Driving`, `TrafficSystem`, `ParkingSystem`, `VehicleControl` | Steering/routes, collision rejection, passenger planning and pose writes are mixed; driven cars use a command clock while routes use world time | Retain route/steering decisions as targets; body motion on world time. Driven/parked/autonomous status changes intent/body mode, not collision authority |
| `MovingSupport`, beds, towing, transporter, railway, boats | Several manual pose/carry/ground writers and relationship-specific collision checks | Represent moving collision shapes/kinematic targets and attachment changes in the same world; keep seat/load relationships as gameplay, remove duplicate physical carry/contact correction |
| Species travel preparation and animal-work systems | Frog/rabbit hops, bird/predator flight and fauna travel directly write `wz`; work items attach, detach or receive launch velocity | Return trajectory targets, impulses or explicit attachment/teleport commands. Physics owns physical pose; cosmetic-only motion remains presentation. No species needs a new independent solver |
| Records, save/reload, streaming, transitions and `EntityHandle` | Durable semantic fields exist, runtime body handles do not; editor/script setters and restoration directly alter entities | Reconstruct body registry from semantic records, store required velocity/mode state, route explicit mutations at a safe boundary; keep residency and authoritative index/dirty updates coherent |
| `RealmSimulationOwner`, `RapierRealmSimulation`, `RapierWorld`, `FullWorldPredictor` | Reference already collects two players then steps once, with dynamic bodies and rollback, but has hardcoded fixtures/seats/full small-world snapshots | Reuse patterns and scenarios, not the fixture class as a production world. Current owner hook replaces the entire ambient/AI phase, so it cannot simply be installed unchanged |
| Scenario hosts, Worker runtime, World Geometry and cooperative lab | Shared authority/prediction/rendering consumers already exist; some reference labs use special physics adapters | Expose the same kernel to normal game and representative labs; update startup/source inventory/diagnostics; retire redundant reference backends rather than grow another permanent implementation |

The eight central production files (`Realm`, `PlayerPredictor`, `EntityManager`,
`PlayerMovement`, `SimulationEnvironment`, `GameCharacterPhysics`,
`PersistentCollisionWorld`, `CollisionGeometry`) total about **7,533 LOC**.
`Driving` and `TrafficSystem` add 2,372; protocol/codec/deltas/serialization and
actor records add 2,739. These are the inspected ownership surfaces, not a proposal
to rewrite all 12.6k lines. Much of Realm and traffic is retained gameplay or I/O.
Expect roughly 25–45 runtime files plus affected tests/lab consumers to change
across the full cutover; that is a planning range, not a counted future diff.

## Important findings

**The main refactor is time and pose ownership, not swapping an API call.** A
single `world.step()` cannot replace all existing refresh calls until intent is
collected and contact/commit ordering is explicit. The approaching-pair failure
in 203 demonstrates why stale independent proposals are insufficient.

**Intent and actual velocity need separate meaning.** For example Realm's NPC
callback temporarily scales velocity for movement, then restores the AI intent
velocity after collision. A dynamic motor must not overwrite solver velocity
from that field every tick and erase pushes. Give desired movement and actual
body state distinct ownership; mirror actual pose/velocity to entities after
readback for rendering, records and replication.

**Network input is the largest cross-cutting change.** Existing input queue tests
and car-gap tests explicitly require accumulated command travel or held car poses
between commands. Those are policies to retire, not constraints on the new world.
Buffered/late inputs need a bounded server-admitted tick mapping, one-shot jump
edges, stale-input release and an epoch/reset contract. Acknowledging a sequence
must tell prediction what state/time actually includes it. Realm callback tick count and `WorldAPI.time`
advance even when some physics phases are skipped; define a physics tick/epoch
tied to actual shared integrations rather than assuming either is already that
clock. Do not blindly trust a
client's requested future tick, silently replay a command twice or rewind the
server world for every late packet. Choose the exact lead/buffering policy in the
first timing slice, including the local integrated host.

**Slow AI is compatible with fast shared physics.** Retain planning/wildlife sleep
and streaming limits. Nearby interacting bodies share physics ticks even when AI
is idle; sleep/wake follows contact/support dependencies. Far absent/frozen actors
need an explicit residency policy, not large individual-dt steps on wake. The new
proof must use the same active populations as 202, not hide cost by disabling NPCs.

**Body categories are normal engine policy, not multiple worlds.** Static scenery,
controlled upright characters, dynamic balls/cargo, and prescribed trains/platforms
can all share one collision world. Seats/held cargo can be derived attachments
with appropriate collision exclusions. AI navigation, editor placement or raycasts
may still use shared geometry/query helpers; that does not create a second pose
solver. Spawn/teleport and post-physics attachment transforms are legitimate
writes, but must update the registered body deliberately.

## Recommended target and first technical decision

Use a single shared `PhysicsScene`/tick kernel composed by Realm and prediction:

1. Admit input for the tick; apply queued spawns/removals/edits/teleports and body-mode changes.
2. Run due gameplay/AI decisions; gather control intents and prescribed body targets.
3. Refresh persistent geometry and each participating body once; prepare controllers.
4. Execute the shared contact/integration phase for the fixed dt. Any intentional
   global substeps advance all participating bodies together.
5. Read back physical state once, update grounded/support/contact events, then
   derive seated/held attachments, spatial indexes, animation, records and replication.

Per-character queries remain allowed, but do not independently advance the world.
Do not build a replacement pairwise physics engine in TypeScript merely to retain
all previous KCC side transactions.

The **first bounded spike** chooses the character model: upright, rotation-locked
velocity/force-driven dynamic bodies versus a thin KCC/dynamic hybrid. Dynamic
NPCs and ordinary balls are natural candidates; player behavior may justify a
thin controller. The dynamic microbenchmark alone cannot choose this: prove
side pushing/release, a rider walking on a head, jumping beside a body, a simple
step/ramp and crowded contacts. Explicit motor/friction/support policy is normal;
exact legacy acceleration, push amounts and air-control quirks are not required.
Keep player box/capsule as a shape comparison, not two physics architectures.

For prediction, share that kernel in a private bounded local scene. Snapshot/rebase
interacting bodies and relevant motor/kinematic state at a common tick, retain
input history and replay complete local ticks. Remote intent remains uncertain;
measure corrections and convergence rather than promise exact agreement. Reuse
the small-world full-replay reference to prove the contract first. Do not copy or
roll back the entire streamed realm as a production default. Geometry readiness,
versions, membership changes and contact/support dependencies bound replay scenes.

## Work estimate

These are **focused engineer-days including focused tests/review**, not a promise
about elapsed agent time. Assumptions: simpler feel is acceptable; existing art,
renderer and network transport stay; existing equipment remains usable with simpler
physical adapters; no new suspension, tumbling-rendering or articulated machinery
is required for cutover. No engine code was changed to obtain this estimate.

| Slice | Deliverable and exit | Effort |
| --- | --- | ---: |
| A. Shared core and character decision | Persistent body lifecycle/geometry, one tick owner, player/NPC/ball loop; choose controller with head/jump/push/ramp checks; native crowd scaling | 1–2 days |
| B. Ordinary Realm clock and intent split | Input admission on common time, idle ticks, AI intent versus velocity, active-body participation, queued mutations and post-step events; normal Worker playable | 2–3 days |
| C. Prediction and state contract | Tick/input acknowledgment, binary state changes, bounded local-scene restore/replay, independent-clock host/guest, corrections and reset/streaming boundaries | 2–4 days |
| D. Remaining gameplay ownership | Vehicles/routes/parking, water/boats, mounts, authored wildlife travel, moving supports and seats, cargo/equipment adapters, authoritative placement/queries, save/transition reconstruction | 3–5 days |
| E. Qualify and remove old solvers | Normal-game Chromebook CPU/prediction/residency, representative gameplay route, controller/touch/keyboard access, update labs, default switch plus legacy deletion | 1–2 days |
| **Complete bounded cutover** | Includes the above; no new tumbling-car feature | **9–16 days** |

**First ordinary playable shared-tick checkpoint: about 3–5 days** (A+B).
**First meaningful predicted multiplayer checkpoint: about 5–9 days** (A+B+C).
The full estimate is roughly two to three working weeks; difficult replay/support
boundaries could push it toward four. These are planning ranges with medium
confidence, not benchmark-derived delivery guarantees. Slice D is the broadest
compatibility uncertainty; C is the largest architectural risk. Do not add a
buffer for reproducing every old numeric movement invariant: the owner removed
that requirement.

A later fully rotating/tumbling car adds an estimated **3–6 days** for one car's
chassis/control, orientation/angular-state replication/persistence, renderer pose,
reset interaction and latency/performance checks. It is outside this cutover
estimate. Existing replicated entity state carries heading/vertical motion, not
a general 3D quaternion/angular velocity; the current renderer must also consume
that future state. Merely putting a car collider in the shared world does not
finish this feature or suspension/vehicle-family tuning.

## Sequence and stop conditions

Start with A and an ordinary scripted closed-loop scene, not a further prescribed
trace alone. Continue B/C in the same bounded replacement path; the first real
budget decision is after the shared core and again with prediction on Chromebook.
Record body count, integration calls, query/filter counts, geometry updates,
whole-tick tails and replay work. One world step at a flat entity count is an
invariant of this architecture, not sufficient proof of speed or correctness.

Use existing native ScenarioSession and pair scenarios for contacts, input timing,
streaming/edit/reload and prediction. Update legacy algorithm-specific assertions
for the new time/behavior contract while retaining product outcomes. Use browser
checks only for actual Worker/P2P/input/render lifecycle boundaries; use a physical
Chromebook for authority and replay budgets. Keep the paired 202 baselines and
203 counterexample. No full test suite or runtime benchmarks were run for this
read-only audit; documentation validation is diff review and `git diff --check`.

A temporary startup comparison route is useful during implementation. Do not
multiply the current 0/1/2/3/4 experiments with more permanent flags. Once the new
shared kernel is qualified, make it the sole normal path and delete superseded
per-command/character solvers and duplicate prediction/support corrections as part
of this milestone. If the character or prediction spike fails, report the exact
remaining design choice before expanding into all equipment migrations.

This is an audit/estimate handoff. Implementing slices A–E is the next task, not
part of the current audit request.
