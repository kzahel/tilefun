# S02 Exteriors — Independent broad-map review

Date: 2026-10-04. Reviewer: Interiors survey/cabinet worker, separate from mapper.
State: complete at survey resolution, with explicit field corrections below.
No object-level completion, gameplay approval or human approval is implied.

## Reviewed snapshot and observation order

Reviewed [region proposal](S02-exteriors-regions.json), revision 1, exact SHA-256
`dea87c451f573270590135211f43a2d0a9cf27cf5f56b8c90227c44dec07b771`.
Original master is 2816 × 8224, SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
The proposal snapshot is frozen; the following review corrections supersede the
named fields for future integration instead of rewriting the reviewed source.

Before reading proposal labels, I inspected 48 raw source crops at native scale:
x=0,736,1472,2208; y=0,736,…,8096. Each crop is up to 800 × 800; neighbors overlap
64 px where available, including the final 128 px-high row. This covers the complete
master through y=8224 without relying on the author's semantic windows. Initial
notes were saved before comparison. The assignment context made the review
brief-informed; it is not formally blinded.

Initial broad interpretation: streets/road tiles and civic props; garden/camping,
boats and repeated tree palette banks; vehicles, domestic/commercial and emergency
architecture; pools/sports/gardens and salvage/refuse; grand civic architecture and
graveyard/gothic props; gardening/refuse trucks; rail cutaways/bridges/tunnels;
beach/decks, traffic/car palettes/cliffs and mail/hardware buildings; military
walls/tents/radar/armored vehicles/aircraft; lower house/roof/facade extensions and
mansion/gothic/rustic architecture. Complete objects, source samplers, labels,
arrows and modular pieces coexist. Their adjacency is not unique family membership.

After that initial pass, I compared every 45 theme window, 10 pilot window and 40
residual window with the proposal. The residual contact sheet was inspected in
addition to the 48 full-sheet raw crops. Corrections were checked with enlarged
raw tube, ambulance and medical-bed crops.

## Required field corrections

| Region | Field(s) in frozen proposal | Corrected wording / disposition | Pixel evidence |
| --- | --- | --- | --- |
| E10 | `evidence`: “many colored chairs” | Replace with “modular colored playground tubes/tunnels and connectors”; keep region name “Park and playground kit” | Source `[1984,1104,256,288]` shows cylindrical openings, bends, crosses and continuation segments, not chair seats/backs |
| E15 | `name`: “Delivery vans and streets/roundabouts”; corresponding vehicle evidence | Replace name with “Ambulances and streets/roundabouts”. Evidence: “White/red ambulance views and component pieces with cross/112 markings, above roundabout and sidewalk layouts.” | Source `[0,1776,400,144]` has medical crosses and 112; delivery function is contradicted |
| E18 | `name`: “Hospital, helipad and ambulances”; `evidence`: “ambulances” | Replace name with “Hospital, helipad and medical beds/stretchers”. Evidence: “HOSPITAL/Emergency labels, roof H markers, wheeled medical beds/stretchers with empty and patient variants, and helicopters.” | Source `[496,2352,144,352]` shows reclining patients and exposed wheeled bed frames without vehicle body/cab |
| E45 | `name`: “gothic/abandoned architecture tail” | Replace name with “Mansion and gothic-style architecture tail”; building condition remains unknown. Existing roof/facade/fence evidence otherwise stands. | Dark stylized/gothic architecture does not establish abandonment or disrepair from palette alone |

E10/E15/E18 are concrete identity corrections; E45 removes an unsupported condition
claim while retaining the visible style. These are changes to semantic proposal
fields, not source rectangles or art. Exact graphical bounds and gameplay geometry
remain unapproved. Medium-confidence regional style guesses, including E44's
East Asian association and E33's lighthouse/beacon interpretation, remain proposals.

## Broad-window dispositions

Every window is accepted as an exact navigation/search rectangle, not tight object
bounds or exclusive theme membership. “Supported” refers only to the bounded
broad interpretation with its existing medium boundary confidence.

