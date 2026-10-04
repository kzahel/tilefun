# Rendering architecture and backend separation

Topic: rendering-architecture
Status: complete backend/presentation separation, recording proof and integrated
desktop/Android validation delivered; isolated car projection experiment delivered;
Canvas2D remains production.
Updated: 2026-10-04.

Owns renderer boundaries and resource/frame lifetimes. [Performance](performance.md)
owns timing and allocation evidence; [client/server architecture](../client-server-architecture.md)
owns authority and prediction. [Parent 022](../tactical/022-renderer-backend-decoupling.md)
tracks this refactor and its completion gates.

## Architecture

```text
Worker simulation → replicated world + client prediction
                              ↓ read-only presentation inputs
                  frame builder + static content updates
                              ↓ ordered data + resource identities
                      renderer backend and resources
                       Canvas2D now / GPU backend later
```

World chunks contain tile grids and content versions, never graphics resources.
Presentation computes interpolation, visibility and ordering without advancing
simulation. `RenderBackend` receives plain view values and semantic passes:
clear, terrain placements, ordered scene bodies/shadows, indoor commands and
editor overlay geometry. It owns preparation, resource lookup, invalidation,
eviction, resize, recovery and teardown. It does not decide depth/shadow order.

`GameClientOptions.renderHostFactory` is the production selection point.
`RenderHost` supplies the backend, asset configuration, viewport lifecycle and an
independent HUD/touch/debug context. Canvas2D remains the default. A GPU host can
supply a separate UI overlay without changing physics, generation, editing or
presentation policy. GameClient asset loading, procedural sprite creation and
platform input/UI wiring remain application composition responsibilities.

## Data and resource contracts

- `SpriteCatalog` exposes immutable image/tile dimensions and sprite-region
  geometry without loaded images or draw methods. Stable sheet keys connect
  scene data to backend assets. Canvas `Spritesheet` wraps decoded sources.
- `TerrainFrame` computes culling, pixel rounding and seam overscan from scalar
  view data and a resource-ID lookup. Camera-only movement reuses prepared
  resources and a bounded placement pool. Canvas and the recording backend use
  the same builder.
- `collectScene`, `collectSceneOrder`, grass frames and prop-depth metadata own
  outdoor interpolation, visibility and shadow/body ordering. Ground shadows
  precede bodies; elevated shadows immediately precede their associated body.
- `ElevationDescriptorCache` caches static geometry by weak chunk identity,
  placement and edit/visual revisions. Binding a new resource creates new
  immutable records, leaving prior records unchanged. Empty chunks are cached.
- `InteriorPresentation` owns floor/furniture/support/wall/actor ordering and
  emits scalar layer, source/destination and actor commands. Static content has
  a separate identity; camera and actor movement reuse it. No actor draw
  callbacks cross the interface. `CanvasInteriorResources` owns raster shells
  and wall bands and consumes the supplied order.
- `OverlayFrame` and `collectEditorOverlay` emit pooled geometry with explicit
  style values. Scene clips are rectangle lists in logical viewport pixels.
  The Canvas implementation preserves the host transform, including explorer DPR.

Frames are **borrowed synchronously until submission returns**. Preparation,
eviction, reset and buffer reuse must not overlap consumption. A retaining or
asynchronous GPU backend must copy data or add explicit ownership acknowledgment
before using it beyond that lifetime. Resource IDs are transient presentation
references, never saved-world IDs. Released IDs must never resolve to new images;
Canvas IDs are process-local, monotonic and unique across backend instances.

Decoded source images are borrowed from the platform asset loader. Each backend
owns its derived terrain/room surfaces (or future textures/buffers) and references
to those sources. Disposal drops those references without closing another owner's
images. Additive sprite arrival refreshes metadata without rebuilding unchanged
terrain; replacing an existing source uses full invalidation. In-place image
changes require explicit invalidation.

## Invalidation and lifecycle

Replicated `revision` and local `visualRevision` are distinct. Snapshot application,
autotiling and coherent editor updates invalidate content; renderers never consume
a shared dirty flag or write acknowledgment into chunks. Identity and placement
matter even when a replacement chunk has the same numeric revision.

Partial builds are usable only while identity, content and asset revisions match.
Restart, replacement, publication, eviction and reset retire partial handles.
Completed old imagery remains a fallback during a rebuild; `isTerrainReady`
requires current revisions, while completed-only placement can use that fallback.
Publishing new imagery retires the old completed handle. Resource caches and
progressive jobs belong to one backend; another view of the same world is independent.

Normal gameplay retains its existing bounded halo preparation, visible-hole
priority and time/row budgets. Explorer and native review request explicit
visible-only row budgets. Viewport resize preserves native static caches. Realm
reset and context recovery clear terrain and rooms; context restoration triggers
recovery through the Canvas host. Disposal is idempotent, detaches host listeners
and rejects further rendering/preparation. Scene-frame release drops actor,
particle, prop and overlay references; retained pools have explicit bounds.

## Consumer and platform dependency inventory

