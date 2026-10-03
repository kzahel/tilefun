# Rendering architecture and backend separation

Topic: rendering-architecture
Status: terrain ownership, neutral elevation handles and static descriptors extracted;
complete frame/backend and asset interfaces are being implemented under the activated end-to-end plan.
Updated: 2026-10-03.

Owns renderer boundaries and resource/frame lifetime contracts. The
[performance topic](performance.md) owns timing and allocation evidence;
[Tactical 013](../tactical/013-renderer-boundary-and-allocation-audit.md) records
the original audit and completed allocation work. The [client/server architecture](../client-server-architecture.md)
continues to own authority and prediction.
[Parent Tactical 022](../tactical/022-renderer-backend-decoupling.md) tracks the
remaining milestones, activation, just-in-time slice planning and completion gates.

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

1. **Complete:** move completed terrain resources out of `Chunk`; retain preparation jobs in
   the renderer. Replace shared backend dirtiness with visual-content versions.
   Migrate readiness diagnostics and explorer lifecycle to renderer APIs.
2. **Complete:** replace elevation canvases with opaque resource handles resolved only by the
   Canvas backend. Give scene collection a small backend-neutral terrain input.
3. **Complete:** cache static elevation descriptors by chunk identity/content and placement,
   while binding the current resource at collection time. Verify replacement,
   eviction and realm transitions cannot retain stale canvases.
4. **Next:** introduce the complete frame/backend interface and asset metadata catalog,
   including indoor and overlay phases. Remove concrete renderer/Canvas access
   from gameplay presentation orchestration in bounded follow-up slices.
   [Parent Tactical 022](../tactical/022-renderer-backend-decoupling.md) owns their
   sequencing and progress; implementation is active, beginning with asset metadata.
5. Only then prototype a second backend against measured workloads, comparing
   crossings/copies, startup, memory, device recovery and frame presentation.

## Acceptance and evidence

Run typechecks, unit tests, lint, catalog/manifest regeneration, production build,
full browser checks and streaming readiness. Add ownership/invalidation tests
for independent renderers, equal-revision replacement, partial-build restart,
asset changes, eviction, stale handles and reset. Use the existing bundled
Chromium runners and immutable review references; no new reference approvals
are implied by a refactor.

`GameContext` now exposes a neutral renderer and asset catalog. Its Canvas context
is explicitly an independent HUD/touch/debug UI surface supplied by the platform
host. `Spritesheet` is a Canvas resource wrapper with separate neutral metadata.
Indoor actor callbacks have been removed. These are explicit remaining boundaries, not a claim that the
production renderer is already interchangeable.

## Completed slice: terrain resource ownership

`CanvasTerrainResources` owns completed imagery; `TileRenderer` owns progressive
jobs, scheduling and lifecycle. `Chunk` has no canvas or backend dirty flag.
`visualRevision`/`invalidateVisuals()` records coherent local visual changes;
replicated `revision` remains the network/edit version. Snapshot, autotile and
editor writers invalidate content, and renderers never acknowledge by mutating
chunks. Renderer configuration setters invalidate asset-dependent imagery;
call `invalidateAssets()` after in-place image/atlas replacement.

Explorer disposal/eviction and readiness probes now use renderer APIs. Both
preparation and fallback drawing bound completed surfaces; a same-coordinate
replacement cannot accumulate historical chunk objects. Tests cover independent
renderers, equal-revision derived changes, asset changes during a partial build,
and fallback eviction. The following handle slice removes the elevation canvas reference and concrete
scene-collector dependency. Integrated visual/traversal evidence is linked in
the static-descriptor section below.

## Completed slice: backend-neutral elevation handles

`TerrainPresentation` is the scene collector's narrow terrain input; collection
no longer imports concrete `TileRenderer`. `SceneItem` contains no Canvas types.
Elevation records carry a `TerrainResourceId`, and `CanvasTerrainSource` resolves
it only in `drawScene2D`. Gameplay, explorer, geometry review, district
review and traffic playground pass their own renderer's resolver.

Publishing replacement imagery retires the prior handle. IDs are never reused
across renderer instances or clears during the runtime; a stale/cross-backend
handle resolves to nothing, never another image. Asset invalidation leaves the
old completed handle usable during catch-up, then publication replaces it.
Frames must be consumed synchronously before preparation/eviction/reset; handles
are transient presentation references, not saved-world IDs. Tests cover actual
Canvas source rectangles, stale-handle skipping and independent renderer IDs.


## Completed slice: static elevation descriptors

`ElevationDescriptorCache` accepts world data and a resource-ID lookup, with no
Canvas dependency. It caches immutable surface/cliff descriptors using weak chunk
identity, edit/visual versions and placement. Empty chunks are cached too.
Camera movement reuses geometry; a resource change binds new immutable records
without rebuilding geometry or changing previously returned records. Collection
still returns an independently owned list in the original tile/phase order.

