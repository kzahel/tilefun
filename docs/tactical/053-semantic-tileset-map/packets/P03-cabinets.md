# P03 — Wooden cabinets, component kit and shadow variants

## Assignment

- Scope: living-room vendor singles 37–45 in normal, black-shadow and shadowless
  sets: **27 exact source records**, with full original/packed reconciliation.
- Mapper: Interiors survey worker. Independent reviewer: pending assignment.
- Date: 2026-10-04. Revision: 1. State: proposal ready for independent review.
- Outputs: this packet, [machine-readable proposal](P03-cabinets.json), and
  [reproduction helper](../../../../scripts/semantic-map-cabinet-pilot.py).
- Source navigation: S02 original cabinet window `[112,480,128,96]`. This trial
  corrects its tentative side-view interpretation: 41–44 are assembly components.
- Next action: independent visual/alias/component review. No owner approval or
  runtime promotion has been created; geometry remains unknown.

## Source evidence

Rectangles are `[x,y,width,height]`, original pixels, top-left origin and half-open
extents. Explicit `XYXY` fields in JSON use `[left,top,right,bottom]`. Sprite frames,
alpha-tight visual bounds, object-body bounds and packed aliases are separate.

| Source | Dimensions | SHA-256 |
| --- | --- | --- |
| `assets/interiors/1_Interiors/16x16/Interiors_16x16.png` | 256 × 17024 | `a35b8ed8ef392657a9339e1ce0831a3efe7b4631bfff69835bb5ef3bc738550b` |
| `public/assets/tilesets/modern-interiors-atlas.png` | 2048 × 8800 | `b2ff29303e6c7e61d49b650171ec6dac2dfce8baa681a708897b66a1461245bd` |
| `public/data/modern-interiors-atlas.json` | catalog | `c2beaba7bbd767b14df8cb7faa042908adbda89e0a43a7fd5c37cb5101a9a02e` |

All 27 single paths, SHA-256 hashes, dimensions, source rectangles, alpha bounds,
visible-pixel hashes and packed keys/rectangles are pinned in JSON. Every packed
rectangle equals the associated complete source single frame after normalizing
hidden RGB where alpha=0. All other RGBA values, including translucent pixels,
are compared exactly. Existing catalog labels are evidence, not approval.

Reproduce the measurements, exact all-origin searches and visual artifacts:

```sh
python3 scripts/semantic-map-cabinet-pilot.py \
  --verify-proposal --out /tmp/tilefun-semantic-cabinets
```

The helper compares regenerated measurements to the saved proposal, including
source pins, alias bounds, pixel identity, all occurrences, variant deltas and
assembly hashes. It uses the shared streamed matcher for grid=1 searches across
the whole original master; memory does not grow with every possible origin.
No source images, atlases or completed survey files are changed.

Inspected visual evidence:
[three-set contact sheet](/tmp/tilefun-semantic-cabinets/variants.png),
[original context](/tmp/tilefun-semantic-cabinets/master-context.png),
[38 reconstruction](/tmp/tilefun-semantic-cabinets/38-reconstruction.png),
[assembly tests](/tmp/tilefun-semantic-cabinets/assemblies.png), and
[shadow/background comparison](/tmp/tilefun-semantic-cabinets/shadow-backgrounds.png).
Individual 12× views of [41](/tmp/tilefun-semantic-cabinets/detail-41.png),
[42](/tmp/tilefun-semantic-cabinets/detail-42.png),
[43](/tmp/tilefun-semantic-cabinets/detail-43.png),
[44](/tmp/tilefun-semantic-cabinets/detail-44.png) and
[45](/tmp/tilefun-semantic-cabinets/detail-45.png) were also inspected.
PNG artifacts are temporary evidence; the helper and pinned measurements make
them reproducible without committing downloaded art or crops.

## Proposed interpretation

Each row names an explicit three-record member set: `P03-N-normal`,
`P03-N-black-shadow`, and `P03-N-shadowless`, where N is the vendor number.
All material semantic fields have separate confidence/evidence in JSON.

