# City generation and promotion

Topic: city-generation
Status: dense neighborhood and commercial street checkpoints approved; v7–v10
candidates staged for review. New worlds still default to regional-v4.
Updated: 2026-10-03.

Owns the current city progression, review identities and immutable generation
banks. The [explorer guide](../world-explorer.md) owns usage and shared generation
contracts; [Tactical 007](../tactical/007-dense-city-districts-and-street-life-plan.md)
is the parent city milestone plan. Consult the live Workshop inbox for decisions
made after these recorded checkpoints.

Selectable regional-v11 adds [gentle traffic and roof riding](vehicles.md) using
v5's frozen dense-neighborhood terrain and a separate approved vehicle bank.
It does not promote the v7–v10 city candidates or change the default revision.

[Generated railways](trains.md) are planned, not implemented. Their future revision
must reserve town stations, rail corridors, structure approaches and street/walking
access together before placing buildings. The railway parent plan owns this new
work; existing city revisions and promotion banks remain unchanged.

## Review checkpoints and frozen output

### Street palette and road foundations

The street starter review is `/tilefun/building-lab.html?run=streets`, with six
phase-0 furniture cases and its own navigation/pause state. It uses the same
art inbox and review loop; CLI notes include the street case and prop types.
The stage now uses the dense neighborhood's shared pavement/asphalt/curb
composer; parking outlines are placement guides. Street palette approval alone does not select props for
city worldgen; the promoted generation banks below own that selection.
The next district milestones are in [Tactical 007](../tactical/007-dense-city-districts-and-street-life-plan.md).

Road foundation review is `/tilefun/building-lab.html?run=surfaces`, with nine
source-backed width/curb/crossing/divider scenes, its own queue/pause, and shared
`src/road/CitySurfaceRecipes.ts` composition. It is a candidate surface contract
for regional-v4; earlier world revisions are unchanged. The approved neutral
lookup is now promoted, and all nine road review scenes have human approval. The divider is reviewed art
for a future promotion; v4 still pins its original neutral bank. Surface
notes carry a case ID and
`surfaceRecipe`, with no fake building or prop IDs.

### Road geometry and commercial streets

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

### Dense neighborhood and default revision

Dense neighborhood review is `/tilefun/building-lab.html?run=districts`, with
three views of one real `regional-v5` review world (seed 2026, tile 300,519). The lab,
explorer and game use the same plan, pinned building factories and terrain
renderer. The explorer link supports Play here; preview walkers are initial
poses, while the game simulates the planned routes. Review/navigation/pause
remain independent of the other runs. District notes carry `districtRecipe`,
case ID, promoted building IDs and prop types. Keep new runs indexed in tools.
V5 reuses the v4 placements/assets, aligns the plan's primary doorway with its
source art, and paves every visible door/step threshold to the street sidewalk,
including secondary condo and butcher entrances. Tactical 007 records the
phase-1 neighborhood as approved. V4 remains frozen and the default for new
worlds; approval alone does not change that default. Explorer/game handoffs must
carry the candidate's actual generation descriptor, never a hardcoded prior revision.

`src/generation/regional/dense-city-assets-v1.json` is an immutable promotion
snapshot, not build output. Do not regenerate it from changing review candidates.
Regional v4 pins the neutral surface lookup and persistent RoadType IDs 5–14;
its geometry, assets, surface choices and realized fixtures have freeze tests.
Future output changes require a new revision and promoted IDs/bank. New worlds
default to Procedural regional with Dense districts (v4); older generators and
regional revisions remain available with legacy/old labels.

### Staged city places (v7–v10)

City places continue in [Tactical 009](../tactical/009-city-places-and-indoor-performance.md).
Small parking lots use regional-v7 and Workshop batch `parking` (three views),
also `building-lab.html?run=parking`. Place facts reserve driving access and a
separate clear pedestrian connection. These candidates await human review;
saved v7 output is frozen. Reviews without buildings can have empty prefab IDs.

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

## Next work

Review the thirteen v7–v10 views in parking, parks, architecture and pedestrians.
Keep candidate approval, asset promotion and default-generator selection explicit
and separate. After acceptance, the next place milestone is a farmers market
using the square's reserved center. Connected multiblock parks, additional
frontage orientations, east/west crossings, richer schedules and moving traffic
remain later work. [Tactical 009](../tactical/009-city-places-and-indoor-performance.md)
contains delivery evidence and the remaining boundaries.

Indoor rendering measurements now live under [performance](performance.md);
feedback and authentication rules live under [art review](art-review.md).
