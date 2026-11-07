# Tree house and ladders

Status: lab delivered for owner/child play review; outskirts nature park not started.
Owner request, 2026-11-07: more varied outdoor areas at the edge of town —
tree houses, camping and wildlife spots — prototyped in a lab first. The tree
house must be climbable and enterable; one floor is enough. Start with a small
piece to get the ladder mechanic right. City greens stay as they are for now.
Owners: [world geometry](../topics/world-geometry.md),
[embedded engine labs](../topics/embedded-engine-labs.md).

## Delivered

- **Lab.** Workshop → World geometry → `tree-house`
  (`/tilefun/workshop.html?geometry=tree-house#/tool/world-geometry`). Data-only
  `scenarios/TreeHouseRecipe.ts` on the ordinary ScenarioSession/Realm/Worker,
  shared physics, prediction and renderer. Starts: `ground` (ladder foot),
  `porch`, `inside`. Oaks, a picnic table and a bench dress the clearing.
- **Ladder mechanic.** `PropCollider.ladder` marks a passable climbable column
  (zBase → zBase + zHeight) climbed facing north onto the walkable exit beside
  its north edge. `physics/Ladders.ts` maps player intent inside the shared
  `PhysicsScene.step`, so authority and prediction agree without new replicated
  state: ↑ climbs (48px/s), ↓ descends, no vertical input hangs on, ← / → lets go,
  ↑ at the top steps onto the porch; walking off the porch over the ladder hangs
  on and ↓ climbs down. It reuses the prescribed-altitude motor; the previous
  target (already in the physics codec) is the hold base, so hanging on does not
  creep. Jump is ignored on the ladder. Players only; mounts, NPCs and animals
  never climb.
- **Tree house prop** (`entities/TreeHouse.ts`). A 24px deck — above the 22.5px
  jump apex, so the ladder is the way up — on a slab too low to walk under;
  porch, east deck and a 60×33px cabin with walls and a 24px doorway.
  Art is unedited Modern Exteriors atlas crops on the 16px grid: the assembled
  tree house (1328,96 144×176), the matching bare deck from its base kit
  (1472,192), a camping sleeping bag, backpack and lantern. No pixels changed.
- **Enterable cabin.** `PropCollider.room` marks a presentation-only volume.
  Sprite parts flagged `view: "outside" | "inside"` swap when the observing
  player's footprint is inside it, so the roof, walls and canopy lift away and
  the furnished floor shows. Shared `collectScene` owns it, so the game gets the
  same behavior; physics and other observers are unaffected.
- **World depth for raised decks.** The GPU world raster gives each sprite an
  upright depth plane at its feet, which put deck pixels in front of a player on
  the porch. Sprite parts may now name the plane they depict: `depthDy` (upright
  at another ground Y) or `depthFloorZ` (horizontal floor). The tree house uses
  three composite bands: canopy upright at the deck's back edge, deck band on the
  24px floor, ground band (lip, ladder, trunk, tyre swing) upright at the deck's
  front. Existing props are unchanged.

- **Lab plumbing.** World geometry recipe/start selection and fixture intros moved
  to `workshop/WorldGeometryFixtures.tsx`, and Workshop candidates are now a
  lookup table. Every other fixture, ID, prompt and fingerprint is unchanged.
  The code-health baseline accepts +5 lines in `PhysicsScene` for the ladder hook.

## Evidence

- `TreeHouseRecipe.test.ts`: jumping at the deck edge never reaches it; the climb
  rises monotonically, hangs on for a second, survives save/reload mid-ladder,
  steps onto the porch, enters the cabin, is stopped by the back wall, reloads
  inside, walks out and climbs down without a fall; client prediction tracks the
  authoritative height every tick; sideways input lets go to the ground.
- `collectScene.test.ts`: outside/inside part swap by observer room, porch keeps
  the roof, floor depth carried on the deck band.
- Playwright Chromium against the dev server (GPU default): ground, climbing in
  front of the ladder, porch and furnished cabin views, no page errors; the
  porch player was invisible before the depth bands. Every World geometry fixture
  still opens ready with its previous title and start buttons.

## Limits

- Ladders face north only (south-face ladders read clearly in this projection).
- Inside, the cabin has no drawn walls: the roof cutaway shows the bare deck.
- The tree house is a scenario prop, not a `PROP_DEFS` type: no editor palette,
  generation or art promotion. Crops need the normal art review before world use.
- The climbing pose reuses the walk cycle (back view going up, front view going
  down).

## Next

1. Owner/child play review of climb speed, hang-on, getting down and the cabin.
2. Possible polish: keep facing the ladder while descending; draw low cabin
   walls inside; a trapdoor/second ladder variant.
3. Grow the lab toward the outskirts nature park: campground loop (tents,
   campfire, picnic tables), fishing pier, wildlife meadow with existing
   species, trails. Then a generated park beside towns following the motocross
   planner pattern ([224](224-generated-motocross-parks.md)).
