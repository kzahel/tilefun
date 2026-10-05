# Player prediction and moving contacts

Topic: player-prediction
Status: shared prediction implemented; playtest camera/momentum failures reproduced.
Updated: 2026-10-05.

Owns player prediction/reconciliation, moving-entity contact and moving-support
timelines across the game and embedded labs. [Multiplayer networking](multiplayer-networking.md)
owns transport/replication delivery; [vehicles](vehicles.md) and [trains](trains.md)
own their autonomous motion and service behavior.

## Current status

The latest native-120Hz playtest reports stable roof-relative riding but periodic
camera skips and lost jump momentum. Both are reproduced in
[camera/jump evidence](../research/train-camera-and-jump-reproductions.md): real
Worker authority runs near 62.5Hz while advertising 60Hz; combined carrier and
rider screen position skips ~9.4px every 0.4 seconds. Default airborne friction
erases inherited carrier velocity on the second jump command. Eight timing controls
and five full-flight cases repeat identically. No runtime tweaks in that checkpoint.

Shared-loop rate transitions, car/train carry ownership, relative roof prediction
and presentation, timestamped collision proxies and collider-policy parity are
implemented. Bounded display-only decay handles residual uncertain NPC contacts;
it does not change physics or replace the support relationship.
[Implementation evidence](../research/shared-prediction-fix.md) records contracts,
before/after traces, limits, Worker captures and rerun commands.
[Tactical 067](../tactical/067-shared-prediction-timeline.md) owns the design,
engine references and execution record.

The baseline was established before changes: ten native scenes × five delivery
profiles, six scenes × seven rate profiles, independent complete-trace repeats,
and real Worker keyboard boarding on Canvas/GPU. The historical
[contact](../research/moving-contact-reproductions.md),
[rate](../research/prediction-rate-reproductions.md) and
[train](../research/train-roof-prediction-jitter.md) records preserve original faults.

## Timing and contract distinctions

Default player input and authority clocks both target 60Hz, but arrival/processing
is independently scheduled. Client simulation/input follows the advertised server
rate; display rendering is independent. Ordinary nearby NPCs and traffic advance on authority
ticks; the client predicts the controlled player (and a steerable mount), not all
ordinary entities. Collision replay now queries timestamped bounded proxies rather than one latest
replica pose for every command. Lower-activity NPC tick tiers are a further concern outside this baseline.

Current invariants:

- Autonomous roofs carry by committed pose, independently of input count.
- Predicted/replayed walking is relative to synchronized roof snapshots; displayed
  passengers and carriers share interpolation endpoints.
- Nearby solid NPC collision uses bounded timestamped proxies and the shared
  authoritative blocking rule. AI turns/arrival grouping can still correct physics.
- Presentation correction is bounded and time-based; teleports/support changes reset it.
- Raw world-space replay displacement includes carrier travel. Measure actual
  support-relative correction and displayed relative offset separately.

## Next work

Correct shared authority timer drift first and rerun camera continuity measurements,
then address timestamped remote presentation and sustained airborne carrier momentum
with shared game/lab owners. The evidence document records the sequence and missing
gap/collision cases. Do not broaden this into global AI rollback or change immutable
art review snapshots to make unrelated validation pass. Continue engine changes
through game/lab shared owners. Train lifetime/active map markers remain deferred
in [Tactical 066](../tactical/066-train-lifetime-and-map-markers.md).
