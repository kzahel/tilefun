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
