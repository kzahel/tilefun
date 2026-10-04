# E03 playground tubes — independent review

Reviewer: Room Builder mapper, reassigned after freezing RB01. Date: 2026-10-04.
Reviewed proposal SHA-256:
`4370a63a1308b9ccc844029bfe077bb304faac2e62826923c3ba5a685508143e`.
This is agent review, not human approval, collision validation or promotion.

## Fresh source interpretation, recorded before reading semantic claims

The reviewer first read only source IDs/paths, export rectangles and context
rectangles from the packet and made source-only crops. The original master
context shows orange, blue and red playground tubes beside towers/bridges, with
separate unassembled pieces underneath. The context includes a composed long
multicolor tube and a small crossing; those examples do not automatically make
every nearby single a valid standalone object or licensed mixed-color join.

The native singles show curved upper/lower elbows, horizontally and vertically
cut repeat sections, downward mouths, rounded upward ends, and horizontal
branches with upward/downward mouths. Mouth-only left/right pieces have one
cropped tube connection. The taller two-mouth vertical pieces in all three
colors have complete outside silhouettes and look usable as whole short tubes.
Dark rims versus colored centers do not establish real-world passage size or
collision. A rounded upward cap may be closed or merely a rear-facing mouth
whose interior is obscured; that ambiguity should remain.

Initial record impressions: 01/03 upper elbows; 05/07 lower elbows; 02/06/18/19
horizontal repeat pieces; 04/08 vertical repeat pieces; 09/10 downward mouths;
11 downward branch; 12 rounded upward end; 13 upward-mouth branch; 14 rounded
upward-end branch; 15/20/23 complete two-mouth vertical tubes; 16/21/24 right
mouths and 17/22/25 left mouths. Labels here refer to source-image position,
not world compass or gameplay facing.

Raw evidence inspected before comparison:
[native singles](/tmp/tilefun-semantic-E03-review/raw-singles.png),
[bounded context](/tmp/tilefun-semantic-E03-review/raw-context-1.png),
[larger context](/tmp/tilefun-semantic-E03-review/raw-context-2.png).
The initially recorded interpretation is preserved here rather than rewritten
to match the mapper's vocabulary.

## Result and reconciliation

**Accept the frozen packet as a bounded, qualified agent proposal.** All 25
source identities/bounds/aliases and the eight finite assembly dispositions are
supported. No mapper correction blocks this scope. Unknown rounded-end state,
collar function, arbitrary repetition and cross-color compatibility remain
unknown. Agent acceptance here grants no human or gameplay approval.

The initial impression that 15/20/23 were complete short vertical tubes was
wrong. At native detail their horizontal band reaches both export side edges
with straight continuation cuts at local y=16. The independent isolated-cross
render exposes those cuts; adding complementary side-mouth pieces closes them
and produces the depicted four-mouth cross. This discriminating check supports
the mapper's two lateral ports and forbidden standalone status, while the upper
and lower mouths are exterior openings rather than assembly cuts. The first
interpretation remains above so the correction is auditable.

All 25 candidate alpha bounds and original full export rectangles verify. The
large transparent frame margins and two-pixel shadow spill are real source data;
16px body-band alignment, rather than concatenating padded frames, produces the
tested joins. World facing and every gameplay geometry field remain unknown.

## Explicit record dispositions

For every row below: exact source bounds/hash, all declared source aliases and
master occurrences pass; identity as a painted playground tube component and
forbidden standalone proposal are accepted. Port directions use image axes.
“Accepted qualified” means uncertainties or untested joins remain as written,
not that every connector combination is proven.

