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
