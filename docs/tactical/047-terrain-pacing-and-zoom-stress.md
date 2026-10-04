# 047: Terrain pacing and zoom stress

Status: complete. Owner: [performance](../topics/performance.md).

## Direction

Presentation may lag behind demand. A newly visible chunk changes queue priority,
not the work cap. Reuse completed imagery while replacements build; measure frame
pacing and presentation debt together. A wide view is an explicit workload, not a
reason to silently remove budgets or restrict simulation to the normal view.

Local mclone source inspection (2026-10-04, `f9efb9be`):
`native/crates/mclone-render-session/src/session.rs` shares a capacity-gated,
chunk-budgeted compile loop between platforms; `upload.rs` separately budgets
upload and lifecycle acceptance. Tactical 128 describes resident lifecycle,
admission, dispatcher, upload and drawable ownership. Tactical 150 closed as measured baseline stabilization: fixed in-flight caps
were promoted, while adaptive render admission and adaptive GPU upload defaults
were not. It is not a completed multi-stage adaptive controller to copy. Transfer these boundaries and measurement discipline, not its Rust
implementation or platform constants.

## Slices

1. Expose shared named zoom presets (preserve keys 1–4, add 0 for 0.1× overview)
   and an opt-in responsive terrain policy in game Debug and Traffic. Existing
   throughput policy stays default. Responsive uses the existing resumable
   scheduler with a two-row total cap and 2 ms admission deadline, including
   visible holes; completed chunks publish atomically. Keep old complete images
   during replacement. Use shared immutable options, no per-frame settings objects.
2. Extend the real-game benchmark with selectable policies, zoom sweeps through
   those presets, debt/catch-up and upload/work counters. Keep the strict ordinary
   traversal readiness lane and add a separate bounded/catch-up assertion for
   deliberate progressive presentation. Exercise rapid demand changes and warm
   cache reuse through game/lab browser tests and scheduler regressions.
3. Run required validation and matched desktop/Pixel comparisons; record results,
   limitations and next work. Commit completed slices.

## Limits / next boundaries

Two rows is an experimental measured starting point, not a whole-frame deadline.
A row may overshoot; membership scans, collection, sprites, simulation, driver
work and GPU uploads have their own costs. This slice does not add a Worker,
LOD, an adaptive controller or a separate GPU upload queue. At overview scale,
more data/entities/draws remain real work even after terrain preparation settles.
The existing partial Canvas imagery remains in throughput mode; responsive mode
avoids repeatedly uploading a partially built chunk. No simulation collision or
readiness rules change. Other static reference/explorer consumers retain their
explicit visible-only preparation contract. Interactive Traffic shares the game
policy; its interpolation is separate follow-up work.


## Implementation and validation

Slices 1–2 delivered: named controls and shared policies, real-game zoom sweep,
separate strict-readiness/bounded-catch-up gates, and regression coverage for
publication, edits, warm reuse, rapid zoom changes and lab reset. No new terrain
scheduler implementation was necessary; the existing resumable scheduler owns
all preparation. The UI choice supplies shared preparation/publication options.

Typechecks and 1,445 unit tests pass. Lint has only the existing 124 warnings and
32 informational diagnostics. Catalog and all 552 Workshop identities verified;
production build passes. Full browser run: 303 passes, one Workshop standalone
failure caused by changing DebugPanel source after building the bundle, triggering
its source-consistency guard. After regenerating the manifest and rebuilding, all
14 affected controls/GPU/standalone checks pass. All three expanded Traffic mode
checks pass in the full run. No human art approvals were changed.

The default current-generator `streaming:bench -- --assert-ready` passes;
walking, sprinting and reversal have no missing data or incomplete terrain.

Implementation committed as `d82f4d6`. Slice 3 is complete below. Keep Canvas and
faster-fill defaults; small batches is a supported experimental choice, not an
adaptive controller or a promise of hitch-free frames.


## Matched desktop and Pixel evidence

[Sanitized results](../benchmarks/047-terrain-pacing.json) contain five sequential
runs: strict default Canvas traversal, then GPU faster-fill/small-batch pairs in
headed bundled Chromium on Apple M4 Pro and physical Pixel 7a Chrome. Each GPU
run uses 3,600 sprint frames and the shared zoom sequence. No other tests/builds
ran during measurements. Noclip prevents the long route being blocked; desktop
travels 4,417 px in ~30 seconds and phone 8,836–8,885 px in ~60 seconds. These are
continuous streaming tests, not collision or mesh-heavy benchmarks. The endpoint
has one entity and no props, so this is not dense-town evidence.

