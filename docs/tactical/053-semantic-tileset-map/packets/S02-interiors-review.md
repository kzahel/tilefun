# S02 Interiors — independent thematic review

Reviewer: Exteriors worker, independent of Interiors mapper. Date: 2026-10-04.
State: independent broad-region review complete; supported with stated limitations.
This review covers broad regions and evidence, not every individual object.

## Initial independent visual observations

Before reading the mapper’s labels or JSON, I independently hashed and inspected
`Interiors_16x16.png` (256 × 17024,
`a35b8ed8ef392657a9339e1ce0831a3efe7b4631bfff69835bb5ef3bc738550b`)
and `Room_Builder_16x16.png` (1216 × 1808,
`f53d7cd04f275dfa4b3e1f410569d491275105e2710a0f86ec46edeff3ab576f`),
both under `assets/interiors/1_Interiors/16x16/`.

For the narrow master I generated 1024px-tall overlapping raw strips spaced 896px,
grouped three per page without semantic labels; inspected all seven pages from
source y=0 through y=17024. For Room Builder I inspected full-width crops at
source y=0–656, 576–1232, 1152–1808. Source captions remain visible source evidence.
The last furniture/door/shelving/party-prop rows at y=16128–17024 were included.
Evidence lives in `/tmp/tilefun-semantic-interiors-review/raw-master-0.png`
through `raw-master-6.png`, and `raw-room-0.png`, `raw-room-576.png`,
`raw-room-1152.png`. No author’s labels were read during this first pass.

Independent broad reading: this is a thin vertically organized inventory, with
many repeated colors/facings and recurrences; themes do not always obey sharp
horizontal boundaries. Top rows include appliances/kitchen-like counters, tables,
chairs, screens, mirrors, cupboards, rugs and musical instruments. Bathroom-like
fixtures and household furniture follow; desks/beds appear around y=2300–2800.
Halloween/horror props and dark furniture occupy roughly y=2800–3600; repeated
bookcases/library shelves recur through y=3600–5000. Furniture/counter parts,
upholstery and mirrors occur around y=5000–6100. Christmas/celebration imagery is
clear around y=6200–6700. Retail counters, shelves, produce, flowers, and plants
follow roughly y=6700–8000. Medical beds/equipment and institutional fixtures occur
around y=8000–9800; doors, counters and hospital/institution furniture recur around
y=9800–11000. Playground/child-themed objects, colored seating and sectional seating
are clear around y=10800–11700. Western/east-Asian styled wood furniture, floor/rug
swatches and repeated smaller upholstered/seat units occur around y=11600–13300.
Dense retail/food props and long clothing/garment arrays occupy around y=13000–14000.
Ticket/sign/display/museum-like material appears around y=13900 onward, including
paintings, decorative masks, sculptures, display cases, fossils and dinosaur models,
souvenir signs and smaller exhibits. Musical instruments reappear around y=15700.
A dark broadcast/film-like studio section with colored chroma panels, rigs/screens
and cameras occupies roughly y=15900–16450; ice-cream/retail counters and dense shelf/
door components continue through the true bottom. These are scouting impressions,
not exact segment identities or botanical/professional classifications.

Room Builder: upper-left and central columns contain wall/border palettes and
floor material swatches; upper-right captions visibly identify floor shadows,
connectors, carpets, stairs/steps, baseboards and arches. The floor-path examples
occupy the left middle. The right lower block contains many perspective wall/corner
assemblies labelled `3d walls`. Large transparent unused areas remain; the sheet
is not an exhaustive filled rectangle of architectural assets. Captions are source
lettering and must not acquire placeable-asset identity merely from alpha occupancy.

## Comparison with mapper proposal

Compared exact proposal `S02-interiors-regions.json`, revision 1, SHA-256
`f4f6d6d5f35677a96102e62b1a5a83fc8975d1c2938c1fc1551274fb9fc942a1`. This disposition applies only to that JSON snapshot.
The hash was rechecked at the end of comparison and unchanged. Sources retain the
independently verified hashes above. Future semantic or bounds edits require a
new scoped review; the author’s `independentReview: pending` fields were not edited.

**Overall disposition:** supported for broad navigation and family reconnaissance,
with limitations below. No material wrong-theme region or omitted visible block
was found. The narrower review does not establish the author’s finer asset labels,
27-file cabinet identities, packed aliases, assembly roles or gameplay geometry.