| Region | Disposition | Independent review note |
| --- | --- | --- |
| E01 | supported at survey scope | Mixed surfaces, small vegetation and civic boundary props; overlap acceptable. |
| E02 | supported at survey scope | Garden structures/planting and tree-house kit supported; specific greenhouse use is tentative. |
| E03 | supported at survey scope | Camping gear, tents, campers, waterside/decks/boats supported. |
| E04 | supported at survey scope | Four crown-color banks and separate branches/forest assemblies supported; season naming remains unproven. |
| E05 | supported at survey scope | Street/work-zone fixtures and equipment supported. |
| E06 | supported at survey scope | Commercial/window/roof modules and signed storefront supported. |
| E07 | supported at survey scope | Generic low fronts and clutter supported; precise small furniture not reviewed. |
| E08 | supported at survey scope | Brown flat-roof modular structures supported. |
| E09 | supported at survey scope | Colored roof-house examples and detached components supported. |
| E10 | field correction required | Supported after tube/tunnel evidence correction; not chairs. |
| E11 | supported at survey scope | Vehicle colors/views, buses and BUS/sign assets supported; compass ordering unknown. |
| E12 | supported at survey scope | Market/awning storefront variants supported. |
| E13 | supported at survey scope | Police station/aircraft supported by pixels and POLICE signage. |
| E14 | supported at survey scope | Fuel/service station and car palette group supported. |
| E15 | field correction required | Correct ambulance identity; road/roundabout family supported. |
| E16 | supported at survey scope | Tall facade/corner/store modules supported. |
| E17 | supported at survey scope | Hotel sign/facades and brick commercial modules supported. |
| E18 | field correction required | Correct medical-bed/stretchers identity; hospital/helipad/aircraft supported. |
| E19 | supported at survey scope | Pool/leisure/sport items and modular edges supported. |
| E20 | supported at survey scope | Soccer and basketball layouts supported. |
| E21 | supported at survey scope | Food concessions and large civic/school-like facade supported; precise school purpose remains a proposal. |
| E22 | supported at survey scope | Fencing sampler/layout supported; no exclusive yard ownership. |
| E23 | supported at survey scope | Salvage/waste core and utility neighbors supported; single exclusive dumpyard assignment unproven. |
| E24 | supported at survey scope | Police facade panels and detached pieces supported. |
| E25 | supported at survey scope | Hedges/topiary, ornamental sculpture and fountains supported. |
| E26 | supported at survey scope | Modern office facade/roof modules supported. |
| E27 | supported at survey scope | Ornate classical/civic/mansion-like assembly supported; specific building function unknown. |
| E28 | supported at survey scope | Planters/flowers/greenhouses and garden boundary kit supported; overlaps industrial/refuse neighbors. |
| E29 | supported at survey scope | Fire station and fire engines supported. |
| E30 | supported at survey scope | Graveyard/coffins/gothic/horror motifs supported. |
| E31 | supported at survey scope | Rail/station/vehicle cutaways and structures supported; overlaps neighboring kits by design. |
| E32 | supported at survey scope | Beach/leisure/sand/deck/rock kit supported. |
| E33 | supported at survey scope | Cylindrical beacon/lighthouse-like forms supported with medium function confidence. |
| E34 | supported at survey scope | Raised sand/cliff material and example joins supported; no physical-height inference. |
| E35 | supported at survey scope | Post/hardware/gray facades supported by signs and architecture. |
| E36 | supported at survey scope | Markings, diagrams/car views and bridge pieces supported; captions not objects. |
| E37 | supported at survey scope | Signal/support/sign assemblies supported. |
| E38 | supported at survey scope | Novelty food/cup-shaped kiosk structures supported; precise dome noun tentative. |
| E39 | supported at survey scope | Bridge decks/railings/piers/water modules supported. |
| E40 | supported at survey scope | Military/industrial structures, hangars/tents/towers supported; utility membership can overlap. |
| E41 | supported at survey scope | Armored vehicle and helicopter view banks supported; physical geometry unknown. |
| E42 | supported at survey scope | Helicopter vertical/top-like views and rotor components supported; no compass convention. |
| E43 | supported at survey scope | Wood cottage and sloped modern house/facade kit supported. |
| E44 | supported at survey scope | Large roof/timber/prop kit supported; cultural/style attribution stays medium-confidence. |
| E45 | field correction required | Supported after removing abandonment condition; full bottom extension inspected. |

