# 037 — Car artwork on an orbitable 3D proxy

Status: complete, 2026-10-04. Owners: [rendering architecture](../topics/rendering-architecture.md),
[vehicles](../topics/vehicles.md).

The user authorized a car experiment: define proxy geometry, project existing
sprite artwork onto it, orbit with perspective, and inspect collision volumes.
This explores progressively adding unseen artwork toward a 3D presentation.

## Slice

Use one exact approved compact-car side view, with an explicit body-only crop to
exclude neighboring atlas pixels. Define a neutral, versioned visual proxy as
connected hood, windshield, roof, rear and side patches. Author patch depth in
world units and recover vertices from the fixed source projection. This preserves
source pixel registration while supplying actual 3D depth. Close unseen surfaces
with conspicuous checker material. Read the unchanged approved collision bounds
from the promoted bank; do not silently replace gameplay geometry with visual fit.

Use existing Three.js/WebGL in an isolated Workshop experiment with source-image,
source-camera, orbit/perspective, collision, wireframe and missing-surface controls.
Keep GPU code separate from neutral asset geometry. Do not expand RenderBackend
with a speculative complete 3D scene API or change the production renderer.
Register the experiment for zero-event discoverability, explicitly excluded from
approval/promotion because arbitrary GPU orbit pixels are not immutable snapshots.

## Validation

Unit checks: projection/inverse, finite nondegenerate geometry, shared seams,
source bounds and approved collision alignment. Browser checks in full Chromium:
real GPU pixels/source comparison, orbit changes, camera reset, toggles, touch
layout, context recovery and disposal on navigation. Inspect actual screenshots.
Run types, all units, lint, catalog then manifest, build and full browser suite.
Verify every existing candidate record is unchanged. Record actual source-match
coverage and limits; no speedup or complete 3D asset claim. Commit when complete.

## Delivered shape and evidence

- Neutral `CarProxy.ts` pins `vehicle:compact-1:east` and its original source hash,
  separates source-camera projection from viewing camera, and builds 18 connected
  quads (8 textured, 10 explicitly unpainted). The atlas body crop is
  `[96, 1176, 64, 40]`; the original approved rectangle and padded bank are untouched.
- `CarProxyScene.ts` is a standalone Three.js/WebGL adapter, with nearest-neighbor
  textures, perspective orbit and a fixed orthographic source camera. It owns and
  disposes its controls, resize observer, listeners, textures, materials, geometry
  and graphics context. There is no continuous animation loop. The full atlas is
  decoded at cold load; only the body crop becomes a GPU texture.
- Workshop provides camera presets/reset, collision and mesh overlays, unseen-face
  toggle, original pixels and a native-size GPU comparison. Its lazy tool entry
  adds no production rendering or simulation contract. The manifest registers one
  excluded experiment candidate; all 551 pre-existing records are exactly unchanged.
- Full Chromium GPU readback covers **1,809 / 1,809** painted source pixels and
  matches every RGBA value within one level, with **zero** extra pixels. Captures
  of source, perspective, far and low views were inspected. Desktop and 390px touch
  layouts were inspected; this is browser emulation, not an Android measurement.
- Forced context loss exposed a real restoration issue: the renderer's background
  clear state needed explicit reapplication. Recovery now restores the same pixels,
  including alpha. Navigation releases the context and re-entry creates a fresh
  scene. Browser tests also exercise pointer/touch orbit, camera reset, overlays
  and excluded-candidate routing.

## Final validation

`npm run typecheck`, `npm test` (**1,430 tests / 161 files**), `npm run check`,
`npm run art:catalog`, `npm run workshop:manifest`, `npm run build` and the full
`npx playwright test` (**288 passed**, six minutes) completed successfully.
Lint retains existing repository warnings; no new diagnostics remain. Manifest
generation verifies all 552 identities in full Chromium at retina scale; an
independent comparison against HEAD confirms all 551 existing candidate records
are unchanged. `workshop:inbox` discovers the new batch as one excluded experiment,
with zero approvals, changed candidates or requests written for it.

## Limits and next slice

This is an authored depth interpretation, not a reconstruction inferred uniquely
from pixels. The near wheels are painted into the side, the shell silhouette uses
alpha clipping, wheel ground contact is approximate, and hidden sides/ends/underside
lack artwork. Source lighting stays baked into the texture. The experimental
visual mesh and approved collision/support box intentionally remain separate;
there is no new collision behavior, general asset editor, WebGPU backend or
performance claim.

Fit this same car against additional existing directional views next, with explicit
face coverage and separate wheel geometry. Compare conflicting stylized views
before generating new artwork or generalizing the asset format. Production GPU
terrain/sprite benchmarking remains an independent renderer experiment.
