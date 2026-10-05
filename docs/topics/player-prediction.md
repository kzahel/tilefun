# Player prediction and moving contacts

Topic: player-prediction
Status: reproduction baseline established; simulation and prediction changes remain on hold.
Updated: 2026-10-05.

Owns player prediction/reconciliation, moving-entity contact and moving-support
timelines across the game and embedded labs. [Multiplayer networking](multiplayer-networking.md)
owns transport/replication delivery; [vehicles](vehicles.md) and [trains](trains.md)
own their autonomous motion and service behavior.

## Current evidence and decision

The user reports jitter on a straight, constant-speed train and when walking into
a moving NPC. On 2026-10-05 they explicitly requested solid reproducible scenarios
before any tweaks or implementation. No gameplay changes have been made for this
investigation. Preserve that reproduction-first gate rather than treating the
initial train-specific proposal as an instruction to implement it immediately.

[Moving-contact reproductions](../research/moving-contact-reproductions.md) records
50 deterministic cases, each repeated in a fresh production scenario with an
identical complete trace. Controls cover free walking, a static wall and a still
person. Failures cover native moving people under delayed/batched snapshots,
native cows even without latency, and straight cruise on car/train roofs under
independently scheduled inputs. The probe asserts actual walking constraints,
cruise speed and continuous roof support so a missed encounter cannot silently
pass as a stable control.

[Train investigation](../research/train-roof-prediction-jitter.md) additionally
reproduces roof jitter through normal keyboard boarding in the real Worker game
on Canvas and GPU, without artificial latency. The newer NPC/car matrix exercises
production simulation, codec, replication and prediction directly; it does not
yet establish their visible browser presentation error.

## Timing and contract distinctions

Default player input and authority clocks both target 60Hz, but arrival/processing
is independently scheduled. Ordinary nearby NPCs and traffic advance on authority
ticks; the client predicts the controlled player (and a steerable mount), not all
ordinary entities. Replay queries the latest replica geometry for multiple past
commands. Lower-activity NPC tick tiers are a further concern outside this baseline.

Three problems must remain distinguishable:

- Moving-contact geometry has a different timeline from predicted/replayed inputs.
  Person contact fails with stale snapshots despite matching collider policy.
- Native cow collision is authoritative but omitted from client blocking through
  its current `clientSolid` flag. A stationary cow therefore reproduces corrections.
- Autonomous carrier travel and passenger commands use different clocks. Train
  authority keeps its passenger offset fixed while the client corrects; car
  authority itself drifts under uneven commands because missing-input ticks add
  carry in addition to carry in input processing.

Measure actual post-replay displacement, authoritative support-relative offsets
and presented relative poses separately. Raw predicted-minus-server error includes
legitimate unacknowledged movement and is not itself evidence of jitter. Tiny
snapshot precision and 16.67ms versus 1/60s residuals are separate from these failures.

## Next work

Use the baseline to review a shared movement/contact timeline design. A carrier
relationship can address roof travel and presentation, but cannot by itself fix
NPC collision policy or replay against stale collision geometry. Do not hide these
errors with reconciliation smoothing or a train-only flag change.

Before claiming a fix, retain stable ground/static-contact controls and separately
validate moving people, native cow policy, authoritative car offset and train
relative presentation. Broaden acceptance to jump/alight, walking on supports,
curves/braking, multiple passengers, input/frame gaps and game/lab parity on both
backends. [Embedded engine labs](embedded-engine-labs.md) owns shared-engine
alignment. Train lifetime/active map markers remain deferred in
[Tactical 066](../tactical/066-train-lifetime-and-map-markers.md).
