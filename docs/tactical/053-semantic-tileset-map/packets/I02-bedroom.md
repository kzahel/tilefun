# I02 — side beds and blue blanket components

Date: 2026-10-04. Mapper: bounded Bedroom worker. Revision: 1.
State: frozen agent proposal; independent review pending. No human approval,
source-art changes, runtime placement rules or gameplay geometry are implied.

The worker owns this packet, [proposal JSON](I02-bedroom.json) and
[reproduction helper](../../../../scripts/semantic-map-bedroom.py). Shared
registration, model normalization and presentation integration belong to the
coordinator. Art is read-only; no family adapter was added.

Frozen proposal JSON SHA-256:
`9b951c075c0707f86391b14741f533c499a8b1938342db936e0b9dea29f7e0a5`.
Frozen helper SHA-256:
`4242f041621ccb19fa4f5134832b6437d3628faaaf5ca7e3c938a46c7dab7f31`.
Independent review must pin both hashes and disposition all I02-01–18 plus the
finite overlay experiments. Changing either artifact requires another revision.

## Bounded scope and visual inspection

This packet contains **18 source records / six proposal units**. Four side-bed
units share a tan/brown frame and pale-gray bedding: blue or pale-lilac pillow,
with the headboard at image-right or image-left. Two blue star/moon-like blanket
units match those two ends. Every selected unit retains its normal, black-shadow
and shadowless export, including byte-identical duplicates. Other frame colors,
pillow/bedding palettes, blanket motifs, front beds, bunks and Bedroom furniture
are outside this scope. This is not the whole S02-I31 region or Bedroom pack.

Pixels were inspected before assigning roles: normal single contact sheets
1–140 and 141–280; native selected frames at 4×; the full normal Bedroom theme;
master `[0,11136,256,272]`; normal theme `[0,608,240,192]`; candidate overlays at
several offsets; same-number black-shadow files; and finally all 18 actual
counterparts, all 17 assemblies and detailed master comparisons. The wider
single contact sheets orient the bounded choice; they are not semantic coverage.

| Logical unit | Normal / black-shadow / shadowless member IDs | Actual vendor indices | Native frame |
| --- | --- | --- | --- |
| Blue pillow, headboard right | I02-01 / I02-07 / I02-13 | 1 / **424** / 1 | 48×48 |
| Pale-lilac pillow, headboard right | I02-02 / I02-08 / I02-14 | 2 / **425** / 2 | 48×48 |
| Blue pillow, headboard left | I02-03 / I02-09 / I02-15 | 63 / **486** / 63 | 48×48 |
| Pale-lilac pillow, headboard left | I02-04 / I02-10 / I02-16 | 64 / **487** / 64 | 48×48 |
| Blue blanket, pillow end right | I02-05 / I02-11 / I02-17 | 57 / **480** / 57 | 48×32 |
| Blue blanket, pillow end left | I02-06 / I02-12 / I02-18 | 119 / **542** / 119 | 48×32 |

## Exact source contract

Coordinates are native source pixels `[x,y,width,height]`, top-left origin and
half-open bounds. Every candidate's `sourceRect` is its complete original padded
single frame `[0,0,48,48]` or `[0,0,48,32]`; `alphaVisibleRect` is local to that
frame. Packed coordinates remain separate in `committedRendering` and named
aliases. The committed rendering source is `sheetId: modern-interiors`, with
exact packed key, source ID, rectangle and pixel verification.

The JSON deliberately uses explicit small keys: `id`, `label`, `sourceId`,
`sourceRect`, `normalizedRgbaSHA256`, `alphaVisibleRect`, `committedRendering`,
`fields`, `topology`, `occurrences`, `namedExportAliases`. Sources expose `id`,
`path`, `sha256`, `dimensions` and full normalized pixel hash. `fields` separate
identity, family, role, facing, style and variant, with evidence, confidence,
alternatives and proposal disposition. `requiredNeighbors` describes an overlay
underlay relationship, not a tile-edge join. Its `[0,16]` is relative to the
**full padded bed export**, not tight alpha bounds. Recipes use RGBA source-over.

Normal paths are in
`assets/interiors/1_Interiors/16x16/Theme_Sorter_Singles/4_Bedroom_Singles/`;
shadowless paths preserve the logical vendor numbers. Black-shadow paths are in
`Theme_Sorter_Black_Shadow_Singles/4_Bedroom_Black_Shadow_SIngles_16x16/` and
preserve the different actual vendor numbers above. The exact filenames and
all 18 PNG pins are in JSON rather than inferred through filename substitution.

