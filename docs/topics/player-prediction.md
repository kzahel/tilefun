# Player prediction and moving contacts

Topic: player-prediction
Status: shared camera recovery, snapshot-anchored reload pacing and idle airborne
support travel verified; local predicted animation and bounded backlog recovery
delivered. Varying moving-contact acceptance remains next.
Updated: 2026-10-18.

Owns player prediction/reconciliation, moving-entity contact and moving-support
timelines across the game and embedded labs. [Multiplayer networking](multiplayer-networking.md)
owns transport/replication delivery; [vehicles](vehicles.md) and [trains](trains.md)
own their autonomous motion and service behavior.

## Current status

Gentle driven-car contact (2026-10-18):
[135](../tactical/135-vehicle-horns-speeds-and-pushing.md) uses the same per-model
speed, acceleration and bounded push planner in authority and prediction. Pending
car commands retain private displaced collision-body copies, cleared on authority
rebase and copied into bounded scratch replay state; replica entities remain
immutable. Complete quick horn presses are latched independently of held movement.
The contact planner infers missing cached ground height from replicated absolute
height minus jump lift, preserving airborne height and voluntary jump velocity.
Sustained frozen-replica and per-profile/boost parity regressions pass. This does
not replace the existing collision timeline, roof carry or source-time policy;
varying remote voluntary motion retains the uncertainty described below.

Browser fixture correction (2026-10-12): the edit/play recovery check removes
randomly seeded solid chickens through normal editor commands before its first
movement attempt. A full-suite Canvas capture showed a chicken blocking the
player's path. The original hold duration, post-release authority/prediction
convergence, forward travel and strictly increasing input sequence checks remain
intact across all three scene replacements. No engine behavior changes.
The full browser run passed 632/633 with this one blocked Canvas case; after
cleanup, all six repeated recovery checks (three per renderer) pass.

Indexed driving queries (2026-10-12):
[126](../tactical/126-driving-collision-neighborhoods.md) gives published prop
snapshots lazy local indexes. Frozen replay requests retain their own snapshot's
index; newer props do not rebind a running replay. Collision-history bodies and
roof-support ordering remain complete, while independent rider sweeps preserve
headroom. Direct mutable callers keep full-list behavior. A long mounted-car
recovery regression exercises old/new props with indexed and full-list controls;
16 native 30/60Hz delayed-input/snapshot/turn/release traces match the baseline.
Timing and remaining wide-view frame stalls are owned by performance/126.

Inside-car driving follow-up (2026-10-10):
[car jitter evidence](../research/car-driving-prediction-jitter.md) isolates extra
unacknowledged braking/movement on missing-input ticks, confirmed in real Worker
Canvas/GPU play. Shared Realm now integrates cars only for consumed commands;
short empty ticks hold pose without refreshing the 250ms stale-driver deadline.
Real release commands still brake, and stale/disconnected drivers stop. The pure
30/60Hz authority / 120Hz presentation gate now passes with cruise corrections
below 0.000026px, replacing 1.664/3.049px corrections. Eighteen native simulation
regressions cover delivery, turning, release, roof carry, timeout/recovery,
disconnect and train-clock control. No client smoothing change is required.

Duck contact (2026-10-09): solid mallard bodies use the existing shared collision
timeline. Landing on their 9px body supplies a 95px/s upward bounce from
`tickJumpGravity`, shared by prediction, authority input steps and missing-input
gravity. The outcome identifies the contacted duck for server-only alarm/flight;
the client does not mutate NPC AI. A duck bounce over water is not a water landing.
See [077](../tactical/077-duck-contact-and-startle-flight.md) for interaction evidence.

[Idle roof-jump evidence](../research/idle-support-jump.md) finds forward travel
despite correct inherited velocity: uneven input delivery double-counts passive
motion, landing gets a second carry, and takeoff presentation uses a mismatched
time. Authority now admits inherited XY once per world interval, excludes
input-landed riders from another carry and timestamps prediction endpoints for
passive source-time sampling. Contact correction removes expected source-time
travel before decaying residual error; two delayed-acknowledgement cases preserve
the additional native takeoff boundary. Twelve new positional regressions pass at
30/60Hz authority and 120Hz presentation, through flight and landing. Steering and
vertical/input-time admission retain existing policies. Final native 120Hz idle
flights at 30/60Hz authority have zero landing drift and displayed drift below
0.003px; next-carriage/reversal controls pass. All 1,719 units, 36 affected browser
checks, typechecks, lint/build and streaming readiness pass. Varying trajectories
and longer stalls remain open; next is the user's repeated idle-jump playtest.

New playtest follow-up: [reload pacing](../research/train-refresh-pacing.md)
reproduces persistent train/rider stepping after refresh despite stable relative
prediction. GPU approximately-120Hz capture and four historical deterministic failures
isolate early clock initialization and retained forward clock debt. The shared
sampler now anchors to the first snapshot and rebases unusable debt monotonically;
nine startup regressions and two burst/exhaustion clock checks pass. Native
approximately-120Hz GPU-requested 60Hz and Canvas 30Hz reload captures have zero
bad cruise steps; all 1,707 unit tests, 36 affected browser checks, typechecks,
lint/build and streaming readiness pass;
the earlier ordinary-play camera acceptance does not cover this startup path.

