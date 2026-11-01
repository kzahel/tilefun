# Cooperative physics laboratory

Status: delivered and validated for inspection, 2026-11-01. Owner authorized two playable
client views, scripted shared interactions, faithful dynamic prediction and a
clean committed checkout. [Physics engine](../topics/physics-engine.md) owns the
provisional backend direction; [190](190-rapier-prediction-and-realm-proof.md)
records the earlier single-player velocity-proxy experiment.

## Scope and mechanics

Workshop → [Co-op physics laboratory](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/physics)
now defaults to two views of one temporary Realm. Yellow is the local host and
pink the delayed guest. Each has its own private Rapier prediction world,
normal binary input commands, normal Realm replication and RemoteStateView.
The authority lives in a real Worker. Both simulated players are real Realm
sessions. The bridge/scale experiment remains available through its separate
link and `?mode=single` hash parameter; its approximate loose-body proxies remain
explicitly labeled. Normal game worlds retain the existing solver.

`RapierWorld` now supports a second controlled capsule and complete physics
snapshot/restore, including stable body/collider handles, dynamic contacts,
velocities/sleep, world time and both JavaScript character motor states.
Restored character query controllers are recreated against the restored world.
Realm body dimensions/feet offsets are derived from the actual Rapier collider,
including the larger reference cube. FullWorldPredictor restores the complete small scene and replays both players
and the cube together. Both visible players and cube come from that predicted
world. Remote inputs are held at their last acknowledged values; future changes
are unknown. Corrections compare saved predictions with authority at matching
past ticks, across all body positions. The optional white ghost is the last
received authority pose, so its visible offset is not the prediction-error metric.
Rotation disagreement is not included in the current position-error metric.

Authority admits one command per participant per target tick. Inputs use the
existing quantized player-input codec; an experimental envelope adds the target
tick, equal to the sequence number within this disposable session. Clients lead
by two ticks locally, or by the configured maximum uplink delay plus two ticks
for the guest. Authority holds the last admitted input when a command is absent,
reports late commands, and rejects inputs more than 64 ticks ahead. This is an
experimental timeline policy, not a production multiplayer protocol change.

A shared PairHarness owns scenario scripts, seeded ordered links and explicit
fixed 60 Hz coordinator time. Live playback paces these steps against wall time,
awaiting the real Worker reply, while rendering runs independently. Pause and
single-step freeze/advance physics and simulated network queues together. Guest
RTT/jitter are measured in this simulation clock. This deliberate reference host
is **not** the ordinary game's independently scheduled ServerLoop/guest clocks;
under CPU pressure simulated time can fall behind wall time. It establishes
repeatable state/interaction behavior, not independent-clock drift/stall parity.
The original single-player lab retains its independent authority-clock checks.

Only one Worker request is in flight. The normal OrderedWorkerChannel transfers
and accounts for the large WASM buffer; scene-bounded nested pose/engine packets
are cloned. Each delay direction is bounded to 1,024 packets/16 MiB. Prediction
retains eight seconds of command/pose history, with at most 32 replay steps per
correction; larger gaps explicitly recover to authority. Full snapshot restore
and replay are atomic in this bounded reference scene, not guaranteed to fit a
2 ms main-thread slice. Dispose cancels timers, rejects outstanding work,
terminates the disposable memory-only Worker, frees all physics worlds and GPU
resources, and clears queues. No durable user save is opened.

## Shared scenarios and controls

`PhysicsScenarios` defines initial positions and tick-addressed inputs for:

- Host pushes a cube while guest watches.
- Opposing pushes, followed by guest release.
- Host pushes a cube into a stationary guest.
- Shared lift; guest jumps off onto the landing.

Characters remain controlled kinematic capsules. Dynamic objects obstruct them
and receive character impulses, but this is not a freely dynamic character
controller or a promise that an incoming cube displaces an idle character.

Replay script resets the scene and seed (713). Control host/guest enables manual
play and neutralizes the other participant; keyboard, touch and standard
controller share these actions. Shared camera uses both players' midpoint in
both views; disabling it follows each client's own player. Menu/D-pad/A/B covers
the lab controls; X switches seat and Y enters manual play. Reset and network
preset changes reconstruct all disposable state. Pausing can finish the one
already-issued tick before it becomes stable.