## Pilot-window dispositions

| Pilot | Disposition / limit |
| --- | --- |
| P-tree-green | Supported palette/form search window; seasonal/species/facing and exact member equivalence remain unknown. Bare branch forms are a local exception. |
| P-tree-orange | Supported palette/form search window; seasonal/species/facing and exact member equivalence remain unknown. |
| P-tree-teal | Supported palette/form search window; seasonal/species/facing and exact member equivalence remain unknown. |
| P-tree-ochre | Supported palette/form search window; seasonal/species/facing and exact member equivalence remain unknown. Forest overlap is explicitly retained. |
| P-tree-forest | Supported composed-forest/subcomponent search window; no new object-level segmentation or seam approval in this broad review. |
| P-tree-form | Supported sparse vertical comparison window; it is not one large tree or a contiguous family occurrence. |
| P-dump-core | Supported salvage/refuse search window; full objects, components and intact utility neighbors must remain distinct. |
| P-dump-wrecks | Supported salvage/refuse search window; full objects, components and intact utility neighbors must remain distinct. |
| P-dump-piles | Supported salvage/refuse search window; full objects, components and intact utility neighbors must remain distinct. |
| P-dump-utility | Supported salvage/refuse search window; full objects, components and intact utility neighbors must remain distinct. |

## Residual-window dispositions

All 40 windows remain accounting/inspection residuals, not candidate objects. They
can split assemblies and include source annotation; preserve their exact rectangles
and unresolved state. The following local descriptions are review observations,
not new object-level mappings.

| Residual | Disposition / observed content |
| --- | --- |
| U01 | Viewed; facade/roof strips between region windows. Retain unresolved segmentation. |
| U02 | Viewed; facade/roof strips between region windows. Retain unresolved segmentation. |
| U03 | Viewed; police vehicles, facade/sign/roof boundary fragments. Retain unresolved segmentation. |
| U04 | Viewed; police vehicles, facade/sign/roof boundary fragments. Retain unresolved segmentation. |
| U05 | Viewed; police vehicles, facade/sign/roof boundary fragments. Retain unresolved segmentation. |
| U06 | Viewed; police vehicles, facade/sign/roof boundary fragments. Retain unresolved segmentation. |
| U07 | Viewed; street fixtures/clothesline/wall pieces and pothole-like road openings. “Wreck-like” is a tentative residual hint, not a verified car identity. |
| U08 | Viewed; planter/roof or facade/corner boundary pieces; retain unresolved segmentation. |
| U09 | Viewed; doorway/roof detail fragments; retain unresolved segmentation. |
| U10 | Viewed; doorway/roof detail fragments; retain unresolved segmentation. |
| U11 | Viewed; street fixtures/clothesline/wall pieces and pothole-like road openings. “Wreck-like” is a tentative residual hint, not a verified car identity. |
| U12 | Viewed; planter/roof or facade/corner boundary pieces; retain unresolved segmentation. |
| U13 | Viewed; shop/civic-border facade/detail pieces; retain unresolved segmentation. |
| U14 | Viewed; shop/civic-border facade/detail pieces; retain unresolved segmentation. |
| U15 | Viewed; shop/civic-border facade/detail pieces; retain unresolved segmentation. |
| U16 | Viewed; split pool/slide/lounge/railing pieces; exact assemblies unclassified. |
| U17 | Viewed; split pool/slide/lounge/railing pieces; exact assemblies unclassified. |
| U18 | Viewed; split pool/slide/lounge/railing pieces; exact assemblies unclassified. |
| U19 | Viewed; isolated wind turbine is recognizable; retain residual status without geometry or new candidate registration. |
| U20 | Viewed; split pool/slide/lounge/railing pieces; exact assemblies unclassified. |
| U21 | Viewed; split pool/slide/lounge/railing pieces; exact assemblies unclassified. |
| U22 | Viewed; split pool/slide/lounge/railing pieces; exact assemblies unclassified. |
| U23 | Viewed; narrow wall/window/greenhouse perimeter fragments, some only a few pixels wide; accounting strips are not objects. |
| U24 | Viewed; narrow wall/window/greenhouse perimeter fragments, some only a few pixels wide; accounting strips are not objects. |
| U25 | Viewed; narrow wall/window/greenhouse perimeter fragments, some only a few pixels wide; accounting strips are not objects. |
| U26 | Viewed; narrow wall/window/greenhouse perimeter fragments, some only a few pixels wide; accounting strips are not objects. |
| U27 | Viewed; narrow wall/window/greenhouse perimeter fragments, some only a few pixels wide; accounting strips are not objects. |
| U28 | Viewed; narrow wall/window/greenhouse perimeter fragments, some only a few pixels wide; accounting strips are not objects. |
| U29 | Viewed; clipped source lettering; annotation rather than presumed placeable art. |
| U30 | Viewed; sparse road/marking boundary fragment; retain uncertainty. |
| U31 | Viewed; raised sand-step/cliff boundary fragment; no gameplay geometry. |
| U32 | Viewed; signal/annotation boundary fragments; keep art versus caption distinction unresolved per fragment. |
| U33 | Viewed; signal/annotation boundary fragments; keep art versus caption distinction unresolved per fragment. |
| U34 | Viewed; signal/annotation boundary fragments; keep art versus caption distinction unresolved per fragment. |
| U35 | Viewed; kiosk bottom/base pieces; do not drop disconnected narrow fragments. |
| U36 | Viewed; kiosk bottom/base pieces; do not drop disconnected narrow fragments. |
| U37 | Viewed; rotor/aircraft boundary fragments; no compass or animation recipe inference. |
| U38 | Viewed; rotor/aircraft boundary fragments; no compass or animation recipe inference. |
| U39 | Viewed; large roof-edge slices crossing theme bounds; accounting split does not form a new building. |
| U40 | Viewed; large roof-edge slices crossing theme bounds; accounting split does not form a new building. |