The reviewer independently verified all 68 rectangle bounds, the disjoint 45-band
Interiors partition from y=0 to 17024, and occupied-alpha coverage: Interiors
1,952,339 pixels, Room Builder 880,450, zero outside the proposed-window unions.
The author’s reproduction helper also passed. The Room Builder residual rendered
outside family windows contains only captions/arrows; the five annotation windows
are legitimate disposition windows. Rectangles themselves can overlap actual art:
only the residual pixels are asserted to be annotations.

### Explicit region dispositions

`Supported` here means the broad visible vocabulary and navigation window are
reasonable. It never means every contained object is correctly named, all family
members are enumerated, or any member is approved. All 45 bands, 6 family windows,
12 architecture windows and 5 annotation windows have the dispositions below.

| Region ID | Disposition | Evidence limit / exception |
| --- | --- | --- |
| S02-I01 | Supported with limitations | Mixed domestic/shop vocabulary supported; top appliance-like versus bed/table pieces remain object-level questions. |
| S02-I02 | Supported with limitations | Storage/mirror/bookcase vocabulary supported; purple/gold exact furniture identity unresolved. |
| S02-I03 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I04 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I05 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I06 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I07 | Supported with limitations | Fishing/camping-like gear supported; specific equipment identities remain hypotheses. |
| S02-I08 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I09 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I10 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I11 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I12 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I13 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I14 | Supported with limitations | Conference/stage-like platforms supported; no role inheritance between similar rectangles. |
| S02-I15 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I16 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I17 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I18 | Supported with limitations | Mixed circulation/domestic/retail reading supported; transition cuts are navigation only. |
| S02-I19 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I20 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I21 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I22 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I23 | Supported with limitations | Damage/debris contrast supported; component versus preassembled-object segmentation pending. |
| S02-I24 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I25 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I26 | Supported with limitations | Detailed crop confirms food/display/divider and trophy/medal mixture. |
| S02-I27 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I28 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I29 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I30 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I31 | Supported with limitations | Detailed crop resolves reviewer’s initial seating impression: pillows/blankets and bare bed frames support beds. |
| S02-I32 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I33 | Supported with limitations | Detailed crop supports low tables/floor mats/shoji-like panels; culturally specific naming remains qualified. |
| S02-I34 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I35 | Supported with limitations | Headwear/garment-like repeated pieces supported; wearable/mannequin/stock role and facing remain unresolved. |
| S02-I36 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I37 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I38 | Supported with limitations | Skeleton/reconstruction exhibit contrast supported; no species assignment. |
| S02-I39 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I40 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I41 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I42 | Supported with limitations | Studio-like equipment supported; 112px band is not the full exclusive boundary of every rig. |
| S02-I43 | Supported with limitations | Broad visible vocabulary supported; mixed navigation band may cut objects. |
| S02-I44 | Supported with limitations | Detailed crop supports targets and suspended carriers; no functionality inferred. |
| S02-I45 | Supported with limitations | Stair/landing/door and party-tail mixture supported; source true bottom included. |
| S02-R01 | Supported with limitations | Caption/material repetition supports broad family; module relations and individual bounds unreviewed. |
| S02-R02 | Supported with limitations | Caption/material repetition supports broad family; module relations and individual bounds unreviewed. |
| S02-R03 | Supported with limitations | Caption/material repetition supports broad family; module relations and individual bounds unreviewed. |
| S02-R04 | Supported with limitations | Caption/material repetition supports broad family; module relations and individual bounds unreviewed. |
| S02-R05 | Supported with limitations | Caption/material repetition supports broad family; module relations and individual bounds unreviewed. |
| S02-R06 | Supported with limitations | Caption/material repetition supports broad family; module relations and individual bounds unreviewed. |
| S02-R07 | Supported with limitations | Detailed crop confirms two main horizontal threshold/step groups; exact module lengths/roles untested. |
| S02-R08 | Supported with limitations | Caption/material repetition supports broad family; module relations and individual bounds unreviewed. |
| S02-R09 | Supported with limitations | Caption supports three-tile arch interpretation; opening/wall compatibility needs assembly test. |
| S02-R10 | Supported with limitations | Perspective assembly reading and caption supported; no 3D runtime/collision meaning inherited. |
| S02-R11 | Supported with limitations | Path edges/corners/intersections supported at family level; seams and role inventory require probe. |
| S02-R12 | Supported with limitations | Perspective wall/opening palettes supported; not all openings/side pieces individually named. |
| S02-F-initial-purple-gold-furniture | Supported with limitations | Low-confidence exact identity retained; striped surfaces/gold trim alone do not prove upholstery. |
| S02-F-wooden-cabinet-pilot | Supported with limitations | Cabinet/wardrobe family supported; mirrored versus glazed panes and side-looking views require P03. Window includes neighboring mirror/plant and shall not become exclusive member list. |
| S02-F-large-sofa-probe | Supported with limitations | Broad visible family supported; exact segmentation and member inheritance unreviewed. |
| S02-F-broken-wooden-furniture | Supported with limitations | Damage contrast supported; loose debris must not become a complete furniture object. |
| S02-F-topiary-cactus-flowers | Supported with limitations | Broad visible family supported; exact segmentation and member inheritance unreviewed. |
| S02-F-large-skeleton-exhibits | Supported with limitations | Exhibits supported; skeleton/model/backdrop components unsegmented. |
| S02-A-exit-caption | Supported with limitations | Residual-mask pixels are source lettering/arrows; full overlapping window is not asserted caption-only. |
| S02-A-connector-carpet-captions | Supported with limitations | Residual-mask pixels are source lettering/arrows; full overlapping window is not asserted caption-only. |
| S02-A-arch-caption | Supported with limitations | Residual-mask pixels are source lettering/arrows; full overlapping window is not asserted caption-only. |
| S02-A-stairs-caption | Supported with limitations | Residual-mask pixels are source lettering/arrows; full overlapping window is not asserted caption-only. |
| S02-A-steps-caption | Supported with limitations | Residual-mask pixels are source lettering/arrows; full overlapping window is not asserted caption-only. |

