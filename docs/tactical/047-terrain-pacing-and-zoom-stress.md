# 047: Terrain pacing and zoom stress

Status: implementing. Owner: [performance](../topics/performance.md).

## Direction

Presentation may lag behind demand. A newly visible chunk changes queue priority,
not the work cap. Reuse completed imagery while replacements build; measure frame
pacing and presentation debt together. A wide view is an explicit workload, not a
reason to silently remove budgets or restrict simulation to the normal view.

Local mclone source inspection (2026-10-04):
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

Matched timing evidence is pending slice 3. Keep Canvas and faster-fill defaults.
