# Generator profiles and shared tile preview

Status: implementation in progress, September 29, 2026.
The regional map checkpoint in commit `6d388bb` has been reviewed positively.
This plan records the next work and its handoff to the remaining world-building
work in [Tactical 004](004-world-explorer-and-regional-generation-plan.md).

## Outcome and order

Support several independently versioned world generators. Preserve the current
Onion-based world as **Classic**, build the new **Regional** world independently,
and retain Flat and Island choices. Each selected generator has one implementation
consumed by both the explorer and gameplay.

The immediate sequence is:

1. Freeze Classic's generation behavior and establish shared generator selection,
   data contracts, and reusable terrain realization.
2. Zoom from the regional map into actual generated tiles through a configurable
   explorer using the game's terrain assets, autotiling, and rendering code.
3. Select generator type, seed, and supported generation settings in the actual
   game, with persistence and multiplayer using the same resolved descriptor.
4. Refine the Regional world into a convincing city district, realize its
   buildings, and connect explorer locations to authoritative play.
5. Continue with enterable places, villages/farms/wild land, and inhabitants.

Commit reviewable slices. The next visual checkpoint after the refactor is
map-to-real-tiles zoom; it does not depend on finishing apartment buildings.

## Starting point and concrete gaps

- `src/generation/TerrainStrategy.ts` already permits different chunk generators.
  `OnionStrategy` and `FlatStrategy` produce the same `Chunk` format.
- The game's `WorldType` currently combines `generated`, `flat`, and `island`.
  `Realm.buildStrategy` selects Onion or Flat. Island is an Onion configuration.
  Registry metadata and world-creation messages have a seed but no generator
  revision or complete immutable generation descriptor.
- `src/generation/regional/RegionalPlanner.ts` is a pure module used by the
  standalone explorer. It supplies bounded regional queries, geography,
  settlement reservations, and major connections. Gameplay does not consume it.
- The regional descriptor currently fixes `regional-v1` and `temperate-v1`.
  Existing explorer links and review records need an explicit compatibility path
  when a broader descriptor is introduced.
- Regional geography and Onion geography are different. Their water thresholds
  also differ. Calling Onion when zooming into the regional map would show a
  different world; matching seed numbers alone would not establish parity.
- Terrain derivation and water-coverage collision calculation are duplicated in
  Onion generation and `ChunkManager` saved-subgrid restoration.
- `Realm` currently invokes the legacy `StructureGenerator` for every non-flat
  world. Adding a type without fixing that dispatch would introduce Classic
  structures into Regional worlds.
- Autotiling (`Autotiler`, `BlendGraph`) and rendering (`TileRenderer`,
  `collectScene`, `drawScene2D`) are already outside the generation algorithm.
  They consume terrain/scene data. Available blend art constrains compatible
  terrain transitions, but the pipeline does not require Onion's geography.
- `loadGameAssets` bundles terrain with entity sprites and interior assets.
  Exact preview needs a reusable terrain asset subset loaded on demand.
- The explorer already has anchored navigation, a cancellable worker, bounded
  requests, stale-result rejection, links, diagnostics, and local review export.
  Extend that infrastructure instead of building another preview application.

## Architectural decisions

### Multiple generators, shared consumers

Use a small built-in generator catalog and resolver, available to browser
workers, the server/local game, tests, and diagnostic CLIs. Each definition owns
its algorithm/version, parameter validation and defaults, cheap overview source,
and detailed realization. It advertises capabilities such as settlement plans
or procedural placements so unsupported controls can be hidden or explained.

Initial user-facing choices:

| Choice | Implementation policy |
| --- | --- |
| Classic | Frozen Onion geography, terrain bands, roads, and legacy structure placement |
| Island | A named Classic preset with the existing island configuration |
| Flat | The existing flat grass generator, useful for editing and diagnostics |
| Regional | The new regional hierarchy and its own terrain/road/placement rules |

Classic and Regional can evolve through new explicit revisions. Existing worlds
remain pinned to the implementation and settings that created them. A generator
does not acquire another generator's geography merely to share code.

Within each generator, overview and exact output consume the same canonical
facts and terrain classification. Cheap overview queries may sample or simplify;
they must not construct detailed chunks or invent an alternate placement scheme.
Legacy/Flat overviews need only the features those generators actually provide.

