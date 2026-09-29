# Furniture catalog and scene composition

## First milestone: curated objects and a small review round

The wall work is stable after 233 human-approved images. Preserve those exact
images and reopen wall work only when a furnished scene demonstrates a problem.

Generic Home 1 remains a useful visual reference, but its furniture layer is one
flattened image. The first furniture milestone uses individually placeable whole
sprites from the same Modern Interiors pack. It does not stamp that overlay into
new rooms or treat every numbered atlas entry as a complete object.

`src/interiors/FurnitureCatalog.ts` defines 16 named objects: single and bunk beds,
wardrobe, dresser, bedside table, worktable, stool, potted tree, floor lamp,
fireplace, log rack, rug, wall picture, small plant, table lamp, and standing
mirror. Every sprite was visually inspected. Dimensions are checked against the
source index. All use the normal shadow variant; colors and shadow styles are
not separate review permutations. Footprints and access areas are initial curated
metadata, subject to human review, not automatically proven by source inspection.

Each definition has a stable ID and source key, sprite size, placement anchor,
physical footprint, blocking flag, supported facing, and optional usable surface
and access rectangle. Transparent padding remains in the sprite; anchors refer
to the object's actual base rather than the PNG's bottom edge. Sprite bounds and
collision footprints are deliberately separate.

## Separate architecture and furnishing

The emoji architecture sketch remains unchanged. A separate `furniture` array
contains object instances. Coordinates use native pixels, allowing placement
finer than the 32px architecture sketch cell. The UI can overlay furniture emoji
on that plan or show the underlying floor symbols; neither changes the sketch.

```ts
furniture: [
  { id: "desk", asset: "worktable", x: 64, y: 72 },
  { id: "plant", asset: "table-plant", on: "desk", x: 10, y: 20 },
]
```

There are four semantic placement layers:

| Layer | Examples | Placement |
| --- | --- | --- |
| Floor | Rugs | Nonblocking ground footprint; below furniture |
| Standing | Beds, tables, cabinets, plants | Ground anchor and solid footprint |
| Wall | Framed picture | Mounted to the visible north wall in this first round |
| Surface | Small plant, lamp, mirror | Anchor relative to the named support's sprite origin |

Layers are not arbitrary numeric draw priorities. Standing objects sort by their
ground anchors. A support and its attached children form one drawing group, so
the children move with the parent, draw above it, and remain behind nearer
standing objects. The source orientation is explicit; unsupported rotations and
flips are rejected instead of rotating perspective artwork.

The first renderer supports open rectangular room shells. Rugs draw after the
floor but before architecture; wall decorations and standing groups follow the
shell. Interior partitions and their projected occlusion are explicitly outside
this first renderer's scope, and interior-wall layouts are rejected. This keeps
the initial catalog review focused while the established wall renderer remains
unchanged. There is no player integration or general apartment furnishing solver
in this milestone.

## Validation and feedback

Placement checks reject unknown assets, duplicate IDs, invalid coordinates,
missing/cyclic/unsuitable supports, objects extending beyond usable surfaces,
overlapping supported items, overlapping solid footprints, occupied doorway
cells, invalid wall mounts, and blocked or out-of-room access rectangles. Source
sprite dimensions and render bounds are also checked. Access rectangles describe
local clearance; character-sized route finding is a subsequent milestone.

Stage 15 contains eight phone-sized cases covering all 16 entries. The first six
isolate small object groups; the last two combine them into a bedroom and studio.
The smallest scenes display at 2× on a 390px phone viewport. Optional **Footprints
& access** outlines distinguish solids, rugs, supported items, and local access
space. **Objects in this room** names every instance and its support.

Good/Wrong, optional notes/pins, offline outbox, unchecked counts, and the
two-failure pause are reused. Saved feedback includes the separate placements and
catalog version. Furniture fingerprints include the clean rendered pixels,
sketch, placements, and used catalog definitions. Thus changing a footprint or
support rule reopens its cases even if the visible image does not change. The
diagnostic overlay does not change that fingerprint; it may appear in a submitted
screenshot, just like report pins. Historical wall fingerprints are unchanged.

The review source atlas grows from 27 to 43 sprites, packed into 256×183 pixels.
It contains source sprites only. Generated room images and computed fingerprints
are still regenerated, not cached. Search and reduction remain offline; the wall
reducer explicitly rejects furnished fixtures instead of silently discarding
their furniture.

Review: `interior-review.html?stage=15&unchecked=1`. One or two failures are enough.
Promote furniture images to the regression baseline only after human approval of
their current pixels and metadata. Bump the catalog version when revising its
definitions; keep historical feedback intact.

## Follow-up milestones

1. Apply catalog feedback and add compact overlap cases: tall objects behind
   shorter ones, near-wall placement, and a character passing behind/in front.
   Integrate object footprints and drawing anchors with runtime props.
