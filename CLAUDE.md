# CLAUDE.md

## Cross-Project Context

For cross-project context (how this project relates to Transistor, JSTorrent, etc.), see `~/code/dotfiles/projects/README.md`.

## After making changes

Always run typecheck and tests before considering work done:

```bash
npx tsc --noEmit          # typecheck
npm test                  # unit tests (vitest)
npx biome check --write . # lint + format
```

For changes that affect rendering or integration, also run E2E tests:

```bash
npm run build && npx playwright test
```

## Setup and data portability

See `docs/setup-and-local-data.md` for fresh-machine dependencies, committed
versus ignored art, regeneration inputs, and review/browser/world data transfer.
Normal builds use committed assets. Keep NDJSON histories and local state out
of Git; copying server logs does not copy browser drafts, outboxes or worlds.

## Public preview and art feedback

The live deployment at `https://tilefun.graehlarts.com/tilefun/` serves this
checkout through Vite. Use that origin for human review links; isolated local
preview servers are for automated validation.

The central workspace is `/tilefun/workshop.html`, linked as Tilefun Workshop
from the game sidebar and world menu. It includes all review batches, requests,
activity/history and tools. Register new batches/candidates so zero-event work
appears in the global inbox. Old `/tilefun/tools.html` and lab links still work.
See `docs/tilefun-workshop.md` for login, shared APIs and data. Use
`npm run workshop:inbox` for the combined trusted local read. Public/LAN private
API reads require the owner cookie; new/legacy writes also require its CSRF
token. Never commit owner/session files. Direct localhost with a loopback peer
and no forwarding headers skips login (CSRF/origin checks remain). Set
`WORKSHOP_LOCAL_AUTH_BYPASS=0` to exercise login locally; auth/browser tests do
this explicitly. Tests use isolated auth/data and Playwright Chromium, including
full Chromium GPU rendering for district fingerprint parity.
After render/recipe/input changes run `npm run art:catalog` then
`npm run workshop:manifest`; build checks both. Do not synthesize approvals.

The art workbench is at `/tilefun/art-workbench.html`. See
`docs/art-workbench.md` for source-use inventory coverage and the shared note
inbox. Read pending art requests with `npm run art:notes`; notes persist in
ignored `data/art-notes/notes.ndjson`. Update status/reply after acting on the
exact recorded source revision/selection. Run `npm run art:catalog` after asset
source definitions change; the build verifies the generated inventory.

Building Lab review uses an unchecked queue with explicit human approvals.
Two Needs changes reports pause a batch; wait for the user to say “ready” in
chat before implementing that batch's art fixes. Read the saved reasons with
`npm run art:notes`. Agent replies/status changes do not count as approval;
changed recipes or rendered pixels return to review. See `docs/art-workbench.md`.

The street starter review is `/tilefun/building-lab.html?run=streets`, with six
phase-0 furniture cases and its own navigation/pause state. It uses the same
art inbox and review loop; CLI notes include the street case and prop types.
The stage now uses the dense neighborhood's shared pavement/asphalt/curb
composer; parking outlines are placement guides. These props are available for
editing/review, not yet selected by city worldgen.
The next district milestones are in `docs/tactical/007-dense-city-districts-and-street-life-plan.md`.

Road foundation review is `/tilefun/building-lab.html?run=surfaces`, with nine
source-backed width/curb/crossing/divider scenes, its own queue/pause, and shared
`src/road/CitySurfaceRecipes.ts` composition. It is a candidate surface contract
for regional-v4; earlier world revisions are unchanged. The approved neutral
lookup is now promoted, and all nine road review scenes have human approval. The divider is reviewed art
for a future promotion; v4 still pins its original neutral bank. Surface
notes carry a case ID and
`surfaceRecipe`, with no fake building or prop IDs.

The separate Road geometry batch has four new candidates at
`/tilefun/building-lab.html?run=road-geometry`: native curved curb joins,
pedestrian refuge, crossing approaches and curbside parking bays. These use
`city-surfaces-v2` in the same composer/renderer; place facts record crossings,
sidewalk extensions, island/landing bounds and parking reservations. Its
review queue and pause state are independent of the nine approved foundation
scenes. All cases are indexed in Workshop, including Roads sidebar counts.
All four cases are approved. Their exact art is promoted into regional-v6's
immutable commercial surface bank; the original review scenes remain unchanged.

