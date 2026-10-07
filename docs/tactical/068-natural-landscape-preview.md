# 068 — Natural landscape preview

Status: preview implemented; validation checkpoint below; awaiting human composition review.
Date: 2026-10-07.
Owner: [Natural landscapes](../topics/natural-landscapes.md).

## Outcome

Give the owner a concrete, seeded review of meadow, scattered trees, open/dense
woodland and small ponds before choosing the default overworld composition.
Use World explorer for regional planning and World geometry lab for walking and
train-speed inspection through the shared engine. The optional composition is now implemented for temporary review worlds. Ordinary
regional defaults remain unchanged until composition review and integration.

## 1. Audit and baseline

- Read `workshop:inbox` and `art:notes` before asset/review work. Inventory existing
  runtime trees and catalog sources, listing standalone trees, forest edges/interiors,
  shrubs/ground cover and shore materials with exact approval/geometry status.
- Separate wild-tree candidates from fenced/planted patterns. Start with compatible
  runtime art; do not make a large new art campaign a prerequisite.
- Capture seed 2026's current town-to-town trip and select two additional seeds:
  one shore-heavy and one mostly inland, including negative coordinates/seams.
  Determine exact routes from current generation; do not invent review locations.
- Record generation/placement cost and train traversal readiness for comparison.

## 2. Small shared planner/realizer

- Implement temperate habitat weights, irregular groves, clearings and a low-density
  meadow tree population across eligible land. Dense forest must be recognizable
  at ordinary zoom while retaining usable openings.
- Add bounded local ponds outside established infrastructure, with continuous
  shores across chunk seams and dry banks. No rivers, erosion, flowing water,
  waterfalls or elevated hydrology in this slice.
- Consume shared reservation geometry for towns, roads, curved tracks, platforms,
  station access and bridges. Validate footprint/height clearance and canopy
  readability from a moving train; avoid excessively broad empty rail corridors.
- Assign stable procedural IDs and bounded spatial ownership. Preserve edited and
  deleted vegetation through normal persistence. Make map and exact terrain use
  the same decisions; do not use decorative map-only woodland labels as evidence.
- Keep first-slice configuration small: broad cover, interior density, edge scatter
  and pond frequency. Pin all settings in review identities and reproduction links.
  Compare named parameter sets using one implementation, not parallel generators.
- For isolated preview, inject the shared composition/settings through the existing
  explorer/scenario facilities. Production defaults change only in the integration
  checkpoint; do not add a historical generator or silently change saved worlds.

## 3. Review surface

Use existing pages and handoff; no new independent terrain application.

| Review scale | Existing home | Proposed additions |
| --- | --- | --- |
| Regional plan | World explorer | Habitat/forest cover and pond markers; settlement/transport exclusions; legend and seed/settings/location link |
| Local appearance | Explorer exact tiles | Same-location sparse/balanced/lush comparison; actual sprites, forest edge, interior, clearing and shore |
| Play and motion | World geometry lab | Shared landscape recipes; walking, real train ride, pause and route overview using existing scenario hosting |
| Later physical relief | World geometry lab | Separate mesa/ramp/cliff proof after vegetation review |

Register a small first batch of six representative cases: meadow with lone trees,
open grove, dense forest interior, forest edge/clearing, pond bank and inter-town
train corridor. Keep one selected balanced composition per case initially; expose
sparse/lush alternatives with distinct pinned identities when submitted for review.
Include a seam in at least one case and a settlement/station transition in the ride.
Use actual generated views, not conceptual illustrations presented as game output.

Human review questions:

- Do the landscapes feel natural and recognizably different?
- Is there enough open space to walk, play and build?
- Are forest edges and ponds attractive at normal game scale?
- Does train travel alternate between open views, groves and substantial forests,
  without repetitive grids or conspicuous empty strips along the track?

Review links use `https://tilefun.graehlarts.com/tilefun/`; register candidates in
Workshop so unchecked work appears in the inbox. Changed pixels/settings return
to review. Existing exact city snapshots and promoted banks remain immutable.

## 4. Verification and integration checkpoint