Earlier checkpoint: [airborne support momentum](../research/airborne-support-momentum.md) preserves
platform departure velocity while retaining platformer air steering. Landing converts
to new-roof-relative velocity; collision, missing-input ticks, save/reopen and
replay share the contract. A replicated acknowledged jump latch prevents pending
takeoffs from disappearing during reconciliation. Native GPU 60Hz and Canvas 30Hz
Worker flights at approximately 120Hz cross the next carriage and preserve midair
reversal. All three typechecks, 1,696 unit tests, lint/build, 36 affected browser
checks and streaming readiness pass. The user confirmed the preceding camera
fix in ordinary play, including trains.

Shared `PresentationTimeline` samples bounded timestamped remote motion,
and pure `CameraFollow` integrates an explicit target/time pair. Game and embedded
labs borrow display-only replica/player poses during render; physics and collision
replay retain committed poses. The [rider-free cases](../research/camera-basics-reproductions.md#shared-presentation-fix)
now pass late delivery, short render gaps and remote long-pause recovery. All eleven
original expected failures are ordinary passing regressions, including the idle
rider case. Settled-build game/lab browser, streaming and native approximately-120Hz
checks pass; detailed results and limits are in the linked evidence.

Remote display uses a 50ms buffer and at most 100ms of last-segment extrapolation,
then holds. Camera follow uses a render-time exponential response, normalized to
the existing 60Hz response. Grounded local prediction supplies its admitted input
clock, excluding discarded catch-up debt; supported players use remote presentation
time with locally interpolated walking. Switching clock domains preserves camera
position. Opaque epoch identities distinguish predictor replacement/reset, preventing
editor/play transitions from reusing an old local clock. Explicit pause/resume,
visibility and realm reset rebase presentation. Loading renders wait for the first
authority snapshot; exhausted/burst clocks discard unusable debt monotonically;
large relocations start a new history segment. Missing information can still cause
correction when a train brakes/turns or authority stalls beyond the buffer.

The earlier native-120Hz playtest reported stable roof-relative riding but periodic
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
within Float32 noise. All eight rate/delivery traces repeat exactly. Four continuity failures were explicit in that test/doc checkpoint. The subsequent
shared presentation implementation promotes them to ordinary passing regressions;
both headless `--assert-continuous` CLIs now pass.

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
  passengers and carriers share one timestamp-sampled support pose. Local voluntary
  walking retains responsive prediction rather than waiting for remote display time.
- Nearby solid NPC collision uses bounded timestamped proxies and the shared
  authoritative blocking rule. AI turns/arrival grouping can still correct physics.
- Presentation correction is bounded and time-based; teleports/support changes reset it.
- Raw world-space replay displacement includes carrier travel. Measure actual
  support-relative correction and displayed relative offset separately.

## Next work

[088](../tactical/088-wildlife-work-budgets.md) gives ordinary predicted player and
steerable-mount animation a local clock, advanced once per live input step and
preserved across compatible reconciliation. Replay advances physics only;
model/clip changes and resets use the new authoritative sprite. Physically timed
clips retain their authority phase. This fixes the local walk-frame stall found
by the [mobile investigation](../research/mobile-desync-investigation.md).

[089](../tactical/089-prediction-backlog-recovery.md) replaces silent history loss
with an eight-second/1,024-command history, explicit gap/old-ack handling and
bounded scratch replay. Game input numbering now survives Edit/Play replacements
through transport-owned sequence state; internal relocation resets retain the
latest acknowledgement fence. Authority drains at most 32 input subdivisions per player
per tick; client replay shares that allowance across reconciliation/update and
checks a 2ms elapsed target between commands. New local input/animation continues;
only a complete replay pose is committed. Fresh acknowledgements can supersede
scratch work; other arrivals coalesce without restarting it. Explicit resets and
recovery mount changes cancel pending work. An uncovered history gap gets a 250ms
acknowledgement grace before explicit authority resync with a sequence fence.
The tactical records native controls, the corrected flat-world diagnostic fixture,
and limits: changing terrain/NPC contacts and longer-than-history outages can
still cause legitimate correction. Next is ordinary moving countryside/contact
play on the physical phone. The user's original saved session has not been captured.

Repeat the user's refresh/background playtest, then add longer authority-debt,
reconciliation and varying-speed/gap cases before broad passenger acceptance. Preserve the passing fast local-player controls; the existing 250ms
simulation catch-up cap still discards excess local elapsed time. Sustained
airborne carrier momentum is now implemented and covered by the linked evidence.
Do not broaden this into
global AI rollback or change immutable art review snapshots to make unrelated
validation pass. Continue engine changes
through game/lab shared owners. Train lifetime/active map markers remain deferred
in [Tactical 066](../tactical/066-train-lifetime-and-map-markers.md).
