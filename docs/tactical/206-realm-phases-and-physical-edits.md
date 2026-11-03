# Realm phases and explicit physical edits

Status: delivered, 2026-11-03.
Owner: [physics engine](../topics/physics-engine.md).

Follow-up to 205, authorized as incremental cleanup with checkpoint commits.
Preserve the shared 60Hz default, behavior, input/Worker/P2P contracts and retained
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

## Slice 1 — named Realm phases

The tick entry point now orchestrates readiness, input admission, selected
simulation, spawners/save/time and publication in about 30 lines. Simulation names
its decisions, one shared advance, physical outcomes and gameplay consequences.
RealmWildlife binds existing planning/task queries independently of orchestration.
The original order, fixed clock, activity filters and metric boundaries remain.
Transient entity/prop simulation views are released in finally, including errors.

115 existing native checks across eight files pass (authority/prediction,
Realm lifecycle, transport, scenario Worker and representative wildlife work).
All three TypeScript projects and focused lint pass. No new extraction-only tests
were added. Final inventories, browser/execution qualification and readiness wait
for the physical-edit slice so they exercise the finished source.

## Slice 2 — explicit physical edits and coherent admission

PhysicalEdits names pose changes preserving motion, stopped teleports, horizontal/
vertical velocity edits, complete launches and collider replacement. Scripts,
ordinary ball throws, travel/water recovery, vehicle enter/exit, lab teleports,
resource drops, wildlife toy launches and den placement use the shared helpers.
Bootstrap/restore and derived attachments retain their separate lifecycle owners.
Admission remains synchronous at PhysicsScene.synchronize; no command queue,
extra integration or engine configuration was introduced. These helpers stage edits;
solver contacts are recomputed at the next physics step. Callers retain readiness
and clearance checks.

Scene admission now updates physical bodies and their cached numerical state
at the same boundary, invalidating stale support/contact associations on edits.
Snapshot copying is a read of admitted state rather than merging cached state with
later entity fields. A paused launch therefore publishes its airborne velocity
and support state together. Contact invalidation visits the edited body's neighbors,
not the complete contact map. Shape signatures still own one rebuild per change.

Two focused shared-world regressions cover stopped relocation plus launch before
the next integration, contact-neighborhood isolation, immutable previous captures,
one-time launch velocity, and collider replace/remove/re-admit without advancing.
The existing coverage plus those cases passes 280 native checks across 18 files;
all three TypeScript projects pass. A final focused core rerun covers local contact
invalidation. Runtime review fingerprints include the extracted/new shared modules.
Final artifact/browser/streaming qualification follows before readiness.


## Delivery

Implementation checkpoints: `faecda09` names Realm phases and extracts wildlife
bindings; `08f474ca` centralizes physical edits and coherent numerical admission.
The selected native run passes 280 checks across 18 files; the local contact-check
rerun passes 13. All three TypeScript projects and focused lint pass.

Fresh art catalog, all 2,119 Workshop identities/manifest and production build pass.
The four full-Chromium cases pass on that bundle: ordinary game Worker NPC contacts
and prediction, actual delayed P2P convergence, two-seat lab control/fences/reload,
and car ramp traversal with the saved seat. Streaming readiness passes with no
missing/incomplete/stale visible terrain during walking, sprinting and reversal.
No art pixels, approved source banks or human review state changed.

This is an ownership/readability cleanup, not a new performance result or changed
physics configuration. Next separate prediction replay/history from visual
correction, then consolidate repeated AI motion housekeeping in bounded slices.
Final inventories/docs are committed and development readiness is marked last.
