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