2. Add character-sized entrance-to-access route checks and furniture occlusion
   at approved interior partitions. Test tight spaces before larger apartments.
3. Build arrangement recipes: bed + bedside table, desk + chair, seating + rug.
   Place major objects first, preserve routes, and decorate supported surfaces
   last. Use the same eight-case selection and two-report loop.
4. Reconstruct more of the authored sample using individual objects, then generate
   small furnished rooms. Prefer variations in arrangement, density, and purpose
   over recolors. Use separate A/B preference rounds when tuning composition.

Manual placement tools can use the same instance list and validation functions;
the reviewer should not have to paint scenes to provide useful feedback.

## Validation of the first round

Typecheck, build, 936 unit tests, and all 84 browser tests passed. The latter
include the exact 233-image wall baseline, source sprite payload/loading checks,
phone layout, support metadata in saved feedback, overlay-independent approval
hashes, reload behavior, and the two-report pause. The public page shows eight
unchecked furniture cases without horizontal overflow. Biome retains the existing
65 warnings and five infos; no new diagnostics were introduced.

## Pivot from static approval to movement, 2026-09-29

Feedback on the bunk/wardrobe and worktable cases said the sprites looked
reasonable, but the coarse emoji positions could not communicate usable bounding
boxes, precise placement, or behind/in-front occlusion. Static furniture review
is now on hold. Furniture emoji are removed from the architecture sketch, and the
review page links prominently to `furniture-playtest.html`.

The new movement scene uses `createPlayer`, `stepPlayerFromInput` (the shared
server/client movement implementation), and `aabbOverlapsPropWalls`. Catalog
footprints convert to ordinary game prop colliders. The character retains the
game's 10×6px foot collider and 16×16 sprite. Furniture is never converted into
blocked 32px sketch cells. This first sealed rectangular room has explicit inner
pixel bounds; these are shared by movement and furniture placement. Thus usable
floor inside the coarse border sketch cells remains accessible. General wall
collision generation and overworld portals remain future work.

Three small scenes isolate a bunk bed, wardrobe, and table/plant/stool group. The
stool is closer to the table than in the original static case. Arrow/WASD or
holdable phone controls move the player. **Walk around object** finds routes on a
2px grid using the full player collider, then follows them through actual game
physics, without teleporting or disabling collision. The preset circuits pass
behind and in front of each object. **Place furniture** supports alpha-aware
sprite selection, dragging, integer X/Y inputs, and 1px nudges. Support children
move with their parent. Invalid placements and placements overlapping the player
are rejected; layouts persist locally and Reset restores the preset.

Diagnostic views deliberately separate three things:

- Collision shows only real blocking prop boxes and the player's foot box.
  The standing/access planning rectangles are not presented as movement blockers.
- Sprite bounds show the image extent, including transparent padding.
- Depth lines show the feet-based drawing order. Actors can enter the order
  between furniture groups, but never split a table from its supported items.

The player is drawn using the game Canvas2D sprite renderer. Static furniture
rendering uses the same shared ordering function with no actors, preserving its
pixels. Jumping, sitting, climbing onto furniture, and arbitrary vertical
occlusion are not implemented or implied by this ground-walking test. This is an
isolated runtime harness using real movement code, not yet an enterable world
interior.

**Report issue** saves a screenshot, exact separate placements, player position,
facing, selected object, mode, and optional note to the existing feedback inbox.
Movement reports use distinct `furniture-motion-*` IDs; they are not catalog
approvals. The offline outbox retries with the same ID after reload. Asset alpha
lookup caches source sprite pixels only; room images and generated fingerprints
are not cached. No new static review permutations are added.

Next: use movement reports to refine the actual footprints and drawing order.
Then integrate the resulting adapter with enterable indoor scenes. Return to
furniture arrangement generation after these interactions are trustworthy.

Validation: typecheck, production build, 944 unit tests, and all 87 browser tests
pass. The browser suite covers real collision stops, one-pixel moves, alpha-aware
dragging, completed automatic walks in all three presets, phone layout, persisted
placements, and offline report retries. All 233 approved wall renders remain
identical. The explicitly approved bedside scene also matches its saved verdict
and joins the regression baseline (234 images total); no other furniture case is
promoted. Biome remains at the existing 65 warnings and five infos.

## Height, jumping, and positive runtime verdicts, 2026-09-29

The movement test now passes finite `zHeight`/`walkableTop` colliders to the same
prop collision and surface-sampling code used in the game. Space or the holdable
phone Jump button uses the real jump input path; the player can land on furniture,
stand there, and fall when walking off. Gravity presets (1, 0.5, 0.25, and 0.1)
allow inspection of tall objects. Reset player clears height, vertical velocity,
and jump state. The view follows unusually high jumps so the player stays visible.