Commercial street review is `/tilefun/building-lab.html?run=commercial`, with
four views of one `regional-v6` world (seed 2026, tile 300,519). Workshop has a
separate Commercial streets & parking batch under Dense neighborhoods. It shares
the dense planner, ordinary chunk/prop renderer, explorer and game handoff.
The wider avenue includes a refuge, shorter east crossing, marked bays, two
stationary cars, meters and curb furniture, with reserved clear walking strips.
Notes use `commercial-district-v1` and the commercial run; its queue/pause is
independent. Geometry overlays show bays, crossings, doors, colliders and routes.
`commercial-city-assets-v1.json` pins ten exact human approvals, prop geometry
and 61 opaque source cell recipes (persistent roadGrid IDs 15–75). Never
regenerate it in builds. Saved v6 output is frozen too; later changes need a new
revision/bank. New worlds still default to v4. All four commercial views are human-approved.

Dense neighborhood review is `/tilefun/building-lab.html?run=districts`, with
three views of one real `regional-v5` review world (seed 2026, tile 300,519). The lab,
explorer and game use the same plan, pinned building factories and terrain
renderer. The explorer link supports Play here; preview walkers are initial
poses, while the game simulates the planned routes. Review/navigation/pause
remain independent of the other runs. District notes carry `districtRecipe`,
case ID, promoted building IDs and prop types. Keep new runs indexed in tools.
V5 reuses the v4 placements/assets, aligns the plan's primary doorway with its
source art, and paves every visible door/step threshold to the street sidewalk,
including secondary condo and butcher entrances. V4 remains frozen and the default for new
worlds until the v5 review is approved. Explorer/game handoffs must carry the
candidate's actual generation descriptor, never a hardcoded prior revision.

`src/generation/regional/dense-city-assets-v1.json` is an immutable promotion
snapshot, not build output. Do not regenerate it from changing review candidates.
Regional v4 pins the neutral surface lookup and persistent RoadType IDs 5–14;
its geometry, assets, surface choices and realized fixtures have freeze tests.
Future output changes require a new revision and promoted IDs/bank. New worlds
default to Procedural regional with Dense districts (v4); older generators and
regional revisions remain available with legacy/old labels.

City places continue in `docs/tactical/009-city-places-and-indoor-performance.md`.
Small parking lots use regional-v7 and Workshop batch `parking` (three views),
also `building-lab.html?run=parking`. Place facts reserve driving access and a
separate clear pedestrian connection. These candidates await human review;
saved v7 output is frozen. Reviews without buildings can have empty prefab IDs.
Gameplay interiors cache native static floor/wall layers per active room;
furniture edits and actor depth remain live. `npm run interiors:bench -- --headed`
checks pixel parity and measures the isolated path through bundled Chromium.

Parks & squares candidates use regional-v8 / `run=parks` (four Workshop views):
pocket park beside apartments, neighborhood park with loop paths and play area,
and a square with open market reserve. Place recipes live in
`PublicSpaceRecipes.ts`; clear paths and paving are distinct facts. Saved v8
output and earlier review identities stay pinned. These views await approval.

Varied architecture candidates use regional-v9 / `run=architecture` (three
Workshop views). `city-architecture-assets-v1.json` pins new wide residential
and office/services recipes, source rectangles and doorway facts. This is a
candidate bank, not an approval promotion. Never regenerate in builds. Shared
building factories, interiors, planner and surface realization consume it;
source use is indexed. Saved v9 and prior revisions remain frozen.

People & destinations candidates use regional-v10 / `run=pedestrians` (three
Workshop views). `CityWalkGraph.ts` compiles bounded trips between doors and
public seating through the two admitted crossings. Four block walkers and eight
visitors use normal route AI/collision, with longer destination waits. Preview
actors stay initial poses; Play here simulates them. Seating access is reserved
in the city plan. Saved v10 and all earlier versions remain frozen. These views
await human review; thirteen new city views total are staged across v7–v10.
`npm run gameplay:bench -- --headed` measures indoor/outdoor gameplay frames and
checks room movement/return in isolated bundled Chromium. Both measured paths
held 8.3ms median frame intervals after caching; the user's device needs review.

Outdoor asset semantics and scene-location feedback continue in
`docs/tactical/010-outdoor-asset-catalog-and-scene-review.md`. Workshop's Outdoor
assets tool is native React (`#/tool/outdoor`); coverage inspection uses Source
art. `npm run assets:outdoor` builds/verifies committed-source coverage, rectangle
aliases and candidate geometry. Unknown collision stays unknown; runtime atlas
props and saved generations are unchanged. Detailed candidate geometry is shared
with production Prop/collision/renderer code under new explicit asset identities.
Human metadata proposals/approvals and scene notes use authenticated Workshop
`asset`/`scene` events and the existing ignored art inbox. Read their exact snapshots
with `npm run art:notes`; do not promote inferred labels/colliders automatically.
Status replies must preserve original metadata decision time. New used geometry
revisions need distinct asset versions. Neighborhoods default to one whole scene
per batch (`#/scene/CASE_ID`); crops are zoom shortcuts and retain old decisions.
World annotations record pixels, generation/seed and exact asset suggestions;
never interpret their compatibility source pointer as the scene location.
