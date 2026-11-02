# General 3D physics backend

Status: autonomous shared-physics reset active; existing proof failed CPU gate, legacy default pending replacement.
Updated: 2026-11-02.

Owns the physics-backend replacement direction. [World geometry](world-geometry.md)
owns authoring semantics; [prediction](player-prediction.md) owns input replay;
[rendering](rendering-architecture.md) owns visual composition and resource limits.
[189](../tactical/189-rapier-physics-prototype.md) owns the first bounded experiment;
[190](../tactical/190-rapier-prediction-and-realm-proof.md) owns prediction/Realm integration.

## Active reset (205)

The owner authorized [205](../tactical/205-physics-reset.md): purge optional physics
paths/commands and obsolete compatibility tests, retain gravity as the only exposed
physics tuning option, one fixed 60Hz shared Rapier tick, and the same bounded local
prediction kernel. Exact old feel and full peripheral compatibility are not required.
Simplify or explicitly retire peripheral pose writers; do not retain another solver
behind a flag. Keep browser/Worker/P2P, content, renderer and controller/touch access.
Implementation proceeds autonomously with checkpoint commits, focused validation,
actual Chromebook evidence and final review. The reset is not complete until the
normal default is shared physics and old solvers/dispatch are deleted. Prior plans
and measurements below are history/reference, not a compatibility checklist.

## Replacement direction and early decision (201)

Owner direction, 2026-11-02: qualify Rapier as the replacement, then make it the
default and delete legacy collision if basic gameplay and Chromebook performance
are acceptable. A permanent pair of supported physics implementations is not the
goal. [201](../tactical/201-rapier-cutover-sequence.md) owns implementation slices,
proposed budgets and the early proceed/repair/stop decision after a persistent
world and representative interaction loop, before exhaustive compatibility or
dynamic-car expansion. This sequencing supersedes isolated NPC push patching
followed immediately by a dynamic-car prototype.

The target is one persistent authoritative world per realm: static terrain and
buildings share it with controlled players/NPCs/vehicles and dynamic loose bodies.
Private client prediction worlds are nonauthoritative copies. Stream bounded
geometry sections and retain AI activation; one collision authority does not
require all actors to be free rigid bodies or every distant actor to tick.
Legacy collision mode exists only for temporary comparison. It must not silently
resolve unsupported contacts in exclusive Rapier mode. Current gameplay
controllers may survive while their duplicate collision/support solvers retire.

The default remains legacy today. [202](../tactical/202-persistent-realm-collision-proof.md)
implements the persistent controlled-collision proof through the early decision;
the older on-foot-only modes below retain their disposable reference scenes.
Qualification uses the ordinary Worker game and a physical Chromebook. Default
cutover and legacy deletion belong to the same bounded milestone; new tumbling
cars follow that cleanup.

## Persistent realm proof (202)

