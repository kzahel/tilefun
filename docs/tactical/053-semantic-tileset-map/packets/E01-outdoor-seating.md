# E01 — Benches, camping chairs and picnic tables

Status: mapper proposal revision 1; independent per-member review pending.
Date: 2026-10-04. Scope: 27 source records / variant proposal units, not 27
distinct objects or a pack-completion metric. No human approval or promotion.

Owner: bounded mapping worker. Reviewer: unassigned. Allowed outputs are this
document, [proposal JSON](E01-outdoor-seating.json) and
[reproduction helper](../../../../scripts/semantic-map-outdoor-seating.py).
The helper creates only disposable source-based evidence when requested.
Shared catalogs, queues, source pixels and runtime geometry are untouched.

## Exact assignment and sources

All members of three native16 named groups are covered:

| Members | Named exports | Proposed interpretation |
| --- | --- | --- |
| E01-01–07 | City Props Bench 1–7 | Whole slatted benches; length, side-view and palette variants |
| E01-08–23 | Camping Chair 1–16 | Whole framed chairs; panel colors, frame colors and side views |
| E01-24–27 | Camping Benched_Table 1–4 | Whole exported table-and-bench compositions; small/wide and plain/decorated |

School, Garden, rail and pool seating, other themes, animations and autotiles are
outside this packet. Broad windows are context/navigation only; no survey-region
segmentation or full seating coverage is claimed. This avoids the refuted survey
E10 “chairs” label: the playground tubes/tunnels are excluded. The adopted
E15/E18/E45 corrections also remain in force.

The committed master is `public/assets/tilesets/me-complete.png`, **2816×8224**,
PNG SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
Its original alias is
`assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Tileset.png`;
the helper verifies both file pins and exact normalized pixels. Rectangles are
native top-left `[x,y,width,height]`, right/bottom exclusive. Delta bounding boxes
are explicitly separate `[left,top,right,bottom]` values. Export frames,
alpha-visible bounds and legacy atlas-index aliases are distinct fields.

The JSON has an 80-entry source table: 54 exact named-file aliases, the original
and committed masters, and all 24 Exteriors theme sheets. Each entry preserves
path, PNG SHA-256, dimensions, normalized RGBA SHA-256 and a stable path-derived
source ID. The source ledger is pinned to
`c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda`.
The legacy index is pinned separately, retaining its existing coordinates.

All fitting integer pixel origins were searched in the full committed master and
all 24 theme sheets using `Matcher(grid=1)`. Transparent RGB alone is zeroed;
alpha and all visible RGBA must agree. There are **25 exact master occurrences**
and **25 theme-sheet occurrences**. Every selected export has two exact named
aliases: one complete single and one theme-sorter single. Alias searching used
all **12,448** native16 complete/theme singles, with dimension prefiltering and
raw hash plus normalized full-frame pixel checks of **4,028** fitting-size files.
No differently named extra duplicate was found in that domain. These are export
and occurrence counts, not distinct-object counts. Partial/occluded appearances,
near matches and alternate animation domains are outside the equality search.

The source-only contact sheet uses uniform nearest-neighbor **3×** zoom. Context
crops `[32,128,176,464]`, `[1808,32,320,384]` and `[2672,5280,144,160]`
show the civic bench rows, camping furniture, and the distant brown bench.
They preserve surrounding source art rather than fabricating scenes.

## Observations and member exceptions

E01-01/02 have golden horizontal wood-colored slats, distinct back and seat bands,
and dark end supports. The second is wider. E01-03/04 show a narrow side silhouette
with the raised rail on opposite image sides; E01-05/06 extend that same form.
E01-07 is a brown slatted bench with different shading/support details. Its single
name says City Props, but its exact theme occurrence is in **Generic Buildings**
at `[368,2128,32,32]`, and its master occurrence is `[2752,5376,32,32]`.
Family membership rests on seat/back/support structure, not exclusive city-theme
ownership or an assumed pure recolor.

E01-08–11 have green, blue, ochre and gray panels with brown frames. E01-12–15
repeat those panel colors with gray frames. Their seat/back panels show a woven
or checked pattern. E01-16–19 have the tall back rail on image left and colors
blue, gray, green, ochre; E01-20–23 put the rail on image right in the same color
order. “Camping chair” is supported by the closed framed seat/back form and the
camping context. Fabric versus other panel material and folding mechanics remain
unknown. Relative view is proposed; no world compass direction is inferred.

E01-24/26 have a planked tabletop and lower parallel sitting plank with dark
supports; E01-25 adds visible food/drink items, and E01-27 includes plates,
containers and a dark cooking/serving frame. The plain/decorated comparison
supports baked compositions, not a proven attachment mechanism or exact
constituent recipe. The broad nouns are table and bench; precise cookware type
remains unnecessary/unresolved. E01-27's 48×48 frame is taller than E01-26's
48×32 frame; its extra top rows are retained.

All 27 silhouettes are proposed complete visual objects/compositions. No exposed
cut requiring another module is evident, so their explicit topology permits
standalone visual use, requires no neighbor, and proposes no repeatable middle.
This is metadata only. Collision, anchors, footprints, height, walkable surfaces
and gameplay suitability remain unknown for every member.

