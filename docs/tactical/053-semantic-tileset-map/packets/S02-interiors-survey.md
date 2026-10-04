# S02 — Interiors master and Room Builder reconnaissance

## Assignment

- Scope: whole original native 16px Interiors master and Room Builder master;
  thematic navigation plus bounded furniture/architecture trial recommendations.
- Mapper: Interiors survey worker; reviewer: pending independent assignment.
- Date: 2026-10-04. Revision: 1. State: visually surveyed, proposal ready for review.
- Outputs: this packet, [region proposals](S02-interiors-regions.json), and
  [reproduction helper](../../../../scripts/semantic-map-interiors-survey.py).
- Next action: independent broad-map review and P03 wooden cabinet pilot; no
  human approval or runtime promotion is implied.

## Source evidence

Coordinates below are `[x,y,width,height]` in **original source pixels**, top-left
origin, half-open extents. Packed aliases use separate fields. Rectangles are
exact navigation/search windows; they are not alpha-tight object bounds or
proven theme boundaries. Neighboring families overlap and some transitions cut
objects, so use the overlapping evidence crops before segmenting objects.

| Source | Dimensions | SHA-256 |
| --- | --- | --- |
| `assets/interiors/1_Interiors/16x16/Interiors_16x16.png` | 256 × 17024 | `a35b8ed8ef392657a9339e1ce0831a3efe7b4631bfff69835bb5ef3bc738550b` |
| `assets/interiors/1_Interiors/16x16/Room_Builder_16x16.png` | 1216 × 1808 | `f53d7cd04f275dfa4b3e1f410569d491275105e2710a0f86ec46edeff3ab576f` |

Reproduce the overviews and all detail crops with:

```sh
python3 scripts/semantic-map-interiors-survey.py --out /tmp/tilefun-semantic-interiors
```

The helper checks pinned hashes/dimensions, rectangle bounds and saved occupied
pixel/window coverage. It makes nearest-neighbor crops over a gray transparency
background, with original y-coordinate ticks. Every crop was visually inspected
with `view_image`: 18 Interiors crops, beginning at y=0,960,…,16320, each up to
1024px tall, and four Room Builder crops at `(0,0)`, `(576,0)`, `(0,848)` and
`(576,848)`, each 640 × 960. All neighboring crops overlap by 64px horizontally
or vertically where appropriate. The tall master overview rearranges these
strips side by side; it does not change original coordinates. A corrected 304px
panel stride preserves each strip's rightmost pixels; detail crops were unaffected.

Local evidence is disposable and is not committed:
[Interiors overview](/tmp/tilefun-semantic-interiors/interiors-overview.png),
[Room Builder overview](/tmp/tilefun-semantic-interiors/room-builder-overview.png),
[crop index](/tmp/tilefun-semantic-interiors/evidence.json), and
[Room Builder residual captions](/tmp/tilefun-semantic-interiors/room-builder-unclassified.png).
The JSON proposal lists the exact reproducible source rectangles for every crop.

Vendor `Theme_Sorter` filenames supply useful cross-check vocabulary: generic,
living room, bathroom, bedroom, classroom/library, music/sport, art, gym, fishing,
birthday, Halloween, kitchen, conference hall, basement, Christmas, grocery,
visible upstairs, jail, hospital, Japanese interiors, clothing store, museum,
TV/film studio, ice cream shop, shooting range and condominium. Their names do
not prove individual identities, boundaries or completeness. The master is a
mixed chronological strip, not 26 clean contiguous theme blocks. Library,
medical, music, gym and bedroom families recur in distant bands.
`public/data/modern-interiors-atlas.json` is supporting alias evidence only;
it has 19,493 entries and does not directly index the entire original master.
No human decisions were read or transferred into these proposals.

## Proposed interpretation

The broad Interiors map is an exhaustive disjoint **navigation-band** partition,
not an object-level semantic audit. Identity confidence concerns the observed
family vocabulary; all transition bounds have medium confidence. Mixed bands
retain multiple families instead of assigning everything to the nearest theme.