### Concrete retained qualifications

No blocking semantic correction is required for the map’s current broad-scope
claims. Before cataloging individual assets, keep these constraints explicit:

- S02-F-wooden-cabinet-pilot’s “glass” panes are visually reflective and could be
  mirrors. Use reflective/mirrored-or-glazed as the provisional panel label until
  P03 resolves it; its family-level cabinet interpretation is unaffected.
- S02-F-initial-purple-gold-furniture remains low-confidence. The closer crop
  shows striped broad surfaces, gold trim and legs/supports; it does not settle
  upholstered-seat versus table/cabinet membership. Excluding it from core P03 is sound.
- S02-I35’s tiny repeated pieces cannot inherit apparel role/facing from their
  ordering. Its explicit role uncertainty is necessary, not an already reviewed field.
- Annotation residuals are not placeable art, but their full search rectangles
  overlap family windows. Keep alpha-residual accounting separate from ownership.
- `unexaminedPixels:0` is supported only as **whole source viewed at survey
  resolution**, as the packet says; it must not become an object-completion statistic.

The author’s initial grid16 no-match for Living_Room_Singles_38 and the seven
whole Room Builder subfiles remains a method-limited observation, not an absence
claim. This review did not rerun their full matching baseline or validate packed
aliases: those hypotheses are pilot handoffs, outside the 68-region disposition.

## Evidence reproduction and limits

Independent overview/crop recipe (Pillow; source images read-only): composite
source RGBA over `(56,62,70,255)`, crop full master x=0–256 in 1024px-tall strips
spaced 896px, group three raw panels per page with source-y labels. Room Builder
uses full-width 656px crops at y=0, 576, 1152. Targeted crops used exact proposal
rectangles at nearest-neighbor 2×/4× for S02-I26/I31/I32/I33/I35/I44,
S02-R07 and the two initial furniture windows. These local artifacts are evidence,
not committed screenshots. Author reproduction command:

```sh
python3 scripts/semantic-map-interiors-survey.py --out /tmp/tilefun-semantic-interiors-review/author-reproduction
```

[Independent first master page](/tmp/tilefun-semantic-interiors-review/raw-master-0.png),
[master tail](/tmp/tilefun-semantic-interiors-review/raw-master-6.png),
[Room Builder top](/tmp/tilefun-semantic-interiors-review/raw-room-0.png), and
[Room Builder bottom](/tmp/tilefun-semantic-interiors-review/raw-room-1152.png).

Review counts: 68/68 broad proposal regions dispositioned; 0 individual objects
claimed exhaustively reviewed; 0 human approvals. Review does not confer gameplay
metadata, runtime promotion or inherited approval from existing names. Next step:
independent P03 cabinet review once its proposal is complete, followed by the
Room Builder path/arch assembly trial.