### Immutable world identity

Introduce a discriminated generation descriptor containing:

- Generator type and algorithm version.
- Resolved seed.
- Profile/preset identity where it affects output.
- All resolved parameters that affect generation, with stable defaults and
  canonical serialization for comparisons, links, and review identity.

Do not keep two mutable sources of truth in legacy `worldType`/`seed` fields and
the new descriptor. Resolve old metadata through one compatibility adapter.
New worlds store the complete descriptor. Save-format/schema revision and
generator algorithm revision are separate concepts.

Missing generator metadata selects the frozen legacy behavior corresponding to
the old world type, seed, island configuration, and effective road defaults.
Capture actual current behavior, including missing-field handling, before
refactoring it. Preserve existing numeric seeds as stored; a new seed-validation
policy must not clamp or reinterpret legacy worlds. Unknown generator versions
or invalid settings fail explicitly instead of selecting the newest revision.

Numeric/text seed parsing belongs in shared code. Resolve an omitted/random seed
once at world creation and return the resolved descriptor to the client. The
preview, registries, server, and game must not independently choose defaults or
random seeds for the same world.

Normalize existing `regional-v1`/`temperate-v1` preview URLs and review records
through a documented alias if their generation is unchanged. If a generation
change alters output, introduce a revision and make old review verdicts visibly
distinct; do not silently reinterpret them as approvals of changed terrain.

### Shared terrain and scene pipeline

Keep these responsibilities separate:

| Responsibility | Owner |
| --- | --- |
| Geography, land use, roads, lots, and feature placement | Selected generator |
| Mapping that generator's facts to terrain/material IDs | Selected generator, used by its overview and exact path |
| Subgrid-to-tile derivation and terrain collision coverage | Common terrain helpers |
| Blend selection, sprite lookup, depth ordering, and drawing | Existing shared terrain/scene rendering |
| Queueing, residency, cancellation, and view selection | Shared preview/loading services with host adapters |
| Persistence overlays, player spawn, simulation, and multiplayer authority | Game/server |

Extract the duplicated terrain/collision conversion while protecting Classic's
output with fixtures. Reuse the existing autotile implementation. The new
generator writes supported terrain/material IDs and road grids through the same
pipeline; it does not copy Onion's bands or the renderer's fill rules.

Move procedural placement ownership behind generator selection. Deterministic
placement descriptors should include stable feature identity, world-space
position/bounds, and ownership; runtime entity IDs remain game concerns.
Classic adapts its existing structure logic. Regional obtains its structures
from its own plans. Changing loading order or entering preview must not select
a second placement implementation.

Keep generated chunk data transferable and independent of browser canvases.
If necessary, introduce a small chunk-data/hydration boundary around `Chunk`'s
arrays and render cache. Worker transfers contain data, not renderer caches or
runtime class assumptions. The browser renderer consumes hydrated/read-only
scene data without triggering synchronous generation through a getter.

Split terrain asset loading from gameplay/entity/interior loading using one
shared asset definition and variant setup. Reuse `TileRenderer` and the existing
scene drawing path. Introduce narrow read-only rendering inputs where concrete
`World` types cause coupling; do not instantiate `GameClient` or a realm for
unmodified procedural preview.

### Preview configuration and exact coverage

Keep generation configuration and presentation configuration distinct:

| Generation: changes the world descriptor | Presentation/work: changes only the view |
| --- | --- |
| Generator, revision, seed, supported preset and algorithm parameters | Camera, zoom, layers, display mode, sample spacing, exact footprint, job/chunk/memory caps |

Provide **Auto**, **Map**, **Tiles**, and **Coverage** display modes. Auto reveals
real tiles when sufficiently zoomed in; Map and Tiles support explicit comparison
at the same location. Coverage explains ready/pending/fallback areas and caps.
Expose the exact-detail threshold, neighborhood/footprint limit, and relevant
query budgets within safe measured bounds. Manual Tiles mode remains bounded at
broad zoom and clearly indicates the limited footprint.

Expose a deliberate small set of generation presets/parameters as they gain
real implementations. Terrain scale, sea level, or settlement density are
possible future knobs, not promises to add every one immediately. A setting
affecting output must travel with the descriptor into gameplay; it cannot remain
an explorer-only approximation.