| ID | Original rectangle | Observed families / proposed theme | Identity confidence |
| --- | --- | --- | --- |
| S02-I01 | `[0, 0, 256, 416]` | Mixed beds/tables, rugs, pictures, lockers/shelves, chairs, portraits and potted plants | high |
| S02-I02 | `[0, 416, 256, 512]` | Purple/gold furniture, wooden cabinets, mirrors, bookcases, counters/registers, stairs, rugs and fireplace | high |
| S02-I03 | `[0, 928, 256, 320]` | Upright/grand pianos, guitars, harps, drums, microphones, balls and sports posters | high |
| S02-I04 | `[0, 1248, 256, 80]` | Cakes/balloons/gifts/plates and easels at the right; adjoining music/art equipment | high |
| S02-I05 | `[0, 1328, 256, 400]` | Easels/paint and mats/punching bags/weights at left; pots, toilets, sinks and laundry at right/lower | high |
| S02-I06 | `[0, 1728, 256, 256]` | Sinks, mirrors, tubs, toilets, shower stalls, buckets and laundry baskets | high |
| S02-I07 | `[0, 1984, 256, 224]` | Coolers, rods/tackle, compact chairs/stools, cooking equipment and fish/catch | medium |
| S02-I08 | `[0, 2208, 256, 192]` | Shade umbrellas and paired outdoor/leisure chairs, several colors and combinations | high |
| S02-I09 | `[0, 2400, 256, 544]` | Beds, dressers, toys, dolls, train set, rugs, low play tables; gym equipment intrudes lower right | high |
| S02-I10 | `[0, 2944, 256, 640]` | Pumpkins, webs, coffins, ghosts, ritual markings and stains; wooden tables, beds, windows and doors mixed in | high |
| S02-I11 | `[0, 3584, 256, 544]` | Bookcase size/color repeats dominate; curtains, coffin/bed/rug additions, podium and stage components | high |
| S02-I12 | `[0, 4128, 256, 608]` | Cabinets/counters, sinks, chairs and tables, cloths, fridges, ovens, cookware and food | high |
| S02-I13 | `[0, 4736, 256, 336]` | More bookcases interleaved with glass-topped tables and narrow cabinet/counter panels | high |
| S02-I14 | `[0, 5072, 256, 240]` | Podiums, platforms, projection/display pieces, lectern, chairs and equipment; draped tables | medium |
| S02-I15 | `[0, 5312, 256, 144]` | Desks, books, globes, chairs, chalkboards and bulletin boards | high |
| S02-I16 | `[0, 5456, 256, 208]` | Sofas/armchairs in multiple facing/size/color arrangements, cushions, small round tables and vases | high |
| S02-I17 | `[0, 5664, 256, 320]` | Table tennis, billiards, benches/tables/stools, wardrobes/cabinet sides and televisions | high |
| S02-I18 | `[0, 5984, 256, 288]` | Armchairs, low cushions, stairs/banisters, rug, curtains/windows, signs/tools and vending/display machines | medium |
| S02-I19 | `[0, 6272, 256, 256]` | Evergreen trees, gifts, wreaths, fireplaces, stockings, nutcrackers, stars and seasonal decoration | high |
| S02-I20 | `[0, 6528, 256, 784]` | Shopping carts, shelves/products, refrigerated displays, baskets, checkout, bakery food and meat/hanging carcasses | high |
| S02-I21 | `[0, 7312, 256, 160]` | Long stairs, railings, balcony/upper-floor sections; retail/fish/flower pieces at the right | high |
| S02-I22 | `[0, 7472, 256, 208]` | Fish counters/aquariums and fish pieces, produce/crates, hanging food/garlands and carts | high |
| S02-I23 | `[0, 7680, 256, 192]` | Broken wooden seats/cabinets and debris beside intact wardrobes/counters, mirrors and lamps | high |
| S02-I24 | `[0, 7872, 256, 224]` | Potted topiary/cacti/flowers, bouquets, wreath-like arrangements, flower cabinets and heart displays | high |
| S02-I25 | `[0, 8096, 256, 400]` | Bars/prison bunks and stained wall pieces left; medical beds/exam apparatus, monitors/desks and office chairs right/lower | high |
| S02-I26 | `[0, 8496, 256, 448]` | Display shelving/screens, divider panels, chairs, desserts/boxed food plus trophy/medal rows | medium |
| S02-I27 | `[0, 8944, 256, 512]` | Vanities, toilets, mirrors, laundry baskets/washers, showers/tubs, cabinets and debris/dirty variants | high |
| S02-I28 | `[0, 9456, 256, 336]` | Reception counters, forms/screens, storage shelves, potted plants and colored chair facings | high |
| S02-I29 | `[0, 9792, 256, 896]` | Beds/stretchers, partitions/curtains, equipment, windows/doors, fire/waiting furniture and medical workstations | high |
| S02-I30 | `[0, 10688, 256, 496]` | Wheelchairs, child-sized castle storage, colorful chairs/tables, backpacks and kindergarten/playroom furniture; lockers and dirty variants lower | high |
| S02-I31 | `[0, 11184, 256, 480]` | Bed frames, side-facing beds, mattress and blanket/color/pattern variants | high |
| S02-I32 | `[0, 11664, 256, 544]` | Dolls, rugs, toy trains, skateboard-like objects, nightlights, bunk beds and toy houses | high |
| S02-I33 | `[0, 12208, 256, 448]` | Built-in storage, tatami-like mats, low tables/cushions, shoji panels, floor bedding and decorative alcove-like components | medium |
| S02-I34 | `[0, 12656, 256, 496]` | Garments, mannequins, hats, racks, folded stock, mirrors, shelving and changing-room fixtures | high |
| S02-I35 | `[0, 13152, 256, 592]` | Retail accessories plus many small directional garment/headwear pieces and mannequin arrangements | medium |
| S02-I36 | `[0, 13744, 256, 752]` | Ticket counters/turnstiles, pottery/plinths, ropes, framed paintings, columns, display cases, specimens and botanical displays | high |
| S02-I37 | `[0, 14496, 256, 496]` | Pond/plant edge above; statues, busts, mannequins/exhibits, empty and populated glass cases, fossils/rocks | high |
| S02-I38 | `[0, 14992, 256, 480]` | Mounted skeletons and dinosaur-like reconstruction exhibits with platforms/backdrops and bare versions | high |
| S02-I39 | `[0, 15472, 256, 224]` | Souvenir counters, signs, plush-like creature replicas, books/posters/cards and pottery | high |
| S02-I40 | `[0, 15696, 256, 272]` | Pianos/keyboards, guitars, drums/harps and percussion, instruments in several sizes/colors | high |
| S02-I41 | `[0, 15968, 256, 240]` | Exercise balls, dumbbells, weights/racks, mats, benches/machines and punching bags | high |
| S02-I42 | `[0, 16208, 256, 112]` | Cameras/tripods, lights/stands, screens, green-screen pieces, equipment and director-style chairs | high |
| S02-I43 | `[0, 16320, 256, 288]` | Counters, menu boards, ice-cream cones, dispensers and multicolor refrigerated tubs/displays | high |
| S02-I44 | `[0, 16608, 256, 80]` | Counters/benches, circular targets on posts, hanging target carriers and screens | medium |
| S02-I45 | `[0, 16688, 256, 336]` | Multiple long stair configurations, landing/door/rail/mailbox-like additions plus cakes/balloons at bottom | medium |

