# Rapier prediction and Realm boundary proof

Status: delivered for inspection, 2026-11-01. Owner authorized proceeding with the recommended
next milestone after inspecting 189. [Physics engine](../topics/physics-engine.md)
owns provisional direction; [prediction](../topics/player-prediction.md) owns the
existing game's replay contracts.

## Scope

Add an explicit experimental simulation owner to a temporary Realm scenario;
ordinary worlds retain their current solver. Reuse ScenarioSession, ServerLoop,
the game input codec/sequences, Realm acknowledgments/replication, RemoteStateView
and bounded Worker channels. One owner resolves all contacts in the opted-in scene.
Keep the diagnostic renderer while qualifying this simulation boundary; ordinary
game presentation, saved worlds and general multiplayer remain later work.

Predict controlled movement in a nearby Rapier collision world. Authoritative
snapshots anchor character motor state, environment phase and nearby body motion.
Replay unacknowledged fixed steps with bounded scratch work and atomic commit.
Initially use velocity proxies for loose bodies; measure corrections rather than
claiming exact dynamic-body rollback. Compare static ramps, support riding/jumping,
landing and pushing under controlled ordered delay/jitter/stalls.

Expose latency presets, prediction on/off, authority ghost and correction/replay/
acknowledgment/queue diagnostics. Keep keyboard, touch and controller access.
Qualify protocol and physics semantics below the browser; reserve one focused
browser boundary for actual Worker, controls, rendering and lifecycle behavior.

## Acceptance

- Local movement responds before a delayed authority acknowledgment.
- Static/support replay preserves motor state and input edges; stale snapshots,
  teleport epochs and pause/resume cannot replay obsolete commands.
- Histories, delayed delivery and collision residency are bounded; long stalls
  recover explicitly instead of silently dropping required history.
- No partial scratch replay becomes the displayed pose. Report raw and
  support-relative correction and complete replay CPU, not just physics-step CPU.
- A real temporary Realm consumes normal binary commands, acknowledges them and
  replicates matching physical player state without the old solver also stepping it.
- Focused tests/types/lint, streaming readiness, inventories, build and Chromium
  checks pass; record unproved Chromebook, dynamic-contact and production boundaries.

## Implementation and evidence

The existing [playground](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/physics)
now creates `ScenarioSession` with `experimentalRapier`. The Realm has a generic,
explicit `RealmSimulationOwner`; its normal player and ambient physics phases are
bypassed together only for that opted-in scene. Streaming admission, input queues,
save bookkeeping, normal binary replication and world time remain Realm-owned.
Rapier poses map to ordinary player/body entities at 16 game pixels per metre.
Motor flags, vertical motion, support height, spatial membership and dirty records
are synchronized. Ordinary worlds never select this owner.

The simulation factory is injected from the experimental host. Common scenario
code never imports the Rapier implementation. An intermediate build exposed that
a lazy import in ScenarioSession was inlined into every scenario Worker, growing
the normal lab Worker from 1.15 MB to 5.50 MB. Factory injection removes that
dependency edge; final bundle sizes are checked below. Normal game authority does
not acquire the experimental WASM payload.

Final production sizes: common scenario Worker **1,151.42 kB**, normal local-server
Worker **1,209.26 kB**, experimental physics Worker **5,494.46 kB**. The experimental
page's private-WASM client chunk is **4,362.93 kB / 1,680.23 kB gzip**. These are build
outputs, not measured Chromebook startup/heap costs. Existing labs return to their
approximately 1.15 MB Worker instead of paying for the experimental engine.

The proof is single-player/fixed 60 Hz. It admits one ordered input per authority
step; background geometry/dynamics advance once per step. This is a conservative
experimental arrival policy, not the existing game's broader command catch-up
policy. Generic scenario commands, durable reload and the old ScenarioClient reject
experimental recipes; their adapters are not yet qualified. No production migration
or second contact owner is silently enabled.

PhysicsLabClient now sends the actual game `player-input` codec and uses
transport-owned InputSequence. Realm's acknowledgments anchor the replay, while
normal Frame/Sync packets pass through RemoteStateView. A second private WASM
instance owns local prediction. Live/scratch worlds share the backend movement
code, nearby static sections and up to 128 nearby loose-body proxies. The fixture
floor and prescribed lift are retained; sections are selected around a 24 m
neighborhood and recentered before leaving its interior.

Motor snapshots preserve phase, grounded/vertical motion and jump-held state.
Loose bodies retain snapshot rotation and extrapolate linear velocity for at most
100 ms, then hold; they do not re-simulate an authoritative contact island. The UI
reports omitted nearby bodies when the proxy cap is reached. This policy explains
the loose-contact corrections below and is not production approval.

