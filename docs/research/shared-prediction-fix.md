# Shared prediction timeline: implementation evidence

2026-10-05. Design/references: [Tactical 067](../tactical/067-shared-prediction-timeline.md).
Before: [contact reproductions](moving-contact-reproductions.md),
[rate reproductions](prediction-rate-reproductions.md),
[Worker roof captures](train-roof-prediction-jitter.md). Those baseline records
remain historical evidence, not current behavior.

## Contract

GameLoop consumes the active timestep before invoking callbacks that may change
rates. Native rAF and external presentation clocks use the same stepping path.
Moving-support carry is separate from player command integration: cars/trains
carry roof passengers once per committed pose, including ticks with zero or
multiple commands. Shared normalized cardinal transforms preserve native art and
clearance. Relative walking remains predicted; explicit jump and walking off an
edge inherit the last committed carrier velocity once. Missing supports/teleports
reset the relationship. Saves keep stable support identity and authoritative offset.

Prediction replays relative walking against synchronized player/support snapshots.
Render-only rider poses use the same previous/current carrier endpoints as the
body, plus the interpolated relative roof offset. Main-thread physics is not
mutated to obtain the displayed pose. Camera, bodies and lab overlays use this
shared presentation contract. World-space snapshot motion is still measurable;
`resimSupportPosErr` distinguishes rider error from legitimate carrier travel.

Frames include Float64 elapsed authority simulation seconds, independent of tick
rate changes. The frame header grows from 19 to 27 bytes: both endpoints must use
the same build. Moving solid colliders retain eight timestamped poses per visible
entity; queries interpolate history and extrapolate velocity at most 100ms.
Exits, time resets, teleports and geometry changes discard history. Proxies are
collision-only, do not run AI or mutate replicas, and do not advance moving roofs
per input. Prediction and authority both use `solid !== false`; `clientSolid` is
a legacy asset hint, not a separate blocking policy.

Replay advances collision time by stored command durations. Between snapshots,
measured time advances the horizon, subtracting one authority step because player
input executes before the next NPC step. Commands generated together share one
live horizon. This phase matters: per-command advancement or skipping that step
introduced errors in previously stable lockstep/uneven controls during prototyping.
Deterministic runners inject their clock; production uses monotonic time.

Small remaining ground-contact corrections accept the authoritative replay result
immediately in physics. A separate display offset decays exponentially with a
60ms time constant, bounded to 8px, resetting for teleports, height/support/mount
changes and clear/reset. Native roofs do not use this decay. It cannot predict AI
turns, missing frames or whether multiple commands arrive in one authority tick.

## Measured results

All 50 native contact/profile combinations repeat with identical complete traces.
All 42 rate/profile combinations repeat too; fixtures preserve native NPC policy
and autonomous motion. Carrier authority offset range and support-relative replay
error are zero across the contact matrix. All car/train rate profiles have zero
settled displayed roof-offset range; no negative interpolation frames remain.

| Contact | Baseline | Current physics |
| --- | --- | --- |
| Still cow, lockstep | 158 corrections, 1.067px | Float noise only |
| Still cow, uneven/batched/delayed | Up to 4.268px | Float noise only |
| Person moving away, 50ms each way | 44 corrections, 1.067px | Float noise only |
| Person moving away, batched frames | 36 corrections, 1.067px | Float noise only |
| Crossing person, 50ms each way | 6.401px release correction | Float noise only |
| Head-on person, 50ms each way | 49 corrections, 1.067px | One 2.134px correction |
| Uneven commands plus delay, moving NPCs | Repeated corrections | Remaining 1.067–2.134px corrections |
| Car roof, uneven inputs | 21.02136px authority offset drift | Zero drift |
| Train roof at 30Hz authority | 6.402px tick corrections and offset oscillation | Shared displayed offset constant |

Maximum **immediate displayed reconciliation shift** across non-roof contacts is
0.00001454px; the maximum bounded visual offset is 2.13376px. These measure the
absence of correction snaps, not an assertion that all contact motion is physically
smooth or that NPC futures are deterministic. Controls retain float-noise physics.

Real Worker game, ordinary keyboard boarding, bundled full Chromium:
- Native headed Canvas at 30Hz authority measured 120.008Hz presentation; 1336
  cruise frames have exactly zero displayed/server roof-offset range.
- GPU with a timed external clock measured 119.9996Hz, live 60→30→60 authority;
  1369 cruise frames have exactly zero displayed roof-offset range, zero invalid
  alpha frames. This external run does not certify native display cadence.
- One initial GPU boarding attempt timed out before measurement; a fresh run
  boarded successfully. The runner now emits boarding state on setup failure.

Reports are machine-local: `/tmp/contact-presentation-fixed.json`,
`/tmp/prediction-rates-fixed.json`, `/tmp/train-native-fixed.json`,
`/tmp/train-gpu-fixed.json`. Durable results are summarized here; rerun on any
machine with:

```sh
npx tsx scripts/instrumentation/moving-contact.ts --assert-fixed --output=/tmp/contact.json
npx tsx scripts/instrumentation/prediction-rates.ts --assert-fixed --output=/tmp/rates.json
node scripts/instrumentation/train-roof-browser.mjs --headed --renderer=canvas --server-hz=30 --assert-fixed
node scripts/instrumentation/train-roof-browser.mjs --renderer=gpu --render-hz=120 --server-hz=alternate --assert-fixed
```

Units cover rate changes, fractional collision history/limits/resets, relative roof
walking/replay, once-only jump/alight momentum, roof loss, display decay at
30/60/120Hz, native turns/braking/headroom, reload and independent passenger inputs.
Validation results and remaining browser limitations are recorded in Tactical 067.