| Record | Disposition | Independent observation / retained limit |
| --- | --- | --- |
| E03-01 | Accepted | Upper-left elbow has right/bottom cuts; U probe closes both. |
| E03-02 | Accepted | Left/right continuation, native body height 16 with shadow below; straight probe tests two repeated copies. Exact duplicate of 06. |
| E03-03 | Accepted | Upper-right elbow has left/bottom cuts; right shadow extends beyond its 16px body; U closes both. |
| E03-04 | Accepted | Top/bottom continuation; U closes both. Eleven RGBA pixels differ from 08 while alpha is identical; do not collapse shading. |
| E03-05 | Accepted qualified | Lower-right elbow with top/left cuts. Shape is clear, but no frozen positive probe exercises its exact neighbors. |
| E03-06 | Accepted qualified | Byte-identical to 02, with both original names/occurrences preserved. No separate concept or additional frozen compatibility evidence inferred. |
| E03-07 | Accepted qualified | Lower-left elbow with top/right cuts; no frozen positive neighbor recipe for this piece. |
| E03-08 | Accepted | Top/bottom continuation on the U's left arm; shading differs from 04. |
| E03-09 | Accepted | Down-image mouth with a top continuation cut; U closes it. Ten RGBA pixels differ from 10, alpha identical. |
| E03-10 | Accepted | Complementary down-image mouth on the U's left arm; preserve source shading exception. |
| E03-11 | Accepted qualified | Horizontal continuation with downward-mouth branch, side cuts at the upper band. Exact compatible side neighbors are not in frozen tests. |
| E03-12 | Accepted qualified | Rounded top and bottom cut at local y=32. Reviewer end/continuation/mouth probe joins visually; cap versus obscured/rear-facing mouth remains unresolved. |
| E03-13 | Accepted qualified | Dark upper-facing mouth above side cuts at local y=16. Reviewer side-mouth assembly joins visually; no source-to-world heading or traversability claim. |
| E03-14 | Accepted qualified | Rounded upper branch above side cuts at local y=16. Reviewer side-mouth probe renders coherently; opening versus closed cap remains unresolved. |
| E03-15 | Accepted | Native comparison corrects initial complete-tube impression: two lateral continuation cuts plus two mouths; frozen cross closes both cuts. |
| E03-16 | Accepted | Right-image mouth, left cut; straight and cross probes close the cut. Exact mirror equality with 17 applies only to the checked ochre pair. |
| E03-17 | Accepted | Left-image mouth, right cut; two master occurrences retained, including the upper contextual crossing. |
| E03-18 | Accepted qualified | Horizontal continuation with right collar/rim detail. Reviewer straight probe keeps shell continuity but produces a visible seam detail; collar purpose and general compatibility remain unknown. |
| E03-19 | Accepted qualified | Horizontal continuation with left collar/rim detail. Reviewer probe supports a bounded join, not a function or exhaustive connector rule. |
| E03-20 | Accepted | Blue counterpart of 15 with identical alpha. Same-palette blue cross closes the lateral cuts; geometry does not inherit from recolor. |
| E03-21 | Accepted | Blue right mouth; cross closes left cut. Both exact master occurrences retained. |
| E03-22 | Accepted | Blue left mouth; cross closes right cut. Blue mirror relationship was not tested and is not inferred. |
| E03-23 | Accepted | Red counterpart of 15, identical alpha; red cross closes both lateral cuts. Two master appearances preserved. |
| E03-24 | Accepted | Red right mouth; cross closes left cut. Master appearance lies beyond the original narrow context window, but full-master matching retains it. |
| E03-25 | Accepted | Red left mouth; cross closes right cut. Red mirror relationship was not tested and is not inferred. |

The rounded/collared reviewer probes are **supplemental observations in this
review**, not edits to the frozen packet or permission to populate a broad
compatibility matrix. Unknown geometry stays unknown for all 25 records.

## Explicit frozen assembly dispositions

Every recipe was independently re-rendered from pinned original singles using
Pillow `alpha_composite` in the listed order, on the packet's native 64 × 64
transparent canvas. All eight native RGBA hashes match the frozen packet.
The reviewer also independently checks opposite port profiles and global band
origins; the mapper's port-matching implementation alone is not the evidence.

| Probe | Disposition | Unmatched cuts | Visual result |
| --- | --- | --- | --- |
| `straight-two-mouths` | Accept bounded positive | 0 | Two repeated middles retain continuous horizontal shell; both exterior mouths close the chain. |
| `cross-four-mouths-ochre` | Accept bounded positive | 0 | Side mouths close the cross's flat lateral cuts; upper/lower mouth contours remain exterior. |
| `u-two-mouths` | Accept bounded positive | 0 | Two upper elbows, one horizontal middle, one vertical middle per arm and complementary down-mouths form the depicted U. Shading variants retained. |
| `isolated-cross` | Accept negative | 2 | Both flat lateral cuts remain exposed; the two visible vertical mouths cannot satisfy them. |
| `wrong-end-facing` | Accept negative | 2 | The leftmost right-mouth module exposes its left continuation and presents a rounded mouth to the middle. |
| `one-pixel-gap` | Accept negative | 4 | Native transparent columns separate body bands; origins disagree by one pixel and cannot pair. |
| `cross-four-mouths-blue` | Accept bounded positive | 0 | Same-palette blue shell/side mouths align. No arbitrary mixed-color rule. |
| `cross-four-mouths-red` | Accept bounded positive | 0 | Same-palette red shell/side mouths align. No color-to-geometry inheritance. |

