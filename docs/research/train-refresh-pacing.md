# Train reload presentation pacing

2026-10-06. Follow-up to [camera basics](camera-basics-reproductions.md) and
[airborne momentum](airborne-support-momentum.md). Owner:
[player prediction](../topics/player-prediction.md); execution:
[Tactical 067](../tactical/067-shared-prediction-timeline.md).

## Baseline before runtime edits

The user reports that refreshing on a moving train usually makes train and rider
stutter together while ground/camera stay smooth. Backgrounding and returning
recovers. Roof-relative prediction alone does not expose this fault.

Nine deterministic checks use the production RemotePresentation with ideal 192px/s
motion: four no-pause/reset controls, one aligned 60/60Hz control, three startup
pauses at 60/120, 30/120 and 30/60Hz, and rendering before the first snapshot.
The last four are expected failures in the reproduction checkpoint. A 600ms source
pause creates persistent snapshot-paced stepping after perfect delivery resumes;
an explicit reset removes it. Aligned 60/60Hz can mask that staircase.

Actual saved roof ride: bundled headed full Chromium, GPU, real Worker, native
approximately 120Hz display, ordinary keyboard boarding, isolated Vite/persistence,
normal page.reload. No authority timer or render clock is replaced. Six seconds
are captured after reload and after a separate reset control; first cruise second
is excluded. Baseline artifact: [native capture](/tmp/train-refresh-gpu-baseline.json).

| Phase | Display Hz | Steady steps | Train step error max | Camera step error max | Bad train steps (>0.1px) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fresh | 120.002 | 359 | 0.001763px | 0.000312px | 0 |
| Reload | 119.837 | 600 | 1.805763px | 0.087711px | 600 |
| Explicit reset control | 119.983 | 349 | 0.001794px | 0.002081px | 0 |

Reload's clock originated at local 0.3938s before the first usable server stream;
at local 1.3501s, latest authority time was only 0.016667s. During settled cruise,
wanted display time remained 525–542ms ahead of latest authority, permanently above
the 100ms extrapolation cap. Clamping changed time but retained the obsolete origin,
so every new snapshot advanced the display limit in a staircase. Rider composes
onto that same train pose, preserving relative alignment. Camera integrates wall
presentation time, making its much smaller step errors consistent with the report.

The probe's explicit reset is the production visibility-change reset, called
independently. Playwright's pages remain forced-visible in this setup even after
focus emulation is disabled; attempted tab switches are **not** background recovery
evidence. The user's real visibility observation and the pure pause/reset controls
remain separate evidence. All owned browser/server processes close on exit.

## Fix contract

Do not start remote presentation time before the first authority snapshot. When
bounded history is exhausted, discard unusable forward clock debt while preserving
the held pose and monotonic source time. Ordinary delayed snapshots must not reset
the clock. A later burst that advances authority beyond the usable old timeline
must permit bounded forward recovery rather than locking presentation behind a
history that is being pruned. Test each direction independently; missing motion
during a long source/data stall cannot be reconstructed.

## Rerun

```sh
npx vitest run src/client/RemotePresentationStartup.test.ts src/client/RemotePresentation.test.ts src/rendering/PresentationTimeline.test.ts
node scripts/instrumentation/train-roof-browser.mjs --headed --renderer=gpu --reload-pacing --output=/tmp/train-refresh-gpu.json --assert-presentation
```

The browser lane retains raw clocks, authority times and borrowed train/camera
poses. This is numeric render-path evidence, not visual inspection or a screenshot
FPS estimate. A fixed 30Hz variant uses `--server-hz=30`; captures must report the
actual advertised rate after reopen, rather than assuming CVars persist.

## Shared correction

RemotePresentation now distinguishes “no snapshot yet” from source time zero.
Loading renders cannot establish an epoch; the first applied authority snapshot
anchors it. The pure PresentationTimeline rebases unreachable forward debt when
its 100ms extrapolation limit holds, without rewinding the held pose. Ordinary
in-buffer arrivals preserve the origin. If a later delivery burst puts authority
more than buffer + extrapolation (150ms) ahead of wanted time, it catches up to
latest minus the 50ms buffer; otherwise exhausted-clock rebasing could instead
leave it permanently behind history as that bounded history is pruned.

All nine startup checks are now normal passing regressions. Two additional pure
clock checks cover immutable monotonic exhaustion and long delayed-data burst
recovery. Focused game/lab presentation tests (91 checks), all three typechecks,
and both deterministic continuity CLIs pass. Native and full validation are recorded below.
This changes shared replica sampling, not physics, train service motion, passenger
momentum or camera response. A long absence of authoritative data may still hold
and then correct; it cannot cause a permanently stale clock epoch.

## Verified checkpoint

Runtime commit `940e456` (baseline runtime `139b52f`). Both native captures use
bundled headed full Chromium, ordinary keyboard boarding, real Worker authority
and native display timestamps. The 30Hz lane explicitly requests/waits for 30Hz
after reopen because runtime CVars are not necessarily durable; the 60Hz reload
lane makes no rate-change request. Assertions require finite train/player/camera
metrics, at least 60 settled cruise steps, correct advertised rate, ≤0.1px step
error and ≤0.02px roof-offset range.

| Reload capture | Display Hz | Steady steps | Train/rider max step error | Camera max step error | Bad steps | Roof-offset range |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GPU requested, 60Hz authority | 119.981 | 600 | 0.001856px | 0.002340px | 0 | 0px |
| Canvas, 30Hz authority | 120.027 | 599 | 0.000731px | 0.001024px | 0 | 0px |

Fresh and explicit-reset phases also pass in both captures, with no page errors.
Artifacts: [60Hz capture](/tmp/train-refresh-gpu-fixed.json),
[30Hz capture](/tmp/train-refresh-canvas30-fixed.json). One initial 60Hz attempt
failed ordinary keyboard boarding before any pacing capture; the same lane passed
on rerun without runtime changes or threshold changes. Native tab hiding remains
outside these captures; the reset control and production Worker pause/resume
integration test are separate evidence.

Final validation: all three typechecks, 203 unit files / 1,707 tests, lint with
only the existing 118 warnings / 34 infos, refreshed catalog/manifest, production
build, both continuous-presentation CLIs, 36 affected game/lab/Worker Canvas/GPU
browser checks and streaming readiness pass. The manifest changes only its input
digest; immutable art and review pixels are untouched. Tests/build finish before
native pacing runs, and no runtime/build changes occur during browser validation.

Next: repeat the user's actual refresh/background playtest. Longer authoritative
stalls, uncertain acceleration/turning and delivery corrections still need their
own acceptance traces; this verifies snapshot-anchored startup and monotonic clock
recovery, not reconstruction of motion absent from the data stream.
