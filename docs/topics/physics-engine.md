# General 3D physics backend

Status: provisional direction; two-client full-physics laboratory and remote correction presentation delivered for inspection.
Updated: 2026-11-01.

Owns the proposed physics-backend migration. [World geometry](world-geometry.md)
owns authoring semantics; [prediction](player-prediction.md) owns input replay;
[rendering](rendering-architecture.md) owns visual composition and resource limits.
[189](../tactical/189-rapier-physics-prototype.md) owns the first bounded experiment;
[190](../tactical/190-rapier-prediction-and-realm-proof.md) owns prediction/Realm integration.

## Provisional plan

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

## Controlled-player contacts (195)

[195](../tactical/195-player-contact-feedback.md) fixes a raw physics feedback loop:
player KCCs inherited one another's previous solved kinematic velocity as moving
support motion. A native glancing reproduction drifted 4.65 m after release;
another burst to 20.63 m/s against 4.5 m/s walking. Presentation was not the cause.

Environment queries now exclude controlled actors. Rapier sweeps their actual
capsules against both proposed movements; a shared motor rule removes approaching
normal motion while retaining sliding and release. Environment rechecks and a
final sweep prevent simultaneous overlap or sliding through adjacent walls.
Prescribed lifts retain normal KCC carry. Characters block/slide without shoving
another motor. Authority and full-world replay use the identical rule.

New **Players head-on** / **Players glancing / release** scripts and raw native
checks make speed, release drift, jumping/following and separation inspectable.
The two-motor reference passes its 4.55 m/s / 2 mm drift bounds, including mirrored
control seats. General initial-overlap recovery, crowds and moving player supports
remain unqualified. Both-active cube prediction corrections below remain open;
this does not establish normal-game migration or Chromebook performance.

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
