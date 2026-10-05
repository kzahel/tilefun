# Rendering architecture and backend separation

Topic: rendering-architecture
Status: complete backend/presentation separation, recording proof and integrated
desktop/Android validation delivered; optional WebGL2 gameplay backend and shared mesh-car presentation delivered;
Canvas2D remains the default pending performance/asset acceptance.
Updated: 2026-10-05.

Owns renderer boundaries and resource/frame lifetimes. [Performance](performance.md)
owns timing and allocation evidence; [client/server architecture](../client-server-architecture.md)
owns authority and prediction. [Parent 022](../tactical/022-renderer-backend-decoupling.md)
tracks this refactor and its completion gates.

[Embedded engine labs](embedded-engine-labs.md) owns game/lab integration parity.
Changes to shared presentation, assets, preparation or lifecycle must account for
embedded consumers as well as gameplay; shared backend imports alone are not
evidence of equivalent scheduling or resource behavior.

The optional fixed-view GPU renderer preserves existing sprite presentation
and can replace individual sprite bodies with meshes. Entity orientation may
vary continuously while the camera projection stays fixed. The following
invariants govern that extension; they remain requirements for further assets and backends.

## Architecture

Cutaways and level/sector visibility are part of the agreed
[world geometry direction](world-geometry.md#visibility-and-seamless-interiors),
including underground spaces and seamless indoor floor transitions. Shared
presentation should derive observer-specific visibility from physical space and
connection data; backends consume that result. Visibility selection must not
change simulation or collision. `SurfacePresentation` now supplies a bounded
schematic slab view and whole-patch cutaway, shared by outdoor game rendering and
the scenario host. `presentSurfaceScene` now orders individual sprites against
overlapping slabs at their own heights, so a lower train remains below a bridge
when the observer stands on it. General sector visibility, indoor transitions,
intersecting surfaces and arbitrary mesh/particle depth remain future work.

```text
Worker simulation → replicated world + client prediction
                              ↓ read-only presentation inputs
                  frame builder + static content updates
                              ↓ ordered data + resource identities
                      renderer backend and resources
                       Canvas2D default / optional WebGL2
```

World chunks contain tile grids and content versions, never graphics resources.
Presentation computes interpolation, visibility and ordering without advancing
simulation. `RenderBackend` receives plain view values and semantic passes:
clear, terrain placements, ordered scene bodies/shadows, indoor commands and
editor overlay geometry. It owns preparation, resource lookup, invalidation,
eviction, resize, recovery and teardown. It does not decide depth/shadow order.

`GameClientOptions.renderHostFactory` is the production selection point.
`RenderHost` supplies the backend, asset configuration, viewport lifecycle and an
independent HUD/touch/debug context. Canvas2D remains the default. The GPU host
supplies a separate UI overlay and composes it for feedback capture. This works
without changing physics, generation, editing or
presentation policy. GameClient asset loading, procedural sprite creation and
platform input/UI wiring remain application composition responsibilities.

`ScenarioPresentationHost` embeds the same render-host implementations for the
interactive labs. `PlayerPresentation`, `OutdoorPresentation` and `presentInterior`
share camera interpolation, terrain policy and room submission with gameplay. GPU hosts support an absolute world surface inside a positioned
lab wrapper, while the input/UI canvas stays in document flow. See
[embedded engine labs](embedded-engine-labs.md) for lifecycle and migration boundaries.

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
| Interactive Traffic, Outdoor Geometry, World Geometry, Character lab and furniture playtest | Shared `ScenarioPresentationHost`, production Canvas/GPU hosts and semantic scene/terrain/indoor passes; view-specific controls and diagnostics |
| Building/street/district reviews | Canvas reference presentation at platform entry; shared semantic scene/terrain passes; separate stage/geometry diagnostics remain native |
| Native character review | Source-hashed `CharacterTestScene.ts` is immutable approval input. Its `drawScene2D` reference adapter consumes the same scene-pass implementation; do not rewrite approved controller bytes merely to rename a call |
| Indoor review/reference | Explicit native Canvas surfaces using shared furniture/room ordering. `CachedInteriorRenderer` consumes `InteriorPresentation`; uncached drawing remains the independent parity reference |
| Pattern room/atlas previews and tree source composition | Native asset/pattern reference rasterization, separate from gameplay presentation; pattern terrain uses the backend |
| HUD, touch controls, menus, prop selection/collision diagnostics | Independent platform UI/debug surface; Canvas is permitted here and not exposed to neutral frame builders |
| Optional GPU gameplay and diagnostics | `?renderer=gpu` selects the shared raster backend; `&meshes` enables the diagnostic car; renderer lab shares its body adapter |
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
No Rust/WASM engine or WebGPU gameplay backend has been implemented. Intermittent phone hitches and
cold-entry presentation remain separate measured performance work.

## 3D assets and current GPU experiments

[3D assets](3d-assets.md) now owns the car reconstruction workstream, including
037/038 evidence, the unresolved top-view appearance and model-assisted options.
The car lab and `ThreeDebugRenderer` already use GPU-accelerated Three.js/WebGL;
the new GPU gameplay backend is separate from those retained diagnostic adapters. The [research record](../research/sprite-to-3d-and-renderer-options.md)
compares Three.js, WebGPU, Rust/wgpu and a full-engine migration.

Backend independence is delivered; general 3D presentation is not. `RenderView`
contains x/y/zoom and viewport dimensions, terrain placements are screen-space,
and scene passes preserve the current body/shadow ordering. Neutral mesh instances now carry asset identity and orientation. A freely moving
3D camera and world-space terrain still need additional contracts.
Do not derive a 3D world from screen rectangles or move Three.js objects into
simulation. Keep presentation inputs read-only and physical proxies independent
from visual meshes. Existing height-aware physics can remain while that is tested.

## Open engine checkpoints

[Parent 039](../tactical/039-fixed-view-gpu-parent.md) now tracks authorized
autonomous delivery of the six implementation slices. These are follow-ups,
not unfinished gates in the completed 022 refactor.
Plan the next slice just in time; no GPU backend or Rust port is selected for
production by this document.

| ID | State | Next evidence / decision |
| --- | --- | --- |
| G1 | Delivered, optional WebGL2 | Bounded GPU terrain/sprite backend behind `RenderHost`; preserve Canvas reference and compare existing presentation behavior |
| G2 | Diagnostic car delivered; general import later | Portable mesh/material import, sprite fallback and explicit world axes/units/origin; consume the car candidate from the 3D asset workstream |
| G3 | Fixed-view pose delivered | One shared presentation path with optional mesh bodies and full transforms; first prove continuous car heading under the unchanged fixed projection, then expose diagnostic cameras |
| G4 | Compatibility path delivered | Depth/cutout/transparent ordering, fallback sprites, elevation, indoors, picking, streamed edits and resource residency/lifecycle |
| G5 | Measured in 045; Canvas retained | Matched device measurements of frame pacing, allocations, uploads, memory, cold start and graphics loss/recovery; choose backend based on evidence |
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

## Fixed-view sprite/mesh invariants

These are the review checklist for G1–G5. Put shared behavior in one owner;
Canvas and GPU necessarily have different drawing implementations, but must not
acquire different gameplay or presentation rules.

1. **One simulation and identity.** A car remains the same entity whether drawn
   as a sprite, mesh or fallback. Rendering reads replicated/predicted state;
   it never advances movement, steering, collision, support or gameplay animation
   events. No GPU-only entity class, second world or renderer-owned simulation.
   Gameplay labs use shared scenario/runtime code rather than new movement loops.

2. **One presentation evaluation per view/frame.** Shared presentation owns
   interpolation, pose time, visual effects, visibility rules, ordering and shadow
   policy. Representation adapters consume its result. Backends may cache derived
   resources and perform conservative GPU culling, but cannot independently infer
   headings, rerun animation clocks or recollect gameplay state. Evolve the existing
   builders; do not create a parallel `collect3DWorld` containing copied policy.
   Multiple views may evaluate different cameras against the same state and time.

3. **One asset identity, explicit alternatives.** Asset metadata associates a
   sprite presentation and an optional versioned mesh presentation with the same
   logical asset. Source direction labels are normalized in that metadata, not
   patched in each consumer. A shared resolver uses view policy, capabilities and
   a frame-stable readiness snapshot to select exactly one body. Missing, loading,
   failed or unsupported meshes use the sprite fallback without changing gameplay.
   Promotion replaces that body atomically at a frame boundary; never draw both
   bodies or omit both. Multipart models remain one logical body's parts.

4. **One transform composition.** Internal spatial data uses world pixels with
   X/right, Y/ground and Z/up. Mesh metadata normalizes its local forward to +X,
   ground/pivot and units once. Pose orientation is a backend-neutral unit
   quaternion (x,y,z,w); positive yaw about +Z turns +X toward +Y. Euler inputs,
   if introduced, require one documented conversion/order. With column vectors,
   the conceptual composition is `world = entityPose * visualLocal * assetToLocal
   * vertex`. Asset normalization happens once, even if baked during import;
   renderer axis conversion happens at its boundary. Shared presentation resolves
   parent/rider attachment and interpolated world height once. Never add terrain,
   support height, jump offset, sprite pivot or camera offset a second time.

5. **Visual pose does not silently become physics.** Continuous visual heading,
   suspension lean, pitch/roll or wheel animation cannot rotate colliders or move
   support surfaces. A heading affecting gameplay belongs to shared simulation and
   the appropriate replication/prediction contracts. A cosmetic pose derives from
   shared presentation inputs, not a renderer-local controller. Existing discrete
   facing cannot magically provide authoritative continuous steering. Physical
   orientation is a separately specified change, not a side effect of a mesh.

6. **One projection and viewport contract.** The initial mode preserves current
   ground placement and the vertical screen displacement from world height,
   including zoom, shake, pixel rounding, viewport and DPR conventions. A generic
   tilted orthographic camera is not automatically equivalent to this projection.
   Sprites, mesh anchors, shadows, clips and editor overlays must agree at known
   world points. Mesh-local vertices rotate before projection; the fixed camera
   does not rotate with the entity. Ground picking uses the matching inverse;
   elevated picking requires an explicit height/surface policy, since a screen
   point has no unique 3D inverse. UI coordinates stay in the host's UI contract.

7. **One explicit composition policy.** Initially, a mesh body occupies the same
   ordered scene position as its sprite alternative. Depth resolves triangles
   within that body; it must not leak into other ordered bodies, terrain or later
   passes. Backends must isolate/remap depth appropriately and preserve supplied
   clips, alpha cutouts and transparent blending. A separate always-on-top 3D
   canvas cannot correctly interleave with sprite foregrounds. Offscreen mesh
   rendering is permitted only as an implementation of the ordered body command,
   with matching projection/alpha and bounded resource ownership. Whole-body
   ordering cannot depict arbitrary interpenetration; object splitting or a future
   world-depth mode needs explicit shared semantics, never per-car z-offset hacks.

8. **One shadow and appearance policy.** Sprite and mesh alternatives emit one
   logical shadow under the current ground/elevated ordering rules. Do not combine
   the legacy shadow with an extra Three.js shadow by default. Material metadata
   states unlit/lit and opaque/cutout/blended behavior; backends honor it. The
   compatibility path preserves sprite filtering, alpha and color behavior rather
   than silently adding lighting or tone mapping. New mesh art has its own visual
   acceptance criteria; unchanged sprites remain the parity baseline.

9. **One definition of each spatial bound.** Physical collision/support bounds
   remain simulation metadata; visual bounds enclose the posed artwork, and sorting
   anchors retain their defined presentation meaning. Culling considers rotation,
   animation and visible attachments, not just the collider. Picking declares
   whether it selects physical or visual geometry and maps the result to the same
   stable entity identity; a mesh hit cannot become a gameplay collision implicitly.

10. **One resource/lifetime owner.** `RenderHost` selects and owns a backend per
    view; that backend owns its GPU objects, loading publications and disposal.
    Asset IDs/versions cross the interface, Three.js objects do not. Existing
    borrowed-frame and revision rules still apply. Stale async completion cannot
    resurrect an evicted/replaced asset or disposed host. Readiness and fallback
    are explicit; recovery rebuilds graphics without resetting simulation. Source
    assets can be shared, while device/context resources have distinct owners.
    No per-frame reload, unbounded mesh cache or unaccounted offscreen render pool.

11. **One route from experiments into gameplay.** New asset inspectors exercise
    the same asset normalization, pose, material and body-submission implementation
    as gameplay; tool camera controls and annotations remain local. The existing
    car/debug labs are evidence, not parallel implementations to copy forward.
    Before reusing their code, extract the common behavior and document any retained
    diagnostic adapter. Immutable Canvas review references remain intentional
    independent oracles; preserving them does not justify another gameplay pipeline.

## Enforcement at implementation time

Documentation alone cannot enforce these rules. Each implementing slice must add
the relevant evidence before it becomes a supported path:

| Gate | Required evidence |
| --- | --- |
| Boundary and identity | Extend dependency guards and recording-backend tests for mesh data; switching representation/backend preserves entity state, identity and shared presentation results |
| Transform and projection | Landmark fixtures cover ground/elevated anchors, parent/rider height, yaw wraparound, pitch/roll, asset-axis normalization, zoom/DPR and screen-to-ground round trips; model and sprite origins coincide |
| Mixed composition | Full-Chromium fixtures cover a car behind/in front of a sprite prop, elevated bodies/shadows, foreground clips, transparent holes and overlapping mesh bodies; depth state cannot corrupt the next pass |
| Fallback and lifecycle | Loading/error/unsupported cases, replacement mid-load, eviction, realm reset and loss/recovery select one body and one shadow with bounded resources and no stale publication |
| Unchanged appearance | Compare the sprite-only GPU mode with pinned Canvas scenes before enabling meshes; exact pixels where deterministic and explicitly justified tolerances elsewhere, never widening tolerances merely to pass |
| Reuse and performance | Gameplay and the asset inspector consume the same mesh path; matched phone scenarios measure allocations, frame pacing, uploads and residency with repeated load/unload |

First implementation slice: G1 with the unchanged sprite scene and projection
fixtures. G2/G3 then add one optional car mesh with continuous visual heading under
that fixed view. Detail the concrete frame types and depth-isolation strategy in
that slice's tactical; do not build two competing APIs ahead of the evidence.


## Delivered fixed-view backend (039–045)

`RasterRenderBackend` owns common resource preparation and pass consumption.
`Canvas2DRenderer` now draws through the narrow graphics-side `RasterSurface`;
Canvas and GPU share placement, grass, shadows and room composition rules.
`GpuRasterSurface` batches quads and retains revision-tracked texture pages; it
still uploads CPU-prepared terrain/room images. It is not GPU terrain generation.
Neutral `RenderBackend` frames never contain Three objects or decoded images.

`EntityMeshPose` evaluates cosmetic orientation once in shared presentation.
`CarMeshDefinition` normalizes the original source geometry into world-pixel
coordinates and the sprite's ground anchor. `GpuMeshBodies` draws that body into
one reusable depth target and composites it at its supplied scene position.
Depth is local to a body: arbitrary interpenetrating objects are not supported.
Missing/loading/failed assets retain the sprite. A generation-checked resource
slot prevents late async publication after replacement or disposal.

In the game, open **☰ → Debug → Renderer** (or press **F3**). Choose Canvas,
GPU sprites, or GPU + 3D car. The selector switches live and updates only the
renderer/mesh URL parameters, so refreshing retains the choice. Canvas stays the
default; the GPU choices and car artwork remain experimental. The separate
**3D View** control still opens collision/debug geometry.

`SelectableRenderHost` owns replacement between frames, reusing loaded assets and
the original input/UI canvas. It disposes the previous backend and rebuilds its
static caches, without replacing the client, Worker, player, realm or camera.
The game context reads the current backend through a getter rather than retaining
a disposed backend. A module-load failure leaves the current renderer running;
unavailable WebGL2 construction selects Canvas. The selector is disabled while
loading, and disposal prevents a late import from creating another host.

Direct links still support `?renderer=gpu` for sprites and
`?renderer=gpu&meshes` for the experimental car.
The [renderer comparison tool](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/renderer-lab)
exercises the same body adapter, pose and fallback. Its WebGPU/forced-WebGL2
buttons probe portable geometry/materials, not the gameplay sprite shader.
The older car projection lab remains a source/geometry investigation reference.
DOM controls and the original Canvas UI/input surface remain in place.

Residency is a 64 MiB soft texture-page budget with age eviction, plus CPU source
and staging images. Active working sets can exceed the soft budget. A single
mesh target is capped at 1024²; model textures and driver memory are additional.
Texture/vertex upload counters estimate requested bytes, not measured bus traffic.
Context loss pauses graphics; restoration rebuilds resources without resetting
the Worker world. Unsupported construction falls back to Canvas.

See [045](../tactical/045-gpu-measurement-decision.md) for measurements and the
adoption decision. Reconstructed car quality, WebGPU sprite-shader adaptation,
general mesh import and broader device coverage remain explicit next work.


Debug selector validation (2026-10-04): repeated Canvas → GPU → mesh → Canvas
switches at a 390-pixel viewport preserve the client, transport and player ID,
rebuild resident terrain, retire old world canvases and preserve unrelated URL
parameters. All eleven GPU browser tests pass. The full regression run passed
298 existing cases; the new selector test's initial assumption of a New World
screen was corrected to use the already-running game and actual menu controls.
Typechecks, 1,444 unit tests, lint, catalog/manifest verification and build pass.


Terrain pacing is shared presentation policy (`PresentationSettings.ts`), selected
by the view independently of its backend. The game and Traffic use identical
preparation and publication options. Visible holes rank before replacements and
halo work but cannot bypass the selected cap. The experimental small-batch mode
allows gaps while new chunks build and retains completed imagery during edits;
collection/submission must never perform an implicit completion pass. Frame
pacing and presentation debt are measured together; see [047](../tactical/047-terrain-pacing-and-zoom-stress.md).

Grass LOD is shared scene policy: full detail at >=0.5×, smooth opacity fade to
zero at 0.25×, then omission before collection/animation/sorting. Opacity travels
as optional scalar `GrassItem.alpha`; the common raster adapter applies it within
saved state. No backend independently chooses grass density or visibility. Game
and outdoor embedded hosts inherit it through `collectScene`; base terrain and
explicit grass-free diagnostic/indoor hosts are unaffected. See
[059](../tactical/059-grass-overview-lod.md) for validation and the performance
stopping point.

Raster parity remains fixture-scoped. 059's new grass diagnostic exposed
pre-existing Canvas/WebGL nearest-neighbor differences at fractional scales and
rotated blade edges, including at full opacity. Fixed-angle, integer-projection
fixtures establish opacity/composition parity; actual-zoom images are visually
inspected without asserting pixel identity. The sampling difference is recorded
for future renderer fidelity work, not expanded into this LOD optimization.

## Curved railway terrain

Curved city links and loop/winding labs use the same procedural pixel track
rasterizer inside `TileRenderer`. Rails, ballast and globally phased sleepers derive
from analytic line/arc geometry attached to replicated chunks; road masks decide
which tiles retain the tracks, including saved edits. Both backends consume the
ordinary prepared terrain cache. There is no per-frame world track overlay.
Native cardinal train sprites remain unchanged, with support-aware player ordering
above their roofs. See [trains](trains.md#city-to-city-roof-riding-integration).