Room Builder has legible embedded captions and repeated material sets. These
captions support assembly-role hypotheses, while the exact module relationships
still need a rendered probe. The transparent background and printed annotations
must not become placeable objects.

| ID | Original rectangle | Proposed family / observed evidence |
| --- | --- | --- |
| S02-R01 | `[0, 0, 800, 160]` | Ceiling/room border assemblies; arrows and embedded label |
| S02-R02 | `[800, 0, 160, 160]` | Floor-shadow entrance/exit shapes and thin/classic/thick connectors; labels |
| S02-R03 | `[0, 160, 512, 640]` | Repeated wall material/color strips and corners; narrow decorative band at top |
| S02-R04 | `[544, 176, 240, 608]` | Floor textures and related material transitions in four vertical lanes |
| S02-R05 | `[800, 176, 112, 160]` | Short patterned floor/carpet strips, several lengths/colors |
| S02-R06 | `[800, 336, 112, 288]` | Stair/railing assemblies, small directional fragments and color variants |
| S02-R07 | `[800, 624, 96, 64]` | Two short step/threshold strips |
| S02-R08 | `[960, 96, 96, 192]` | L-shaped and short baseboard/trim pieces beside embedded label |
| S02-R09 | `[1056, 160, 160, 512]` | Three-tile arched openings and wall-texture matching variants |
| S02-R10 | `[832, 704, 128, 160]` | Introductory projected wall corner/opening assembly plus 3d walls label |
| S02-R11 | `[0, 864, 672, 192]` | Colored/material path corners, edges and intersections in modular repeated sets |
| S02-R12 | `[704, 864, 384, 944]` | Repeated projected wall/doorway/room-opening sets by material/color |