The three negative results reject specific invalid arrangements; they do not
prove that all other arrangements are valid. Repetition is finite: two
horizontal middles and one vertical middle per U arm. A source-baked multicolor
composition is evidence of intentional mixing in that example, not a universal
color compatibility rule.

Canonical recipe hashes below are review receipts, computed over sorted compact
JSON of exactly `{size, placements, operation}` from each frozen assembly. The
proposal itself retains native raster hashes and recipes but has no separate
recipe-hash field; this receipt pins both without editing the frozen proposal.

| Probe | Canonical render-recipe SHA-256 |
| --- | --- |
| `straight-two-mouths` | `c7ce952a005a32ea52860488f7ee1cc581cafe3e77d61a5b05aec34a49707047` |
| `cross-four-mouths-ochre` | `e12d0577c498b6a3e6378112eaa0aef1978e1df351c71c0337bc8e6278f48cfa` |
| `u-two-mouths` | `e067a732fe199d59819d0131feea0a0d0e1b1ecfa20bc4b2fa1fdfefc7f8ff93` |
| `isolated-cross` | `e9cd33bbae3d8633e58b93ace7ec0a7c4b7e9e984b3d88b0d0f5e10864dfd140` |
| `wrong-end-facing` | `61fc43208338b7f6c91df478941b02b99203868599618ede557ca57acc2805a0` |
| `one-pixel-gap` | `3242def266f680264f7f0e48f7789cf9ef67984a1805725b3c8764165e6dec88` |
| `cross-four-mouths-blue` | `439945aa960f12ee05d876b5ee80ca1cc16adae071eefb90948cf14c1e87a447` |
| `cross-four-mouths-red` | `534ddce81028e96d7d29c7278b75cf3035d6bcb08b73949441655f401286efab` |

## Reviewer challenge probes

Additional source-only hypotheses use 64 × 80 transparent canvases, original
singles and ordered Pillow `alpha_composite`. Positions below are native offsets.
The captures and full native hashes are retained for exact follow-up; they do
not change the reviewed packet's member count or frozen tested-neighbor lists.

| Probe / ordered placements | Observation | Native RGBA SHA-256 |
| --- | --- | --- |
| Rounded upward end: `12@(0,0), 04@(0,32), 09@(0,48)` | Shell is continuous through the declared bottom cut; rounded top state stays unknown. | `e19f3e69955d75c231dd77566d8f0a303a80dbcfeac3091ba57c14671341f85c` |
| Upper mouth branch: `17@(0,16), 13@(16,0), 16@(32,16)` | Side origins at local y=16 align; upper mouth remains an exterior contour. | `c0fbac052b4afa142d6aa7a7458473c397ea2c362b384174bab3ddcece082ceb` |
| Rounded upper branch: `17@(0,16), 14@(16,0), 16@(32,16)` | Same lateral alignment, rounded top silhouette; cap versus rear-facing opening unresolved. | `2256d98ba4205e0e3970f6b98227e2c99cb79dee0625528b9b9eb572ac2025d7` |
| Right-collar repeat: `17@(0,0), 18@(16,0), 16@(32,0)` | Tube shell closes; visible collar seam remains. Function unresolved. | `be88a020b5aab2c54a6ad90c4a1eba52c8ebd144053ac14e89bd03ad1bd5722b` |
| Left-collar repeat: `17@(0,0), 19@(16,0), 16@(32,0)` | Tube shell closes; no new collar interpretation follows from a coherent join. | `3c7a9c41687c02d884f6c7fee899118b8dfc7ad2d0998b6f4547a3082ec7b54c` |

Recipe hashes use sorted compact JSON of `{size:[64,80], placements:[{memberId,
offsetXY},…], operation:"Pillow RGBA alpha_composite in listed order; no scaling"}`.

