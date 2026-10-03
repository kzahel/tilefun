# 032 — Renderer composition and lifecycle

Status: delivered. Parent: [022](022-renderer-backend-decoupling.md), R3/R4.
Depends on [031](031-interior-frame-data.md).

## Inspected scope

`GameClient` constructs a TileRenderer, configures its image sources and exposes
it and loaded sheets through `GameContext`. World/editor/indoor rendering now
uses neutral passes, but PropEditorScene still draws images directly. Runtime
readiness/diagnostic scripts also address the concrete terrain renderer.

Move creation/configuration into a platform render host factory. The gameplay
client accepts an injected factory and consumes `RenderBackend` plus a separate
UI surface supplied by that host. Canvas remains the default host. Remove
concrete terrain/sheet access from GameContext, move prop-preview imagery to
neutral submissions, and isolate optional Canvas/Three debug rendering from
world presentation orchestration. Existing HUD/chat/touch/debug drawing remains
explicit UI composition; another host may provide a separate UI overlay surface.

Complete backend readiness, resource diagnostics, resize, asset invalidation,
context recovery and idempotent disposal contracts. Realm resets clear both room
and terrain resources. Update diagnostic runners to use the shared interface;
keep their existing workload/coverage semantics. Asset decoding/configuration is
platform composition, never frame data. Backend disposal must not close borrowed
source images still used by another owner.

## Acceptance and validation

Exercise resize without unnecessary static rebuilds, asset invalidation, context
recovery, disposal, independent instances and resource counts. Verify an injected
recording host can be selected without changing world/gameplay code. Remove
obsolete fields from the gameplay context rather than leaving aliases. Run all
required unit/type/lint/build/browser checks and streaming readiness, regenerate
inventories, and preserve existing review identities. Explorer and review
composition migration is the following R4 child; do not mark all R4 complete here.

## Evidence

Typechecks, all 1,414 unit tests, lint (existing warnings), catalog/manifest,
production build and all 293 browser tests pass. All 551 candidate records are
unchanged. [Traversal readiness](../benchmarks/032-renderer-host.json) passes
for v4/v10 walk, sprint and reverse with zero missing/unfinished visible frames.

GameClient accepts `renderHostFactory`; Canvas creation/asset setup/context events
live in `CanvasRenderHost`. `GameContext` exposes a neutral renderer/catalog,
not TileRenderer or loaded sheets. Prop-preview sprites use geometry submission.
Optional debug drawing moved out of world orchestration. The independent HUD,
touch and debug UI context is an explicit host surface; a future GPU host can
supply a separate overlay and clear it in `beginFrame`.

Tests cover resize preserving resources, fallback imagery during invalidation,
recovery retiring handles, disposal rejecting new work, listener detachment and
borrowed source-image lifetime. Runtime diagnostics and benchmark overrides now
use the backend interface without changing workload definitions. Remaining R4
work is shared terrain placement and explorer/reference composition in 033.
