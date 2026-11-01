# Rapier physics prototype

Status: first backend playground delivered for inspection, 2026-11-01. Owner authorized recording the provisional plan
and proceeding to a shareable prototype. [Physics engine](../topics/physics-engine.md)
owns the longer-term direction. This is not approval to migrate normal gameplay.

## First delivery

- Shared TypeScript adapter around pinned Rapier WASM, with no SAB requirement.
- Actual dedicated authority Worker using production ServerLoop and bounded channel.
- Schematic 3D Workshop viewport generated from the same geometry as collision.
- Walk/jump up ramps, over a sectioned bridge and through its underpass; loose
  bouncing/pushable objects and moving support exercise general contacts.
- Configurable bridge length, spawn locations and object load; visible physics,
  frame and render counters. Keyboard, touch and standard controller access.
- Pause/reset, teardown, errors and stale-session handling; deterministic headless
  physics checks and one focused browser Worker/input/render lifecycle boundary.

## Scope and measurement limits

Experimental backend host, not Realm replacement. The lab may introduce a minimal
command/replay predictor using the shared backend; qualify exactly what it covers.
Production persistence, multiplayer protocol, vehicles and animal AI remain later.
Schematic meshes are diagnostics, not new promoted art. Keep timing results labeled
by host/hardware and workload; no FPS or Chromebook gain claim without measurement.

Run relevant TypeScript/lint, focused native tests, selected full Chromium capture,
streaming readiness (execution changes), generated inventories and a production
bundle check. Record evidence and live source verification before sharing.

## Execution

- Initial inspection: P2P Worker authority is already delivered (188); normal game
  physics remains shared bespoke movement/support. The prototype can stay isolated
  from the dirty ongoing gameplay changes in the checkout.
- Added pinned `@dimforge/rapier3d-compat` 0.21.0. The shared backend lives in
  `src/physics/rapier`, independent of React and rendering; only its Worker imports
  the WASM module in the browser. Shapes use metres/Y-up and the same slab vertices
  supply Rapier convex colliders and diagnostic Three.js meshes. No promoted art
  or existing game-physics behavior changes.
- Workshop tool `physics` is public, lazy-loaded, registered as an excluded
  schematic geometry candidate, and available at
  <https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/physics>.
  It offers 32/256/1024 m bridge presets, both ramp approaches, deck/underpass/lift
  starts, dynamic balls/crates (512-object cap), deck transparency, zoom, pause and
  reset. It follows the player with a fixed orthographic camera.
- Authority uses ServerLoop at 60 Hz and publishes complete pose snapshots at
  30 Hz through OrderedWorkerChannel/transferable ArrayBuffers. Backpressure can
  skip full snapshots without advancing a delta baseline. Both channel endpoints
  continue budgeted draining after a long callback. Stale input clears after
  350 ms; page blur clears movement, hidden tabs pause, unmount terminates the
  Worker and releases GPU resources. No main-thread prediction or SAB is included.
- The lift regression initially exposed vertical sinking with position-based
  prescribed motion. Velocity-based kinematic motion supplies current support
  velocity before the character query; the engine then carries the character
  through ascent/descent without bridge/platform-name movement rules. The test
  follows a full cycle; rotating supports and departure momentum are unqualified.
- Five native backend tests cover bidirectional ramp/section traversal, lower
  passage and slab undersides, lift carry, far-end kilometre support and bounded
  loose objects, and dynamic falling/rest. These plus existing clock/channel tests
  pass (24 tests). Browser/server/Worker-package TypeScript checks and focused lint
  pass. All six existing streaming readiness scenarios pass with zero missing data
  or final incomplete caches; this is regression readiness, not a speed comparison.
- [Accelerated Node/WASM measurements](../benchmarks/189-physics-prototype.json)
  record six 600-step lanes after 180 warmup steps on Apple M4 Pro. Empty-scene
  measured step p95 is approximately 0.03–0.11 ms; 128 initially spawned loose
  objects measure approximately 0.60–0.77 ms. Counts change as objects leave the
  bounded floor. These exclude Worker/publication, rendering, AI, persistence and
  WASM initialization; constructor timings exclude library initialization. They
  establish no game speedup or Chromebook deadline result. The UI reports sampled
  backend step p95 and RAF callback interval p95, not GPU execution time.
- Final qualification: production build and focused full-Chromium browser boundary
  pass. The browser exercises real keyboard ramp traversal, underpass teleport
  delivery and movement, pointer-captured touch controls, kilometre bridge culling
  at both ends, object spawn, controller movement/menu confirm/back, pause/resume
  and Worker teardown. The first run exposed a test reading the previous pose
  immediately after teleport; the check now waits for authority's new position.
  No production code change was needed for that test correction.
- Fresh inventories render/verify 2,119 Workshop candidates in normal Chromium at
  retina scale. The new candidate is explicitly excluded from immutable art
  approvals. Existing dirty gameplay edits account for other refreshed runtime
  fingerprints; no asset bank is regenerated. Production bundles the experimental
  Worker as a lazy 4.34 MB uncompressed asset, not part of normal gameplay execution.
- Desktop browser capture after selecting the 1,024 m bridge: 11/1,028 visible
  static pieces and 21 draws near the entrance, about 60 FPS with roughly 16.7 ms
  callback p95. This is one schematic view, not sustained GPU timing, a matched
  production comparison or a Chromebook result. Both ends pass the under-60 draw
  count assertion. The existing renderer's resource policies remain unchanged.
- The public development origin was checked to serve the current page and
  velocity-based support source before handoff. Normal game worlds, authority and
  existing renderer keep their current physics.

## Boundaries and next work

The diagnostic viewport culls static pieces with their geometric bounds; every
collider and render mesh remains resident. No kilometre-sized raster surface is
allocated, but memory/build/culling traversal still grow with total structure size.
Production chunk residency, edited-section invalidation and integration with the
existing sprite/mesh renderer remain separate acceptance work.

The next slice is a nearby client collision world with acknowledged input replay
and moving-contact corrections. Qualify that in this backend host before deciding
how it plugs into Realm/ScenarioSession. Real multiplayer, production animal AI,
vehicle dynamics, durable saves, terrain excavation and Chromebook measurements
have not been established by this prototype.
