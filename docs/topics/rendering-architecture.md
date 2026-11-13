# Rendering architecture and backend separation

[241](../tactical/241-budget-terrain-raster-completion.md) closes the terrain
budget blind spot identified in [240](../tactical/240-phone-pause-attribution.md).
CPU-requested canvases can defer drawing until a page copy; preparation now reads
the full changed 256×16 row before the next deadline check or publication. The
pixels are discarded without write-back. Rows remain atomic, so a deadline can
overrun by one completed row. Existing scheduling, retained imagery and shared
game/lab ownership remain intact; warm terrain does no reads. Desktop and phone
pixel oracles are exact. Pixel 7a worst render callbacks roughly halve with
~0.1–0.2 ms median overhead; occasional startup/late intervals remain. Plain GL
copies and CPU canvases stay in place.

[238](../tactical/238-allocation-churn-and-regional-planning.md) retains static prop
receiver faces in a per-client `SceneFrame` weak cache. Scalar snapshots detect
in-place shape edits; an edit replaces cached faces without mutating prior borrows.
Visibility, eligibility and excavation are evaluated per view. Sources use unique
query tokens, so sharing geometry across frame/view instances cannot suppress
candidates. World/frame clear discards the cache; ordinary release keeps weak
geometry entries. Moving body bounds use the same eight scalar corner transforms,
and detailed triangle caches allocate only on demand. Pixel output/order is unchanged.

[229](../tactical/229-first-person-view.md) adds an opt-in first-person view, the
first non-fixed camera over shared presentation. It is not a `RenderBackend`: it
consumes `collectWorldSprites` (the actor stage split out of `collectScene`;
fixed-view output unchanged), replicated chunk layers and prop colliders, and draws
them with its own Three.js renderer. Vehicle pose composition and loading are shared
through `AuthoredMeshPose.ts`. The view mirrors game Y once at its scene boundary.
The integration glue is temporary; 226 owns the view/camera-policy contracts it needs.
[230](../tactical/230-3d-cameras-stereo-and-webxr.md) slices 1–2 add a saved view
distance that sets the fog end and the hidden fixed camera's streamed area, and draw
rooms from the fixed view's own room rasters (floor plane, painted wall heights,
anchor-placed furniture, flat rugs).
[247](../tactical/247-first-person-shadows-and-walls.md) gives that view shadows
and fuller props without per-frame cost:
- A sun shadow map of the static world only (`SunShadows`). It is the ground seen
  along the sun's rays, one texel per world pixel, and is redrawn only when nearby
  static content changes or the eye crosses a 128 px step.
- Receivers are Three's built-in materials with their shaders edited by
  `shadeMaterial`. New first-person materials must go through it to take shadows.
- Contact shadows under moving bodies use the collector's `GpuShadow` shapes, as
  the fixed view's depth pass does. `GpuShadow.support` carries the resolved
  surface height for views without a depth pass.
- Standing props (trees, posts, forest rows) are static merged card meshes; the
  vertex shader turns them to the eye. Only moving actors are written per frame.
- Building walls all wear the south-face artwork; forest rows stand as cards.

[220](../tactical/220-world-anchors-shadows-and-jump-transitions.md) projected
vehicle shadows on the CPU (replaced by the GPU depth pass in 236, below). It cast
them from the displayed rotated bounding volume's finite upper faces.
Using a scalar root height could drop the footprint through a ramp crest to
terrain. Up to three disjoint caster quads share the existing soft mask; each has
its own ceiling, preserving underpass shadows even when an exposed end is higher.
Receiver broadphase bounds use actual polygon vertices rather than extrapolated
AABB corners. The collector uses the same displayed orientation as the mesh.

[236](../tactical/236-render-scorecard-and-gpu-shadows.md) draws every body
shadow of the GPU fixed view in one pass (`GpuDeferredShadows`). There is no
second path and no switch.
- Collection attaches a `GpuShadow` (`GpuShadowShape.ts`) to the caster's sprite:
  a footprint, a mask, an upper plane and a band of heights below it. Actors are
  ovals; vehicles, boats and trains are oriented footprints.
- After the world is complete, one instanced draw reconstructs each visible point
  from the world depth texture and shades upward-facing receivers in that band.
- `GpuRenderBackend` owns the pass and `presentWorld`; hosts present through it.
- The world target gets a depth texture once a shadow asks for one.
- Sinks without world depth (rooms, clipped scene passes, the review raster) draw
  the plain ground shadow for ovals.
- Receivers serve the support point query and contact effects (particles,
  landing rings) only. Below 0.2× none are built.
- The first-person view (229) is a separate renderer with its own shadows (247):
  a cached sun map plus contact shadows from the same `GpuShadow` shapes.
- Known differences from the deleted projection (ledges, crest seams, low ramp
  ends, tilted stacks) are listed in 236; the renderer lab's
  `probeDeferredShadows` compares the pass with a CPU oracle.

[235](../tactical/235-crowd-bench-and-unnecessary-work.md) makes the receiver
partition (`SurfacePartition.ts`) cost follow real overlaps:
- A cutter that misses a piece leaves it whole.
- Exact box and edge rejections run before any clipping.
- Each caster's partition is remembered across frames: up to four per caster,
  within 8 MB, for bit-equal planes and clipped polygons.

The union per receiver is unchanged, and a Node test compares it with the
original algorithm. Candidate faces keep their first-visit order (broad sources,
then x-major cells), because coplanar ties and decal sort keys depend on it.


[218](../tactical/218-traffic-and-rail-gameplay-recovery.md) replaces repeated
mixed-car scratch resizing with exact-size color/depth pairs in a 16MiB / 16-entry
LRU. Immediate scratch composition, native resolution, outlines and depth stay
unchanged; completed-pose images keep their separate existing budget. Mesh disable,
context recovery, expiry and teardown release the pairs. GPU stats expose pool
counts/bytes/hits/evictions. The production mixed-traffic capture drops from about
27 texture creations per frame to two over eight seconds; physical-phone FPS
confirmation remains open.

[217](../tactical/217-surface-projected-shadows-and-effects.md) adds shared finite
surface receivers and conforming cartoon decals. Character ovals and oriented
vehicle footprints split across ramps/decks and use actual ready-mesh roof
triangles. A retained local triangle index bounds moving-mesh queries. GPU decals
blend over completed world color with depth testing and no depth writes; finite
surface-outline depth clamps repair ramp/deck seam holes. Room caches retain
explicit painter ordering, and non-world overlays finish above the decal blend.
Contact effects carry world Z/normal; attached marks follow body-local coordinates,
while released dust inherits linear support motion. Landing detection confirms
nearby physical support and a genuine clearance episode before placing its effect
on visible geometry, tolerating transient prediction flags without spawning
mid-air or repeated stationary dust. Full lighting/shadow
maps and projected caster silhouettes remain follow-ons; sprite fallback baked
shadows and immutable review art remain. Qualification is recorded in 217.

