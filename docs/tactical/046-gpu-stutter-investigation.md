# 046 — GPU frame-stutter investigation

Status: complete, 2026-10-04. Owner: [performance](../topics/performance.md).

Compare Canvas and GPU in the real Worker game using the isolated traversal
runner. Run longer untraced controls in bundled full headed Chromium and the
attached Pixel, then matched traces. Avoid concurrent builds/tests. Preserve
terrain-readiness assertions and report movement coverage and cadence, including
120 Hz where a fixed 25 ms cutoff misses dropped frames.

Traced runs add diagnostic-only render phase timing and upload counters; these
wrappers allocate and nest, so their durations are inclusive and instrumentation
can perturb pacing. Correlate slow intervals with main-thread GC, CPU work and
GPU-process work without treating overlap as proof of causation. Keep raw traces
local; record a sanitized summary and reproduction commands. Do not attribute the
separate Traffic lab cache-policy conflict to the main game, or imply that sprite
traversal covers mesh-heavy workloads. Make targeted diagnostic interventions only
when the evidence supports them; retain Canvas default pending a measured win.


## Measurement corrections and first findings

The ordinary extended phone sprint becomes blocked after about 460 pixels, while
the held key/touch benchmark continues sampling. Those samples are not sustained
movement evidence. Added travelled distance and longest stationary duration, plus
an explicit benchmark-only noclip option for continuous rendering/streaming
stress. This does not replace ordinary gameplay or collision tests.

Headed desktop observes about 120 Hz, so the analyzer now flags intervals above
1.5 times the observed median cadence, retaining a separate over-25-ms count.
A synthetic 120 Hz fixture checks that a 16.7 ms missed interval is found and that
its GC/phase correlation is correct. Traced phase counters are inclusive:
submission includes page copying and flushes; totals cannot simply be added.

The first continuous Pixel GPU trace has four missed intervals with no overlapping
main-thread GC. Its overlapping GPU-process requests last 14–21 ms; three contain
33–49 Canvas raster batches. Main render callbacks remain short. Follow up with
an isolated two-row terrain budget, bracketing it with the default policy, while
requiring visible terrain readiness and real movement. This is a diagnostic
intervention, not a production change or a hardware GPU timer measurement.


## Controlled results

[Sanitized evidence](../benchmarks/046-gpu-stutters.json) records the controls,
trace summaries, movement validity and limits. Raw traces stay local.

| Continuous sprint, 3,600 frames | Canvas | GPU sprites |
| --- | ---: | ---: |
| Headed desktop, ~120 Hz, untraced | 0 missed intervals | 0 |
| Pixel, ~60 Hz, untraced | 5 | 18 |
| Headed desktop, traced | 0 | 0 |
| Pixel, traced | 2 | 4 |

Desktop sprints cover about 4,417 world pixels in 30 seconds; Pixel sprints cover
about 8,850 pixels in 60 seconds. Each comparison is within its platform, with
the same generator, arrival, input direction and renderer-independent game.
All continuous movement samples have ready visible terrain. Small differences
in total duration, camera bounds and moving actors prevent pixel-identical loads.

The Pixel Canvas trace includes a **42.314 ms main-thread GC event** overlapping
one missed interval at about 49.77 seconds. Its other missed interval overlaps
a 27.286 ms GPU-process request. The GPU trace's four missed intervals overlap
14.193, 15.388, 20.955 and 19.693 ms GPU-process requests, with no recorded
main-thread GC overlap. Three contain 42, 33 and 49 Canvas raster batches.
The 20.955 ms request uses only 1.699 ms of thread CPU, so its elapsed time cannot
be described as 21 ms of GPU execution; waiting/descheduling may contribute.

The GPU backend still builds terrain/room images through Canvas before drawing
textured quads. A main-thread preparation deadline can bound command submission
without bounding the browser's later raster work. These captures support that
as a contributor; they do not assign all ordinary-play stalls to a single cause.
Tracing reduced the observed miss count and adds allocations, so traced GC and
pacing totals are diagnostic observations, not uncontaminated gameplay rates.

### Reversible terrain-budget intervention

An explicit benchmark-only two-row budget, then restoration to default:

| Pixel GPU, untraced one-minute sprint | Default before | Two rows | Default after |
| --- | ---: | ---: | ---: |
| Missed intervals | 20 | 6 | 23 |
| Missing/incomplete visible terrain during movement | 0 / 0 | 0 / 0 | 0 / 0 |
| Incomplete-cache frames in first 120 post-ready frames | 9 | 26 | 10 |

The bracketing default runs support a scheduling effect rather than a simple
warmup win. The cold-entry tradeoff rules out blindly promoting this fixed cap.
No production policy changed. Next, budget **background/offscreen raster work**
more tightly while retaining urgency for visible holes; validate warm settling,
movement and entry in the game and affected embedded labs through a shared owner.
Fix the separately documented Traffic double-preparation policy as its own issue.

The original reported periodic hitch remains only partly attributed. Follow-up
allocation profiling must distinguish game allocations from benchmark/tracing
storage before naming the cause of the long GC event. Mesh-heavy rendering and
sustained thermal/lower-end/iOS coverage are not established by these runs.

## Reproduction

Use the existing isolated runner, one process at a time:

```sh
npm run streaming:bench -- --headed --renderer=gpu --sprint-frames=3600 --noclip --assert-ready --output=/tmp/gpu-control
npm run streaming:bench -- --headed --renderer=gpu --noclip --trace-stage=sprint --trace-frames=3600 --assert-ready --output=/tmp/gpu-trace
node scripts/analyze-streaming-trace.mjs /tmp/gpu-trace/current-sprint-trace.json /tmp/gpu-trace/summary.json /tmp/gpu-trace/report.json
```

Use `--renderer=canvas` for its paired control. Physical-device runs replace
`--headed` with the existing `--cdp`, dedicated `--port`, `--touch` and descriptive
`--device` options; forward/reverse only the test endpoints. Add
`--terrain-row-budget=2` for the diagnostic intervention and `--frame-timeline`
for untraced interval timestamps. Device identifiers and raw browser traces do
not belong in Git. See 012 for testbed setup. Current benchmark instrumentation
is ephemeral and restores methods before closing its isolated tab/origin.


The two-row trace still has two missed intervals: one overlaps a 14.479 ms GPU
request containing 33 raster batches, and another a 32.272 ms main-thread task.
The cap reduces observed stalls but does not eliminate every raster burst or
other work. Phone temperature rose from 25.6°C to 30.4°C across the investigation,
charging throughout, with reported thermal status 0 before/after; this is not
sustained thermal evidence. All 16 runs completed; two blocked ordinary phone
sprints are explicitly excluded from continuous-movement conclusions.


Validation: typechecks, 1,444 unit tests and lint pass (existing 124 warnings/32
infos). The synthetic analyzer fixture validates 120 Hz detection and phase/GC
alignment; all five real trace summaries contain the expected 3,600 intervals.
All continuous traversals pass movement terrain readiness; the blocked ordinary
phone samples are excluded as noted. Test tabs, temporary origins and device
forwards are cleaned up. No production rendering, recipes, assets or approval
identities changed; other in-progress documentation edits are preserved.