Share links and reports include the full generation descriptor plus view,
mode, overlays, and relevant preview configuration. Camera/layer/budget changes
do not invalidate canonical world identity. Old links without new view controls
receive documented presentation defaults.

Use tile coordinates as the generation boundary and the existing tile/pixel
conversion helpers for gameplay and rendering. Map and tile modes share one
view state and navigation transform, preserving the inspected focus through
zoom and mode changes. Reuse pan, pinch, and camera controls across both modes.

At broad zoom, no detailed generation or large sprite assets are required.
On entering detail, lazy-load terrain sheets and generate a capped visible
neighborhood, with a bounded halo for autotile/road neighbors. Keep coarse
coverage visible until exact content is ready. Publish readiness per painted
area, distinguish complete data from complete render caches, and avoid duplicate
roads/props when exact coverage replaces schematic content. Include sprite
overhang when admitting and culling later buildings.

Use threshold hysteresis to avoid repeated admission/eviction near a zoom
boundary. Center exact residency on the inspected camera/focus area. Preserve
the existing next-frame navigation, cancellation, stale-result handling, and
bounded memory. Return buffers/caches to bounded working memory as views change;
do not create a persistent generated atlas or sprite-image cache.

## Implementation slices and review gates

### A. Freeze Classic and establish the generation boundary

Capture fixed-output fixtures before changing existing generation: multiple
seeds, negative coordinates, terrain/water borders, roads, island/flat behavior,
legacy placement descriptors, and missing/default metadata. Compare generated
arrays/placements rather than screenshots or transient entity IDs. Record known
legacy limitations rather than accidentally redefining their behavior during
the refactor.

Add the catalog, descriptor resolver, validation, and compatibility adapter.
Extract shared terrain derivation. Establish the generator-owned placement hook
and a chunk data boundary as needed, retaining existing entry points through
small adapters. The explorer and game-side factory resolve the same definitions.

Acceptance: Classic/Island/Flat fixtures remain equal; edited/saved chunks still
restore correctly; Regional never runs Classic structure generation; unknown
versions/settings are rejected. Coarse queries use no chunks. Commit this
refactor as a useful standalone slice before expanding the preview UI.

### B. Regional exact terrain and configurable tile zoom

Implement Regional chunk realization from the existing regional facts, with
terrain classification shared by its overview and exact path. Realize basic
ground, water/beach transitions, and the admitted major road corridors. Enforce
dry settlement/road reservations and compatible terrain transitions. Woods/rural
labels remain planning facts until vegetation/farm realization is implemented;
the preview should not imply completed scenery from a label alone.

Add worker realization through the same producer the game-side adapter calls.
Reuse common autotiling, tile rendering, variants, and lazy terrain assets.
Extend the existing explorer's zoom range and add the display modes, bounded
detail controls, readiness/coverage diagnostics, and reproducible links/reports.
Allow selecting Classic/Island/Flat as supported comparison sources without
fabricating Regional features for them.

Acceptance: zoom from seed 2026's map into recognizable real terrain and road
tiles, then back out; coastline and reservations agree with the plan. Independently
generated neighboring chunks agree at positive/negative borders. Worker output
equals game-side producer output for each supported descriptor. Auto/manual modes,
rapid seed/type changes, cancellation, and disposal retain bounded work.

Review checkpoint: a few land/water, settlement-edge, road, and chunk-boundary
views on desktop and phone layout. Record loading, generation, transfer,
autotiling, cache building, drawing, and memory separately. Measure a physical
representative phone before treating desktop CPU throttling as phone evidence.
Commit the exact-preview slice once it is useful to inspect.

### C. Actual game world type/seed selection and persistence

Wire descriptor creation/loading through both IndexedDB and filesystem world
registries, `GameServer`/`Realm`, shared protocol messages, and local/network
client paths. Slice A's metadata normalization provides the compatibility rule;
this slice completes durable storage and the player-facing flow.

Use the shared catalog and seed parser in the game world-creation controls.
Expose Classic, Island, Flat, and Regional with resolved seed and supported
settings. The authority validates the request and returns exactly the descriptor
it will use. World lists/details show the selected type and seed. Reopening a
world uses its pinned revision/settings rather than current UI defaults.