No cached descriptor holds a canvas or a strong chunk reference. Backend eviction
invalidates handles, a missing resource emits no elevation, and renderer reset
also clears the descriptor cache. Coordinate changes cannot bind imagery from
the old placement. Low-level grid writers must invalidate completed visual
updates, as before for terrain. This does not add an asynchronous frame lifetime;
old handle-bearing frames remain transient synchronous data.

Detailed allocation and integrated validation evidence is recorded in
[Tactical 013](../tactical/013-renderer-boundary-and-allocation-audit.md#implementation-record-renderer-resource-boundaries).
The next architectural slice should define the full frame/backend interface,
starting with outdoor terrain/scene/editor phases and then replacing indoor draw
callbacks with ordered data. Pair this with a backend-independent sprite metadata
catalog; keep the current Canvas implementation as the reference renderer.

## Sprite metadata prerequisite

`SpriteCatalog` exposes immutable dimensions and tile-region geometry without
images or drawing methods. Canvas `Spritesheet` owns the loaded image and uses
that metadata for source rectangles. GameClient projects the catalog once after
asset loading, including procedural sprites; resource replacement must refresh
the catalog. Gameplay availability checks now use metadata. Concrete sheet access
for drawing remains until the frame/backend consumer migration.

## Outdoor frame submission

`RenderBackend` accepts data-only view parameters and semantic `RenderPass`
batches. Production outdoor rendering submits clear, prepared terrain placements
and explicitly ordered scene entries. `collectSceneOrder` owns ground/elevated
shadow sequencing; the Canvas backend only consumes it. Terrain placement buffers
are borrowed synchronously with a bounded record pool, and partial terrain handles
retire on restart/replacement/publication/reset. [029](../tactical/029-outdoor-frame-contract.md)
records ownership tests, unchanged review identities and traversal coverage.

Editor overlays now use explicit pooled geometry through the same backend;
[030](../tactical/030-editor-overlay-data.md) records parity with all original
brush, preview and remote-cursor drawing operations. Indoor frames now use
the same submission interface, as described below. Terrain placement
selection currently lives with the concrete cache and must become shared
presentation policy during final boundary cleanup. `GameContext` no longer exposes concrete terrain renderers or sheets; independent
UI/debug rendering has an explicit platform-owned context.

## Indoor frame data

`InteriorPresentation` owns furniture/support and wall/actor ordering. It emits
floor, wall-band, furniture, shadow and actor commands with scalar source/destination
geometry. Its room-content identity changes with compiled room content, while
camera motion and actor motion reuse static content. Each client's `SceneFrame`
owns the presentation cache; release drops dynamic actor references. There is no
module-global gameplay renderer or per-actor draw callback.

`CanvasInteriorResources` rasterizes the static shell/bands and consumes that
order. Backend reset and asset replacement discard the room cache; independent
backends never share room surfaces. `FurnitureLayout` and `LayeredInteriorMap`
are neutral modules; raster functions live in `CanvasInteriorMap`. Native Canvas
review/uncached reference adapters still exist and share these rules.
[031](../tactical/031-interior-frame-data.md) records exact room pixel parity,
resource ownership tests and ordinary/edited-room movement evidence.

## Platform host and lifecycle

`GameClientOptions.renderHostFactory` selects a `RenderHost`: neutral backend,
independent UI context, asset setup, resize, frame-start UI clearing and disposal.
Canvas is the default implementation; gameplay orchestration does not construct
or configure TileRenderer. A GPU host can supply a separate UI overlay without
changing physics, editing or presentation rules.

`RenderBackend` exposes readiness, diagnostics, resource invalidation, resize,
recovery and disposal. Resize keeps native static caches. Asset invalidation
keeps completed terrain fallback while replacement builds; recovery/reset clears
terrain and rooms. Disposal is idempotent, rejects further rendering/preparation
and drops source references without closing images borrowed from another owner.
[032](../tactical/032-renderer-host-lifecycle.md) records lifecycle and integration
validation. Explorer/native reference composition remains the next migration.

## Shared terrain placement and remaining consumers

`TerrainFrame` computes culling, rounding, seam overscan and placements from a
plain view and resource-ID lookup. Canvas and recording backends share that
policy. Terrain preparation is separate: gameplay uses the existing bounded halo
scheduler; explorer/native composition can request visible-only row budgets.
Explorer scene clipping is a list of rectangles in logical viewport pixels.
Canvas composition preserves the host transform, including explorer DPR.

All active outdoor consumers now submit semantic passes. Native character review
retains its source-hashed controller and calls a Canvas reference adapter that
consumes the same scene-pass schema. Room reference drawing and pattern room
atlas previews remain explicitly native Canvas compositions. Additive decoded
sprite updates refresh metadata without rebuilding terrain; replacing an existing
source must use full invalidation. Borrowed source images remain owned by the
asset loader, and backend disposal releases its references without closing them.
See [033](../tactical/033-shared-terrain-and-consumers.md) for parity and allocation
validation. The remaining step is obsolete API removal and integrated boundary proof.