The native runner uses the same PairAuthority, PairHarness, scripts, codecs,
links and predictor. A Worker port substitutes for direct authority in-browser;
the browser does not implement alternate physics or scripted collision outcomes.
No WebRTC loss/reordering, durable multiplayer reconnect, general game renderer,
large contact-island optimization or Chromebook qualification is claimed.

## Evidence

- Focused native checks: 83 passed across physics, Realm boundary, bounded
  channels/server clock, dev update watcher, vehicle controls and junction restore.
- Complete restore/replay matches a two-player dynamic-contact reference within
  10 micrometres on every checked step; full Float32 pose/rotation/velocity arrays
  also match exactly on the checked desktop runtime. Seeded scripted runs reproduce
  the same pose/delivery trace. Stale snapshots and excessive replay gaps are bounded.
- All four scripts converge to zero final same-tick position error under 200 ms
  RTT with ±20 ms jitter in each direction, with zero late commands/recoveries.
- Reproduce desktop Node measurements with
  `npx tsx scripts/benchmark-pair-physics.ts --output=docs/benchmarks/191-pair-physics.json`.
  Full snapshots are 21.2–25.2 KiB: roughly 0.65–0.77 MB/s per recipient at 30 Hz,
  before ordinary replica traffic or compression. This is intentionally expensive.
  Guest complete replay p95 is about 0.78–1.27 ms. Maximum observed replay reaches
  5.71 ms in the host warm-up. Unknown-input transitions produce up to 15 cm
  correction across the scripted shared interactions; final settled error is zero.
  The host's own single push has zero correction throughout. These accelerated
  Node results include Realm/codec work but exclude Worker transfer/rendering and
  establish no Chromebook headroom or like-for-like comparison with 190.

- The replica regression preserves a one-time odd-tick entity change until the
  next delivered even-tick frame. Ordinary replication baselines advance only on
  publication; the 60 Hz physics clock does not silently discard 30 Hz deltas.
- All three full-Chromium physics browser cases pass through the production
  bundle. The new case covers both panes, delayed local response, ordinary replica
  acknowledgments, pause/step, script reset, manual host/guest, controller seat
  switching/menu/back, touch and Worker teardown. The two bridge cases retain
  kilometre culling, moving support and stall/recovery checks. Push and lift
  captures were visually inspected. One push capture reports coordinator-step
  p95 2.30 ms, zero current error and no late inputs/recoveries; this is a bounded
  desktop observation, not sustained/GPU/Chromebook evidence.
- Three-project typechecks, focused lint and diff whitespace checks pass. Fresh
  inventories verify 2,119 review identities in normal Chromium at retina scale
  (137 exclusions). Production build passes. Common scenario/local-server Workers
  retain their exact previous runtime hashes and 1,151.42/1,209.26 kB sizes. The
  experimental pair Worker is 5,497.69 kB; the shared experimental page chunk is
  4,381.81 kB (1,685.66 kB gzip). Normal worlds do not acquire the WASM payload.
- All six normal-game streaming readiness stages pass with zero missing-data
  frames/final missing/final incomplete caches. The pending manual development
  reload browser boundary also passes. Validation uses isolated data/auth and
  bundled Playwright browsers; no primary browser/profile or saved user world
  is opened. The whole pre-existing unit/browser suites were not rerun.

The final owner-requested commit includes the prior uncommitted 189/190 prototypes
and pending development-reload, horn-reaction and streamed traffic-recovery work,
with their owning docs/tests preserved. No push or production-game migration is
part of this checkpoint. The earlier unrelated spectator-backfill expectation
(48 vs 50) remains recorded in 190; this milestone does not change that content test.

## Next

Inspect opposing pushes and manual guest contact with jitter. Then qualify the
same input/state rules with independently scheduled authority/client clocks and
actual Chromebook/WebRTC play before optimizing snapshot/contact residency or
migrating normal game interactions.