Support carrying an explorer setup into new-world creation so its settings are
not manually retyped. This initial handoff can create the matching world at its
normal safe spawn. Exact **Play here** arrival is a separate later gate; a preview
camera coordinate alone is not a teleport or spawn authority.

Acceptance: create, play, save, reload, and join worlds of each type through local
and server-backed paths. Same descriptor/coordinates produce the terrain seen in
the preview. Existing worlds keep Classic behavior in saved and newly visited
chunks. Invalid/unsupported descriptors cannot create a different fallback world.
New Regional worlds use their own generation/placement hooks, and terrain edits
remain authoritative on reload.

Review checkpoint: select type/seed in the real game, compare a shared location
with the explorer, and revisit it after reload. Commit this gameplay slice.

### D. Planned district, building art, and explorer-to-play arrival

Resume Tactical 004's district and real-art work on the shared Regional producer:
connected local streets, varied blocks, accessible lots, sidewalks/crossings,
park/playground, apartment/shop footprints, and entrances. Prove the minimum
asset recipes before accepting lot sizes/facings. The explorer automatically
gains realized art through the common scene pipeline as those features arrive.

Before procedural props/buildings participate in saved-world regeneration,
settle persistent stable IDs and deletion/move/edit overlays. Existing saved
entity records contain type/position and do not establish that contract. Avoid
duplicate respawns across chunk reloads, saved restoration, and multiplayer.

Add **Play here** using the descriptor and an explicit saved-world ID when
applicable. The server resolves a bounded safe walkable spawn against realized
terrain and props, reports failure when none is available, and enters the one
authoritative realm. Saved-world inspection obtains saved overlays from that
authority and labels procedural-only or unavailable coverage clearly.

Acceptance: plan, preview, and gameplay agree on roads, footprints, entrances,
and placements; walk several blocks and the park, unload/reload, and compare two
clients. Entry into an existing world preserves its edits and resolves the
correct location. This completes Tactical 004's first playable district milestone.

### E. Enterable places and broader world generation

Continue Tactical 004's stable exterior-door/interior realm mapping, return
locations, and persistent interior state, reusing the wall/furniture system.
Then add villages, farms, forest paths, wildlife areas, other urban districts,
and simple inhabitants with navigable destinations. Audit each new asset family
and use compact review rounds organized around new structural behavior.

New geography/placement revisions remain selectable/pinned. Add another generator
only when it offers a distinct world and can satisfy the shared query/realization
contract. Deep schedules, traffic, economies, and a fixed game genre remain
separate decisions.

## Verification and completion criteria

Maintain three different kinds of evidence:

- **Compatibility:** frozen Classic/Island/Flat arrays and placement fixtures;
  old metadata/default resolution; saved edited chunks; old preview-link aliases.
- **Shared-world correctness:** descriptor serialization, seed normalization,
  coarse/exact terrain classification, border/ownership agreement, deterministic
  query/load order, and equality between actual explorer-worker results and the
  game-side chunk producer. Test real adapters, not two calls to a UI-local copy.
- **Presentation and lifecycle:** real source sprites and shared rendering,
  bounded broad/exact modes, coverage replacement, responsiveness, cancellation,
  stale settings rejection, assets/caches released appropriately, touch/navigation,
  type/seed selection, persistence, and multiplayer integration.

Use repository unit tests, diagnostic benchmark/smoke runners, and Playwright
Chromium first. Capture and inspect representative rendered views. Run the
required typecheck, unit tests, lint/format, build, and relevant E2E checks after
implementation changes. Existing review verdicts remain durable user data,
separate from generated-content working memory.

Retain Tactical 004's initial responsiveness/first-view targets and refine exact
limits from measurements. Record cold assets separately. Do not claim full-world
memory bounds from a single screenshot: include sustained pan/zoom, repeated
mode/type/seed changes, unload/reload, and worker/cache teardown evidence.

The A–C work is complete when the frozen legacy types and new Regional generator
are selectable, the explorer can reveal real tiles with configurable bounded
detail, and the actual game creates/reopens the same generator descriptor using
the same producer. D–E remain the next product milestones, not prerequisites for
that first tile-preview checkpoint.

## mclone references and scope

Use the sibling checkout `~/code/mclone` as an architectural reference:

- `docs/topics/world-view-navigation.md`: Terrain Lab's canonical pane consumes
  production generation/assets/rendering while the host remains small; shared
  navigation and world identity connect overview, exact inspection, and play.
