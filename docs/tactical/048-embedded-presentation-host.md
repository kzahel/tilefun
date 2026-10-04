# Embedded presentation host

Topic: embedded-engine-labs
Status: delivered and validated.
Date: 2026-10-04.

## Scope

Traffic already used the production Realm and predictor, but its React view owned
another frame loop, snapped its camera and passed alpha 1 to scene collection.
Its backend setup supplied sprite sheets without configuring terrain blend
sheets, road sheets or tile variants. Share those engine responsibilities through
an embedded host while retaining lab-specific controls and scenario recipes.

## Delivered composition

- `ScenarioPresentationHost` owns the scenario client/Worker, loaded assets,
  production `GameLoop`, render host, camera and borrowed `SceneFrame`. Its caller
  supplies input, settings, viewport/framing intent and diagnostic UI callbacks.
  Traffic is the first consumer; the host currently presents outdoor scenarios.
- `PlayerPresentation` extracts the game's fixed-tick follow and exponential
  sub-tick camera interpolation. `PlayScene` and the embedded host call the same
  functions. Predictor previous position/jump/world-height values feed scene
  collection and camera follow together. The lab's -12px framing offset is an
  explicit host option; authority commands snap the camera to avoid a teleport
  sweep. Gameplay's follow, shake and vertical-follow behavior is preserved.
- `OutdoorPresentation.presentTerrain` is the shared preparation/submission owner
  for play/edit and the lab. Both retain the existing throughput/responsive
  settings. Shared `collectScene`/`collectSceneOrder` supply actors, props, grass,
  elevation, mesh pose and ordered bodies; frame storage releases in `finally`.
- `RenderHost.setAssets` configures the loaded gameplay pack, including terrain
  blend sheets, road sheets and variants. Traffic no longer polls the same fully
  loaded sprite manifest or recomputes authoritative autotiles on its replica.
  Grass uses the shared scene policy when its sprite is available.
- The existing selectable Canvas/GPU host factory accepts embedded placement.
  GPU world rendering is an absolute sibling under the original input/UI canvas
  inside a positioned wrapper. It follows scrolling without a per-frame layout
  read; the existing resize observer handles CSS viewport changes. Context loss,
  recovery, fallback and resource disposal use the production host.
- Paused views render their final pose without submitting simulation steps.
  Hidden views stop the clock and restart from current time on visibility return,
  avoiding hidden-time catch-up. Backpressure reports whether prediction advanced;
  rejected ticks do not replay interpolation of an old movement interval.
- Disposal stops the clock, detaches visibility hooks, releases graphics/frame
  storage, closes owned assets and terminates the Worker. Asset arrivals after
  disposal close without creating a renderer. Initialization errors use the same
  cleanup path. Reset retains the fresh-canvas behavior from the cache fix.

## Validation

Unit checks cover predicted/replica interpolation at sub-tick times, height and
shake, camera restoration, placeholder/teleport behavior, the real 60 Hz clock
at 120 Hz presentation, and host startup/disposal/late asset failure paths.
Dependency guards include the new neutral presentation helpers.

Browser coverage uses the actual Worker with Canvas, GPU sprites and GPU meshes:
terrain settling and pacing/zoom, roof riding, pause/resume, reset and exit;
interpolation and camera lag during steady travel; embedded GPU alignment after
scroll/phone resize, real context loss/recovery and removal on tool exit. Motion
checks wait for actual travel, rather than assuming the car immediately reaches
cruising speed. Readiness waits require a quiet window after startup publication.

Typechecks, all 1,452 unit tests, lint (existing warnings), catalog/manifest
verification, production build and all 306 browser tests pass. Sequential isolated
desktop `streaming:bench -- --assert-ready` runs pass for Canvas and GPU + meshes:
cold entry, standing, walking, sprinting, reversal and zoom-out each record zero
missing-data frames, incomplete-cache frames and frames over 25 ms. These are
short desktop checks, not new mobile/high-refresh performance claims. The 120 Hz
unit clock test is a controlled timestamp test, not a physical display capture.

Regenerated inventories preserve all 552 candidate identities; only the broad
manifest digest and catalog source-use references change. No approval reference
was rewritten. The rendered Canvas roof-riding scene was also visually inspected.

## Remaining consumers

OutdoorGeometryTest still combines a variable-step scenario client with fixed
camera/grid/collider diagnostics. Character lab and furniture playtest use the
shared scenario authority but retain their view clocks and native review/layout
adapters. Static diagrams and immutable approval renders remain intentional
reference consumers. Migrate interactive presentation incrementally with explicit
overlay/camera policies; do not rewrite approval sources as a side effect.

This slice does not claim complete GameClient equivalence: menus, audio, particles,
indoor presentation and global world/profile persistence are outside this outdoor
host. Scenario scheduling/transport remain the bounded temporary runtime described
in the [scenario topic](../topics/gameplay-scenarios.md).