Useful overlapping family windows are explicitly listed in JSON: purple/gold
furniture `[0,416,160,64]`; wooden wardrobes/cabinets `[112,480,128,96]`;
upholstered sofas `[48,5456,208,208]`; broken wooden furniture
`[0,7680,144,192]`; florist/topiary/cacti `[0,7872,256,224]`; and large skeleton
exhibits `[0,14992,256,480]`. Small garment/headwear pieces around
`[0,13152,256,592]` have unresolved role/facing: a thumbnail view cannot establish
whether every piece is a wearable, mannequin component or stock display.

Unknown fields remain unknown: precise object segmentation, facing convention,
component roles in most modular families, semantic inheritance between repeats,
all gameplay footprints/collision/heights, and detailed species/exhibit identities.
The purple/gold furniture remains ambiguous between upholstered furniture and
low tables/cabinets; it was deliberately excluded from the core furniture trial.

## Independent review

Pending. No agreement, correction, rejection or approval is invented. The
reviewer should inspect the sources afresh before comparing this table, then
check each navigation band and each Room Builder family search window. Existing
single filenames and atlas categories are evidence rather than ground truth.

## Alternatives and experiments

### Furniture trial: wooden wardrobe/cabinet family

Recommend the original `[112,480,128,96]` window, with normal
`Living_Room_Singles_37` through `_45` as the exact nine-member source-file set.
Probe black-shadow and shadowless counterparts, giving a bounded 27-file trial
if every counterpart exists. Initial pixels support wooden cabinets/wardrobes,
with solid/glazed fronts and narrow side-looking views. Do not infer facing
names merely from file-number order. Distinguish mirrors/reflections from open
doors using the other views and example-room compositions.

An exact master scan already finds eight of nine normal singles. `_38` has no
full-file exact match at a 16px grid; the visibly related wide cabinet should
be examined for shadow, margin, reflected content or changed pixels before any
missing-art conclusion. Every verified original occurrence, single source hash,
packed key and packed rectangle is retained in JSON. For example:

- `_37`: original `[112,480,32,48]`, packed `[928,4014,32,48]`, alias
  `single/normal/living-room/living-room-singles-37`.
- `_39`: original `[208,480,32,48]`, packed `[992,4014,32,48]`.
- `_41`–`_44`: original x=112,144,160,128 respectively at y=528, size 16 × 48.
- `_45`: original `[176,528,16,32]`, packed `[112,7214,16,32]`.

Reproduce the baseline without modifying art or atlases:

```sh
python3 scripts/semantic-map-match.py   --master assets/interiors/1_Interiors/16x16/Interiors_16x16.png   --candidate assets/interiors/1_Interiors/16x16/Theme_Sorter_Singles/2_Living_Room_Singles   --output /tmp/tilefun-semantic-interiors/living-room-matches.json
```

This compares visible RGBA and alpha exactly while normalizing hidden RGB at
alpha=0. It retains every grid-aligned occurrence. Of 122 normal living-room
single files, 82 have at least one exact master occurrence and 40 do not. These
are file counts, not unique-object or semantic-coverage counts. `_96` matches
both `[48,7696,16,32]` and `[96,7728,16,32]`; neither occurrence should be lost.

For an unindexed contrasting furniture sample, examine the sofa window
`[48,5456,208,208]`. None of those 122 normal living-room singles exactly match
inside that window. This excludes only these full-file grid16 matches; other
atlas themes, altered margins, shadow differences and subcomponents remain
untested. It is a useful challenge to proximity-based theme inference.

### Architecture probe: floor paths and one arched opening

Recommend Room Builder `[0,864,672,192]` first. Segment one material's 16px
center, straight edge, corner and intersection roles; preserve every repeated
occurrence and match to `Room_Builder_Floor_Paths_16x16.png` and packed
`room-builder-tile/floor-paths/...` entries. Assemble two widths and an L/T join
at native scale, recording seam or shading failures before deciding roles.
Then test one three-tile arch within `[1056,160,160,512]` against the associated
wall texture; this exercises an opening relationship the floor trial cannot.

A preliminary **whole alpha-trimmed subfile** comparison found visible-byte
identity for walls `[0,176,512,608]` and borders `[80,0,720,144]`. The helper also writes
[the reproducible subfile comparison](/tmp/tilefun-semantic-interiors/room-subfile-matches.json).
The other seven Room Builder subfiles did not match as one rectangle: 3d walls, arches,
baseboards, floor connectors, paths, shadows and floors. Normalizing hidden
transparent RGB did not change that result. This does not establish any missing
components: the subfiles can rearrange pieces, remove captions, differ in
padding or include different revisions. Use per-tile/subregion comparisons in
the probe, and retain both original and subfile coordinates. The packed
`room-builder-sheet/...` coordinate is an alias for the subfile, not the master.

## Reconciliation and handoff

All source pixels have been looked at through overview and detailed overlapping
crops; no part of either master is unexamined at **survey resolution**. Individual
objects are not all segmented, understood, independently reviewed or approved.
There are 45 Interiors navigation bands, six overlapping family windows and
12 Room Builder family windows. Their boundaries are intentionally proposals.

The Interiors navigation partition includes all 1,952,339 alpha-positive pixels.
Room Builder has 880,450 alpha-positive pixels. A residual-mask inspection
initially revealed clipped staircase fragments/baseboard edges; those windows
were widened from 96 to 112px and from x=976 to x=960 respectively. The remaining
2,466 pixels outside family windows are embedded caption/arrow fragments:
exit `[944,0,48,64]`, connectors/carpets `[800,144,176,96]`, arch caption
`[1040,80,176,96]`, stairs `[896,320,80,80]`, and steps `[896,576,80,80]`.
The rendered residual contains those words/arrows only. JSON records them as
five annotation windows, after which no occupied pixels fall outside all
proposed windows. Area inclusion is not semantic completeness; transparent
margins, captions, embedded examples and overlapping family membership are
explicitly different dispositions.

Validation: helper regeneration, hash/dimension pins, all rectangle bounds,
occupied-pixel coverage and direct visual inspection passed; normal living-room
baseline matching was reproduced. Typecheck/unit/lint for the integrated task
are owned by the coordinator. No pixels, source atlases, packed inventories,
review candidates, gameplay metadata or approved snapshots were modified.
The next useful step is P03's exact cabinet aliases/shadow comparison, plus the
small floor-path assembly probe and an independent broad-map review.
