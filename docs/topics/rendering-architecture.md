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

## Sprite artwork on 3D proxies

[Car projection lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/car-projection)
implements the first bounded experiment, recorded in
[037](../tactical/037-car-projection-experiment.md). It fits one approved compact-car
side image to a closed, low-poly visual shell: bonnet, windscreen, roof, rear slope
and side. Orbit, source, far-side and low perspective views expose depth; exact
orthographic side/top presets support pan, zoom and reset. Toggles show mesh edges,
unchanged approved collision bounds and unpainted faces. User corrections and
orthographic checks are recorded in [038](../tactical/038-car-proxy-orthographic-checks.md).

`src/projection/CarProxy.ts` owns graphics-independent geometry in world-pixel
X/ground-Y/height-Z coordinates, pinned source/crop provenance and fixed oblique
source projection. Vertices are recovered from authored image points plus depth;
UVs remain tied to that fixed projection while the viewing camera moves. This is
actual textured geometry, not a billboard that turns with the camera.
`CarProxyScene.ts` owns the Three.js/WebGL adapter, cameras, input and GPU resources;
`CarProjectionPage.tsx` owns the DOM controls and lifecycle. Rendering is on demand.
This lab deliberately does not enlarge the production `RenderBackend` contract.

A visual proxy and a physical proxy have different jobs. The experimental shell
extends beyond the existing 56 × 20 × 24 collision box in places; its fitted roof
and alpha-cut silhouette do not replace approved support/collision geometry.
The near wheels remain painted onto the vertical side. Their visible lower edge
now reaches Z=0, and the grid lies on that same ground plane. The fitted roof is
21 pixels high; these inspection corrections do not alter the approved 24-pixel
physical height. Top surfaces have equal heights across the car, so bonnet and
windscreen are edge-on from the side. Hand-picked source samples check that their
painted details are assigned to top surfaces, rather than leaking onto the side.

`ProxyTexture.ts` derives a separate top texture by extending nearest opaque edge
colors through transparent border texels. This closes visible holes against the
checker face while retaining the original source and side/wheel alpha. Source
lighting and oblique distortions stay baked into the texture; a closed top is not
a fully authored top-view asset. Amber faces indicate missing artwork; they do not
mirror or invent the hidden side. No source pixels, promoted asset banks or gameplay
rules change.

Full Chromium reproduces all 1,809 painted source pixels within one color level,
with no uncovered pixels, when viewed through the fixed source camera. Top edge
extension now adds 182 pixels outside the original silhouette, explicitly reported
by the lab. Orthographic GPU probes find zero visible top-face pixels from the
side, 1,152/1,152 filled pixels across the top footprint, contacts under both tires
and zero pixels below ground. That proves source registration and the targeted
geometry fixes, not unique reconstruction or arbitrary-angle fidelity. The same sprite admits many possible depths. Touch orbit, graphics
context restoration and resource release on navigation have browser coverage.
The experiment is registered and discoverable but excluded from approval:
arbitrary orbit output is not an immutable native review snapshot.

The user suggested model-assisted reconstruction as a follow-up discussion. The
source image, fitted proxy and orthographic silhouettes/contact checks can serve as
inputs and acceptance constraints for that exploration; no model or external asset
service is integrated here.

Next useful slice: fit the same car against its other existing directional views,
assign explicit per-face image coverage and separate wheel geometry. Inspect the
views together before adding new textures or generalizing to other assets.
Do not assume stylized directional sprites are mutually consistent projections.
First-person presentation would additionally need interiors, surfaces below the
source view, close-up detail and world-wide geometry coverage. This experiment
makes no performance claim; its cold load still decodes the full source atlas.

## Next architecture experiment

Build a bounded second-backend prototype behind `RenderHost`, starting with a
representative terrain/sprite scene. Reuse presentation builders and compare
pixel/depth behavior, copied/uploaded bytes, startup, memory, loss/recovery and
actual device presentation. Preserve the Canvas reference and immutable approvals.
Only then decide whether broader WebGPU adoption or a Rust/WASM component pays
for its crossings and maintenance cost. Graphics API and execution language are
independent choices; neither requires rewriting simulation.
