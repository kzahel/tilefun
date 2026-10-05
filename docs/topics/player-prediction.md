# Player prediction and moving contacts

Topic: player-prediction
Status: shared authority timing fixed; remaining presentation/momentum work recorded.
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
and five full-flight cases repeat identically. That record preserves the baseline.

The authorized timing follow-up replaces ServerLoop's repeating timer count with
monotonic deadlines and bounded catch-up, shared by Worker/P2P/dedicated authority.
Native approximately-120Hz captures now measure ~60Hz/~30Hz authority; the repeating
400ms skip is gone. GPU 60Hz and Canvas 30Hz captures have no large screen jumps;
one Canvas delayed-frame pair and rate-switch discontinuities remain. The evidence
records those limits. Camera smoothing and airborne movement are unchanged.

The timing checkpoint passes all three typechecks, 1,596 unit tests, lint, build,
16 affected game/lab/Worker/standalone browser tests and streaming readiness.
Final native GPU capture measures 60.003Hz authority at approximately 120Hz render,
with zero large screen jumps; the linked evidence preserves residual/transition cases.

A focused [headless presentation reproduction](../research/train-camera-and-jump-reproductions.md#small-headless-presentation-reproduction)
now isolates a single 10ms late snapshot at correct authority cadence. Production
client interpolation/prediction/camera math yields a backward frame and ~9.9px
screen jump at 60Hz snapshots / 120Hz presentation, while roof alignment remains
within Float32 noise. All eight rate/delivery traces repeat exactly. Four expected
continuity failures remain explicit in unit tests; `--assert-continuous` is red.
This is a test/doc checkpoint, with no runtime refactor or camera tweak.

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
- Shared authority ticks follow monotonic wall-time deadlines; short late wakes
  catch up, long stalls bound debt to 250ms, and resume/rate changes reset the epoch.
- Predicted/replayed walking is relative to synchronized roof snapshots; displayed
  passengers and carriers share interpolation endpoints.
- Nearby solid NPC collision uses bounded timestamped proxies and the shared
  authoritative blocking rule. AI turns/arrival grouping can still correct physics.
- Presentation correction is bounded and time-based; teleports/support changes reset it.
- Raw world-space replay displacement includes carrier travel. Measure actual
  support-relative correction and displayed relative offset separately.

## Next work

With authority timer drift corrected, address timestamped remote presentation
and sustained airborne carrier momentum
with shared game/lab owners. The evidence document records the sequence and missing
gap/collision cases. Do not broaden this into global AI rollback or change immutable
art review snapshots to make unrelated validation pass. Continue engine changes
through game/lab shared owners. Train lifetime/active map markers remain deferred
in [Tactical 066](../tactical/066-train-lifetime-and-map-markers.md).