Automated invariants: deterministic query/chunk-order results; positive/negative
seams; pond terrain/overview agreement at suitable detail; no trees in water or
reserved access; curved-track and bridge clearance; unique IDs; deletion/move
persistence after reload; bounded caches and placement work. Dense-case walking
must demonstrate usable gaps; an overview label alone cannot establish this.

Exercise game and affected lab through real Worker authority and Canvas/GPU
presentation, including a sustained train trip and an edited/reloaded forest.
Measure density effects on prop count, generation time, terrain preparation,
residency and frame pacing against the same baseline route. Report desktop/device
limits; readiness alone is not a phone-performance or frame-pacing result.

Run repository-required typecheck, unit tests and lint. For implementation,
refresh art catalog then Workshop manifest after recipe/render/input changes;
run build and Playwright, generation/explorer benchmarks, and
`npm run streaming:bench -- --assert-ready` for generation/streaming integration.

After human composition review, select one default and compose it into the current
regional generator for fresh/recreated worlds. Preserve simple Classic/Island/Flat
presets, procedural edits and frozen review snapshots. No version bump is required
under current greenfield policy; same-version existing worlds are not migrated.

## Deferred

Climate simulation; broad biome roster; new wildlife/AI; seasonal growth; general
rivers; mountains/mesas and road/rail rerouting over them; arbitrary forest pattern
authoring. The owning topic records the extension boundaries and next mesa proof.

## Planning checkpoint

Source inspection confirmed the current composition omits `CountrySource` and
that its rectangular woodland loops are unsuitable as the complete natural-cover
solution. Documentation only; no assets, recipes or generator behavior changed.

Planning validation: typechecks and all 1,719 unit tests passed; `npm run check`
completed with existing warnings/informational diagnostics and no errors.
Runtime/browser validation belongs to the implementation checkpoint above.


## Asset audit checkpoint

Read the trusted Workshop inbox and art notes on 2026-10-07. Existing city reports
and the five unchecked fenced-tree cases were left untouched. This is a new batch,
not a repair of a paused batch. No feedback events or approval records were changed.

| Source | Finding | First-slice decision |
| --- | --- | --- |
| Runtime `prop-oak-tree` / `public/assets/props/oak-tree.png` | Existing 64×64 sprite, 16×12 trunk, finite-height crown; fingerprint begins `d0cc6d4bcf31` | Reuse unchanged for every preview density; normal collision and depth |
| Runtime palm | Existing geometry/art, different landscape character | Defer from the temperate palette |
| Trees family: `tree-1`–`tree-3` | Three standalone forms with color variants and separately cataloged tree bases | Available for palette review; not assumed to share oak collision |
| Forest 1–3: `F01`–`F09` | Three left/center/right sets; family examples include dense repeated rows | Owner source feedback identifies repeatable forest centers; still need footprint, edge, canopy and traversal composition review |
| Fenced trees v1 | Horizontal south-fence strip; five unchecked pattern scenes | Keep separate from wild forest placement |
| Terrain `me03`, `me07`–`me10`, `me13`, `me15`, `me16` | Committed grass, sand and shallow/deep water transitions | Reuse through BlendGraph; no source pixels changed |
| Shrubs, reeds, flowers, mushrooms | Broader source/catalog possibilities, no new habitat palette selected here | Follow-up palette audit; do not imply they were promoted or generated |

The first preview deliberately tests spatial composition with one existing tree.
Source modules remain accessible from the lab's Trees and forest link. This is
not the final visual variety or a claim that dense forest kits have been integrated.

## Implementation checkpoint

- Implemented six pinned scenes in `NaturalLandscapeRecipe.ts`; three densities
  each give 18 unchecked candidates under `natural-landscapes`. Balanced is the
  initial suggestion, not an approval. Candidate identity pins settings/recipe,
  generation sources, relevant art fingerprints, prop geometry and shared drawing.
- Forest/micro-grove/clearing fields feed a jittered 4-tile candidate lattice.
  Coordinate priority rejects anchors closer than 2.6 tiles, leaving trunk gaps
  and avoiding query-order state. Per-world IDs preserve deletion/move records.