## Alternatives and reproducible refutation

The JSON records per-field value, evidence, confidence, alternatives and
disposition for identity, bounds, family, role, facing and variant. The following
tests prevent plausible shortcuts from silently becoming rules:

| Hypothesis and members | Measured result | Disposition and remaining limit |
| --- | --- | --- |
| Side benches E01-03↔04 are exact mirrors | Horizontal reflection differs at 20 pixels, all alpha changes, in target bounds `[0,28,1,48]` | Exact mirror shortcut refuted; opposite-side facing supported |
| Long side benches E01-05↔06 are exact mirrors | 32 alpha/RGBA differences in `[0,16,1,48]` | Exact mirror shortcut refuted; retain each original |
| Brown/gray chair frames E01-08↔12, 09↔13, 10↔14, 11↔15 share silhouettes | Each pair changes 40 visible RGBA pixels, zero alpha pixels | Frame-color variants supported; no physics inheritance |
| Chair panel-color banks share silhouettes | Front bank changes 137/137/143 pixels; side bank 95/94/94; all comparisons have zero alpha differences | Color/view correspondence supported; a universal recolor transform is not established |
| Opposite side chairs E01-16↔20, 17↔21, 18↔22, 19↔23 are exact mirrors | Four horizontal reflections have zero RGBA/alpha differences | Exact mirror relationship supported for these four pairs only |
| Small decorated table E01-25 replaces structure | Compared with E01-24, 126 RGBA changes in `[4,2,26,15]`, zero alpha changes | Added tabletop contents supported; lower structure unchanged under this exact comparison |
| Wide decorated table E01-27 is a resized small export | Explicit lower crop `[0,16,48,32]` versus E01-26 has 404 RGBA differences, zero alpha differences, all in the upper 16 comparison rows | Aligned wide structure with additions supported; extra top rows remain part of the full export |
| Longer benches E01-05/06 can be made solely by repeating whole rows from E01-03/04 | Top short rows 11–26 equal long rows 0–15; bottom rows 28–47 equal. Long 5 has 12 rows and long 6 six rows absent from every full short row | Whole-row duplication-only recipe refuted. Partial counterpart equality is not whole-image lineage |

All delta comparisons have exact input/output and changed-mask hashes in the JSON.
Unknown material, exact view convention and table/bench attachment are explicitly
retained alternatives. Continuous alpha does not prove seam quality; this packet
does not propose modular assembly or arbitrary repetition.

## Bench 5/6 rendering handoff

E01-05/06 have **no whole-frame match** in the master or any of the 24 theme sheets.
Both full original single exports are hash-pinned, and each has an exact duplicated
theme-sorter single. No absence of art is inferred. The missing whole-sheet match
is reported separately from supported original-export identity.

The current committed atlas can render all other **25** records exactly. It cannot
render Bench 5/6 as whole objects without additional art. For committed-only family
browsing, copy the two exact original PNGs into an appropriate committed public
source location during serial integration and verify these hashes:

| Export | Frame | PNG SHA-256 |
| --- | --- | --- |
| `ME_Singles_City_Props_16x16_Bench_5.png` | 16×48 | `a20540ddc069f247d4ea6550deba55d4e69a44d3e57a0636d04b155ad08c33fa` |
| `ME_Singles_City_Props_16x16_Bench_6.png` | 16×48 | `a009c6d2666cf55b4f05a1b8307f84d147f3434aba2ccfc956ce7a46ee63f74f` |

That would preserve existing pixels; it would not approve metadata or promote
gameplay assets. This worker has not copied or modified sources. An earlier
shorter bench is useful comparison context but is not a substitute for either
exact long export. Do not force an incomplete reconstruction or hide the two
original-only records. `committedRendering` records this distinction per member.

## Verification and review handoff

Frozen proposal JSON SHA-256:
`9562c3956611af40245966284ad5614bbff9a7c11a07fac78c9b9a6a5c5bd62b`.
Review must pin this exact hash and give dispositions for E01-01–27, including the
two original-only benches and the Generic Buildings occurrence. Independent
review is pending; no human review registration, approval or promotion is claimed.

```sh
python3 scripts/semantic-map-outdoor-seating.py --check
python3 scripts/semantic-map-outdoor-seating.py --check --capture-dir /tmp/tilefun-semantic-E01
```

Requires Pillow and restored original PNGs. The helper verifies ledger/raw source
pins, dimensions, full-origin occurrences, named aliases and deterministic
variant/partial-correspondence evidence; source drift fails. It does not establish
pack-wide semantics or check unknown physics. Root owns the shared repository
typecheck, unit-test and lint run; no render/runtime/input code changed here.

Disposable inspection evidence:
[contact sheet](/tmp/tilefun-semantic-E01/contact-sheet.png),
[civic context](/tmp/tilefun-semantic-E01/context-1.png),
[camping context](/tmp/tilefun-semantic-E01/context-2.png),
[brown-bench context](/tmp/tilefun-semantic-E01/context-3.png).
The commands above reproduce these from pinned sources.

Next: independent visual review, then serial reconciliation and an exact-source
rendering decision for Bench 5/6 before extending the family-sheet adapter.
