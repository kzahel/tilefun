# Stop-and-go vehicle jumps

Reproduced 2026-11-17 at `720a7c7a` in an ordinary single-player Worker world on
flat grass and in a deterministic flat-road scenario. On that revision, the
visible car can jump back while braking and jump forward when throttle resumes.
The original device, vehicle and route are unverified.

## Reproduction

On the affected revision, place and enter an open-wheel racer in a flat world.
With the default relative controls, hold Shift + Up for about 1.1 seconds.
Release Up for about 0.36 seconds, then press Up again. Keep Shift held through
the cycle and leave a clear path. A longer release also shows the braking jump,
even if the car has stopped by the next acceleration.

The deterministic reproduction requires no browser or simulated network lag.

```sh
npx tsx scripts/reproduce-stop-go-prediction.ts --json /tmp/tilefun-stop-go.json
```

The script warms up the parked chassis, drives it 90 ticks at full boost,
releases for 22 ticks, then repeats with a longer release. It uses ordinary
binary replication, the shared predictor, and the actual replica presentation at
half-tick interpolation. A second run holds predicted presentation throughout.
These pre-fix numbers are world pixels along the car's direction of travel.

| Transition | Baseline displayed step | Control displayed step | Authority step |
| --- | ---: | ---: | ---: |
| Brake, first frame from the buffer | −14.67 | +5.55 | +5.45 |
| Resume, first frame back in prediction | +23.18 | +4.93 | +4.97 |
| Brake after the second acceleration | −14.67 | +5.55 | +5.45 |

The control and baseline authority poses match throughout. Maximum predicted
position error at the same physics tick is below 0.000002 px in both runs.

In bundled desktop Chromium with the default top-down view and no injected
latency, three brake transitions with the boosted racer moved the car backward
by 12.66–21.16 px in individual 16.6–16.7 ms frames. On the worst frame the
predicted chassis still advanced 4.44 px at 266 px/s, the mounted player's speed
was zero, and reconciliation reported less than 0.000002 px error. A short pause
followed by throttle produced a 14.71 px forward step as the predicted chassis
advanced 2.09 px. Holding predicted presentation for the following two cycles
removed the discontinuities. An unboosted compact on grass showed the same
three braking handoffs with smaller 0.30–0.54 px backward steps. Both captures
had 16.8 ms frame p99 and no browser page errors.

## Cause and fix

The mounted avatar has zero horizontal velocity by design. Each authority tick
copies the chassis position to the avatar. The predictor's 300 ms activity
window expires after the last movement input, and its continued-motion check
reads the avatar's velocity. A grounded car can therefore still be braking
at speed when the presentation gate switches the car and rider to the older
authority buffer. Resuming throttle switches them back to the current predicted
pose. The buffer has a nominal 50 ms interpolation delay and can trail the
private prediction by additional Worker delivery and input lead. The larger
displacement on a faster car follows from this gap.

The shared predictor keeps a locally driven car and rider on the same predicted
presentation timeline throughout the drive, including braking and idle.
Local co-seats get the same policy. Once ordinary activity expires, that policy
selects the driven body, its rider and solved contacts. Nearby unconnected
bodies use the buffer. Replay holds its last committed display, and dismount
returns the car to ordinary scene selection.

The fixed deterministic run has zero handoffs, and its authority and displayed
poses match the always-predicted control exactly. The native regressions cover
braking, renewed throttle, prolonged idle, an unrelated actor, dismount and a
local co-seat driving while the primary seat stands. A fresh ordinary Worker
capture holds car and rider together for all 434 sampled frames, including
three releases and a full stop. The largest displayed step difference from
interpolated prediction is under 0.00003 px. The browser also verifies dismount.
The production build and Chromium vehicle placement and jump park checks pass.