- Ponds use 128-tile owners, irregular elliptical boundaries and dry banks;
  admission reserves their entire possible bank envelope against existing roads,
  rail/stations/bridge approaches and towns. No planning recursion was added.
- Overview and exact preview share the natural planner; the existing World geometry
  lab delegates these fixtures to the same ScenarioPresentationHost, Realm, Worker,
  production railway and render backends. No independent physics/render engine.
- Preview profile lives outside the saved GenerationDescriptor. Saved snapshots and
  archives reject experimental overlays; normal creation omits it. Exact preview
  remains bounded at 81 chunks, with a profile-specific 2,048-placement safety cap
  (ordinary preview retains 512). Natural caches cap reservations at 64 cells and
  ponds at 128; broad overview omits local features when its budgets cannot admit them.
- Seed 2026 supplies inland and train scenes; seed 7 supplies the edge/clearing.
  Seed 42 is the water-heavy diagnostic seed. All three exercise production rail
  reservations; negative-coordinate forest and pond/chunk seams are covered.
- A larger pond-clearance envelope correctly rejected the initially selected pond
  near infrastructure. The review now uses the admitted `pond:1:-2` at seed 2026,
  viewed from tile 227,-183, rather than overriding admission to preserve a screenshot.
- Native captures wait for authoritative blend data as well as raster settling.
  Scenario readiness alone can precede the first completed terrain blend packet;
  that existing startup behavior is not a terrain-content change.

The manifest rebuild preserves frozen city snapshots, approved vehicle banks and
all source-image fingerprints. Three excluded train experiment fingerprints and
six character controller fingerprints change because they hash the complete
ScenarioSession/Realm source containing the new optional composition parameter.
Their recorded decisions are not rewritten; no character pixels/settings changed.

## Review links

The live inbox reports a current manifest with **18 unchecked, 0 changed,
0 approved, 0 needs changes and 0 excluded** natural-landscape candidates.

