# Movement pacing investigation

Status: reproduced and explained; production fix is not implemented.
Updated: 2026-11-03.

Owner reports uneven walking, running and driving on desktop/laptop, including
clear ground away from other bodies. Investigate frame timing, prediction and
actual presented motion before attributing this to contacts or slow rendering.

## Reproduction and evidence

The normal GPU/meshes streaming runner with `--frame-timeline` reproduces uneven
presented movement with steady 16.7ms frame median/16.8ms p99. A second isolated
ordinary-Worker capture removes NPCs and uses empty flat grass. It measures actual
presented player/driver positions, rendered camera pose, input/physics clocks,
corrections and screen projection during steady rightward walk, run and driving.
Unlike the older streaming runner's post-render `cameraX`, this camera sample is
taken inside `presentFollow`, before `restoreActual` restores the fixed-tick pose.

Reproduce with:

```sh
node scripts/instrumentation/movement-pacing.mjs --output=/tmp/tilefun-movement-pacing
```

The runner owns isolated Vite/data and bundled full Chromium, closes both and
keeps raw timelines outside Git. The compact [numerical evidence](../benchmarks/211-movement-pacing-investigation.json)
contains exploratory and portable-command confirmation captures. Measurements use
successive displayed X positions divided by monotonic render-time differences;
30 leading samples are discarded after movement warmup.

| Movement | Target speed | Baseline displayed speed range | Diagnostic control |
| --- | ---: | ---: | ---: |
| Walk | 64 px/s | 56.37–71.30 | 63.999–64.001 |
| Run | 128 px/s | 113.43–143.72 | about 127.998 |
| Compact car | 112 px/s | 90.51–128.36 | about 112.002 |

These are short confirmation-capture ranges, not universal limits. All six cases
retain 16.8ms frame p99 and have no page errors. The first independent capture
reproduces the same effect. This is desktop Chromium without CPU emulation, not
physical-phone qualification.

## Cause: comparison crosses local input ticks

PlayScene calls `reconcile` before storing the next input, as intended. However,
reconciliation can only start a pending replay; it finishes later in `predictInput`
after that next input has already been appended. `drainReplay` compares the old
published pose / `job.before` against the result including that legitimate extra
movement tick. Normal motion is therefore recorded and smoothed as an error.

On straight clear ground the same past physics tick agrees within 0.0002px, yet
median reported current correction is exactly one movement tick: 1.0667px walking,
2.1333px running and 1.8667px driving. Repeated corrections accumulate roughly
4.4/8.7/7.6px of unnecessary horizontal display offset. Its decay depends on callback
timing, so small timing variation becomes visible speed modulation despite steady
simulation inputs and frame delivery. Source-clock/ack phase variations can also
produce zero/two predicted physics ticks in individual render intervals; correction
must distinguish those genuine rebases from newly added local movement.

The diagnostic control drains the pending replay before storing the next input.
In both captures the false correction falls to approximately zero and steady
displayed speed becomes nearly constant for all three movements. The control is
deliberately browser-only: an extra `update` can spend a second replay slice and
does not qualify as a production repair. Simply disabling smoothing can expose
larger zero/two-tick raw jumps and is not the proposed fix.

## Secondary effect: integer camera translation

`Projection.projectWorld` rounds the camera translation when `pixelSnap` is on.
Even in the matched-replay control, the centered player's screen X oscillates
through roughly 0.85–1.00 screen pixel while its world speed is steady. Reprojecting
the identical poses/camera without rounding reduces that range to 0.0006–0.011px.
This is a separate pixel-grid effect. The existing snap keeps terrain/sprite layers
aligned; removing it blindly can reintroduce shimmer/seams and needs its own
presentation decision after the larger replay issue is repaired.

## Next implementation slice

Capture the local input tick represented by the pre-replay pose, and compare at
that same tick inside the existing bounded replay. Inputs appended during replay
must advance movement without being mistaken for correction. Preserve the 210
contact anchor, 208 previous poses, replay slicing/held presentation, coalesced input
and one shared physics step. Do not add another loop or a runtime option.

Add a narrow native regression for an input appended during pending replay, with
variable callback times and constant movement. Qualify zero false correction and
steady fractional presentation, then ordinary Worker/P2P, contact, driving and
actual display pacing. Consider pixel-grid presentation separately afterward.

Validation for this investigation: diagnostic Node syntax check and focused lint
pass; both six-case captures complete without page errors. No game-source or asset
files change, so builds/full tests and a development-ready signal are unnecessary.
