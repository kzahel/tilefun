# Rendering architecture and backend separation

Topic: rendering-architecture
Status: target agreed; incremental extraction behind the working Canvas2D renderer.
Updated: 2026-10-03.

Owns renderer boundaries and resource/frame lifetime contracts. The
[performance topic](performance.md) owns timing and allocation evidence;
[Tactical 013](../tactical/013-renderer-boundary-and-allocation-audit.md) records
the original audit and completed allocation work. The [client/server architecture](../client-server-architecture.md)
continues to own authority and prediction.

## Desired architecture

```text
Worker simulation → replicated world + client prediction
                              ↓ read-only presentation inputs
                  frame builder + static content updates
                              ↓ ordered data + resource identities
                      renderer backend and resources
                       Canvas2D now / GPU backend later
```

World chunks contain tile grids and content versions, never canvases or GPU
objects. Presentation code computes interpolation, culling and depth ordering;
it does not advance simulation. The backend owns image/texture/buffer allocation,
partial preparation, upload, eviction, resize, recovery and teardown. Multiple
renderers must be able to view one world without consuming each other's dirty
flags or sharing backend resources.

Scene data identifies resources, source rectangles and world-space geometry.
It must not embed canvas/image objects or draw callbacks. Asset metadata (stable
IDs, dimensions and sprite regions) is separate from the backend's loaded images.
The eventual frame interface covers terrain, ground shadows, ordered actors/
elevation/grass/particles, indoor wall/furniture interleaving, and editor/overlay
phases. Gameplay, editor, explorer and review tools share these contracts.

Static grids and descriptors update on content changes. Camera movement changes
view/transforms and dynamic instances; it must not regenerate static tile grids.
Use reusable frame storage with explicit synchronous borrowing today. An async
backend must copy data or acknowledge buffer ownership before reuse. Resource
IDs must not alias after eviction, realm changes or backend replacement.

A GPU backend should accept batches and retain buffers, updating changed ranges.
Avoid a generic wrapper around every Canvas call. Rust/WASM execution and graphics
API selection are independent later decisions; neither is required for these
boundaries. Keep the Canvas implementation working through every slice.

## Invalidation and visual invariants

- Distinguish replicated edit revision from local visual-content invalidation.
  Snapshot application, derived autotiling and editor updates invalidate all
  observing renderers without a renderer writing back into world data.
- Track chunk identity and placement plus content versions. Replacing a chunk at
  equal revision must discard its old partial work and resource identity.
- Asset/atlas/variant changes explicitly invalidate backend terrain resources.
- Preserve old completed imagery while replacements build, visible-hole priority,
  preparation deadlines/row caps, and bounded residency. Eviction affects only
  the owning renderer.
- Preserve equal-depth ordering, nearest-neighbor sampling, shadows, clipping,
  tile seams, multipart sprites and indoor actor/wall occlusion. Exact approved
  art stays immutable; a refactor must not silently create new review pixels.

## Implementation sequence

1. Move completed terrain resources out of `Chunk`; retain preparation jobs in
   the renderer. Replace shared backend dirtiness with visual-content versions.
   Migrate readiness diagnostics and explorer lifecycle to renderer APIs.
2. Replace elevation canvases with opaque resource handles resolved only by the
   Canvas backend. Give scene collection a small backend-neutral terrain input.
3. Cache static elevation descriptors by chunk identity/content and placement,
   while binding the current resource at collection time. Verify replacement,
   eviction and realm transitions cannot retain stale canvases.
4. Introduce the complete frame/backend interface and asset metadata catalog,
   including indoor and overlay phases. Remove concrete renderer/Canvas access
   from gameplay presentation orchestration in bounded follow-up slices.
5. Only then prototype a second backend against measured workloads, comparing
   crossings/copies, startup, memory, device recovery and frame presentation.

## Acceptance and evidence

Run typechecks, unit tests, lint, catalog/manifest regeneration, production build,
full browser checks and streaming readiness. Add ownership/invalidation tests
for independent renderers, equal-revision replacement, partial-build restart,
asset changes, eviction, stale handles and reset. Use the existing bundled
Chromium runners and immutable review references; no new reference approvals
are implied by a refactor.

Current implementation still exposes Canvas in `GameContext`, `Spritesheet` and
indoor callbacks. These are explicit remaining boundaries, not a claim that the
production renderer is already interchangeable.