- Tactical 247, `standalone-world-explorer-foundation`: independent explorer
  application with a narrow dependency graph.
- Tactical 248, `terrain-lab-navigation-and-worker-modernization`: move repeated
  navigation/execution policy into shared services, retaining thin host adapters.
- Tactical 262, `world-explorer-exact-procedural-composition`: explicit exact
  readiness/coverage and shared source identity before full game lifecycle.
- Tactical 266, `terrain-lab-runtime-composition-adoption`: a diagnostic consumer
  adopts the shared runtime rather than creating another exact implementation.
- `tools/terrain-lab/src/state.ts`: profile/pane capability selection and
  reproducible generation/view settings; study the distinction between source
  configuration and presentation choices.

Borrow those boundaries and reuse principles. Tilefun remains a 2D TypeScript
game using its existing sprites and renderers; it does not require mclone's
Rust/Wasm, 3D meshing, clipmap/depth architecture, or a runtime dependency on it.

## Implementation record

- Slice A: captured frozen terrain/placement fixtures for Classic, Island, and
  Flat; added immutable descriptors, validation, catalog, metadata compatibility,
  shared terrain derivation, generator-owned placement dispatch, and transferable
  chunk data. Legacy numeric seeds remain unchanged. Regional tile realization
  is explicitly unavailable until slice B. Typecheck, 975 unit tests, and build
  passed. Browser checks passed 105/106 initially; the review-inbox test passed
  with a dedicated test server after isolating it from the open demo server.

- Slice B: Regional exact terrain and admitted major roads now run through the
  shared producer; all four choices have bounded overview queries. The explorer
  uses shared terrain assets/autotiling/rendering with Auto/Map/Tiles/Coverage,
  configurable admission/footprint/sample caps, complete-cache coverage, links,
  and independent worker/game parity checks. Typecheck and 980 unit tests pass;
  all 109 browser tests pass, including sustained exact navigation and
  rendered desktop/phone-layout captures. Physical
  phone measurements remain outstanding.

- Slice C: complete descriptors now persist in IndexedDB/filesystem registries
  and travel through create/join/list protocol paths. Game controls use the shared
  catalog/parser, expose Classic road settings, and accept explorer setup links.
  Blank seeds resolve once at the authority. Regional starts at a bounded dry
  planner location. Concurrent joins share one realm load, and direct local
  consumers follow their player. Typecheck and 985 unit tests pass; targeted
  browser creation/reload/handoff tests pass for every generator. Build and all
  111 browser tests pass; lint has only existing warnings.

- Slice D: Regional v2 adds connected avenues/local streets/alleys, sidewalk
  crossings, south-facing stable lots, apartment/shop source-atlas facade recipes,
  and parks. Both hosts use shared placement and scene rendering. Procedural
  props have durable deletion/move overlays and bounded disposable residency.
  Play here checks identity and resolves a safe arrival within 32 tiles before
  leaving the old realm. Local saved inspection labels persisted snapshots;
  server HTTP inspection reads bounded chunks and includes live realm edits.
  Source selection, refresh, revision selection, and saved-world links are wired
  into the explorer/game menu. Regional v1 and legacy generators remain pinned.
  Verification includes district connectivity/entrances/seams, overlay eviction
  and restoration, live authority inspection, and browser create/delete/reload
  arrival. Art was visually inspected against the original atlas. Typecheck,
  990 unit tests, and the complete browser suite pass; the browser arrival test
  creates, deletes, inspects, and rejoins the same persisted world.

- Slice E, interiors: stable versioned child realms reuse the native wall and
  furniture systems. Apartment/shop/home doors support keyboard and touch entry;
  the authority validates proximity and resolves the return position. Furniture
  edits persist across child unload and server/browser reload; direct child joins
  are rejected. Multiplayer entry shares one room, parent deletion cleans up
  children, and persistence writes drain before deletion. Rooms have one floor;
  a game reload resumes the parent and preserves the room for reentry.

## Next action

A–D and the interior portion of E are implemented. Continue **slice E** with
farms, woods, wildlife, district variation, and simple inhabitants.
Record measured caps and any changed contracts in this document and update
[the explorer checkpoint guide](../world-explorer.md) after each accepted slice.