| Principal source | Dimensions | PNG SHA-256 |
| --- | --- | --- |
| `Interiors_16x16.png` | 256×17024 | `a35b8ed8ef392657a9339e1ce0831a3efe7b4631bfff69835bb5ef3bc738550b` |
| `Theme_Sorter/4_Bedroom_16x16.png` | 256×1712 | `33d61ecc64367d21f1d198b64d9ecc21c23d492b2fe9d12bfa4676ba9def7b6e` |
| `Theme_Sorter_Black_Shadow/4_Bedroom_Black_Shadow_16x16.png` | 256×1712 | `6cb30a055463265bfa75331cebb8b314b12b5fb1a713cd5d3c20833ab24dce11` |
| `Theme_Sorter_Shadowless/4_Bedroom_Shadowless.png` | 256×1712 | `1da60c7e76480fb993075fb9dfe7e3a201e13768fe8e319128d92a066cf7ae05` |
| `public/assets/tilesets/modern-interiors-atlas.png` | 2048×8800 | `b2ff29303e6c7e61d49b650171ec6dac2dfce8baa681a708897b66a1461245bd` |

Original source paths above are relative to
`assets/interiors/1_Interiors/16x16/` except the packed atlas. The JSON pins source
manifest, source ledger, packed index, helper and match helper. All **153**
materialized source records are pinned, including the bounded counterpart corpus
and six deliberately wrong-name examples.

## Roles, facing, style and alternatives

The 12 bed records are proposed complete visual beds: closed rails, one end
headboard, mattress/bedding, pillow and feet are all present. Padding is not an
open assembly cut. A sofa/daybed interpretation was considered; the lack of a
raised back along the long edge and the clear end pillow/headboard support the
bed name. No sleeper capacity, fabric, material species, vendor style name or
age is inferred. Tan/brown rails resemble wood; this is a medium-confidence
style hypothesis. Image-left/image-right is visible; compass headings are unknown.

The six cloth records are proposed **bedding overlay components**, forbidden as
standalone complete props within this bed kit. They have no frame, pillow,
legs or support. Their hanging scalloped lower edge and end fold align over
matching beds; a small rug or freestanding hanging cloth remains a lower-support
alternative, because no author-provided assembled whole export was found.
The specific star/moon wording describes visible pale motifs, not a theme or
physical material established by filenames.

Blanket 57/480/57 fits the right-headboard blue and lilac beds in its labeled
render set; blanket 119/542/119 fits the left-headboard pair. For each recipe,
copy the bed at `[0,0]`, then source-over the complete blanket frame at `[0,16]`
on a transparent 48×48 canvas. Topology does not license repetition, scaling,
mirroring, unselected bed palettes or arbitrary cloth fitting. Same-render
pairing preserves record identity: the blanket pixels themselves are identical
across all three sets, so that labeling restriction is bookkeeping rather than
a claimed visual difference. The beds remain complete without the optional
blanket. Topology is metadata only; collision, occlusion, anchor, footprint,
height and walkable surfaces remain unknown for every record.

## Counterpart investigation and filename refutation

**Same vendor number is not a valid black-shadow counterpart rule in Bedroom.**
Black-shadow 1/2 are bunk beds; 63/64 are front beds; 57 and 119 are other front
beds. The helper saves all six wrong-name source pins, native sizes, normalized
hashes and refutation outcomes. A same-name strategy would silently substitute
unrelated objects.

The bounded black-shadow search reads **all 130 indexed Bedroom black-shadow
singles** of selected sizes 48×48 or 48×32. Only the observed shadow token
`[58,58,80,100]` is zeroed for that candidate comparison. Each selected shadowless
body signature has exactly one match in that pool, giving the actual numbers in
the table. Source dimensions and all pixels outside that token must agree.
Normal versus shadowless bed comparisons change **53 pixels** each, all outside
the shadowless body; black-shadow versus shadowless changes the same count.
Normal changed token is `[167,151,150,255]`. Each of the six units preserves its
full delta, changed-mask hash and exact color pairs. The covers change **zero**
pixels across shadow sets. No normalization is applied to aliases or sheet
occurrences, and no whole-Interiors shadow rule is claimed.

## Occurrences, duplicate exports and master differences

The full master and all three Bedroom theme sheets are searched at **every fitting
integer pixel origin** with `Matcher(grid=1)`. Comparisons retain visible RGBA
and alpha exactly, zeroing hidden RGB only where alpha is zero.
There are **six master occurrence links**, all belonging to the two cover frames
repeated across three render records. These represent two pixel locations,
`[144,11360,48,32]` and `[0,11360,48,32]`, rather than six unique objects.
There are **21 theme occurrence links**: 18 duplicate cover links plus one
right-headboard blue-pillow bed in each matching render sheet at
`[96,608,48,48]`. Other selected whole bed exports have no exact match in the
searched sheets. Every occurrence link is retained.

Named-alias search covers all **15,964 indexed native16 Interiors singles**,
across all themes and three sets. The dimensions prefilter retains **457**
files; each raw pin and normalized full frame is checked. There are **18 unique
exact named alias files**, **14 distinct selected pixel states**, and **30
per-record alias links**: each of six cloth records links its three identical
exports, while each of 12 bed records links one file. These are duplicate export
and source-record counts, not unique-object or semantic completion counts.
Every selected packed alias matches the original single's full normalized frame;
normal browsing can render all 18 records from committed art alone.