| Supplemental probe | Recipe SHA-256 |
| --- | --- |
| Rounded upward end | `b416b2fcd700852ba1228b09651db3a5c8a739e8f8d886dd756704a0497a28b9` |
| Upper mouth branch | `2abd3ad702c924034012aa7d88cbb9cc683e0aed0b0032472c4e802357f2599c` |
| Rounded upper branch | `d3ce4aae6914d9987368cda2c860f0499f6a53df87207c6673fac864152aa985` |
| Right-collar repeat | `9ef51146a31f36de48f62b9c1f86e394e74eb95a7354f336d151fb4441472ffa` |
| Left-collar repeat | `acb56130e5b330706ad6b5f46d84cf0609e0324bfa1e2d5c635532a82db0e66d` |

## Validation and exact limits

Passed:

- `python3 scripts/semantic-map-playground.py --check --capture-dir /tmp/tilefun-semantic-E03-review/reproduced` reproduces the full-original search and alias corpus.
- A separate reviewer script directly verifies **76 PNG hashes/dimensions/full
  normalized RGBA hashes**, all 25 alpha bounds, all **60 declared sheet
  occurrence links**, **30 master occurrence links**, **54 named alias links**
  and all 25 legacy index pixel aliases. No near-match is accepted as equality.
- Independent comparison checks reproduce the 2/6 exact duplicate, 4/8's 11
  changed RGBA pixels, 9/10's 10 changed RGBA pixels, selected cross recolors'
  517 changed pixels and side-mouth recolors' 177 changed pixels. All recolor
  alpha deltas are zero; ochre 16 reflected horizontally exactly equals 17.
- All eight frozen native assembly rasters independently match their full
  RGBA hashes, and a profile-aware independent port evaluation reproduces
  all matched/unmatched counts and all valid/invalid dispositions.
- Every final native candidate, all eight frozen assembly probes and five
  reviewer alternatives were visually inspected at integer pixel zoom.

The mapper helper's search exhausts every fitting integer origin in the full
master plus all 24 declared native16 Exteriors theme sheets, and dimension
prefilters all 12,448 declared complete/theme single files (7,578 read). The
separate reviewer script directly verifies every *declared* occurrence and alias;
its independent pass does not separately exhaust the whole search domain.
The helper reproduction provides that exhaustive-domain check. Hidden RGB is
normalized only where alpha is zero; all other RGBA/alpha remain exact.

Limitations remain: whole-export equality only, with margins; no occluded,
clipped, transformed, alternate-resolution, animation or arbitrary large baked
composition equality claim. Identity/assembly evidence does not establish
traversability, real material, heights, collision, world orientation, universal
connector rules or human acceptance. Only selected colors and finite recipes
are reviewed. No shared npm/build/browser jobs or catalog mutations were run.

Disposable independently rendered evidence:
[straight](/tmp/tilefun-semantic-E03-review/straight-two-mouths-independent.png),
[ochre cross](/tmp/tilefun-semantic-E03-review/cross-four-mouths-ochre-independent.png),
[U](/tmp/tilefun-semantic-E03-review/u-two-mouths-independent.png),
[isolated cross](/tmp/tilefun-semantic-E03-review/isolated-cross-independent.png),
[wrong end](/tmp/tilefun-semantic-E03-review/wrong-end-facing-independent.png),
[one-pixel gap](/tmp/tilefun-semantic-E03-review/one-pixel-gap-independent.png),
[blue cross](/tmp/tilefun-semantic-E03-review/cross-four-mouths-blue-independent.png),
[red cross](/tmp/tilefun-semantic-E03-review/cross-four-mouths-red-independent.png),
[rounded end](/tmp/tilefun-semantic-E03-review/rounded-upward-end.png),
[upper branch](/tmp/tilefun-semantic-E03-review/upper-mouth-branch.png),
[rounded branch](/tmp/tilefun-semantic-E03-review/rounded-upper-branch.png),
[right collar](/tmp/tilefun-semantic-E03-review/collared-right-repeat.png),
[left collar](/tmp/tilefun-semantic-E03-review/collared-left-repeat.png),
[verification script](/tmp/tilefun-semantic-E03-review/verify.py),
[verification receipt](/tmp/tilefun-semantic-E03-review/receipt.json).

Next: coordinator can register this exact bounded proposal and review, keeping
components separate from whole objects. Follow-up should investigate unresolved
rounded states/collars and remaining blue/red shapes in new bounded packets;
none of those fields need an invented answer to accept this evidence.