- [Regional planning overview](https://tilefun.graehlarts.com/tilefun/world-explorer.html?seed=2026&x=-350&y=-450&zoom=1&landscape=balanced)
- [Forest and density comparison](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-forest&landscape=balanced#/tool/world-geometry)
- [Pond bank](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-pond&landscape=balanced#/tool/world-geometry)
- [Train journey](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-train&landscape=balanced#/tool/world-geometry)

Next: review forest density/open space and pond banks, select a default, then
integrate the chosen composition into fresh regional worlds. Broader tree palettes
and the existing dense forest modules should follow as distinct composition work;
mesas retain the separate World geometry proof boundary.

## Validation evidence

- Typechecks and all **1,731 unit tests** passed. Lint has no errors (118 existing
  warnings, 34 informational diagnostics). Catalog, manifest and production build
  pass; the manifest verifies all 623 identities in full Chromium at retina scale.
- The full browser run passed 376 of 379 tests. It exposed a generator-switching
  regression: refreshing the new profile controls copied Classic/Flat's version
  into the regional-only revision dropdown. `syncSource` now retains a valid current
  regional revision for those presets; affected explorer and landscape checks are
  rerun: all **12 explorer/landscape browser checks pass** (31.3 seconds).
- The other two failures are existing wildlife evidence availability: the registered
  `demos/wildlife-v2/fox/pilot-v1/preview.gif` is absent in this checkout. Native review
  correctly blocks before the playback mutation test reaches its expected error.
  The wildlife topic documents archived GIF dependencies. No frozen evidence,
  checksum, approval or safety check was replaced to hide these failures.
- Landscape-specific browser checks pass in Canvas and GPU, including actual
  Worker trees, walking, reload, settled terrain, train motion, renderer/Worker
  disposal, profile URLs and exact-review entry at 390×844. Native authority tests
  complete a lush inter-town roof ride, reload midway, travel over 8,000 pixels,
  and stream more than 100 natural trees while preserving the passenger's support.
- Captures inspect actual forest, pond banks, train scenery, regional/exact maps
  and phone controls. Tests wait for authoritative blend data before snapshots.
- `npx tsx scripts/benchmark-natural-landscape.ts` measures 49 chunks at each
  pinned location and a 1,024×768-tile planning query. Desktop chunk-generation
  medians are 0.78–0.98 ms for current and 1.04–1.25 ms for natural profiles;
  natural p95 values are 1.35–1.82 ms. These include placement enumeration, not
  rendering, asset loads or persistent caches across separate profiles.
  The forest window contains 163/351/498 unique trees in sparse/balanced/lush,
  versus zero in current. Natural overview CPU is 30–45 ms versus 3.4–6.6 ms
  current: the additional reservation/pond work is measurable and runs in the
  existing cancellable worker. Train-window counts include normal station props;
  they are not a density measurement for the entire journey.
  [Raw generation/overview measurements](../benchmarks/068-natural-landscape.json).
- `npm run streaming:bench -- --assert-ready` passes for the ordinary current
  generator with zero missing/incomplete terrain frames in walk, sprint and reverse
  stages. This checks the shared factory/Realm integration without changing the
  production profile. [Readiness and frame summary](../benchmarks/068-streaming-readiness.json).

Sustained forest render-frame percentiles against a matched ordinary route and
physical-phone measurements remain integration evidence, not claims of this preview.
The complete simulated train route proves authority/support/residency behavior;
the short real-time Canvas/GPU ride proves presentation and readiness at its sampled
points. Neither establishes smooth performance on every device or along every route.

## Owner follow-up: solid patterned forests

The owner praised the full-fidelity embedded train world, then clarified that dense
forest should include the existing repeating multi-tree/staggered patterns and
large impassable areas. This supersedes the first slice's universal walkable-gap
intent. Read the current inbox/art notes: the natural batch was 18 unchecked with
no reports or approvals. The exact prior source acceptance is recorded in
[the varied-offset forest review](053-semantic-tileset-map/notes/2026-10-04-family-contact-sheets.md#owner-acceptance-varied-offset-forest-compositions).

Implemented **Extra dense · forest patterns** (`landscape=thicket`), with three
pinned generated examples of F02/F05/F08 centers and their matching F01–F09 caps.
Source rectangles, native periods and 48px overlap follow the accepted interior
direction; seeded row phases, exposed boundaries and physical footprints are new
composition work for review. No source pixels or accepted family examples changed.

Each 128-tile owner admits an irregular mass from broad habitat cover. An ellipse
envelope varies each row's length; seed/global-row offsets prevent phase resets
at chunk edges. Each complete row is checked against dry terrain and production
town/road/curved-track/station/bridge reservations. Rejecting a row can create
openings near water or infrastructure. Ordinary trees are excluded from these
crowns; other countryside retains the lone-tree/grove field. Caches cap forest
owners at 64 in addition to the previous bounded reservations/pond caches.

`ForestThicket.ts` produces ordinary multipart Props, with stable procedural row
IDs and shared factory reconstruction. The solid center ground band is 48px deep,
with tapered cap footprints, finite 80px height and no walkable top. Source F03's
shorter height remains explicit. A row is one editable prop: deleting it removes
that strip, rather than pretending every painted trunk is an independent object.
Normal chunks, broadphase, collision, binary replicas, Canvas/GPU scene collection
and save/reload own the behavior. No new simulation or renderer was introduced.

Nine locations × four profiles now produce 36 exact candidates. Selecting a new
forest-pattern scene initially selects Extra dense; the previous forest scene is
labelled Woodland · individual trees. Precise map queries show solid thickets as
the darkest cover. Extra dense raises broad cover to include forest masses along
the pinned town route, while leaving normal generator defaults and all prior
sparse/balanced/lush spatial settings unchanged.

Review:

- [Forest 1 · tall thicket](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-thicket-1&landscape=thicket#/tool/world-geometry)
- [Forest 2 · stump thicket](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-thicket-2&landscape=thicket#/tool/world-geometry)
- [Forest 3 · mixed thicket](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-thicket-3&landscape=thicket#/tool/world-geometry)
- [Extra-dense train journey](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-train&landscape=thicket#/tool/world-geometry)

Check the visible front/side against where movement stops, caps and ground joins,
patch size, routes around/between masses and the mixed palette. In-memory lab
composition versus full application hosting is documented in
[Gameplay scenarios](../topics/gameplay-scenarios.md#composition).

Initial evidence: all 1,737 units, typechecks, lint and production build pass;
641 candidate identities verify in full Chromium. Native tests block walking and
jumping at each kit's front, remove/reload rows, preserve negative-coordinate
seams and map agreement, and complete lush/extra-dense train journeys with a reload.
Six landscape browser checks pass in Canvas/GPU and phone layouts, including
all three pattern kits and real Worker collision. Captures inspect normal and wide
views on both backends. Broad regression and cost measurements follow below.

The full browser run passed 377/381. Two failures are the same absent archived
wildlife GIF described above. Two explorer phone-overflow checks caught the long
new select label widening the sidebar; the explorer now uses the shorter **Extra
dense** label, with pattern meaning retained in its nearby description. The
affected explorer/landscape rerun passes all **14 tests** (43.5 seconds), including
both phone overflow regressions; runtime composition is unchanged. Lint remains
error-free with the existing 118 warnings and 34 informational diagnostics.

[Generation and overview costs](../benchmarks/068-forest-thickets.json), measured
after the full browser suite stopped: Extra dense chunk medians are 1.04–1.18 ms,
p95 1.22–2.94 ms and observed maxima 2.81–5.91 ms across nine 49-chunk windows.
The three dedicated thicket windows include 17/15/9 native row props alongside
326/423/352 ordinary trees. A row contains multiple native sprite pieces; row
counts are not draw-call counts. Overview queries take 67–93 ms for this profile,
including footprint admission. The train's initial station window contains no
thicket rows; they enter residency later in the full journey. These CPU numbers
do not establish render frame pacing or physical-phone performance.

Final normal-world `streaming:bench -- --assert-ready` passes after the shared prop
factory additions, with no visible missing/incomplete terrain during walk, sprint
or reverse. [Recorded readiness](../benchmarks/068-thicket-streaming-readiness.json).
The live Workshop manifest is current and lists all 36 natural candidates unchecked;
no human decisions were synthesized. Default-world integration remains the next
checkpoint after composition review.

## Fractional-zoom seams follow-up

The owner's two cropped screenshots exposed thin vertical lines between repeat
pieces. A native F02 row drawn through `drawScene2D` over a contrasting background
reproduced the gap: at zoom 0.8, the 128px source width becomes 307.2px, but rounded
origins can be 308px apart. The atlas crop and repeat period are correct.

`Canvas2DRenderer` now projects and snaps both sprite edges, deriving destination
size from their difference. Canvas and GPU use this shared rule, including
flipped pieces and vertical offsets. No source art, row spacing, collision or
authority scheduling changed. Natural candidate fingerprints explicitly include
the drawing source; the 36 candidates remain unchecked.

The renderer lab's new translucent tiled-rectangle regression found gaps/overlaps
in 14 of 32 backend/zoom/camera cases before the correction and zero afterward.
It includes horizontal/vertical joins, flips, height offsets and distant world
coordinates. All 1,737 unit tests, typechecks, lint and build pass; catalog and
all 641 candidate identities verify in normal Chromium at retina scale.

The scheduling explanation is recorded in the embedded-labs topic: explicit
scenario steps support repeatable headless tests and precise inspection, while
the game authority uses its independent ServerLoop. In-memory storage does not
require a different scheduler. Game-host timing evidence remains necessary;
consolidating interactive hosting while retaining manual test stepping is a
separate follow-up.

Final browser validation: **380/382 passed** in 12.3 minutes. The new seam
regression, all six landscape checks, shared renderer tests, complete Canvas/GPU
city-train journeys and geometry/grade tests pass. The two failures are the
pre-existing wildlife-review checks blocked by the absent archived
`demos/wildlife-v2/fox/pilot-v1/preview.gif`; no archive or approval was rewritten.
Fresh normal/wide captures of all three forest kits were inspected. The Workshop
manifest remains current, with all 36 natural candidates unchecked.
