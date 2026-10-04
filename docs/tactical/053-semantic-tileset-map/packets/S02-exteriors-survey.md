# S02 — Modern Exteriors whole-sheet thematic survey

## Assignment

- Owner: Exteriors survey worker. Date: 2026-10-04. Revision: 1.
- State: source-pinned broad survey complete; independent review pending.
- Scope: the complete native 16px master, including its lower extensions. The
  assignment stops at thematic windows and pilot hypotheses; it does not claim
  exhaustive asset segmentation, physics, human approval or runtime promotion.
- Exclusive outputs: this packet, `S02-exteriors-regions.json`, and
  `scripts/semantic-map-exteriors-survey.py`. No source art was changed.
- Next action: independently review boundaries, then run seasonal-tree and
  scrap/dumpyard object trials against pinned originals and named singles.

## Source evidence

Original: `assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Tileset.png`.
Dimensions: **2816 × 8224 RGBA**, 176 × 514 native 16px grid cells.
SHA-256: `1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
`public/assets/tilesets/me-complete.png` is byte-identical: these are aliases of
one full sheet, with unchanged coordinates, not a separately packed atlas.
The manifest coordinator owns pack provenance beyond this independently checked source.

All rectangles below are original pixels `(x, y, w, h)`, top-left origin,
half-open right/bottom edges. They are **bounded scouting windows**, often
containing transparent pixels, captions and neighboring kit pieces. Confidence
in a broad theme does not imply exact segmentation or exclusive membership.
Every theme window has medium boundary confidence pending detailed segmentation.

I visually inspected a 704 × 2056 whole-sheet overview, ten half-scale bands
covering `[0,1024)`, `[896,1920)`, `[1792,2816)`, `[2688,3712)`,
`[3584,4608)`, `[4480,5504)`, `[5376,6400)`, `[6272,7296)`,
`[7168,8192)`, and `[8064,8224)`, followed by enlarged tree and scrap-yard
crops and the residual contact sheet. The final 32 rows below y8192 were
explicitly inspected; modern roofs, military equipment and the mansion/gothic
tail were not omitted because they are sparse or weakly indexed.

Reproduce source/alias verification, bounds and alpha accounting plus all
persistent pilot crops:

```sh
python3 scripts/semantic-map-exteriors-survey.py --out /tmp/tilefun-semantic-exteriors
```

Temporary evidence: [whole-sheet overview](/tmp/tilefun-semantic-exteriors/overview.png),
[annotated thematic map](/tmp/tilefun-semantic-exteriors/thematic-map.png),
[unclassified residual contact sheet](/tmp/tilefun-semantic-exteriors/unclassified-residuals.png).
The helper also writes `band-0000.png` through `band-8064.png` and each
`P-*.png`; no generated crops or downloaded art are committed.

Supporting vendor evidence, consulted after pixel inspection:
`assets/exteriors/Modern_Exteriors_16x16/atlas-index.json` and the
`ME_Theme_Sorter_16x16/*.png` names. The index has 4,816 matches and 1,408
unmatched singles; these are matcher results, **not** a semantic coverage score.
Its `ME_Singles_Camping` entries support the tree grouping, and its
`ME_Singles_City_Props` entries support the wreck/scrap interpretation.
No existing human approval has been imported or claimed for these proposals.

## Proposed broad map

The machine-readable [region map](S02-exteriors-regions.json) owns full evidence,
family suggestions, uncertainty and exact rectangles. This table is its navigation
layer. Families may recur across regions; especially cars, fences, storefronts,
water edges and trees must not acquire unique membership from spatial proximity.

| ID | Broad visible theme | `(x, y, w, h)` | Theme confidence |
| --- | --- | --- | --- |
| E01 | Terrain, fences, small park vegetation | (0, 0, 816, 352) | high |
| E02 | Domestic garden, villa and tree-house kit | (816, 0, 880, 352) | high |
| E03 | Camping and waterside recreation | (1696, 0, 640, 672) | high |
| E04 | Tree color and form banks | (2336, 0, 448, 1888) | high |
| E05 | Street props and construction equipment | (0, 352, 672, 400) | high |
| E06 | Commercial facade and modular building kit | (688, 352, 848, 400) | high |
| E07 | Generic building pieces and garage clutter | (0, 752, 688, 448) | medium |
| E08 | Brown flat-roof residence kit | (688, 752, 656, 288) | high |
| E09 | Colored pitched-roof houses and components | (1344, 736, 576, 448) | high |
| E10 | Park and playground kit | (1808, 672, 512, 1056) | high |
| E11 | Colored cars, buses and street directions | (0, 1200, 624, 592) | high |
| E12 | Colored market storefront kit | (688, 1040, 704, 576) | high |
| E13 | Police buildings and aircraft | (1408, 1184, 912, 544) | high |
| E14 | Service station and compact car palettes | (528, 1328, 880, 592) | high |
| E15 | Delivery vans and streets/roundabouts | (0, 1792, 816, 832) | high |
| E16 | Tall corner/flat facade modular buildings | (1088, 1840, 784, 848) | high |
| E17 | Hotel and red-brick commercial facades | (1872, 1744, 944, 896) | high |
| E18 | Hospital, helipad and ambulances | (496, 2240, 576, 608) | high |
| E19 | Pool and sports equipment | (0, 2624, 448, 688) | high |
| E20 | Soccer and basketball courts | (400, 2640, 768, 656) | high |
| E21 | Food kiosks and school facade | (1088, 2672, 1728, 416) | high |
| E22 | Fence layout examples beside scrap yard | (1152, 2896, 864, 144) | medium |
| E23 | Scrapyard/dumpyard and utility kit | (1280, 3040, 1152, 288) | high |
| E24 | Alternate police facade panels | (2432, 3072, 384, 256) | high |
| E25 | Garden hedges, topiary, statues and fountains | (0, 3376, 592, 416) | high |
| E26 | Office facade/roof assembly kit | (592, 3312, 2224, 464) | high |
| E27 | Classical mansion/civic facade kit | (0, 3776, 832, 576) | high |
| E28 | Garden nursery, greenhouse and floral kit | (832, 3664, 1328, 672) | high |
| E29 | Fire station and emergency trucks | (2160, 4016, 656, 384) | high |
| E30 | Graveyard and autumn/horror props | (0, 4336, 1920, 208) | high |
| E31 | Railway/subway buildings, platforms and trains | (0, 4384, 2816, 704) | high |
| E32 | Beach, sand and resort props | (0, 4880, 1360, 656) | high |
| E33 | Cylindrical beacon/tower assembly kit | (1408, 4976, 512, 512) | medium |
| E34 | Raised sand/cliff examples | (1408, 5248, 512, 368) | high |
| E35 | Post office and gray business facades | (1952, 5056, 864, 1184) | high |
| E36 | Road layout/marking examples and car bank | (0, 5488, 1360, 768) | high |
| E37 | Traffic light and overhead sign frames | (1376, 5664, 720, 528) | high |
| E38 | Novelty food-shaped kiosk structures | (1824, 5904, 512, 336) | high |
| E39 | Bridge roadway, piers and railings | (0, 6000, 1824, 352) | high |
| E40 | Military buildings, hangars, tents and towers | (0, 6320, 2496, 688) | high |
| E41 | Military armored vehicles and helicopters | (0, 6960, 2816, 288) | high |
| E42 | Helicopter vertical views and rotors | (2496, 6352, 320, 608) | high |
| E43 | Wood cottage and sloped-roof modern houses | (0, 7248, 2128, 688) | high |
| E44 | East Asian styled buildings and roof/prop kit | (1728, 7328, 1088, 608) | medium |
| E45 | Mansion and gothic/abandoned architecture tail | (0, 7904, 2320, 320) | high |

## Seasonal-tree pilot hypothesis

The visible organization is four **palette banks**, high confidence:

| Candidate | Window | Visible interpretation |
| --- | --- | --- |
| P-tree-green | (2336,16,448,416) | Green broadleaf/conifer/fruit forms, including adjacent bare branches |
| P-tree-orange | (2336,448,448,400) | Orange/red crowns; autumn-like appearance |
| P-tree-teal | (2336,864,448,400) | Blue-green crowns; no snow or other winter-specific proof |
| P-tree-ochre | (2336,1280,448,400) | Ochre/yellow crowns; overlaps later forest examples |
| P-tree-forest | (2448,1600,240,272) | Three composed forest groups and separate side strips |

[Green bank crop](/tmp/tilefun-semantic-exteriors/P-tree-green.png),
[orange bank crop](/tmp/tilefun-semantic-exteriors/P-tree-orange.png),
[teal bank crop](/tmp/tilefun-semantic-exteriors/P-tree-teal.png),
[ochre bank crop](/tmp/tilefun-semantic-exteriors/P-tree-ochre.png), and
[forest composition crop](/tmp/tilefun-semantic-exteriors/P-tree-forest.png).

A useful compact family probe is the rounded broadleaf tree in four 64 × 64
windows: `(2464,16,64,64)`, `(2464,448,64,64)`, `(2464,864,64,64)`,
`(2464,1280,64,64)`. Index names are respectively `Tree_1`, `Tree_4`,
`Tree_7`, `Tree_10` under `ME_Singles_Camping_16x16_`. Visual crown and trunk
form repeat; compare exact source masks, pixels and singles before final membership.
The banks also show broadleaf size/form changes, fruit/no-fruit forms, conifer sizes,
and multiple brown/pale/green trunk treatments. Species, season names and the
meaning of trunk treatments remain unknown. Facing is not established.

**Challenge:** do these encode four seasons or palette variants? Orange/red and
bare branches support autumn-like imagery, but teal lacks snow and ochre is also
fall-like. The present evidence supports color-bank labels, not a green → autumn →
winter → spring sequence. A crop-to-single match plus variant mask comparison is
a discriminating next check. Repeated arrangement is not universal: bare branches
occur in the first bank, and the forest compositions overlap the ochre bank.

The forest strip is also a modular assembly probe: index names
`Tree_Wall_Modular_1`–`9` divide three rows into left/main/right parts, with gaps
between source pieces. Proposed role: composed vegetation boundary/forest segments,
medium confidence. Mere crop adjacency does not establish a seamless assembly;
render the left, middle and right pieces to test seams before accepting that role.

## Dumpyard/scrapyard pilot hypothesis

High confidence in **waste/scrap imagery**, medium confidence in a single exclusive
“dumpyard theme.” Its core scouting window is `(1344,3040,1088,272)`;
[exact core crop](/tmp/tilefun-semantic-exteriors/P-dump-core.png).
Suggested subdivisions:

| Candidate | Window | Visible evidence and ambiguity |
| --- | --- | --- |
| P-dump-wrecks | (1712,3040,512,112) | Crushed cars, two/three-car piles and overturned cars; pile/object boundaries need segmentation |
| P-dump-piles | (1808,3152,624,160) | Trash and scrap heaps, loose components, shack and modular pile/containers; components vs compositions unresolved |
| P-dump-utility | (1280,3152,512,160) | Flat-roof utility fronts and water-tower/ladder/platform variants; could be a general industrial utility kit |

[Wreck crop](/tmp/tilefun-semantic-exteriors/P-dump-wrecks.png),
[piles crop](/tmp/tilefun-semantic-exteriors/P-dump-piles.png), and
[utility crop](/tmp/tilefun-semantic-exteriors/P-dump-utility.png).

The upper strip has tires, bent scrap, ladder pieces, barrels, hazard placards and
shipping containers. Adjacent fence rings at y2896–3040 are reusable site boundaries,
not proof of yard ownership. The left utility building and towers, and right
containers, plausibly belong to the same industrial neighborhood but should retain
cross-theme links. School parts above and police variants to the right are excluded
from the core. Source index examples: `Car_Wreck_6` at `(1712,3040,64,64)`,
`Car_Wreck_7` at `(1904,3072,64,80)`, `Container_House_1` at
`(1920,3152,80,80)`, `Scrap_Metal_Pile_1` at `(1984,3232,80,48)`,
`Junk_Shack_1` at `(2176,3216,96,96)`. Names support, but do not independently
prove, the visible identities or their exact segmentation.

**Alternatives/tests:** a salvage/recycling yard fits crushed cars and stored metal;
a mixed city-prop pack fits the broad range of utilities. Both remain compatible
with the pixels. Extract named wreck and pile singles, reconcile every exact
occurrence, and independently count each precomposed heap versus loose components.
The lower long pile with detached ends is a second modular assembly probe: test
continuity rather than treating its empty source gaps as object separation.

## Unclassified regions and coverage limits

There are **45 proposed broad thematic windows**, 10 pilot/detail windows and
40 bounded residual windows. All residuals were viewed in the contact sheet;
no large unexplained area was silently dropped. Their local hypotheses include
facade strips between camping and commercial kits (U01–02); police/vehicle boundary
fragments (U03–06); street fixtures, wreck-like props and facades (U07–12);
shop/school borders (U13–15); sports/pool pieces and an isolated wind turbine
(U16–22); office/nursery fragments (U23–28); source lettering and signal borders
(U29–34); novelty kiosk bottoms and rotor borders (U35–38); and large eastern-roof
fragments (U39–40). These hypotheses are not adopted semantic labels. Some
residual windows split a single assembly at an arbitrary 256px accounting boundary.
They track source occupancy gaps, not candidate asset identities.

The source has **11,431,345 nonzero-alpha pixels**. Theme windows cover
11,331,822 (99.13%); 99,523 (0.87%) lie in the recorded residual windows.
Residual-window union covers every remaining occupied pixel. This checks only
that no visible source region was lost from the survey disposition. It does not
measure object completion, semantic accuracy or approval. Zero objects are claimed
fully segmented, zero candidates independently reviewed, and zero human approvals.
Some broad windows intentionally overlap; counts use their union, not a sum.

## Independent review and handoff

Independent reviewer: pending. No agreement or review disposition is synthesized.
Revision 1 remains a proposal; a reviewer should first inspect the original source
before comparing this map. Primary challenges: palette-bank semantics, sparse
boundary pieces, scrapyard composition/component segmentation and tail-kit names.
Gameplay footprints, collision, walkable surfaces and height remain unknown.

Validation: helper verifies pinned hashes, byte-identical alias, dimensions,
all theme/pilot/residual bounds, exact occupied-alpha counts and residual coverage.
Only docs and a standalone read-only crop helper changed. Repository checks are
owned by the coordinating session; no rendering inputs or runtime catalogs changed.
This map is not registered as a human-review batch and does not confer promotion.
Next logical step: independently review the two pilot regions, then complete
bounded member/occurrence lists and assembly experiments before scaling outward.