| Candidate | Proposed identity | Object/component role | Body rectangle inside source frame | Confidence and uncertainty |
| --- | --- | --- | --- | --- |
| P03-C37 | Tall, solid two-panel wooden storage cabinet | Complete object | `[2,4,27,38]` | High cabinet identity; wardrobe use/contents unknown |
| P03-C38 | Tall, reflective two-panel wooden storage cabinet | Complete object | `[2,4,27,38]` | High cabinet identity; mirror versus glazing unresolved |
| P03-C39 | Shorter, solid two-panel wooden storage cabinet | Complete object | `[3,9,27,31]` | High; real-world height and specific use unknown |
| P03-C40 | Shorter, reflective two-panel wooden storage cabinet | Complete object | `[3,9,27,31]` | High; mirror versus glazing unresolved |
| P03-C41 | Solid-panel cabinet left end | Horizontal component | `[2,4,14,38]` | High: left cap/outline; source right edge continues rails |
| P03-C42 | Reflective cabinet middle segment | Horizontal component | `[0,4,16,38]` | High: both sides continue; reflective material unresolved |
| P03-C43 | Solid-panel cabinet middle segment | Horizontal component | `[0,4,16,38]` | High: both sides continue; functional door count unknown |
| P03-C44 | Solid-panel cabinet right end | Horizontal component | `[0,4,13,38]` | High: right cap/outline; source left edge continues rails |
| P03-C45 | Small wooden open-front shelf/side-table unit | Complete object; separate family | `[0,6,16,17]` | Medium: green/cream/brown contents visible; books and exact furniture purpose unknown |

Body rectangles are alpha-tight shadowless art bounds; they do not include the
normal/black-shadow ground pixels and do not establish collision or footprints.
37–40 use 32 × 48 frames, 41–44 use 16 × 48 frames, and 45 uses a 16 × 32 frame.
The two cabinet heights have different body occupancy despite identical frame
size; frame height is not a physical-height measurement.

The panel depiction supports a front-facing interpretation with medium confidence.
No compass-facing convention is established. 41–44 do not show four orthogonal
facings: they have complementary cut edges and continuous horizontal rails.
A wardrobe-specific label is less certain than a storage-cabinet description.
Reflective fronts lack visible interior contents, so mirror is plausible; pale
blue panels and diagonal highlights alone cannot distinguish mirrors from glazing.
45's neighboring suffix does not make it a wardrobe module.

## Original-to-packed reconciliation

| Normal single | Every exact whole-master rectangle | Packed rectangle |
| --- | --- | --- |
| 37 | `[112,480,32,48]` | `[928,4014,32,48]` |
| 38 | None; exact composition below | `[960,4014,32,48]` |
| 39 | `[208,480,32,48]` | `[992,4014,32,48]` |
| 40 | `[176,480,32,48]` | `[1024,4014,32,48]` |
| 41 | `[112,528,16,48]` | `[512,4926,16,48]` |
| 42 | `[144,528,16,48]` | `[528,4926,16,48]` |
| 43 | `[160,528,16,48]` | `[544,4926,16,48]` |
| 44 | `[128,528,16,48]` | `[560,4926,16,48]` |
| 45 | `[176,528,16,32]` | `[112,7214,16,32]` |

These eight exact whole-master files were checked at **every pixel origin**, not
only the 16px grid. None of the 18 black-shadow/shadowless complete frames match
this original master at any origin. Their identity correspondence is supported
by the normal counterparts and verified body comparison; it is explicitly a
derived correspondence, not a direct original occurrence of the alternate pixels.
All 27 have exact packed aliases. Alias keys and alternate packed rectangles are
in JSON rather than inferred from normal ordering or atlas proximity.

## Alternatives and experiments

### E01–E04: the missing normal 38

The hypotheses were an off-grid placement, transparent padding differences,
truly distinct body pixels, or a shared component omitted from the master layout.

- Whole-frame all-origin search: no match. This refutes the off-grid-only explanation.
- Alpha-trimmed all-origin search: no match for the 27 × 39 trimmed crop. Transparent
  margin removal therefore does not solve it.
- Comparing single 38 with master `[144,480,32,48]` reveals **318 differing pixels**,
  all within the upper 16px. They are opaque cap/top pixels in the single and
  transparent pixels in this master location. The lower 32px are identical.
- Copy master `[112,480,32,16]` to target `[0,0,32,16]`, then copy master
  `[144,496,32,32]` to target `[0,16,32,32]`. Both replacement and alpha-overlay
  reconstruct single 38 **exactly**, visible-RGBA hash
  `7101bb3218a8320edf58ce981c523a45953a2fea48769889e6940342c82def1d`.

The upper strip also has exact all-origin appearances at `[177,485,32,16]` and
`[209,485,32,16]`, reflecting the offset placement of the shorter cabinet tops.
All three upper-strip occurrences are retained; the lower strip has only
`[144,496,32,32]`. Choosing the neighboring 37 cap gives the simplest pinned
recipe, without deleting the other appearances.

The body-distinct explanation is refuted for this pinned normal 38: every pixel
comes from the two original pieces. This is a **composed correspondence** and must
not be converted into a fictitious single whole-master rectangle or an assertion
that all unmatched singles can be repaired by this recipe. The black-shadow and
shadowless 38 bodies are separately pinned alternate pixels, not exact raw copies
of this normal composite.

### E05: shadow-set numbering and foreground differences

