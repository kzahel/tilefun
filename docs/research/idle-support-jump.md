# Idle moving-roof jump

2026-10-07. Owner: [player prediction](../topics/player-prediction.md).
Follow-up to [airborne momentum](airborne-support-momentum.md).

The user expects jumping without XY input to keep the same position relative to
an unchanged straight-moving train, including landing and repeated jumps.
Velocity-only acceptance did not establish that contract.

Before runtime edits (`d082e7c`), four real Realm/ScenarioSession cases fail:
train landing advances 3.20064px / 6.39936px at 60/30Hz; car landing advances
0.60012px / 1.19988px. Lockstep flight itself keeps the correct relative position.
Input-driven gravity lands before service motion, so the newly grounded passenger
is carried a second time during the same interval. Two headless actual replica /
GameLoop / predictor traces at 120Hz display additionally show airborne display
offsets of about 3.22px / 4.80px despite constant authoritative offsets in flight.

The native ordinary-keyboard idle-jump probe on bundled full Chromium / real Worker
shows larger cumulative physical drift: two 60Hz jumps land ~16.02px and ~19.22px
forward, while velocity remains exactly 192px/s. A two-command tick adds 3.2px
relative travel; the following zero-command tick's fallback advances again, so
that extra travel persists. The prior test asserted velocity, not travel versus
source elapsed time. Two setup attempts timed out boarding before capture;
unchanged retry reached the measured flight. [Baseline capture](/tmp/idle-train-jump-baseline.json).

Six expected failures preserve the lockstep physics and headless presentation
baseline. Next add an uneven 2/0 delivery case, then establish one authority-time
budget for passive flight motion, exclude already-integrated landing intervals
from roof carry, and sample the passive display contribution at the same source
time as carriers. Voluntary steering stays on its existing input clock; departure
momentum remains fixed if the old platform changes speed, turns or unloads.
No runtime correction has been made at this reproduction checkpoint.

```sh
npx vitest run src/client/IdleSupportJump.test.ts
node scripts/instrumentation/train-roof-browser.mjs --headed --renderer=gpu --server-hz=60 --idle-jump --output=/tmp/idle-train-jump.json
```

## Shared correction

Ten regressions now pass: lockstep and alternating 2/0 inputs for native cars and
trains at 30/60Hz, plus full replica/predictor/GameLoop presentation at 120Hz,
including the first grounded display after flight. Authority admits passive XY
motion once per world tick through the shared movement context; commanded
steering and jump gravity retain their existing input time. No-input fallback
already advances once and keeps that behavior. The movement collision path
restores total velocity after admitting passive displacement and preserves clipped
axes. Input-landed passengers are excluded from the following carry interval in
both traffic and straight/curved rail services.

Prediction timestamps its world endpoints and interpolates only inherited XY
onto the replica's sampled source time. Local steering stays responsive. Predicted
landing converts the future roof offset back to the newest committed roof frame.
First-history holds, reset and endpoint collapse have matching source timestamps.
Departed platforms are not followed in flight; the stored departure velocity is
used. Existing clipped-axis/ground-landing display translation policy is retained.
The 104 focused movement/prediction/camera checks and all three typechecks pass.
Native and final validation follow. This does not redesign vertical/input-time
admission or infer unavailable varying-platform trajectories.

The first post-correction native 60Hz / 120Hz GPU capture has zero authoritative
landing drift for both jumps but a brief ~3.2px backward display error after
takeoff. Two delayed-snapshot regressions reproduce it without a browser:
~3.20064px / 6.39944px at 60/30Hz. Grounded acknowledgements still replaying the
pending takeoff advance the predicted world/source endpoint; contact-error decay
mistakes the expected source-time shift for residual displacement even though
passive sampling already accounts for it. These two expected failures precede
the follow-up correction. [Native boundary capture](/tmp/idle-train-jump-before-residual60.json).
The probe's initial timed boarding was unreliable; it now waits for acknowledged
play mode, approaches the actual body and releases XY while over the roof, using
ordinary keys and observed server coordinates only.

The follow-up measures display contact corrections after removing the expected
passive displacement between pre/post-replay source endpoints, when that axis's
departure momentum is unchanged. Genuine residual contact error retains its
existing decay. Both delayed regressions now pass without changing thresholds;
all twelve idle-jump cases are ordinary passing tests. Native idle/steering and
settled full verification still follow.

## Native cruise verification

At `48665be`, ordinary keyboard boarding and two idle jumps pass on the native
approximately-120Hz display with a real Worker and bundled full Chromium. The
driver waits one second at full cruise before jumping so the borrowed train
history is also constant-speed; raw server and displayed player/train poses are
recorded. No simulation/prediction/clock override or screenshots-as-motion-judgment
are used. Predicted airborne frames include the takeoff before acknowledgement.

| Lane | Measured display Hz | Landing drift, jump 1 / 2 | Maximum displayed relative drift, jump 1 / 2 |
| --- | ---: | ---: | ---: |
| GPU / 60Hz authority | 120.0003 | 0 / 0px | 0.001875 / 0.002300px |
| Canvas / 30Hz authority | 119.9991 | 0 / 0px | 0.001431 / 0.001569px |

Both flights land on the same roof at height 44, retain 192px/s and report zero
page errors. [60Hz capture](/tmp/idle-train-jump-final60-cruise.json),
[30Hz capture](/tmp/idle-train-jump-final30.json). An earlier post-residual-correction
capture jumped immediately at the acceleration-to-cruise boundary and observed
0.164px initial displayed relative error, decaying as the buffered acceleration
history cleared. That remains a varying-trajectory presentation limit, not a
passing constant-cruise capture. [Boundary capture](/tmp/idle-train-jump-final60.json).

All three typechecks, 204 files / 1,719 unit checks, existing-only lint diagnostics,
settled catalogs/manifest and build pass. Native forward/reversal controls and
affected browser/readiness checks follow without changing runtime/build.

Native forward-jump and idle→forward→backward controls also pass on GPU/60Hz and
Canvas/30Hz at measured 120.0119Hz / 120.0130Hz. First jumps land on the next
carriage; second flights retain the 128–256px/s steering range, with unchanged
departure momentum and no page errors. Takeoff step errors are below 0.001px.
[60Hz control](/tmp/idle-controls-final60.json), [30Hz control](/tmp/idle-controls-final30.json).

## Final verification

All **36 affected Playwright checks pass** on the settled build: generated city
train boarding/ride/reopen/alight, phone roof lab, curves, train/vehicle grades,
Traffic, Character, Furniture, Outdoor and World Geometry presentation, cutaways,
Worker lifecycle/persistence, scenario disposal and standalone Workshop. Both
Canvas and full-Chromium GPU consumers use isolated auth/data. Sources/build stay
fixed during captures and integration; owned browsers and servers are closed.
Streaming `--assert-ready` passes with no fixture failures or missing/incomplete
terrain frames. [Readiness report](/tmp/idle-streaming-final/report.json).

Together with the 1,719 units, typechecks, lint and build above, this establishes
constant-velocity idle roof travel through repeated takeoff/landing and retains
directional jumps. It does not add air resistance or change vertical/input-time
admission. Variable platform motion, extended stalls and the existing clipped-axis/
ordinary-ground display release policy remain separate limits. Next is the
user's exact repeated idle-jump playtest on a cruising train.