`FurniturePhysics.ts` holds provisional runtime heights for the four blocking
objects in these three scenes: bunk 24px, wardrobe 32px, table and stool 10px.
They are candidates for review, not inferred approvals of the sprites. The
selected object's height and landable-top flag can be edited and saved locally.
Height edits that would intersect the player are rejected. These runtime values
are separate from static catalog metadata, preserving the prior static approval.
The current shape is one rectangular prism per object; plants remain nonblocking
surface decorations. Compound bodies and multiple top surfaces are future work.

The collision overlay now draws ground and raised top rectangles with vertical
edges, including the player's volume at its actual Z. Green tops are landable.
“Depth lines” is renamed “Draw-order guides,” with an explanation that these
lines describe rendering order, not physical height. Player sprites shift upward
by world Z and use the game's Y+Z sorting convention.

Both **Looks good** and **Report issue** are always visible at the bottom of the
screen. Either captures the scene, screenshot, player XYZ/vertical velocity,
gravity, collider heights, and landability. Runtime verdicts persist through the
same offline outbox and server inbox as other feedback, but never approve static
catalog cases. The displayed verdict applies only to matching placements,
catalog metadata, runtime physics version, and gravity; changing these shows
Unchecked. Walking or changing diagnostic overlays does not erase a verdict.
New runtime physics or rendering behavior must bump the runtime version.

Next review: check whether the raised collider tops match each sprite and whether
landing/standing looks and feels correct, then refine those heights before adding
more furniture. Normal gravity should not reach the wardrobe; 0.25× can.

Validation: typecheck and production build pass, as do 947 unit tests. The full
browser run passed 88 cases; the remaining jump-control test was clicking below
its desktop viewport. Giving that phone test an explicit phone viewport and
scrolling its control into view made its rerun pass (89 browser cases verified).
New checks cover actual low-gravity landing, standing and falling, height-based
collision, airborne reset, persisted good verdicts and their invalidation,
phone jump cancellation, and keeping very high jumps visible. The public phone
smoke test visibly landed on the wardrobe at Z=32. The exact 234-image static
baseline still passes. Biome retains 65 warnings and five infos.

## Eight more runtime sets and automatic review advance, 2026-09-29

The bunk, wardrobe, and worktable sets have explicit good runtime verdicts with
matching default configurations. Their exact signatures are protected in
`tests/fixtures/furniture-motion-approved.json`; the current three approvals stay
valid. New sets extend the existing source-inspected catalog rather than adding
color-only variations:

- Single bed, bedside table, and supported lamp.
- Low dresser with a supported mirror.
- Potted tree, with a small solid footprint beneath the taller sprite.
- Tall floor lamp.
- Fireplace with a separate low log rack.
- Stool on a nonblocking rug.
- Dresser beneath north-wall artwork.
- Stool and rug between a plant and floor lamp.

The 11 movement sets now exercise all 16 catalog assets. The seven newly exercised
solid assets have provisional runtime heights; tree, lamp, and fireplace tops are
not landable. These remain editable and unapproved until reviewed. Rugs and wall
art show their nonblocking status and hide physical-height controls. Wall art has
no automatic orbit action because its anchor is outside the floor area.

Looks good first persists its full report in the offline outbox, then immediately
advances to the next unchecked set without waiting for the network. Previously
approved and reported sets are skipped, the search wraps once, and the last
approval shows batch completion instead of cycling back. Reports stay on the
current set so notes and follow-up inspection remain easy. If local persistence
fails, advance waits for a successful server save. The picker marks each set with
its verdict; counts show unchecked, approved, and reported totals. Next unchecked
also permits manual skipping. `?scene=next` opens the next pending set after saved
verdicts load. Editing a configuration still invalidates only its matching grade.

All new default circuits use actual collision-aware walking. The narrower plant
revealed an exact-edge corner issue in waypoint following; route nodes now have a
1px clearance margin, and obstructed orbit targets can choose a clear node within
4px. Manual movement keeps the exact physical collider. This affects the optional
automatic route only, not approved geometry or physical behavior.

Next: review these eight sets for height, occlusion, and spacing. After that, add
new source-inspected furniture families beyond this initial catalog, especially
seating and kitchen/storage furniture, using the same small runtime scenes.

Validation: 950 unit tests, typecheck, and production build pass. All 100 browser
cases are verified: the initial full run passed 98; the furniture suite rerun
verified all 11 automatic circuits after the route correction, and the remaining
phone pointer test passed after scrolling its control and canvas into view. The
queue test covers offline advance/retry, preserving the three approvals, all eight
new approvals, and final completion without looping. All 234 static image
baselines remain exact. The public phone page loads the next new scene with
8 unchecked / 3 approved, and all eight new renders were visually inspected.
Biome retains the existing 65 warnings and five infos.