Same-suffix correspondence was tested instead of assumed. A pilot-specific body
signature removes normal ground pixels `(167,151,150,255)`, removes black-shadow
pixels `(58,58,80,100)`, and normalizes opaque white `(248,248,248,255)` to
`(255,255,255,255)`. This signature was checked against **all 122 shadowless
living-room singles**, with the reference corpus pinned by a sorted path/hash
fingerprint. Each of the 27 pilot records has exactly one counterpart in that
pool, and it has the same suffix. The raw delta analysis below independently
accounts for every removed/normalized pixel. This is not a pack-wide conversion
rule or permission to discard source variants.

| Index | Normal ground pixels outside body | Normal differing reflection pixels inside body | Black-shadow differing body pixels |
| --- | --- | --- | --- |
| 37 | 47 | 0 | 0 |
| 38 | 47 | 32 | 0 |
| 39 | 43 | 0 | 0 |
| 40 | 43 | 16 | 0 |
| 41 | 24 | 0 | 0 |
| 42 | 16 | 32 | 0 |
| 43 | 16 | 0 | 0 |
| 44 | 23 | 0 | 0 |
| 45 | 22 | 0 | 0 |

Normal ground pixels are fully opaque muted brown/gray. The vendor black-shadow
pixels use translucent blue/gray RGBA `(58,58,80,100)`, not literal black. The
shadow/background render confirms that normal shadows remain the same opaque
color on white, green and dark backgrounds, while translucent shadows blend.
The black-shadow and shadowless foregrounds match exactly for all nine suffixes.
Normal 38, 40 and 42 additionally use gray-white 248 highlights where the other
sets use white 255. Those 32/16/32 changed reflection pixels refute the claim that
normal differs only outside the object body. Preserve all exact identities and
reflection-color differences even when the semantic identity is shared.

### E06–E07: complete objects versus modular pieces

The proposed cabinet kit has 41 as left end, 44 as right end, and 42/43 as
reflective/solid middle alternatives. Rendered positive sequences in **each shadow
set** were `[41,44]`, `[41,43,44]`, `[41,42,44]` and `[41,42,43,44]`.
Top/body/base rails remain continuous, silhouettes close at the outer edges, and
there are no internal alpha gaps across occupied body rows y=4…41.

Normal `[41,44]` is an exact original assembled rectangle `[112,528,32,48]`.
Normal `[42,43]` is also an exact original rectangle `[144,528,32,48]`, but its
outer edges are uncapped; it is a source sampler of middle pieces, not proof of a
standalone cabinet. This distinction matters when deriving object counts from
contiguous occupied source pixels.

The negative control `[44,42,41]` places both end caps internally. The render
shows two gaps and open outside edges; every one of the 38 body rows has internal
alpha gaps in all three shadow sets. This supports left/middle/right component
roles and refutes their interpretation as self-contained side-facing cabinets.
The expanded sequences are assembly proposals, not human-approved objects;
arbitrary long repetitions and every ordering have not been tested.

45's open shelf, squat top/support silhouette and different rails weaken its
membership in the wardrobe kit. It remains a separate complete small-furniture
proposal, with exact contents and shelf-versus-side-table purpose unresolved.

## Independent review

Pending. The reviewer should first record an interpretation from the fresh
master/contact sheet, then compare all nine candidates and their three-record
member sets. Check the 38 composite, unique suffix correspondences, reflection
exceptions and component-end ordering. Agent agreement will not create human
approval. Candidate-level disposition is required; the uncertain reflective
material and 45 identity should remain visible rather than forcing closure.

## Reconciliation and handoff

The trial examined all 27 core source records and reconciled every packed alias.
It proposes nine semantic candidates: five complete-object candidates and four
horizontal component candidates. Eight normal files have direct whole-original
occurrences; normal 38 has exact composed correspondence; 18 shadow alternatives
have verified counterpart-derived lineage without direct whole-master occurrences.
These denominators are different from unique objects, assembly counts or semantic
coverage. Independent review and human approval counts are both zero.

All geometry fields remain unknown. Mirror-versus-glazing and the small unit's
specific function/contents remain unresolved. The investigation was not clocked,
and owner review effort is not yet available; no throughput or full-run completion
estimate is inferred from automated matching speed.

Validation: regeneration with `--verify-proposal` passed; source/catalog/packed
hash pins, all 27 alias bounds/pixels, all-origin occurrence search, exact 38
composition, raw shadow deltas, unique counterpart matching and positive/negative
assembly evidence were checked. The coordinator owns integrated repository
checks. No source pixels, promoted snapshots, review records, runtime geometry,
packed inventories or completed S02 artifacts changed. The next step is the
independent P03 review, followed by owner review of retained uncertainties.
