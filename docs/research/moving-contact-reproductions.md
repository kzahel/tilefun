# Reproduction baseline for player contact and moving roofs

Recorded 2026-10-05 against gameplay source at `9d6e6dd`. Only diagnostic scripts
and documentation changed. [Player prediction](../topics/player-prediction.md)
owns current status and the user's reproduction-first gate. No gameplay fix or
collider-policy change is implemented.

[Rate coverage](prediction-rate-reproductions.md) subsequently adds 30/60Hz
authority, 60/120Hz presentation, live rate transitions and measured native 120Hz
Worker captures. The fixed-60Hz matrix below remains the original timing baseline.

## Repeatable commands

```sh
npx tsx scripts/instrumentation/moving-contact.ts --output=/tmp/moving-contact.json
npx tsx scripts/instrumentation/moving-contact.ts --case=person-away --profile=delay50 --output=/tmp/person-contact.json
npx tsx scripts/instrumentation/moving-contact.ts --case=cow-still --profile=lockstep --output=/tmp/cow-contact.json
npx tsx scripts/instrumentation/moving-contact.ts --case=car-roof --profile=uneven --output=/tmp/car-contact.json
```

The default matrix runs ten scenes under five timing profiles, twice each in a
fresh session. It hashes the entire trace and rejects non-identical repeats.
Contact cases must actually constrain walking. Roof cases must retain support
and native cruise speed throughout. These assert fixture validity/repeatability,
not that the current implementation is correct. The JSON includes every tick,
input/ack sequence, replay count, actual correction, target/replica geometry,
collider flags and authoritative passenger offset; retain it for before/after work.

## What the harness exercises

`moving-contact-cases.ts` supplies fixture data to existing `ScenarioSession`.
`moving-contact-run.ts` drives production Realm ticks independently from player
commands, using native AI, collision, traffic and railway systems. Player inputs
and authority frames pass through production binary codecs and replication into
`RemoteStateView`/`PlayerPredictor`. It does not substitute a movement simulator.
All terrains are flat, seed 1, ordinary 64px/s rightward walking or idle roof input.

Native person/cow factories retain their current collider flags. A known initial
AI state (100-second wander timer) keeps unrelated random turns outside the
three-second observation window; native collision reversals and separation still
run. Person speed is 20px/s and cow speed is 12px/s. People start ahead of the
player, moving away, head-on or across its path; still controls use native idle AI.
The static wall is an ordinary scenario prop. A native compact car accelerates
normally to 36px/s on a straight asphalt lane before diagnostic roof placement.
A native three-carriage train departs through its normal eight-second station
dwell, reaches 192px/s, and uses ordinary diagnostic roof placement. Neither
carrier's runtime speed, collider, motion controller or carry logic is overridden.

Every case observes 180 authority ticks at 60Hz, with 16.67ms wire commands.
Input prediction runs before that tick's authority step and incoming frames are
applied afterward. Timing profiles are controlled ordered delivery, not WAN or
browser scheduling measurements:

| Profile | Commands generated per authority tick | Input/frame delay | Frame application |
| --- | --- | --- | --- |
| `lockstep` | 1 | none | each tick |
| `uneven` | repeating 2, 0, 1, 1, 1 | none | each tick |
| `delay50` | 1 | 3 ticks each way (50ms) | each tick |
| `batched-frames` | 1 | none | all ordered frames every fourth tick |
| `uneven-delay50` | repeating 2, 0, 1, 1, 1 | 3 ticks each way | each tick |

The uneven profile averages exactly one command per authority tick. No frames or
commands are dropped/reordered. Constant delay reaches a constant backlog after
startup; it does not model varying latency. Batched frames retain intermediate
messages and reconcile once after the batch. Default nearby active entity ticking
is covered; distant/lower-activity AI tiers are not.

## Observed baseline

Largest **actual post-replay shift**, in world pixels. This is the position change
from immediately before reconciliation to after authoritative reset and replay,
not the raw predicted-versus-server difference. All 50 full traces repeat exactly.

| Scene | Lockstep | Uneven | Delay 50ms | Batched frames | Uneven + delay |
| --- | ---: | ---: | ---: | ---: | ---: |
| Free walking | <0.00002 | <0.00002 | <0.00002 | <0.00002 | <0.00002 |
| Static wall | <0.00001 | <0.00001 | <0.00001 | <0.00001 | <0.00001 |
| Still person | <0.00001 | <0.00001 | <0.00001 | <0.00001 | <0.00001 |
| Person moving away | <0.00001 | <0.00001 | 1.06688 | 1.06689 | 1.06688 |
| Person crossing | <0.00002 | <0.00002 | 6.40128 | <0.00002 | 6.40128 |
| Person head-on | <0.00001 | <0.00001 | 1.06689 | 1.06689 | 1.06688 |
| Still cow | 1.06688 | 2.13376 | 1.06688 | 4.26752 | 2.13376 |
| Cow moving away | 1.06688 | 2.13376 | 1.06688 | 4.26752 | 2.13376 |
| Straight car roof | 0.000023 | 0.60001 | 0.60001 | 0.000029 | 0.60001 |
| Straight train roof | 0.000689 | 3.20133 | 3.20008 | 0.002634 | 3.20133 |