`?physics=rapier-world&hull=box|capsule` selects experimental startup modes 3/4.
The shared [Realm physics fixture](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=realm#/tool/world-geometry)
offers a normal Worker/rendered comparison. Persistent section geometry, controlled
NPC/player contacts, one upright controlled car and ordinary ball collision use
one authority; client predictors own private worlds and clear scratch resources.
AI, steering and ball bounce intent remain gameplay motors. This proof is not yet
general dynamic rigid-body simulation. Unqualified mounts, autonomous traffic,
parking, rail motion and moving roof passengers do not fall through to old solvers.
Other compatibility gaps and the source/validation inventory belong to 202.

The final physical Chromebook GPU comparison fails the proposed cutover budget:
24/96/384-near NPC tick p95 is 15–18.8/26.8–27.8/118.3–125.6ms versus legacy
5.6–8.6/17.1–17.9/30.6–32.3ms. The decision is **no default cutover**. Smooth
main-thread frames hide the Worker slowdown. Migration pauses before compatibility
and dynamic-car expansion; first reconsider repeated per-NPC motor/query/refresh
work in a bounded performance proof. [202](../tactical/202-persistent-realm-collision-proof.md#early-decision--stop-the-cutover-reconsider-the-npc-stepping-approach)
owns raw evidence, next exit conditions and unqualified gates.

[203](../tactical/203-physics-copy-and-model-comparison.md) isolates the next design
question with native simplified models. The adapter makes thousands of temporary
shape descriptors and repeated neighbor scans plus one world refresh per motor;
caching descriptors alone does not recover the budget. A lean sequential KCC and
one-step rigid-body model are much cheaper, but omit gameplay semantics. Naive
once-per-tick KCC batching fails approaching-peer contact checks. Next prove one
shared contact phase with consistent commits and the existing character rules,
then rerun the ordinary-game Chromebook gate. Production is unchanged by 203.

## Unified architecture audit (204)

The owner prefers a simpler codebase and one default physics configuration. Exact
legacy movement, optional backend/shape comparisons and historical parameter
permutations are not migration requirements. [204](../tactical/204-unified-physics-architecture-audit.md)
owns the source audit and the distinction between essential shared time/body/
prediction work and optional feature-preservation work.

The original 9–16 focused engineer-day estimate assumed keeping all current
equipment usable. It is not a minimum for the now-simpler baseline. First prove
one shared tick/controller configuration with players, ordinary NPCs, static
geometry, a loose body and basic driving, followed by bounded coupled prediction.
Retain AI decisions that supply intent; do not treat each species as its own
physics port. Simplify or explicitly disposition specialized movement/equipment,
then remove old backends, time policies and duplicate pose solvers. Use normal
body shape/mass data without multiplying supported algorithms or product switches.

The main architectural work remains input-to-tick admission, separating desired
intent from physical velocity, and restoring/replaying interacting bodies at a
common tick. Engine defaults are a starting point for a single character preset,
not a guarantee that desired movement/pushing/support emerges without a controller.
Production is unchanged by the audit and clarification; the 202 negative game gate
remains until the shared core has normal-game device evidence.

## Retained subsystem constraints

Keep browser/Chromebook play primary, the existing renderer, TypeScript gameplay,
AI, persistence, replication and Worker authority. Evaluate Rapier's JavaScript
API/WASM physics subsystem, not a Rust server rewrite or adoption of Bevy.
P2P authority already shares the dedicated Worker (188).

Start with ordinary private WASM memory inside authority. Call physics synchronously
within the tick. Retain bounded transferable-buffer messages; SharedArrayBuffer,
shared WASM memory, additional compute workers and custom Rust bulk bindings are
separate measured experiments, not prerequisites.

One authored geometric description should supply collision shapes, rendered
geometry and surface metadata. Ramps, decks, undersides, barriers and moving
supports should participate in ordinary contacts instead of feature-name checks.
Preserve tile/surface-based authoring; users need not model arbitrary solid meshes.
Represent long structures by bounded spatial sections with stable logical identity.
Qualify contact continuity, culling, edits and residency at section boundaries.

Prefer controlled characters/animals initially, fixed structure colliders and
dynamic loose objects. Vehicle dynamics, navigation on stacked spaces and full
dynamic contact prediction need explicit later decisions. Do not replace every
animal with an unconstrained dynamic body or assume engine sleeping replaces AI
activation. Each migrated interaction must have one physical owner.

Prediction needs a separate nearby collision world, shared movement semantics,
explicit support/body history, fixed input/substep timing and correction replay.
Engine determinism does not make a partial replica identical to authority.

Measure adapter/API overhead, whole Worker ticks, main-thread prediction/replay,
frame tails, contact counts, geometry updates and memory. WASM is not an automatic
speedup; sparse specialized collision can be cheaper, AI/rendering are separate
costs, and dynamic contacts may increase work. No Chromebook gain is established.

## Opt-in game characters (197)

[200](../tactical/200-npc-support-contact-ownership.md) fixes the separate ordinary
game NPC case: the legacy player/NPC overlap pass could eject an NPC after Rapier
had landed a rider on its top. Opted-in on-foot players actually stepped by the
character solver now exclude that duplicate response. Default legacy pushing,
NPC AI and NPC/NPC separation retain their owners. NPCs remain fixed query
obstacles to the selected player motor; dynamic NPC pushing/carry is unqualified.
Real Realm chicken/person landings in both hulls and an ordinary Worker game
landing on a following person cover the boundary missed by two-player fixtures.

[199](../tactical/199-idle-player-head-support.md) fixes the ordinary capsule backend's
idle lower motor moving sideways to clear an overhead rider after landing. Idle
nonascending support queries ignore that separated overhead player; horizontal/upward
intent retains obstacle checks. Full falling-and-resting regressions cover both game
hulls and motor orders. **Land and stand on player** exposes the reference through
the cooperative lab's shared script/replay path.

[198](../tactical/198-character-support-and-jumping.md) fixes rider walking feeding
sideways pushes into the supporting character, and blocked push guards arresting
jumps. Side eligibility uses vertical side extents (capsule caps remain support),
side responses/guards preserve vertical intent, and actual ceiling events cancel
upward velocity. Native support queries avoid solved-motor velocity feedback.
The cooperative lab adds **Walk across player shoulders** and **Jump against pinned
player** scripts shared with native replay tests.

[197](../tactical/197-opt-in-game-character-physics.md) adds an experimental on-foot
backend to ordinary Worker authority and PlayerPredictor. Start the game with
`?physics=rapier&hull=box` or `hull=capsule`; authority can switch with
`sv_characterphysics 0|1|2` (legacy / fixed box / capsule). This is a host setting,
synchronized to guests. Normal launches select 0 and never initialize Rapier.
The World Geometry deck fixture offers **Character contacts** using these same
engine paths, normal input, prediction and renderer.

The TypeScript motor still owns acceleration/friction, sprint, jump intent, air
control and existing physics CVars. Rapier WASM resolves the selected player's
collision, support and gravity step, including idle authority ticks. Its cuboid
keeps the existing anchored 10×6 footprint and 12-pixel height regardless of facing.
The comparison capsule is inscribed (6×6 footprint, same anchor and full height).
Reusable shape descriptors accept either hull for later character/NPC adoption;
NPC motion is not migrated in this slice.

Each movement substep builds and frees a canonical local query scene from normal
terrain, exact excavation planes, wall geometry, one-way surfaces, ramps, slabs
and nearby actors. Long authored structures are clipped to the local extent,
including far-world origin rebasing. The scene has a 512-collider limit, bounded
partition/cut complexity and at most 512 pixels of XY swept extent; over-budget
queries reject. Rebuilding is deliberately simple for replay correctness and
has **no established performance advantage**. Cache/residency changes need measured
authority and replay tails before promotion.

Grounded player pushing shares current side-contact proposals and checks both
environment endpoints. A per-interval displacement budget combines own and passive
travel without storing received motion as velocity. Player prediction uses private
pushed-body copies, cleared on every authoritative rebase. Recipient-specific
water/one-way rules, landing momentum conversion and wildlife mounting remain shared.

This opt-in slice keeps existing ownership for general dynamics, AI and vehicles.
It does not solve the full-world lab's both-active cube corrections. Airborne
recipients, chains/crowds, initial overlaps/hull expansion, moving roofs/vehicle-bed
details, independent clocks, persistence/editing under broad content and Chromebook
tail latency remain qualification gates. Neither default rollout nor a WASM/SAB
server rewrite is implied.

## Controlled-player contacts (195–196)

[195](../tactical/195-player-contact-feedback.md) fixed a raw physics feedback loop:
player KCCs inherited one another's previous solved kinematic velocity as moving
support motion. A native glancing reproduction drifted 4.65 m after release;
another burst to 20.63 m/s against 4.5 m/s walking. Presentation was not the cause.
Its no-push policy removed intended gameplay; the owner rejected that behavior.

[196](../tactical/196-restore-controlled-player-pushing.md) restores pushing from
fresh motor proposals. Environment KCC queries exclude controlled actors; Rapier
sweeps their actual capsules against both proposed movements. Equal character
masses share the side-contact response, so walking into an idle actor moves both.
Combined horizontal walking/pushing stays within the movement budget, and release
stops the push. Environment rechecks and a final sweep retain wall clearance and
capsule separation. Lifts retain normal KCC carry. Authority and full-world replay
use the identical response.

**Players pushing / release**, **Players head-on** and **Players glancing / release**
share their visual/native input scripts. Raw acceptance requires positive movement
of an idle recipient in both seat orders, bounded speed and release drift, wall
clearance and available jumping/following. General initial-overlap recovery, crowds
and moving player supports remain unqualified. Both-active cube prediction
corrections below remain open; this does not establish normal-game migration or
Chromebook performance.

## Contact presentation (194)

[194](../tactical/194-coherent-contact-presentation.md) supersedes the display policy
from 192–193. Buffering only a remote avatar while predicting its cube produced
visible pushes across a roughly one-metre gap. Independent per-body correction
offsets also separated touching shapes, even with a shared decay fraction.

Contact components now share one scene tick and a rigid correction transform.
Idle clients buffer the coherent scene. Recent local input and airborne motion
predict the local interaction component, with a confirmation/display tail through
release and landing; unrelated components remain buffered. Source changes preserve
the chosen local anchor and fresh local motion. Own/remote/cube source/tick metrics
and drawn first-push gap make coherence observable. Physics and networking are unchanged.

The left-control/right-idle-observer reproduction now aligns the cube and avatar.
This prioritizes coherent contact geometry over preserving every independently
smoothed member: both-active opposing pushes can still visibly correct by over a
metre and remain a migration blocker. Do not interpret earlier 192–193 smoothness
measurements as general contact qualification. Next address coupled input/timeline
uncertainty and independent clocks before normal-game migration or Chromebook claims.

## Cooperative reference (191)

[191](../tactical/191-cooperative-physics-laboratory.md) adds two real Realm sessions
and two separately predicted client views. Full small-world Rapier snapshots
restore contacts and both motors; dynamic cubes and players replay together and
are displayed from that predicted world. Shared tick-addressed scripts, seeded
ordered delay, input codecs and replicas run in both the interactive lab and
native tests. Compare errors at matching past ticks, not the two displayed times.
The local host has no artificial delay; the guest offers 0/100/200 ms RTT and jitter.

The lab uses an explicit coordinator clock for repeatable pause/step and real-time
playback through an asynchronous Worker. It does not yet prove independent-clock
scheduling or WebRTC parity. Full snapshots are intentionally expensive; bounded
replay, memory and recovery are measured reference behavior, not a shipping
bandwidth/Chromebook claim. Characters remain controlled capsules. The old bridge/
scale page is separate and still uses approximate loose-body proxies.

Next: inspect shared pushes, then qualify independent clocks and Chromebook play
before choosing contact-island/bandwidth optimization and normal game migration.

## Earlier single-player proof

The first backend playground is available at
<https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/physics>.
It now uses an explicitly opted-in temporary Realm with normal game input encoding,
sequence acknowledgments, replication and RemoteStateView. A nearby Rapier client
world predicts and replays unacknowledged commands with shared history/work bounds.
Both threads have private WASM instances. The schematic renderer remains in place;
normal game worlds retain their existing solver and rendering. Authority geometry
remains resident; local collision sections/proxies are bounded.

Choose **100 ms RTT** or **200 ms RTT + jitter**, enable **Authority ghost**, and
compare **View: predicted / authority**. View selection does not disable predictor
CPU work. Try the lift and jump off, walk under/across the bridge, push objects,
and inject client/authority stalls. Diagnostics distinguish backend physics, Realm
ticks including normal replication, pose packing, complete replay totals, individual
replay slices, corrections, pending inputs, omitted nearby bodies and recovery fences.

Static ramps and moving support are promising. The current linear-velocity proxies
for loose objects produce significant corrections under contact; they are not a
production dynamic-body prediction policy. [190](../tactical/190-rapier-prediction-and-realm-proof.md)
records measured bounds, reference controls, known failure and next work.

1. Shared standalone backend and schematic Worker lab: ramps, bridge/underpass,
   section joins, moving support, dynamic objects, length/crowd controls and timings.
2. Authority/prediction boundary prototype with command acknowledgments and replay;
   compare correction size and moving contacts before gameplay migration.
3. Matched sparse/crowd/long-structure controls on the actual Chromebook, including
   main-thread frames and Worker deadlines, against current production behavior.
4. Incremental Realm/ScenarioSession migration by interaction category, retiring
   superseded collision paths only after parity/behavior review.

The first lab may host an experimental backend directly using the shared
ServerLoop/OrderedWorkerChannel. It must be labeled as such: it does not establish
production Realm, persistence, multiplayer or existing renderer integration.
This is an explicit prototype boundary, not a second implementation of game physics.

## References

- [Rapier JS/WASM integration](https://rapier.rs/docs/user_guides/javascript/getting_started_js/)
- [Controllers](https://rapier.rs/docs/user_guides/javascript/character_controller/)
- [Determinism conditions](https://rapier.rs/docs/user_guides/javascript/determinism/)
- [Shared memory requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