## Independent validation and handoff

Ran the source/coverage helper into a review-specific temporary directory:

```sh
python3 scripts/semantic-map-exteriors-survey.py --out /tmp/tilefun-semantic-exteriors-review/S02-captures
```

The helper verified source/public-alias identity, all 45/10/40 bounds and coverage.
An independent Pillow union-mask recomputation, without importing the survey
helper, confirmed **11,431,345** alpha-positive source pixels, **11,331,822** in
broad theme-window union, **99,523** outside that union, and **zero** occupied pixels
outside the union of theme and residual dispositions. All pilot bounds were also
independently checked. Overlap is counted by union, not summed rectangles.
This verifies lossless survey accounting, not semantic accuracy or object coverage.
No object segmentation denominator or human approval percentage is inferred.

[Independent measured checks](/tmp/tilefun-semantic-exteriors-review/independent-checks.json),
[raw crop index](/tmp/tilefun-semantic-exteriors-review/raw-crop-index.json),
[residual contact sheet](/tmp/tilefun-semantic-exteriors-review/S02-captures/unclassified-residuals.png),
[tube correction evidence](/tmp/tilefun-semantic-exteriors-review/tubes.png),
[ambulance evidence](/tmp/tilefun-semantic-exteriors-review/emergency-vans.png), and
[medical-bed evidence](/tmp/tilefun-semantic-exteriors-review/medical-bed.png)
are disposable local evidence. The raw 48-crop grid is exactly specified above;
source hashes and the survey helper reproduce authoritative source evidence.

Disposition: all 45 broad regions, 10 pilot windows and 40 residual windows reviewed
at survey resolution, with four explicit superseding field corrections and retained
uncertainties. Object semantics, assembly recipes and geometry remain separate.
Neither palette organization nor source occupancy proves four-season identities,
species, damage/abandonment, exclusive theme ownership or runtime suitability.
No source/author/shared files were edited by this review. Next: coordinator
integration must consume the E10/E15/E18/E45 corrections rather than inherit the
refuted frozen fields; keep residuals and medium-confidence interpretations visible
for subsequent bounded mapping and human review.