| Surface | Boundary / intentional graphics dependency |
| --- | --- |
| Play/edit outdoor and indoor rendering | Neutral `renderWorld`, `renderInterior`, scene and overlay builders; `RenderBackend` only |
| Explorer | Canvas selected in `TilePreview` composition; explicit preparation/submission, ready-chunk clips and lifecycle |
| Traffic, outdoor geometry, building/street/district reviews | Canvas selected at each platform entry; shared semantic scene/terrain passes; separate stage/geometry diagnostics remain native |
| Native character review | Source-hashed `CharacterTestScene.ts` is immutable approval input. Its `drawScene2D` reference adapter consumes the same scene-pass implementation; do not rewrite approved controller bytes merely to rename a call |
| Indoor review/reference and furniture playtest | Explicit native Canvas surfaces using shared furniture/room ordering. `CachedInteriorRenderer` consumes `InteriorPresentation`; uncached drawing remains the independent parity reference |
| Pattern room/atlas previews and tree source composition | Native asset/pattern reference rasterization, separate from gameplay presentation; pattern terrain uses the backend |
| HUD, touch controls, menus, prop selection/collision diagnostics | Independent platform UI/debug surface; Canvas is permitted here and not exposed to neutral frame builders |
| Optional Three.js diagnostics | Separate debug renderer, dynamically selected outside gameplay presentation |
| Asset loaders and `Canvas*` / `TileRenderer` internals | Concrete source decoding, rasterization and resource ownership; not presentation policy |

`TileRenderer` is now an internal Canvas terrain preparation/resource component.
The old combined terrain draw API and furniture metadata re-export aliases are
removed. The small native reference adapters above are permanent, explicit
composition choices, not hidden alternative gameplay pipelines.

## Evidence and limits

[034](../tactical/034-renderer-completion.md) owns final integrated evidence.
The recording backend runs the actual outdoor/editor/indoor entry points with no
Canvas context, using shared terrain/elevation builders. It checks data-only
submissions, synchronous copying/release, static reuse, independent handles,
content/asset replacement, realm recovery and unchanged simulation inputs.
Dependency tests guard concrete graphics imports/types in neutral modules and
keep backend selection in platform composition.

Earlier delivery evidence:

- [013](../tactical/013-renderer-boundary-and-allocation-audit.md): terrain ownership,
  neutral handles and static elevation descriptors.
- [028](../tactical/028-sprite-metadata.md): independent metadata catalog.
- [029](../tactical/029-outdoor-frame-contract.md) and
  [030](../tactical/030-editor-overlay-data.md): outdoor semantic passes and exact
  effective-operation parity for 16 editor cases.
- [031](../tactical/031-interior-frame-data.md): indoor commands and 81 exact room
  pixel hashes, including wall crossings and edited-room gameplay.
- [032](../tactical/032-renderer-host-lifecycle.md): host injection and lifecycle.
- [033](../tactical/033-shared-terrain-and-consumers.md): remaining consumers,
  unchanged review identities and lower allocation for matched terrain placement.

A recording backend proves the data boundary, not GPU raster parity or performance.
No Rust/WASM/WebGPU engine has been implemented. Intermittent phone hitches and
cold-entry presentation remain separate measured performance work.

## 3D assets and current GPU experiments

[3D assets](3d-assets.md) now owns the car reconstruction workstream, including
037/038 evidence, the unresolved top-view appearance and model-assisted options.
The car lab and `ThreeDebugRenderer` already use GPU-accelerated Three.js/WebGL;
neither is a gameplay backend. The [research record](../research/sprite-to-3d-and-renderer-options.md)
compares Three.js, WebGPU, Rust/wgpu and a full-engine migration.

Backend independence is delivered; general 3D presentation is not. `RenderView`
contains x/y/zoom and viewport dimensions, terrain placements are screen-space,
and scene passes preserve the current body/shadow ordering. Mesh/material
instances, a 3D camera and world-space terrain need an additional neutral contract.
Do not derive a 3D world from screen rectangles or move Three.js objects into
simulation. Keep presentation inputs read-only and physical proxies independent
from visual meshes. Existing height-aware physics can remain while that is tested.

## Open engine checkpoints

These are proposed follow-ups, not unfinished gates in the completed 022 refactor.
Plan the next slice just in time; no GPU backend or Rust port is selected for
production by this document.

| ID | State | Next evidence / decision |
| --- | --- | --- |
| G1 | Open | Bounded GPU terrain/sprite backend behind `RenderHost`; preserve Canvas reference and compare existing presentation behavior |
| G2 | Proposed | Portable mesh/material import and explicit world axes/units/origin; consume the car candidate from the 3D asset workstream |
| G3 | Proposed | Neutral world-space scene and camera data feeding a shared-world 3D lab: ground, car, prop and actor; retain Worker authority and browser UI |
| G4 | Proposed | Depth/cutout/transparent ordering, fallback sprites, elevation, indoors, picking, streamed edits and resource residency/lifecycle |
| G5 | Proposed | Matched device measurements of frame pacing, allocations, uploads, memory, cold start and graphics loss/recovery; choose backend based on evidence |
| G6 | Later | Broader asset/world coverage and first-person interaction/content; consider Rust/wgpu only with a concrete measured or platform reason |

G1 can proceed independently of reconstructing convincing 3D assets. G2/G3 make
those assets renderable in shared-world context; they do not require completing
a production replacement first. Existing DOM and independent Canvas UI/debug
surfaces can stay across browser rendering experiments.

Recommended implementation route: use the existing TypeScript/Three.js stack for
the first portable-asset and world-view experiments, then compare WebGPU and
WebGL2 in a bounded test. Graphics API, execution language and simulation engine
are separate decisions. A backend swap alone neither guarantees a performance
improvement nor supplies hidden artwork or first-person-ready world geometry.