| Pixel GPU measurement | Faster fill | Small batches |
| --- | ---: | ---: |
| Sprint missed intervals / 3,600 samples | 20 | 1 |
| Sprint missing-data / incomplete-cache frames | 0 / 0 | 0 / 0 |
| Initial 120 post-ready samples with incomplete terrain | 8 | 26 |
| Overview catch-up frame p95 | 33.4 ms | 16.8 ms |
| Overview catch-up missed intervals / samples | 23 / 116 | 7 / 740 |
| Overview first fully current visible frame | 30 | 344 |
| Overview incomplete-cache frames | 29 | 343 |
| Overview total catch-up time, including halo and 60 quiet frames | 2.37 s | 12.45 s |
| Overview requested texture upload | 19.0 MiB | 10.75 MiB |
| Overview warm frame p95 | 16.8 ms | 16.8 ms |
| Overview warm missed intervals / 120 samples | 0 | 0 |

Desktop GPU sprint has zero missed intervals with either policy. The overview
shows a separate steady rendering limit at the ~120 Hz desktop cadence:

| Desktop GPU overview | Faster fill | Small batches |
| --- | ---: | ---: |
| Total catch-up time, including halo and quiet window | 2.38 s | 19.42 s |
| Requested texture upload during catch-up | 79.25 MiB | 39.5 MiB |
| Warm render callback p95 | 11.3 ms | 11.1 ms |
| Warm missed intervals / 120 samples | 33 | 40 |

All zooms catch up, both responsive runs obey the two-row cap throughout, and
all warm stages perform zero terrain preparation and request zero texture uploads.
The desktop overview retains 285 loaded chunks / 71.25 MiB terrain surfaces;
phone overview retains 120–135 chunks / 30–33.75 MiB terrain surfaces. These exclude
staging/texture/driver and other engine memory. The desktop's ongoing cost cannot
be solved solely by smaller terrain preparation batches. The narrower phone
viewport (411 × 789 versus 1280 × 900) also requests a smaller world region.

Misses are rAF intervals above 1.5× each stage's observed median cadence, not
hardware presentation counters. Catch-up stages have different durations; compare
pacing distributions and debt, not raw miss totals as if durations matched. This
is one sequential pair per platform without tracing or a repeated randomized
trial. Terrain cap and completed-only publication change together, so this pair
does not isolate their individual contributions. The frame-count-based phone
route also travels ~49 px farther in the slower baseline, changing chunk alignment
and its final retained region (135 versus 120 chunks); upload totals therefore
include this workload difference. Desktop endpoints have identical distance and
285-chunk residency. The initial "cold" sample begins
after game readiness and policy selection, not at navigation/first paint. Phone
was charging, battery 26.8°C before the measurements and 27.0°C afterward, thermal
status 0 at both checks; no sustained thermal claim. Test tabs, browsers, servers
and ADB forwards were cleaned up; raw reports/screenshots stay local.

## Next work

Profile the warm overview's shared collection/submission cost (including grass,
terrain quads and draw batching) before choosing reuse, detail reduction or LOD.
Keep explicit presentation debt and catch-up measurements while testing a less
conservative small-batch cap or adaptive admission. Separate upload admission is
still useful for cold resource creation/recovery, but a main-thread time budget
alone cannot bound browser GPU execution. Do not switch defaults from one pair.

Reproduce:

```sh
npm run streaming:bench -- --assert-ready
npm run streaming:bench -- --headed --renderer=gpu --terrain-pacing=throughput --zoom-sweep --noclip --sprint-frames=3600 --output=/tmp/tilefun-047-throughput
npm run streaming:bench -- --headed --renderer=gpu --terrain-pacing=responsive --zoom-sweep --assert-bounded --noclip --sprint-frames=3600 --output=/tmp/tilefun-047-responsive
```

For physical Android replace `--headed` with
`--cdp=http://127.0.0.1:9223 --port=4188 --touch --device=Pixel-7a`, using the
[existing isolated CDP setup](012-streaming-performance-and-local-server-worker.md).