Replay shares the game's 8-second/1,024-command bounds (60 Hz limits this proof to
480 retained commands), 32-step work admission and a soft 2 ms per-slice target
checked between commands. Complete scratch work swaps atomically; new input may
continue while it drains. New snapshots coalesce behind in-progress work. Epoch
fences invalidate pre-teleport/pause history; stale epochs/ticks/acks are rejected.
History loss, client stalls over 250 ms and excessive pending input trigger explicit
resynchronization. Acknowledgments fence discarded queued input; sequence numbering
continues. Delayed application queues are ordered, limited to 1,024 packets/16 MiB
per direction, and release timers/resources on close.
Delayed application also yields after 64 packets or a soft 2 ms target between
packets; one packet remains atomic, just like the existing ordered channel.

Controls add 100 ms RTT or 200 ms RTT with up to 20 ms jitter in each direction,
an authoritative wireframe ghost, view comparison, resync and real 500 ms
client/authority stalls. These are application-delay controls over a real Worker,
not WebRTC loss/reordering tests. View comparison keeps prediction running, so it
does not establish predictor CPU savings. The renderer remains schematic.

### Native checks and measured controls

- New replay tests cover delayed ramp/support movement, jump/landing, atomic
  scratch commit with new commands, stale epochs, bounded history recovery, local
  collider/body bounds and a real Realm/codec/replica proof. A fake-clock delivery
  check covers order, queue bounds and cancellation.
- Focused checks total 48 passes and one explicitly excluded pre-existing failure.
  The spectator backfill test expects 48 actors but finds 50. A temporary Vite
  source overlay using Git HEAD's Realm and ScenarioSession reproduces the same
  50-versus-48 failure with the rest of the checkout unchanged. No spectator
  expectation or unrelated gameplay source was changed for this work.
- Typechecks pass. Focused lint has existing Realm non-null warnings and existing
  style advice; no new errors remain. Six normal-game streaming readiness scenarios
  pass with zero missing data/final incomplete caches. These establish regression
  readiness, not performance improvement.
- [Reproducible accelerated controls](../benchmarks/190-rapier-prediction.json):
  `npx tsx scripts/benchmark-rapier-prediction.ts --output=docs/benchmarks/190-rapier-prediction.json`.
  Each lane runs 600 steps with six input-delay steps and 6–8 ordered snapshot-delay
  steps on Apple M4 Pro. Maximum pending history is 15 commands. Complete replay
  p95 is 0.44 ms ramp, 0.88 ms lift and 1.59 ms with 16 loose objects; complete
  maxima reach 2.12/1.31/2.27 ms. Totals include restoration and all scratch slices,
  so they are distinct from the soft per-slice target.
- Ramp corrections are zero in those controls. Lift world-space correction peaks
  at 1.95 cm while support-relative correction is zero. Loose-contact correction
  reaches **18.3 cm p95 / 63.9 cm maximum**. This is a material limitation, not a
  presentation error to conceal. These accelerated roles omit Worker, Realm codec,
  rendering and persistence costs and establish no Chromebook/game headroom claim.

### Browser and host boundary

The existing browser lifecycle test still covers actual keyboard/pointer/controller
actions, both ends of the kilometre bridge, spawn, pause and teardown. A second
focused full-Chromium case verifies that local motion precedes a delayed authority
pose, the normal replica/ack agrees with that authority, lift use, both real stalls,
bounded pending input, explicit recovery and authority/predicted view selection.
Both pass through the production bundle using isolated preview auth/data.

Final full-Chromium capture on the moving lift with the 200 ms RTT/jitter preset:
about 60 FPS / 16.7 ms callback p95, 0.80 ms Realm-tick p95, 0.10 ms pose-packing
p95 and 0.50 ms complete-replay p95. It reports 17 pending inputs, 236 ms observed
ack age, 37 local colliders, zero omitted nearby bodies and zero current relative
correction. These are one schematic desktop view, not a sustained performance gate.
Realm timing includes its normal replication/encoding; pose timing excludes later
transport posting, and frame intervals are not GPU execution time.

Fresh inventories verify 2,119 candidate identities in normal Chromium at retina
scale; the new experiment remains excluded from immutable art approvals. Build,
focused browser checks and public-origin source verification pass. Normal worlds
retain their current movement solver. No Chromebook or broad migration is claimed.

A temporary dev-server harness also passed the browser cases, but its default
game-server plugin attempted the checkout's world database and was refused by the
SQLite lock. That harness was closed. Its startup is not claimed as clean isolated
validation; final evidence uses the production-preview harness, whose test data and
auth are separate. No primary installed browser/profile was used.

## Remaining gates

1. Choose and measure a dynamic-contact prediction policy: bounded local contact
   island replay or authority-owned pushing with a defined interaction model.
   Significant loose-body corrections currently block broad migration.
2. Run the same interactive profiles on the actual Chromebook. Include whole Realm
   tick/replication, pose packing, client replay and displayed-frame tails. Current
   diagnostics separate these phases; Worker delivery/GPU time are not fully attributed.
3. Qualify ordinary player presentation, sprite/mesh depth and camera behavior with
   this backend. The actual replica is present, but the viewport is still diagnostic.
4. Qualify section arrival/removal, editing/invalidation, durable state and further
   gameplay/vehicle/multiplayer paths. All authority geometry is still resident.