[216](../tactical/216-dynamic-3d-vehicles.md) delivers qualified shared GPU world depth without discarding per-vehicle image reuse: cached color/depth pairs, world-relative depth conversion, upright sprite planes and surface top/front equations. Physical cars use separate ground shadows. No CPU depth readback is added to gameplay; the existing coherent final world composition remains. The independent common-geometry depth oracle qualifies behind/above/rolled vehicle overlaps, including cache reuse and reversed draw order.

216 owner feel follow-up: physical vehicle resources bypass the old per-model
sprite-height compression (compact-1 was 0.631×); pitch/roll expose authored solid
proportions. The shared oblique x,y−z camera remains fixed, so normal edge-on
foreshortening remains. Legacy review instances restore their prior height fit on
every draw; physical roof riders no longer inherit its presentation offset.

[215](../tactical/215-coherent-world-raster.md) repairs the registration regression
reproduced in [214](../tactical/214-world-registration.md). Production hosts collect
and render the world in one aligned, padded frame, then apply fractional camera
translation once before HUD. Actors retain fractional screen-pixel placement inside
the frame, including indoors and at rest. Logical follow/picking remain continuous.
Actual Canvas/GPU and physical Chromebook pixels qualify static registration and
followed-actor stability together. Stable sampling, crop isolation and terrain edge
extrusion address sampling ties/atlas seams; the linked record owns costs and limits.
Software WebGL (hosted CI's SwiftShader) executes every shader branch for every
fragment, so the inlined per-slot four-tap filter raised its frames from ~16ms to
~100ms. Raster batches without filtered actor quads now use a program without the
filter, and the four taps share one per-slot fetch in a loop (`GpuRasterShader.ts`).
Replayed game frames remain byte-identical to the previous program on Apple Metal
and SwiftShader; local SwiftShader frames measure ~17–24ms. Keep tap offsets as
additions: an equivalent multiply changed edge texels on Metal.

[213](../tactical/213-continuous-camera-projection.md) removes independent integer
camera-translation rounding from default gameplay/lab projection. Continuous
projection keeps the followed actor steady on screen; shared raster-edge rounding,
terrain overscan and inverse picking remain. `?pixelsnap=1` retains the old comparison.
Source pixels and reference-camera contracts are unchanged. 39 native checks,
eight production browser cases (including Canvas/GPU pixel seam probes), all
typechecks, build/inventories and throttled streaming readiness pass. The review
runtime fingerprint now includes projection math and settings. Owner playtest next.

Reset [205](../tactical/205-physics-reset.md) makes shared physics poses authoritative
for scene collection and collision inspection. Runtime car ground fitting and
articulated carry/equipment reconstruction are deleted; retained equipment pose
math is render-only for frozen asset inspection. CollisionDebug reads the same
body dimensions as Rapier. 216 now supplies full car orientation/suspension.

Topic: rendering-architecture
Status: complete backend/presentation separation, recording proof and integrated
desktop/Android validation delivered; WebGL2 gameplay backend and shared mesh-car presentation delivered;
GPU + 3D car is the owner-selected default for the game and every embedded lab,
and since 2026-11-09 the only GPU mode (the GPU sprite-vehicle mode is removed).
[232](../tactical/232-webgl2-only-renderer.md) (owner decision 2026-11-09) removes
Canvas: the game, labs, explorer and probes draw only through WebGL2, ignore
`?renderer=` and show a "Tilefun needs WebGL2" screen instead of falling back. The
Canvas host is deleted (slice 3); a native Canvas2D raster (`ReviewRasterBackend`)
remains only for fingerprinted review images.
Bounded unchanged car images and ordered multi-texture GPU batches are delivered.
Updated: 2026-11-11.

[169](../tactical/169-wheel-lift-towing.md) groups a tow truck and its car in one
shared GPU depth target. Per-draw absolute transforms reset both cached assets;
both must be ready (including paint) before replacing the complete paired
fallback. Display sampling pins the axle to the displayed hitch after independent
timelines; authority poses remain untouched. Cardinal fallback captures use the
same loader/projection/outline and preserve paint. This bounded pair does not
resolve whole-group ordering against external world props.

[167](../tactical/167-tipping-dump-bed.md) adds absolute per-draw dump tub, gate
and ram transforms to the existing shared loader. One cached model can render
level and tipped instances without pose leakage. Upright bed contents retain the
same local depth composition. The nonzero-tilt Canvas/disabled/pending/failed path
software-rasterizes the retained actual triangles/UVs with a bounded atlas-owned
pose cache; source-derived physical rays still approximate content occlusion.
This preserves the existing whole-group world-ordering limit from tactical 162.

Owns renderer boundaries and resource/frame lifetimes. [Performance](performance.md)
owns timing and allocation evidence; [client/server architecture](../client-server-architecture.md)
owns authority and prediction. [Parent 022](../tactical/022-renderer-backend-decoupling.md)
tracks this refactor and its completion gates.

[Embedded engine labs](embedded-engine-labs.md) owns game/lab integration parity.
Changes to shared presentation, assets, preparation or lifecycle must account for
embedded consumers as well as gameplay; shared backend imports alone are not
evidence of equivalent scheduling or resource behavior.

The fixed-view GPU renderer preserves existing sprite presentation
and can replace individual sprite bodies with meshes. Entity orientation may
vary continuously while the world camera projection stays fixed. Authored bodies
may need explicit source-camera registration, as described for compact-1 below.
The following invariants govern that extension; they remain requirements for further assets and backends.

## Architecture

Cutaways and level/sector visibility are part of the agreed
[world geometry direction](world-geometry.md#visibility-and-seamless-interiors),
including underground spaces and seamless indoor floor transitions. Shared
presentation should derive observer-specific visibility from physical space and
connection data; backends consume that result. Visibility selection must not
change simulation or collision. `SurfacePresentation` now supplies a bounded
schematic slab view and translucent whole-patch cutaway (group opacity on the
overlay pass, honored by Canvas and GPU), shared by outdoor game rendering and
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
                    WebGL2 (game, labs, explorer, probes)
                    native review raster (fingerprinted showcases only)
```

World chunks contain tile grids and content versions, never graphics resources.
Presentation computes interpolation, visibility and ordering without advancing
simulation. `RenderBackend` receives plain view values and semantic passes:
clear, terrain placements, ordered scene bodies/shadows, indoor commands and
editor overlay geometry. It owns preparation, resource lookup, invalidation,
eviction, resize, recovery and teardown. It does not decide depth/shadow order.

`GameClientOptions.renderHostFactory` supplies the browser host.
`RenderHost` supplies the backend, asset configuration, viewport lifecycle and an
independent HUD/touch/debug context. `loadRenderHostFactory` gives the game and
every `LabView` lab the WebGL2 host after `requireWebGl2` confirms a context; there
is no renderer choice (232). The GPU host
supplies a separate UI overlay and composes it for feedback capture. This works
without changing physics, generation, editing or
presentation policy. GameClient asset loading, procedural sprite creation and
platform input/UI wiring remain application composition responsibilities.

**Views ([226](../tactical/226-player-views-and-local-split-screen.md) slice 3a).**
One display frame can hold several views. `beginFrame` runs once, then each view
calls `RenderHost.beginView(camera, region)`/`endView()` with a camera whose
viewport is the region's size; `beginWorld`/`endWorld` are the whole-canvas view
through the same code. Regions come from `layoutViews` (1, 2 side by side, 2×2,
or a diagonal half-plane `mask`, discarded in the GPU present shader) and never go through
`resize()`. The GPU host reuses one world target: a later view clears it, draws
in its top-left corner and composes into its region with a GL viewport or a
half-plane discard in the present shader (`GpuWorldComposition`, maths in
`worldComposite`). A view composed into a region is
pixel-identical to a single view of that size (renderer lab
`probeViewRegions`). Terrain for every view is prepared once per frame
(`prepareViewTerrain` → `prepareTerrainViews`, scheduled by `TerrainResidency`):
one time and row budget, any view's on-screen gap first, per-view look-ahead and
focal rows, and no view evicts another's chunks; each view then presents its
terrain with `prepared` set. Observer-local slab fades belong to each view
(`presentSurfaceScene`'s `fades`, cleared with the device's presentation on a
world load or realm exit); the device's `SceneFrame` (mesh poses, collection
buffers) is shared. Since slice 3b the game (PlayScene) and the lab
host draw through `renderViews` over their device session's views
(`src/session/`), with `drawViewTerrain`/`drawViewScene` as the one outdoor
world draw; each has one view until split screen (slice 5).

`LabView` (226; `ScenarioPresentationHost` before it) embeds the same
render-host implementations for the interactive labs. `PlayerPresentation`, `OutdoorPresentation` and `presentInterior`
share camera interpolation, terrain policy and room submission with gameplay. GPU hosts support an absolute world surface inside a positioned
lab wrapper, while the input/UI canvas stays in document flow. See
[embedded engine labs](embedded-engine-labs.md) for lifecycle and migration boundaries.

The reviewed blue v3 rear/middle/front train meshes now share the road models'
ordinary game/lab mesh selection. Each carriage retains physical end orientation
when travel reverses. Backend-disabled, loading and failed assets draw the native
carriage crop. Retained model/review pixels and authoritative train geometry stay
unchanged; [trains](trains.md) records owner acceptance and the remaining join limits.

## Data and resource contracts

- `SpriteCatalog` exposes immutable image/tile dimensions and sprite-region
  geometry without loaded images or draw methods. Stable sheet keys connect
  scene data to backend assets. Canvas `Spritesheet` wraps decoded sources.
- `TerrainFrame` computes culling, pixel rounding and seam overscan from scalar
  view data and a resource-ID lookup. Camera-only movement reuses prepared
  resources and a bounded placement pool. Canvas and the recording backend use
  the same builder.
- Gameplay, interactive labs and reference cameras default to continuous projection.
  `Projection` shares the same translation across terrain, sprites, grass, mesh
  anchors, overlays and picking. Production RenderHost scopes aligned projection
  during world collection/drawing and presents its fractional remainder once (215);
  shared projection alone did not guarantee final pixel registration (214).
  The earlier grid-locked prototype remains an
  explicit `?pixelsnap=1` comparison through `RenderView.pixelSnap`; its independent
  translation rounding caused the followed actor's one-pixel oscillation (213).
- `collectScene`, `collectSceneOrder`, grass frames and prop-depth metadata own
  outdoor interpolation, visibility and shadow/body ordering. Ground shadows
  precede bodies; elevated shadows immediately precede their associated body.
- Entity viewport culling uses the displayed XY and height, including sprite
  draw offsets, and unions that rectangle with conservative optional mesh bounds.
  This keeps ground-centered vehicle fronts visible before their centers enter
  the screen. Game and embedded labs share this collector on Canvas and GPU;
  `collectScene.test.ts` covers the incoming bus's committed artwork, all 45
  vehicle models at all four edges and three zooms, interpolation, legacy height
  fallback and mesh bounds. Validation on 2026-10-11: typechecks, all 2,480 unit
  tests, lint (existing warnings), inventories and production build pass. The
  full Chromium run has 545 passes and two tap-movement failures (GPU water tap
  and profile reload destination); both pass twice on a one-worker isolated
  rerun, alongside the Canvas water-tap counterpart (six passes).
- Ordinary sprite rectangles snap both projected edges, then derive their width
  and height from those endpoints. Rounding only the origin while retaining a
  fractional scaled size exposed one-pixel gaps/overlaps between forest repeat
  pieces at fractional zoom. This shared raster rule applies to Canvas and GPU,
  including flipped sprites and visual height offsets. The renderer lab's
  `probeSpriteSeams` checks translucent adjoining pieces (so overlap also fails)
  at four zooms and four camera positions.
  `probeCameraStability` additionally checks stationary terrain landmarks,
  fractional prop anchors and frozen grass at five zooms, positive/negative chunk
  coordinates and an odd viewport. Since 232 slice 2 these probes, like
  `probeWorldRegistration` and `probeViewRegions`, run on the GPU only. Solid landmarks isolate layer
  placement: detailed nearest-neighbor textures can still exhibit texel tie
  differences during integer translation, especially at fractional scales. The
  prototype addresses relative positioning; it does not establish complete texel
  stability or a frame-pacing result. Owner review should check both alignment and
  any remaining internal shimmer while a forest camera settles.
  Prototype validation: typechecks, all 1,743 unit tests, lint (existing warnings),
  catalog/manifest generation and production build pass. Full Chromium checks pass
  all 20 placement cases and 64 seam cases, plus the real game and embedded forest
  walking/reload/travel checks on Canvas/GPU. The full browser suite records 384
  passes and three failures: two wildlife-review checks encounter the missing
  archived `fox/pilot-v1/preview.gif`; the GPU city train passenger-height check
  passes on an isolated rerun. These are not a clean full-suite acceptance result.
- `ElevationDescriptorCache` caches static geometry by weak chunk identity,
  placement and edit/visual revisions. Binding a new resource creates new
  immutable records, leaving prior records unchanged. Empty chunks are cached.
- `InteriorPresentation` owns floor/furniture/support/wall/actor ordering and
  emits scalar layer, source/destination and actor commands. Static content has
  a separate identity; camera and actor movement reuse it. No actor draw
  callbacks cross the interface. `CanvasInteriorResources` owns raster shells
  and wall bands and consumes the supplied order.
- `OverlayFrame` and `collectEditorOverlay` emit pooled geometry with explicit
  style values. Scene clips are rectangle lists in the camera's viewport pixels
  (device pixels for the explorer). The GPU snaps clip edges to whole pixels, so
  strips sharing a fractional edge neither gap nor double-blend.
  The native raster implementation preserves the host transform. The explorer
  draws its GPU frame at device pixels and copies it into the map canvas.

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

## Parking ground and ordinary terrain

Parking pavement, bay paint, crossings, curbs and islands are saved 16px road-grid
cells (IDs 79–162), selected by the regional district planner. `TileRenderer`
composes their source layers into the ordinary native terrain chunk once; Canvas
and GPU reuse that chunk while panning, zooming and resizing. Content edits,
source replacement and normal chunk lifecycle own invalidation. Buildings, trees,
carts and pay stations remain ordinary object props; cars and shoppers remain live.

There is no camera-dependent static-sprite composite cache. Multipart object props
use normal per-piece scene collection. [134](../tactical/134-parking-as-city-terrain.md)
replaces the cache introduced in 132 and records regression/performance evidence.
The playable parking lab uses production city planning and the same terrain path.
Static art reference views retain their independent exact review pixels.

### Ground pattern ownership

Large flat artwork (pavement, parking bays, paint, plazas and similar decoration)
must compile to ordinary terrain cells/chunks. Source sprite sheets and authored
multi-piece patterns are supported; their authoring representation does not
justify per-piece gameplay props or camera-dependent screen composites. Mixed
patterns explicitly identify `terrain` and `object` pieces. The parking compiler
uses this metadata rather than English labels to route ground to saved cells and
objects to ordinary props. Ground cache regressions cover parking, track and depot
through pan/zoom/resize, with content edits still invalidating affected chunks.

An independent ground decoration layer, when required by content, must share the
same world-aligned chunk culling, bounded residency and content/source/lifecycle
invalidation. Bake layers sharing ground order into existing chunks where possible;
do not allocate a whole-world image or rebuild on camera movement.

Elevated slabs retain their per-surface painter placement. [184](../tactical/184-ground-rendering-and-moving-racetrack.md)
coalesces adjacent actor/shadow runs between slabs. Its GPU backend rasterizes
rect/line surface commands into local images, preserving Canvas raster phase and
reusing unchanged geometry across integer screen translations. Cache keys are
semantic surface IDs; no graphics resources escape the backend. Residency is
capped at 32 images / 8 MiB, eviction releases GPU pages, and invisible surfaces
submit no image. Fractional raster-phase changes, geometry/style changes and
normal source/reset/recovery lifecycle rebuild as needed. Other overlay kinds
retain the existing general path. Never merge elevated surfaces into ground or
group objects across a surface ordering boundary for speed.

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
priority and time/row budgets (now one budget across all views of a frame).
Explorer and native review request explicit visible-only row budgets, which are
single-view only (multi-view preparation refuses them). Viewport resize preserves native static caches. Realm
reset and context recovery clear terrain and rooms; context restoration triggers
recovery through the GPU host. Disposal is idempotent, detaches host listeners
and rejects further rendering/preparation. Scene-frame release drops actor,
particle, prop and overlay references; retained pools have explicit bounds.

## Consumer and platform dependency inventory

| Surface | Boundary / intentional graphics dependency |
| --- | --- |
| Play/edit outdoor and indoor rendering | Neutral `renderWorld`, `renderInterior`, scene and overlay builders; `RenderBackend` only |
| Explorer | `TilePreview` draws on an offscreen WebGL2 `GpuRenderBackend` at device pixels (232), copied into the map canvas over the regional map and under the coverage overlay; explicit preparation/submission, ready-chunk clips and lifecycle |
| Interactive Traffic, Outdoor Geometry, World Geometry, Natural landscape, Character lab and furniture playtest | The game's `LabView`, the production GPU host and semantic scene/terrain/indoor passes; view-specific controls and diagnostics |
| Building/street/district reviews | Native Canvas2D review raster (`ReviewRasterBackend`) at platform entry: approval fingerprints hash these pixels, so they stay off the GPU (232 slice 2); shared semantic scene/terrain passes; separate stage/geometry diagnostics remain native |
| Native character review | Source-hashed `CharacterTestScene.ts` is immutable approval input. Its `drawScene2D` reference adapter consumes the same scene-pass implementation; do not rewrite approved controller bytes merely to rename a call |
| Indoor review/reference | Explicit native Canvas surfaces using shared furniture/room ordering. `CachedInteriorRenderer` consumes `InteriorPresentation`; uncached drawing remains the independent parity reference |
| Pattern room/atlas previews and tree source composition | Native asset/pattern reference rasterization, separate from gameplay presentation; pattern terrain uses the native raster backend, whose pixels are the candidate fingerprint (232 slice 2) |
| HUD, touch controls, menus, prop selection/collision diagnostics | Independent platform UI/debug surface; Canvas is permitted here and not exposed to neutral frame builders |
| GPU gameplay and diagnostics | Game and labs require WebGL2 and always draw GPU + 3D car (232); renderer lab shares its body adapter |
| Asset loaders and `Canvas*` / `TileRenderer` internals | Concrete source decoding, rasterization and resource ownership; not presentation policy |

`TileRenderer` is now an internal terrain preparation/resource component (it
rasterizes chunks into images that the GPU uploads).
The old combined terrain draw API and furniture metadata re-export aliases are
removed. The small native reference adapters above are permanent, explicit
composition choices, not hidden alternative gameplay pipelines.

## Evidence and limits

### Car pipeline audit and optimization direction · 2026-10-22

The [current-source audit](../benchmarks/car-render-pipeline-audit.json) follows
the [Pixel 7a depot/track investigation](../research/depot-racetrack-performance.md).
Production cars already use actual GLB geometry. Their image production and world
ordering are separate stages:

```text
read-only interpolated car/wheel/light/paint/bed/tow state
  → batched GLB meshes in a native-world-pixel RGBA + local-depth target
  → one-pixel inward silhouette outline into another RGBA target
  → nearest-sampled quad in the existing ordered sprite/prop/grass scene
```

`CarMeshAsset` owns loaded geometry, palette textures and absolute rig transforms.
`EntityMeshPose` supplies presentation state; `GpuMeshBodies` borrows the shared
asset and applies every pose before drawing. Truck contents are alpha-tested
upright sprite planes in the same local depth target; a towed car shares that
target too. Local depth resolves mesh parts and these bounded groups. External
world ordering remains the shared collector/painter sequence, including shadows,
surface slabs, props and grass; the final raster shader does not write depth.

Target resolution is `2 × radius`, capped at 1024, independent of camera zoom.
For example, a 160px body target still renders at 160px when displayed about
48px wide at scale 0.3. This preserves the native pixel grid but retains offscreen
work when zoomed out. Textures use nearest sampling/no mipmaps; the main GPU path
disables antialiasing. `CarPixelOutline` tests source alpha >=128/255 and four
cardinal neighbors, darkening bright inward edge pixels to the retained ink
color. Internal window/body ink also lives in authored textures; it is not a
normal/depth Sobel outline. A scene-wide alpha outline would lose individual
boundaries where opaque objects touch, and opaque ground would hide silhouettes.

Current mode inventory:

| Surface | Available behavior | Boundary |
| --- | --- | --- |
| Main game/labs | GPU + 3D car (WebGL2 required, 232) | Shared fixed camera/painter ordering and GLB bodies |
| F3 collision overlay | Independently colored driving, walking, actor, support, query and sprite geometry; optional shape labels | Shared physics-derived collector, also used by the Truck bed playground; [vehicle inspection](vehicles.md#bed-geometry-and-debug-inspection) owns usage and limits |
| `r_show3d 1` | Orbitable perspective split-screen | Collider/terrain geometry, not a complete textured vehicle/world renderer |
| Retained vehicle viewers | Study 50° / shared game camera, wheel motion, wireframe | Actual GLBs, still using native pixel targets and the shared outline |
| Renderer lab | Mesh/sprite, pose, foreground/clip/recovery controls | Same production body adapter; useful for composition and fallback checks |
| Renderer lab asset probe | WebGPU selection or forced WebGL2, raw body render | Portable-asset proof; no gameplay sprite shader/order/outline port |
| 160/162 diagnostics | Isolated, local group depth and shared world depth | Standalone GPU proofs; not a selectable full-game world-depth mode |

There is no production raw/unoutlined car shader selector or global world-depth
toggle. Debug's Base `depth`/`nw` selection concerns terrain base picking, not a
GPU depth-buffer mode. The current registry has 79 models/80 opaque source
materials: 34 use `KHR_materials_unlit`, 46 use emissive paint. Runtime contact
shadows and emergency-lens clones are additional. This is mostly flat painted
appearance, not an expensive dynamic lighting/shadow-map stack. Geometry batching
is already shipped; do not propose merging the original 32–56 parts as new work.

The new diagnostic
[`fused-outline-composite.mjs`](../../scripts/instrumentation/fused-outline-composite.mjs)
copies the same alpha-neighbor/ink rule into the final raster composite and skips
the intermediate outline target/pass. **72/72 full RGBA comparisons are exact**:
compact-1, fire-truck-ladder-2 and current dump-truck-v2; four headings; scales
0.3/0.75/3; opacity 1/0.65; rear band and translucent foreground in the same painter
sequence. It uses production loading, projection, outline and raster shader,
rejects empty bodies/GL errors and pins source/asset hashes. It changes no game
defaults. Cargo, towing, alternate paints, clips, context recovery and complete
game/lab/phone performance are not qualified by this small proof.

Fusion is a candidate, not a measured speedup: at scale 3 it repeats neighbor
tests for more display fragments, while the old native outline image is reused
by upscaling. Compare near and far views; a hybrid or cached outlined image may
win. Existing exact-size target reuse is diagnostic-only and showed only a small
desktop improvement in the depot investigation.

[179](../tactical/179-cached-car-images.md) implements the first slice through
the shared backend. `CarBodyImageCache` retains finished outlined RGBA targets,
keyed by the loaded asset generation, exact local rig pose and paint texture
identity/version. Camera, world position and composite alpha remain external.
Only poses recurring across consecutive frames qualify; cargo groups, towed
pairs and enabled emergency lights bypass reuse. Retention is bounded to
64 images / 16 MiB and 120 unused frames, with explicit reset/invalidation/
recovery/disposal cleanup. Each quad retains its original painter position.
With split-screen views (226), a pose that does not recur is kept for the rest
of its display frame (`FrameCarImages`: pooled targets, 8 MiB, a size released
after 120 unused frames), so later views composite it instead of rendering the
car again. The memo turns on when the previous display frame drew more than one
view; a single view renders exactly as before.
The original outline source is retained byte-for-byte in the historical replay
catalog; no historical art receipt or approved raster is rewritten.

The production-adapter probe has **144/144 exact RGBA pairs** covering four
models, two alternate paints, fractional scale, opacity and clips. Each warm hit
issues zero body/outline calls; recovery reproduces the reference. Three explicit
unsupported-group checks bypass reuse and match the reference. The
[receipt](../benchmarks/cached-car-images.json) owns source hashes and the ten
native Pixel 7a controls. Fleet pairs gain 30–33% callback FPS and halve render
CPU; warm body/outline calls fall 449→0/frame. The 51 images occupy 6.55 MiB.
Wide racing records no hits and remains about 44 FPS; 168–212 raster submissions
per frame remain the next bottleneck. Full validation and its intermittent
Canvas deer timeout/repeat results are recorded in 179. Manifest regeneration
preserves the other 1,977 candidate fingerprints; the two excluded interactive
truck/towing engine identities change because they hash the current adapter.

[180](../tactical/180-ordered-texture-batches.md) delivers the next submission
slice. Up to eight existing textures (since 232 slice 4: seven, plus the page
atlas; see the fixed-view backend section) share an indexed batch, with one sampler
slot value per vertex and constant GLSL sampler indices. Quad/index order and
per-source raw/sRGB conversion remain unchanged. Cached car quads can join the
batch; dirty mesh/outline target writes, uploads, clips, capacity, pass endings
and resource retirement still drain it. Texture budgets stay unchanged; vertex
records grow eight→nine floats, adding 32 KiB of reusable storage. This is ordered
multi-texture submission, not a spatial atlas or a new depth/outline policy.

Native Pixel 7a source-verified original/new pairs measure **41.01→60.02 FPS**
wide and **40.27→59.98 FPS** in the cached fleet. Submissions fall about
168→25 / 212→24 per frame. Desktop and native phone each pass 18 exact mixed-
texture and 144 exact car-image RGBA pairs, including queued-image lifetimes.
All 829 browser cases and GPU streaming readiness pass; details and thermal
exclusions are in the [receipt](../benchmarks/ordered-texture-batches.json).
The earlier 179 ceiling above is historical evidence for this delivered slice.

Optimization sequence and next work:

1. **Unchanged simple body image reuse is delivered in 179**, with exact pose/
   paint/asset keys, bounded lifetime and existing world/alpha composition.
   Unsupported groups retain their current renderer.
2. **Ordered multi-texture submission is delivered in 180.** It avoids atlas
   copies/gutters while addressing car, terrain, sprite and white-fill switches.
   Standing wide/fleet cases now reach 60Hz. Follow-up
   [181](../tactical/181-depot-and-driving-acceptance.md) measures
   moving normal/overview at 59.7/56.8 FPS on Pixel 7a; the exact saved depot remains
   open. Mixed raster servicing/GC evidence selects movement-time source-upload
   and terrain preparation admission as the next experiment. A desktop census
   still finds about ten scratch body/outline size changes per frame, but a size
   pool's phone benefit is unproven. No new shader/order/runtime policy is shipped.
3. **If new profiles justify it, measure outline fusion for changing bodies**,
   including the extra fragment
   work at close zoom. Add the missing composition/rig/lifecycle qualification
   through existing game/lab consumers before any production selection. The
   new measurements put broad submission ahead of this narrower pass reduction.
4. **Keep shared world depth as a separate correctness/rendering experiment.**
   Fresh replay still matches five ordinary poses, while the wall corner differs
   by seven pixels and no whole-object permutation fixes the last three. The
   independent ray oracle passes all 1,517 overlap checks. Global depth needs
   explicit sprite/terrain depth and transparency rules; retaining individual
   outlines needs object/depth-aware treatment. The common final outline in 162
   does not establish production per-car outline parity or a speed advantage.

The replay also corrected a diagnostic provenance bug: 162's browser follows
the current registry (dump-truck-v2), but its host formerly checked/hashed the
hard-coded v1 GLB. It now reports, checks opacity and hashes the actual loaded
asset declarations. Historical retained reports remain immutable. New replay
assets/hashes and visibility results are in the audit receipt above.

Validation: all three typechecks, 6,638 unit tests in 365 files, the Node visual
comparison integration and lint pass (existing 121 warnings / 42 infos). The
72-pair GPU proof and six-scene depth replay pass in owned bundled full Chromium;
all browsers/servers are reaped. No production render/recipe/asset input changed,
so this slice does not rerun the full production build/browser suite or regenerate
art inventories.

[127](../tactical/127-wide-view-investigation.md) profiles native phone wide views.
Per-car body/outline passes retain native-world resolution and resize their shared
targets between model sizes. The registered models contain 32–56 primitives with
one opaque source material; wheels and runtime emergency-lens materials remain
independently controlled. [129](../tactical/129-vehicle-geometry-batching.md) compiles
compatible opaque siblings at road-model loading without baking transforms or
changing literal vertices/triangles. Qualified raster-sensitive parts stay separate;
missing declarations fail closed into the existing sprite fallback. Parent wheel/
equipment groups and tagged light materials keep their independent state. Original
and compiled geometry share asset-owned disposal; source meshCount remains authored
part count while drawMeshCount/drawMeshes report compiled meshes. Game and labs use
the same GPU factory opt-in; direct source callers and train prototypes retain
their original hierarchy. Exact desktop RGBA qualification and cool-phone timing
are recorded separately. Target reuse remains benchmark-only; terrain/LOD, target
resolution and renderer defaults stay unchanged.

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

[160](../tactical/160-live-3d-and-shared-depth-investigation.md) records the owner's
2026-10-20 request to investigate live character meshes and broader shared scene
depth for vehicle passengers/cargo. A schematic GPU comparison shows the unchanged
Explorer sprite can participate in depth as an upright alpha-tested plane; local
group and world-depth results match in that bounded fixture. The four-source GLB
audit exposes material, animation packaging and source-identity gaps. Production
remains on isolated mesh-body depth. [162](../tactical/162-shared-world-depth-comparison.md)
extends this to actual dump-truck/pickup meshes and ordinary authority/collector
snapshots. Five of six poses match, including overlapping vehicles. A wall corner
has seven differing visibility pixels; all whole-group orders still leave at
least three wrong. This establishes one cross-group clipping limit while keeping
the existing character sprite. The standalone harness does not yet exercise the
Worker, production outline placement or `RenderHost` lifecycle. Next is bounded
shared presentation-host integration. [164](../tactical/164-playable-truck-bed.md)
implements a bounded version for one opt-in level dump bed: neutral sprite
contents join the vehicle's existing depth target, with shared source-derived
fallback clips and physical debug overlays. It runs the normal Worker and
  selectable renderer. [165](../tactical/165-truck-bed-gameplay.md) enables normal
  dump beds and groups loose toy/food sprites with riders, including Canvas and
  loading/failed-mesh clipping. Source artwork and full-world depth remain
  unchanged. No full-world renderer or automatic art conversion is selected.

[Parent 039](../tactical/039-fixed-view-gpu-parent.md) now tracks authorized
autonomous delivery of the six implementation slices. These are follow-ups,
not unfinished gates in the completed 022 refactor.
Plan the next slice just in time. The owner's 2026-10-11 default selection uses
the delivered WebGL2 backend; a WebGPU or Rust migration remains unselected.

| ID | State | Next evidence / decision |
| --- | --- | --- |
| G1 | Delivered, default in main game | Bounded GPU terrain/sprite backend behind `RenderHost`; the only renderer since 232 |
| G2 | Diagnostic car delivered; general import later | Portable mesh/material import, sprite fallback and explicit world axes/units/origin; consume the car candidate from the 3D asset workstream |
| G3 | Fixed-view pose delivered | One shared presentation path with optional mesh bodies and full transforms; first prove continuous car heading under the unchanged fixed projection, then expose diagnostic cameras |
| G4 | Compatibility path delivered | Depth/cutout/transparent ordering, fallback sprites, elevation, indoors, picking, streamed edits and resource residency/lifecycle |
| G5 | Measured in 045; Canvas removed in 232 | Matched device measurements of frame pacing, allocations, uploads, memory, cold start and graphics loss/recovery; choose backend based on evidence |
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
the GPU and the native review raster have different drawing implementations, but
must not acquire different gameplay or presentation rules.

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
   All 79 road models use measured wheel contacts in shared
   `VehicleGroundPose`, then supplies `gradePitch`, `gradeRoll` and `gradeOffsetZ`
   through `collectScene`. The GPU composes yaw, negative local-Y pitch, local-X
   roll, and visual Z translation; each draw resets the reused asset's pose.
   These inputs also invalidate cached body images. Physical body/roof support
   stays upright. A rider's existing mesh-ready height correction includes the
   fitted tilted roof plane; fallback remains at authoritative height. Coupled
   cars inherit the carrier's grade about its pivot. Detailed-bed foot positions
   follow that rigid transform while sprite planes stay upright; airborne and
   below-body actors are not attached. Carried-car roof riders wait for both
   models before applying inherited mesh-only XY/Z offsets. See
   [vehicles](vehicles.md#turning-and-fleet-ramp-poses--2026-10-24).

6. **One projection and viewport contract.** The initial mode preserves current
   ground placement and the vertical screen displacement from world height,
   including zoom, shake, pixel rounding, viewport and DPR conventions. A generic
   tilted orthographic camera is not automatically equivalent to this projection.
   Sprites, mesh anchors, shadows, clips and editor overlays must agree at known
   world points. Mesh-local vertices rotate before projection. Compact-1 uses
   the same fixed `x, y-z` projection for all headings, with static lateral asset
   registration before rotation. Direction-dependent lenses distort the screen
   heading and are prohibited in the shared gameplay path. Ground picking uses the
   matching inverse;
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

**Page atlas and direct sprites (232 slice 4).**
- `GpuPages` keeps every paged image in one `TEXTURE_2D_ARRAY` of 1024² layers
  (`GpuPageAtlas`, packed by `AtlasAllocator`): sprite sheets, terrain chunks,
  shadow ellipses, actor crops and overlays. Interleaved sources no longer split
  batches at the slot limit; a 0.1× city frame is ~8 draw calls (was ~91).
- The array grows by half and shrinks when eviction empties its top three
  quarters; the existing page LRU (age and 64 MiB budget) decides residency.
  Beyond its 256 MiB cap a page falls back to its own texture (`atlasMisses`).
- Images are split into pages of at most 512 texels a side, so a first use
  uploads at most 1 MiB (237). Page sources and terrain chunk images are CPU
  canvases (`cpuRasterCanvas`): a GPU-backed 2D canvas would rasterize in the
  GPU process, outside any main-thread time budget. CPU canvases can still defer
  drawing, so terrain completes each changed row with a full-row read before
  checking its preparation deadline or publishing pixels (241).
- Pages upload through a 2D staging texture and a GPU copy, never
  `texSubImage3D` from a canvas (a CPU readback in Chrome). The copy is plain
  GL: three.js's `copyTextureToTexture` reads context state back, which waits
  for the GPU process (20–40 ms a page on a phone). Staging textures are
  reused per page size within 8 MiB (`stagingBytes`). Staging flips rows like the
  old 2D pages, and unfiltered lookups clamp to their page as CLAMP_TO_EDGE did.
  Composed-world nearest-sampled scenery is byte-identical to separate page
  textures, including 0.5×'s all-tie sampling. Filtered actor edges can round one
  or two levels differently; without world composition (explorer, labs) a pixel
  center exactly on a texel edge falls to interpolation rounding either way.
- A resize holds the old and new arrays until the GPU copy completes: growing
  41 → 62 layers peaks at ~412 MiB for one frame, then settles at the new size.
- Seven image/depth sampler slots remain for non-paged textures (mesh composites,
  white); with the atlas sampler that is 15 of WebGL2's 16 units.
- `setPageAtlas(false)` is a diagnostic A/B that keeps every page in its own
  texture; `setPageAtlas(true, layers)` lowers the cap to exercise growth,
  shrinking and the fallback.
- The shared scene drawing calls the GPU-only `RasterSurface.drawSpriteImage` and
  `fillShadow` when present, skipping Canvas-shaped save/restore, transform and
  path calls. The native review raster lacks them and draws through Canvas state,
  so review fingerprints are unaffected.
- Flushing through Three.js costs ~10 µs per batch; a direct WebGL draw was not
  worth it at ~8 batches per frame.

`EntityMeshPose` evaluates cosmetic orientation and signed wheel travel once in
shared presentation. Its view-owned ID cache survives borrowed render clones,
evicts absent entities and clears on scene teardown. Travel uses interpolated
positions; rest holds phase and teleports/visibility gaps establish a new sample.
[108](../tactical/108-authored-blue-car-gameplay.md) replaces the older proxy with
the retained blue compact-1 v7 GLB. `CarMeshAsset` converts +Y-up/-X-forward to
+Z-up/+X-forward once; authored world-pixel scale and Z=0 ground center need no
sprite/camera offset. `CarMeshDefinition` also retains the earlier reference
projection registration for historical reference checks.

[112](../tactical/112-coherent-car-presentation-and-test-override.md) supersedes
109's heading-dependent authored lens. It made a 45° movement appear to face
38.2°, while extra cosmetic turn smoothing and cardinal rest fallback added drift.
`CarMeshProjection` matches fixed `projectWorld` at every heading, zoom and height.
[130](../tactical/130-vehicle-game-camera-fit.md) adds fixed per-model vertical
registration around Z=0 to match all 45 source side heights within one native pixel.
The compact's existing 1.3× lateral registration remains. These are visual transforms
before entity yaw; physical metadata and immutable source geometry stay intact.
Ground contacts remain fixed through wheel roll and diagonal yaw, with one mesh-only
contact ellipse. End views retain the source-camera contradictions.
Cosmetic yaw follows displayed forward movement, using velocity to reject backwards
interpolation corrections; it holds at rest. Teleports/visibility gaps fence travel.
Roof sprites attach to fitted visual support only while that exact mesh is ready;
Loading/failure fallbacks retain their original support appearance.

The opt-in `?allcars3d` flag selects the blue body for every
`vehicle-v1:` road vehicle in the shared game/lab collector. Original actor types,
colliders and sprite fallbacks remain intact. A bus may retain a larger collision
body than its compact test appearance. Trains and other actors are excluded.

Retained ambulance v2 supplies six separately tagged emergency-light lenses.
GLB node extras identify schema, role, channel, group and phase; fixed bases are
untagged. `VehicleEmergencyLights` clones lens materials and pulses existing
emissive/unlit paint from explicit enabled/shared-time inputs, setting absolute
state on every draw and resetting off. It borrows atlas resources and restores
materials on disposal. Actual GLB off/A/B captures verify visible alternation and
unchanged body/base paint. [117](../tactical/117-ambulance-driving-controls.md) connects
ambulance v2 through its own resource slot and resolver in game/lab GPU mesh mode.
It uses authored width, the same axis normalization, a 112px enclosing radius,
independent wheel travel and native silhouette ink. Every draw sets lens state from
replicated emergency flags and host presentation time; the sprite fallback
adds alternating blue roof beacons. Authority, persistence and audio remain outside
the renderer. The allcars3d override preserves the ambulance's own asset.
[120](../tactical/120-firetruck-gameplay.md) adds stowed firetruck v2 through a separate
resource slot and a shared 144px conservative sphere for culling/body targets. It
retains authored width, independent wheel roll, stowed equipment and absolute
state/time for its two tagged lenses. The test override preserves its own asset too.
Exact-revision art review and steering qualification remain open; the tagging
contract originated in [116](../tactical/116-ambulance-beacons-and-light-tags.md).

[122](../tactical/122-complete-vehicle-port.md) gives every compact color its own
GLB through `AuthoredVehicleMeshes`. The registry owns type/asset IDs, enclosing
radii and lateral registration. Pose resolution, culling and GPU resource
selection use the same definitions. Unregistered vehicles retain sprites; the
`allcars3d` test override applies only to those vehicles. Additional assets load
on first eligible draw and continue using sprites while loading or after failure.
Resources are bounded by the registry and disposed with the renderer; per-frame
ready state prevents a mid-frame load from changing the selected draw path.
Traffic playground selects each compact through the same shared collector.
Actual GPU probes check visible own-model pixels, absolute pose/light reset,
simulation isolation and resource disposal. Browser tests check all six colors
and compact-6 load failure with working sprite gameplay.

[122](../tactical/122-complete-vehicle-port.md) gives every compact color its own
GLB through `AuthoredVehicleMeshes`. The registry owns type/asset IDs, enclosing
radii and lateral registration. Pose resolution, culling and GPU resource
selection use the same definitions. Unregistered vehicles retain sprites; the
`allcars3d` test override applies only to those vehicles. Additional assets load
on first eligible draw and continue using sprites while loading or after failure.
Resources are bounded by the registry and disposed with the renderer; per-frame
ready state prevents a mid-frame load from changing the selected draw path.
Traffic playground selects each compact through the same shared collector.
Actual GPU probes check visible own-model pixels, absolute pose/light reset,
simulation isolation and resource disposal. Browser tests check all six colors
and compact-6 load failure with working sprite gameplay.

`GpuMeshBodies` draws that body into one reusable depth target at one texel per
world pixel, applies inward silhouette ink in a second color target and composites
it at its supplied scene position. Nearest enlargement keeps stroke width
independent of zoom/DPR. Wheel transforms use the supplied absolute phase for
each body, so the shared GLB cannot leak another car's pose. The compact's 128²
target pair accounts for 192 KiB of color/depth storage, excluding model/driver
resources. Geometry/material/texture ownership includes closing GLTFLoader image
bitmaps at disposal. No driving or collision policy changes; steering remains
neutral.
Depth is local to a body: arbitrary interpenetrating objects are not supported.
Missing/loading/failed assets retain the sprite. A generation-checked resource
slot prevents late async publication after replacement or disposal.

The owner selected GPU + 3D car as the main-game default on 2026-10-11 and for
embedded labs on 2026-11-07; this selection does not establish human art approval
or a new performance claim. The debug panel's live renderer selector and
`SelectableRenderHost` were removed with the Canvas option (232 slice 1), and the
Canvas host in slice 3; older `?renderer=` and `meshes` links still open, unchanged. Without WebGL2, the game
shows a "Tilefun needs WebGL2" dialog (not reported as a fault) and labs show the
same message in their error area. Only the context probe produces that screen; a
GPU backend that fails after a successful probe is an ordinary reported fault. Graphics-loss recovery is unchanged. The separate
**3D View** control still opens collision/debug geometry. GPU sprite vehicles were
removed on 2026-11-09 (owner: cars are always 3D); sprites remain only for
loading/failed meshes.
The [renderer lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/renderer-lab)
exercises the same body adapter, pose and fallback. Its WebGPU/forced-WebGL2
buttons probe portable geometry/materials, not the gameplay sprite shader.
Since 232 slice 2 the lab has no Canvas reference view. Its checks
(`RendererLabChecks`, `tests/gpu-renderer.spec.ts`) are GPU invariants and
explicit expected values:
- clipped frames match the unclipped frame inside the clip union and the clear
  color outside;
- a disabled or failed mesh draws exactly the plain sprite car;
- non-overlapping grass blades at a LOD alpha blend linearly between full detail
  and none;
- smooth shadows keep the pixel-exact shadows' darkening mass and centroid
  (asserted within 5% and 0.25 px);
- the editor overlay changes nothing outside its box and blends its fill at the
  item's alpha;
- the zoom-1 scene and room frames have recorded color counts and per-color pixel
  bounds, which also catch mirroring and shifts. These were taken from the GPU
  while it still matched the Canvas reference exactly, and are checked with a
  tolerance of 2 per channel.

`histogram()` and `palette()` re-derive these values when a reviewed change
moves pixels. `probeWorldRegistration` also checks the actor's absolute
placement.
The older car projection lab remains a source/geometry investigation reference.
DOM controls and the original Canvas UI/input surface remain in place.

The mono VR screen (a host-composed world plus Canvas HUD frame uploaded to a
WebXR layer) was removed in [226](../tactical/226-player-views-and-local-split-screen.md)
slice 2 to simplify input, views and rendering; `captureFrame()` now always
returns an independent snapshot. Real VR from the 3D scene remains a later idea
([229](../tactical/229-first-person-view.md)).

Default-renderer validation (2026-10-11): typechecks, 2,374 unit tests, lint,
catalog/manifest generation and production builds pass. The 545-check browser
suite passed 542 checks initially; three Workshop checks passed on targeted retry
with fresh test review data and the rebuilt standalone output. The first run had
reused earlier catalog/vehicle feedback and an older standalone appearance manifest.
Full Chromium covers default mesh startup, reusable composed capture, Canvas
fallback, live switching/reload persistence, graphics recovery and actual authored
car driving/save/reload. The XR unit check verifies composed-frame upload after
the game tick and normal-loop restoration on exit. Quest/phone frame pacing is
the next device checkpoint; these checks make no new performance claim.

Pre-commit revalidation (2026-10-11): typechecks, all 2,428 unit tests, lint,
catalog/manifest generation and the production build pass. The current full
browser run passed 546 of 547 checks. The explicit GPU tap-movement water/animal
interaction check failed to create its water destination and instead recorded an
interaction; two of three isolated repeats passed. This intermittent browser
failure remains unresolved and needs a focused input/setup investigation.

Residency is a 64 MiB soft texture-page budget with age eviction, plus CPU source
and staging images. Active working sets can exceed the soft budget. A single
mesh target is capped at 1024²; model textures and driver memory are additional.
Texture/vertex upload counters estimate requested bytes, not measured bus traffic.
Context loss pauses graphics; restoration rebuilds resources without resetting
the Worker world. Without WebGL2 the game shows the "needs WebGL2" screen (232).

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

The Ubuntu x64 CI probes use a fixed blade angle away from raster sample ties,
integer furniture texel scaling and representable 8-bit batch alpha. Exact
camera-translation/room comparisons and the existing one-channel batch tolerance
remain unchanged; these fixtures isolate placement, pass ordering and batching
from architecture-specific sampling ties. Context-loss checks wait for the first
real replicated player ID before testing identity preservation.

## Curved railway terrain

Curved city links and loop/winding labs use the same procedural pixel track
rasterizer inside `TileRenderer`. Rails, ballast and globally phased sleepers derive
from analytic line/arc geometry attached to replicated chunks; road masks decide
which tiles retain the tracks, including saved edits. Both backends consume the
ordinary prepared terrain cache. There is no per-frame world track overlay.
Native cardinal train sprites remain unchanged, with support-aware player ordering
above their roofs. See [trains](trains.md#city-to-city-roof-riding-integration).

### Complete vehicle presentation checkpoint

[122](../tactical/122-complete-vehicle-port.md) registers all 45 own source types.
`AuthoredVehicleMeshes` owns GLB path, revision, width and enclosing radius;
legacy eager slots request that registry so ambulance v3 cannot preload v2.
Loading, failed and disabled resources preserve the complete colored-flashing
sprite body in the shared raster path. Per-draw absolute travel and lens state
reset prevent cached resources from carrying another entity's phase.
`CarMeshAsset` discovers and validates all named roll nodes (required four corners,
plus middle garbage axles), applies each node's own radius/axis/rest quaternion,
and rejects duplicates or malformed extras while freeing resources. Disposal,
visibility bounds and simulation isolation use shared game/lab code. Source
physical proxies remain authoritative. Equipment stays at its qualified rest pose
and steering is neutral; exact production art review is separate from integration.