The failures have different signatures:

- **Moving person:** delayed away/head-on cases produce 44/49 shifts above 1px;
  batched cases produce 36/29. Person collision is enabled on both sides
  (`solid` and `clientSolid`). Still-person controls remain stable under the same
  delivery profiles, and moving-person lockstep is stable. This isolates moving
  geometry timing from collider-policy disagreement.
- **Crossing person:** the delayed case produces a single 6.40128px forward shift
  as the person clears the path. At tick 62, six commands replay against one
  replica pose; the replica person Y is -6 versus current authority Y -7. The new
  collision clearance changes all six replayed commands together. This is a
  transient release correction, not continuous steady jitter.
- **Native cow:** even the stationary lockstep case has 158 corrections above 1px.
  Authority constrains the player but client prediction omits this native collider
  (`clientSolid` is absent). The error equals one 64px/s walking command,
  1.06688px; batching scales it by the commands accumulated. This is a policy
  mismatch distinct from the matching-policy moving-person cases. Whether that
  policy is intentional must be resolved before changing flags broadly.
- **Car roof:** uneven inputs produce 36 corrections around 0.6px, and the
  authoritative passenger-relative X spans **21.02136px in three seconds**.
  All samples remain on the roof at 36px/s. Lockstep authoritative offset spans
  only 0.02148px, the small command-duration discrepancy. At the first two-command
  tick the offset advances 0.60024px; the following zero-command tick carries
  authority another car tick while client generates no command. The cycle repeats.
  This establishes an authority carry-clock defect as well as a prediction issue.
- **Train roof:** uneven inputs produce 72 corrections around 3.2px, while
  authoritative roof offset is exactly constant. Neither car nor train loses
  support in any of the five profiles. Fixed delay alone produces only three
  startup corrections on each carrier; a fixed cruise backlog can hide the clock
  mismatch. Batched train frames have only the small wire-duration residual in
  this schedule. These stable lanes must not be generalized to arbitrary timing.

## Code-path explanation and limits

`PlayerPredictor.applyInput`/replay consult latest replica entities through
`clientSolid`; ordinary NPCs are not locally simulated forward for each command.
`Realm` processes player inputs before native AI/physics advances nearby entities.
Replaying multiple past commands against one moving collider pose therefore does
not reproduce the authority's sequence of encounters, even when both nominal
rates are 60Hz. Matching rates do not mean matching times or geometry.

For car roofs, `stepPlayerFromInput` carries by support velocity per command.
Realm additionally carries non-train roof passengers on ticks without a processed
player command, before traffic ticks independently. A two-command tick followed
by a no-command tick therefore carries the rider for three command/tick intervals
while the car travels for two. Train authority already defers command carry to
the train's committed pose; its client still carries per command. The
[train evidence](train-roof-prediction-jitter.md) proves the resulting clock
equation in the real Worker game on both rendering backends.

These are deterministic simulation/prediction reproductions, not new NPC/car
browser visual measurements, FPS claims or proof of every collision issue.
Render interpolation, GPU/Canvas parity and camera motion for NPC/car cases
remain separate validation work. The existing train browser runner supplies
real presentation evidence for that case. No smoothing, carrier extrapolation,
collision flags or input scheduling have been changed to make the cases pass.

## Next design review

Use these cases as independent acceptance requirements for a shared timeline
design: stable ground controls, consistent collision policy, replay against
appropriate moving geometry, carrier travel once per simulation interval, and
one presented carrier/passenger pose relationship. A train-only carry flag or
position smoothing does not address the full baseline. Add jump/alight, relative
roof walking, curves/braking, multiple riders and actual browser NPC/car captures
before calling the eventual implementation complete.

## Validation

All 50 cases completed with fixture validity checks and identical full-trace
hashes across independent repeats (100 runs). Project typechecks, all 192 unit
files / 1,571 tests, lint and a separate strict TypeScript check of the diagnostic
entry point passed. Lint retains its existing 118 warnings and 34 informational
diagnostics. No production source, assets, rendering or streaming behavior changed.
