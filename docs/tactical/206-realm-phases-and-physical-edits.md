# Realm phases and explicit physical edits

Status: active, 2026-11-03.
Owner: [physics engine](../topics/physics-engine.md).

Follow-up to205, authorized as incremental cleanup with checkpoint commits.
Preserve the shared60Hz default, behavior, input/Worker/P2P contracts and retained
features. Do not introduce another scheduler, backend, command queue or tuning mode.

1. Make Realm.tick an ordered orchestration of readiness, input admission,
   simulation selection/decisions, one physics step, consequences and publication.
   Move wildlife environment binding into a focused module. Keep lifecycle owners
   and metrics boundaries, and release transient simulation views with finally.
2. Introduce explicit shared APIs for teleports, launches and collider replacement;
   migrate ordinary game/script and lab writers. Preserve deferred body admission
   and immediate coherent replication. Centralize how edits invalidate body support
   and interpolation instead of spreading field assignments across callers.

Use existing native shared-authority, prediction, script, lifecycle and vehicle
coverage; add tests only for a distinct edit contract missing there. Run types/lint,
streaming readiness and selected ordinary Worker/P2P/lab boundaries. Refresh required
inventories/build after source changes, commit checkpoints, finish clean and mark
ready last. Prediction/presentation separation and broader AI helper consolidation
remain later slices; this task starts with the two highest-value changes.

## Slice1 — named Realm phases

The tick entry point now orchestrates readiness, input admission, selected
simulation, spawners/save/time and publication in about30 lines. Simulation names
its decisions, one shared advance, physical outcomes and gameplay consequences.
RealmWildlife binds existing planning/task queries independently of orchestration.
The original order, fixed clock, activity filters and metric boundaries remain.
Transient entity/prop simulation views are released in finally, including errors.

115 existing native checks across eight files pass (authority/prediction,
Realm lifecycle, transport, scenario Worker and representative wildlife work).
All three TypeScript projects and focused lint pass. No new extraction-only tests
were added. Final inventories, browser/execution qualification and readiness wait
for the physical-edit slice so they exercise the finished source.
