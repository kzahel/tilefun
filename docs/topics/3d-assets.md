# 3D assets and sprite reconstruction

Topic: 3d-assets
Status: car projection and orthographic inspection delivered; top-view appearance
unresolved. Optional fixed-view GPU gameplay integration is delivered; model-assisted reconstruction remains proposed.
Updated: 2026-10-04.

Owns reconstructing coherent visual assets from sprite artwork, their relationship
to physical proxies, and cross-view quality. [Rendering architecture](rendering-architecture.md)
owns engine interfaces and GPU integration; [performance](performance.md) owns
measurements. [Research and investigations](../research/sprite-to-3d-and-renderer-options.md)
records the experiments, external options and their limits.

## Desired outcome

An asset can have a coherent visual mesh, explicit texture coverage and a separate
physical proxy, all aligned to the same world origin and scale. The normal game
can retain its sprite presentation while an experimental view shows the same
world from orthographic or perspective cameras. Later, sufficiently complete
assets could support a fully 3D presentation, including first person.

The immediate integration target keeps the current fixed game projection and
allows individual entities to use meshes with continuous orientation. Sprites
remain the fallback. The [sprite/mesh invariants](rendering-architecture.md#fixed-view-spritemesh-invariants)
own identity, transform, composition and lifecycle rules for that shared path;
asset tools must consume its common implementation rather than fork it.

This is a direction, not a claim that all sprites have recoverable hidden surfaces
or that changing the renderer alone makes the world ready for first person.

## Current experiment and findings

[Car projection lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/car-projection)
maps one approved compact-car image onto authored low-poly geometry using Three.js
WebGL. Orbit, source, side/top orthographic and perspective views expose the shape;
wireframe, collision bounds and checker faces expose assumptions. This already
uses GPU-rendered textured geometry. It is separate from the gameplay backend.

- [037](../tactical/037-car-projection-experiment.md), commit `1ce41f7`, delivered
  the fixed source projection, visual shell and inspection tool.
- [038](../tactical/038-car-proxy-orthographic-checks.md), commit `cc6b362`, added
  exact orthographic presets, grounded the tire artwork, made upper faces edge-on
  in side view and filled transparent top-edge gaps with a derived texture.
- GPU checks match all 1,809 painted source pixels within one color level, with
  182 additional edge pixels; top occupancy is 1,152/1,152, side has zero visible
  top-face fragments, both tires contact the ground and no pixels extend below it.
- **The user subsequently found the top view unacceptable.** Coverage, contact and
  source registration checks passed, but stretched outlines and oblique texture
  distortion remain. These checks are necessary diagnostics, not a reconstruction
  quality gate. No acceptable all-angle car has been established.
- Wheels are still painted onto the side, hidden faces remain checker surfaces,
  and only one directional image constrains the current fit. No image-to-3D model
  has been run or evaluated on this asset.

The visual roof is 21 world pixels high; the approved collision proxy remains
56 × 20 × 24. Their disagreement is visible and intentional pending a separate
geometry decision. The experiment is registered but excluded from approval;
arbitrary orbit output is not an immutable review snapshot.

## Contracts and decisions

- Keep original sprites, promoted banks and physical metadata immutable. New
  mesh/texture outputs are candidates with provenance, not automatic replacements.
- Use world-pixel X/ground-Y/height-Z coordinates internally. Convert axes/units
  explicitly at import/export; record ground origin, forward direction and scale.
- Keep render geometry separate from collision/support geometry. Existing bounds
  provide alignment and physical constraints, not a requirement that every visual
  vertex fit inside an approximate collision box.
- Track which faces use observed artwork, rectified artwork or inferred/generated
  artwork. A generated top view is a hypothesis, not another independent source.
- Do generation and mesh preparation offline. Runtime consumption should use
  portable meshes/textures and metadata, without a generation-service dependency.
- A proposed asset record should identify source hashes/crops, mesh/material
  resources, transforms, visual bounds and separate physical/contact metadata.
  Start with the car; defer a general schema until two consumers exercise it.
- Preserve Canvas gameplay and source-art reference rendering while experimenting.
  Human acceptance of changed artwork remains governed by [art review](art-review.md).

## Tracking and next checkpoints

These are proposed checkpoints, not an authorized unattended implementation plan.
Plan each implementation slice in a new tactical when it is taken up.

| ID | State | Checkpoint and evidence needed |
| --- | --- | --- |
| A1 | Done | Single-view projection and orthographic inspection; evidence in 037/038 |
| A2 | Open | Assemble original directional crops, actual facing labels, source-camera assumptions, wheel/roof/hood landmarks and physical bounds; identify inconsistent sprite views |
| A3 | Proposed | Compare authored geometry/rectified UVs, image-generated geometry, and authored geometry with generated textures on the same car |
| A4 | Proposed | Evaluate fixed source/front/back/side/top and oblique views; inspect wheel volume, roof/hood layout, seams, ground contact and unknown surfaces; record human judgment alongside metrics |
| A5 | Proposed | Export/import the chosen candidate as a portable asset with provenance and explicit axis/scale conversion; establish bounded triangle/texture budgets from device evidence |
| A6 | Diagnostic implementation delivered in 039–045 | Render the asset as an optional mesh body under the unchanged game projection, with continuous visual heading and a sprite fallback; engine work is tracked in the rendering topic |
| A7 | Later | Test a second asset class before generalizing authoring, animation or batch generation; first-person coverage remains a later scope |

Recommended next slice: A2 plus a fixed-camera comparison harness. It makes the
three reconstruction approaches comparable without treating the current bad top
view as training truth. Provider selection, execution cost and output quality are
still open; custom training is not the starting assumption.

## Implementation pointers

- [`CarProxy.ts`](../../src/projection/CarProxy.ts): neutral mesh and pinned source projection.
- [`ProxyTexture.ts`](../../src/projection/ProxyTexture.ts): derived top-edge extension.
- [`CarProxyScene.ts`](../../src/projection/CarProxyScene.ts): Three.js adapter and GPU lifecycle.
- [3D physics](../3D-PHYSICS-DESIGN.md): existing height/support/collision semantics.
- [Research](../research/sprite-to-3d-and-renderer-options.md): model capabilities,
  comparison protocol and renderer decision matrix.


The optional `?renderer=gpu&meshes` path and renderer comparison tool now share
`CarMeshAsset`, asset registration and isolated body depth. Continuous yaw plus
diagnostic pitch/roll work under the unchanged game projection. This does not
resolve A2–A5: the proxy still has flat wheels, incomplete hidden surfaces and
unacceptable top-view artwork. No candidate has been promoted by this integration.