No complete selected bed is an exact master alias. Context-only comparisons are
explicitly kept outside `occurrences`: normal 1 against master
`[96,11216,48,48]`, and normal 63 against `[48,11216,48,48]`. The tight bed frame
adds **14 upper headboard pixels** in each named export. The left-headboard
example also swaps **27 opaque wood-shading pixels**. Full-frame delta counts
are 39 and 116 because neighboring source art occupies padding above the beds.
Exact hashes, changed-mask hashes and color pairs are retained. The helper does
not erase padding, body pixels or shadows to manufacture master lineage.

Only whole padded-frame exact sheet occurrences and whole named exports are
recorded. Other theme sheets, arbitrary transformed/clipped/occluded sources,
near matches, other resolutions and unindexed files are outside the search.
Failure in this finite domain does not imply missing art. Tight crops were
inspected diagnostically for the two context comparisons; they are not an
additional occurrence class or reconstruction source.

## Finite source-only assembly evidence

All **17** recipes retain exact member IDs, full source rectangles, native offsets,
operation, canvas dimensions and output pixel hash. Full-master equality search
is saved per assembled canvas; none is an author-provided exact master whole.
Nearest-neighbor 4× capture zoom and gray backing are viewing aids only.

| Experiment IDs | Finding |
| --- | --- |
| `{normal,black-shadow,shadowless}-bed-{1,2,63,64}-matching-cover` | Twelve proposed valid compositions. Blanket top aligns with mattress top; pillow/headboard remain exposed and the lower scallops hang over the near rail toward the feet. |
| `wrong-end-right-bed`, `wrong-end-left-bed` | Wrong-end fold/alignment leaves a gray mattress strip at the foot and intrudes into the pillow seam. Invalid for the selected pairing rule. |
| `unshifted-export` | Using both native frames at `[0,0]` places the cloth above the mattress. Native padding must be accounted for. |
| `cover-raised-four-pixels` | Offset `[0,12]` raises the cloth top above the mattress and stops its hem higher. Weakened alternative; `[0,16]` is the proposed fit. |
| `cover-only` | Cloth lacks frame, pillow and feet; invalid as a complete bed. |

These renders support the bounded overlay proposal; they do not independently
prove physical cloth behavior, game draw order, universal bed compatibility or
human acceptance. The rug/hanging-cloth alternative remains documented for review.

## Quiet presentation handoff

The JSON's `presentation` block is concrete: title **Side beds and blue blankets**,
three plain family facts, **six** card definitions, normal defaults, and a
normal/black-shadow/shadowless selector for each logical unit. Each card maps all
three exact record IDs and lists its plain facts and positive experiment IDs.
The four beds belong under **Complete beds**, the two cloths under **Pieces to
combine**. No research identifiers or agents belong in normal browsing.
The six-card table above is the authoritative variant correspondence; pillow
colors remain separate cards so no multi-axis selector fallback is needed.

Complete views can use `committedRendering` directly. Positive examples use each
experiment's bed layer followed by blanket layer at `[0,16]`, native 48×48 canvas
and source-over blend; canvas sizing must preserve original padding. Keep proposal
state and unknown gameplay geometry visible. Registration and note targets await
the coordinator; this packet is not an approval artifact.

## Reproduce and handoff

```sh
python3 scripts/semantic-map-bedroom.py --check
python3 scripts/semantic-map-bedroom.py --check --capture-dir /tmp/tilefun-semantic-I02
```

Both deterministic source replay and capture replay passed. The helper verifies
pinned source/index files, native dimensions, exact packed frames, all bounded
sheet occurrences, exact named aliases, unique actual black-shadow counterparts,
wrong-number refutations, source/master deltas and all 17 recipes. Every final
candidate, composition and context capture was visually inspected.
No shared npm, build, browser or Git tasks were run by this worker; the coordinator
owns application validation and registration.

Disposable evidence:
[contact sheet](/tmp/tilefun-semantic-I02/contact-sheet.png),
[assembly comparisons](/tmp/tilefun-semantic-I02/assemblies.png),
[wrong-name refutations](/tmp/tilefun-semantic-I02/filename-refutations.png),
[master differences](/tmp/tilefun-semantic-I02/master-differences.png),
[master context](/tmp/tilefun-semantic-I02/context-1.png),
[theme context](/tmp/tilefun-semantic-I02/context-2.png),
[evidence index](/tmp/tilefun-semantic-I02/evidence.json).

Next: an independently different reviewer should first inspect pixels without
this naming proposal, then disposition all 18 records and overlay experiments,
especially reordered black-shadow exports, changed master headboards/wood shading,
and the cloth-versus-rug alternative. Reconcile serially before adding the six-card
quiet sheet or normalizing the proposed overlay relationship into shared catalogs.
