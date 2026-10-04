# E05 — Low picket fences and separate garden gates

## Assignment

- Mapper: bounded source investigation worker; reviewer: coordinator, independently.
- Date: 2026-10-04. Proposal revision: 1. State: Proposed; independent review pending.
- Scope: all 22 native `Terrains_and_Fences/Fence_1` exports, all four native
  `Garden/Gate` exports, and `Garden/Bush_6` as one experimental support/refutation
  record. These are **two separate kits**, not an inferred mixed fence system.
- Owned outputs: this Markdown, [E05-fences-gates.json](E05-fences-gates.json),
  `scripts/semantic-map-fences-gates.py`, disposable captures only.
- No source pixels, runtime definitions, catalogs, registries or approvals change.

## Source evidence

The JSON pins every original PNG's bytes, dimensions and full normalized RGBA,
alongside source ledger, legacy index and matcher implementation receipts. All
27 untrimmed source frames exactly reproduce committed `me-complete` crops.
No original-only copy or padded restoration is needed. Original and committed
master PNG bytes are identical; `masterLineage` records that alias rather than
counting it as another semantic record. Rectangle coordinates remain original
master pixels; they are not repacked atlas coordinates.

The helper searches all fitting integer origins in the whole committed master
and the two selected native theme sheets, Terrains and Fences plus Garden. It
compares full frames with RGB zeroed **only** at alpha zero. The frozen packet
contains 58 pinned PNG source files, 48 declared master/theme occurrence links,
and 70 exact named export-alias links. Dimension-filtered complete/theme singles
are checked against the pinned inventory; duplicate names remain separate. The
JSON reports exact corpus sizes and matching limits. No absence claim is made
for unsearched theme sheets, occluded crops, transformations, or other resolutions.

The picket context is master `[1328,2928,240,144]`. Individual frames are 16×16.
Garden gates are 48×32 or 64×32, with Bush_6 at 16×32. Alpha-visible bounds are
separate from native frame bounds. Every candidate includes exact index lineage
and the proposed committed-rendering contract:

```text
{sheetId, sourceId, rect, operation: "direct-crop", frameSize,
 offsetXY: [0,0], normalizedRgbaSHA256}
```

The initial broad Garden investigation was refuted as a fence module bank:
Bush_1…23 depict complete shrub/topiary forms rather than explicit fence ends,
corners and junctions. That broader plant family remains excluded. Bush_6 is
retained only to challenge the gate-side extension hypothesis. Terrains Fence_2,
Fence_3, Props_Fence, other gates and animation strips remain outside this packet.

## Proposed interpretation and topology

The picket material is unknown: the actual art is gray/violet narrow pickets and
rails, not a demonstrated wood or metal category. All 22 source crops are
**forbidden standalone components**. World orientation, collision, height,
walkability and placement anchors remain unknown. Source labels and visual
structure do not establish those fields.

| Records | Role | Required image-plane neighbors |
| --- | --- | --- |
| 01, 11 | Upper-left corner | Right rail and lower left-side post |
| 02 | Upper horizontal rail | Left and right |
| 03, 12 | Upper-right corner | Left rail and lower right-side post |
| 04, 05 | Right-side vertical post strip; shading differs | Above and below |
| 06, 13 | Lower-right corner | Left rail and upper right-side post |
| 07 | Lower horizontal rail | Left and right |
| 08, 14 | Lower-left corner | Right rail and upper left-side post |
| 09, 10 | Left-side vertical post strip; shading differs | Above and below |
| 15 / 16 | Rising diagonal lower / upper half | 15 needs 16 above; 16 needs 15 below |
| 17 / 18 | Falling diagonal upper / lower half | 17 needs 18 below; 18 needs 17 above |
| 19 / 20 | Alternate rising diagonal upper / lower half | 19 needs 20 below; 20 needs 19 above |
| 21 / 22 | Alternate falling diagonal lower / upper half | 21 needs 22 above; 22 needs 21 below |

All record numbers in the table have prefix `E05-`. The JSON lists explicit
compatible member IDs, own/neighbor edges, relative native offsets and the exact
positive experiment supporting each relation. Every picket record participates
in a supported finite recipe. Side-post alpha columns are `[3,7)` on the left
and `[10,14)` on the right; horizontal rail anchors use local row 7. Straight
frame advances are `[16,0]` or `[0,16]`. Diagonal halves require `[0,16]`, **not**
advancing by export width as well. These image anchors are diagnostic conventions
for the measured source joins, not collision or navigation ports.

The outer diagonal endpoints are closed in the four tested two-half forms. No
independent straight end-cap or T/cross junction export is established in this
selected bank. Corners close the tested enclosures; calling a corner an isolated
end or whole fence would leave continuation cuts exposed. Arbitrary enclosure
sizes, mixed diagonal banks, junction graphs and world-facing conventions are
unproven. Matching port names alone does not license an arbitrary assembly.

Four corner duplicate pairs preserve their source names: 01/11, 03/12, 06/13 and
08/14 are pixel-exact. Similar-looking 04/05 and 09/10 each differ at 32 RGBA
pixels with equal alpha. The 18/21 diagonal halves differ at 21 pixels despite
equal alpha; 17/22 differ at 22 pixels, including four alpha changes. The 27
source records therefore contain 23 distinct pixel states, not 27 unique objects.

### Garden gates and the hedge challenge

Records 23/24 are the narrow gate with cool/warm framing; 25/26 are the wider
paired gate faces. They depict closed ornamental barred gate panels surrounded
by hedge crops. Standalone eligibility and hedge-side closure remain **unknown**.
`requiredNeighborsStatus` explicitly records that unknown boundary requirement;
an empty required-neighbor list does not mean a free placement permission.
Gate opening, movement, triggers, collision and traversability remain unknown.

The style pairs are not pure palette swaps. Narrow 23/24 changes 189 RGBA pixels
including eight alpha pixels; wide 25/26 changes 364 including sixteen alpha
pixels. Original linework and edge differences must be retained. No closed/open
state transition is inferred from their colors.

Record 27 is a complete outlined upright shrub proposal, not a proven modular
hedge continuation. Gate_1's left/right 16×32 foliage crops differ from Bush_6
at 371/376 pixels, including 29/30 alpha pixels. Replacing either side with that
shrub is therefore not an exact reconstruction. Placing shrubs beside the gate
at y=0 leaves pronounced outlined seams and changes the hedge contour; shifting
them one tile down worsens the silhouette. Both trials remain research, with no
accepted compatible-member relation. Picket-kit/garden-gate joins are unproven.

## Alternatives and reproducible experiments

Recipes retain native source frames, ordered `blend: "over"` composition,
transparent canvases, exact offsets, recipe receipts and normalized output hashes.
No source is edited, reflected, scaled or trimmed. Adjacent edge diagnostics
record alpha and RGBA differences; edge equality is not treated as automatic
render-quality proof. Captures were inspected at integer pixel zoom.

| Probe ID | Disposition and observation |
| --- | --- |
| `closed-picket-48` | Supported finite 48×48 enclosure; every continuation has a matched neighbor. |
| `closed-picket-48-duplicate-exports` | Supported duplicate-corner/alternate-side-shading recipe; retains all named records. |
| `closed-picket-64` | Supported finite 64×64 enclosure with two middle advances and two side-post rows. |
| `rising-diagonal-a` | Supported closed two-half 16×32 rising panel, zero x advance. |
| `falling-diagonal-a` | Supported closed two-half 16×32 falling panel. |
| `rising-diagonal-b` | Supported alternate rising pair, separately retained. |
| `falling-diagonal-b` | Supported alternate falling pair, separately retained. |
| `open-upper-run` | Supported **open section**: both downward corner cuts still need side posts. |
| `reversed-upper-corners` | Invalid as the intended chain; corners point away from the middle and cuts remain exposed. |
| `side-post-shift-one-pixel` | Invalid for the recorded post anchors; both right-post joins disconnect. |
| `diagonal-export-width-step` | Refutes naive width/height stepping: two visibly disconnected fragments. |
| `isolated-upper-left-corner` | Invalid standalone: right and lower continuation cuts exposed. |
| `garden-gate-hedge-extension` | Unresolved; neighboring shrub outlines do not prove a seamless gate hedge. |
| `garden-gate-hedge-extension-low` | Weakened alignment alternative; the one-tile vertical shift breaks the hedge outline. |

These are seven positive closed probes, one positive open section, four negative
probes and two unresolved/weakened garden trials. The duplicate-corner probe
adds source-name coverage, not another unique fence system. Positive graph
closure, visually inspected rendering and future human approval remain separate.

Disposable evidence:
[contact](/tmp/tilefun-semantic-E05/frozen/contact.png),
[context](/tmp/tilefun-semantic-E05/frozen/context-0.png),
[48px enclosure](/tmp/tilefun-semantic-E05/frozen/closed-picket-48.png),
[64px enclosure](/tmp/tilefun-semantic-E05/frozen/closed-picket-64.png),
[rising diagonal](/tmp/tilefun-semantic-E05/frozen/rising-diagonal-a.png),
[wrong diagonal step](/tmp/tilefun-semantic-E05/frozen/diagonal-export-width-step.png),
[gate extension](/tmp/tilefun-semantic-E05/frozen/garden-gate-hedge-extension.png),
[lowered hedge](/tmp/tilefun-semantic-E05/frozen/garden-gate-hedge-extension-low.png).
The native PNGs beside these captures are recipe rasters; colored backgrounds and
integer zoom belong only to visual captures, never to the frozen source hashes.

## Presentation and handoff

`presentationProposal` supplies plain labels, facts, group member IDs, card kinds,
exact record membership and positive experiment IDs. Proposed family title:
**Low picket fences and garden gates**. Pickets and garden gates stay in different
groups. Cool/warm gate styles group as two width cards, while both original
records remain exposed. The upright shrub is a separate whole-form trial card;
it is not presented as a validated gate attachment.
Gate cards use kind `unknown` because their standalone eligibility remains
unresolved; the component badge is reserved for the partial fence pieces.

Closed fence examples may appear under Together; `open-upper-run` needs an
**Open fence sections** heading and visible continuing-post qualification.
Negative and unresolved garden trials remain in research. The proposal contains
no gate assembly advertised as complete and no universal fence placement rule.
Whole-sheet and exact piece/style discussion can later use the existing pinned
family-sheet workflow; there is no metadata approval or generator promotion here.

The deterministic helper checks all pins, dimensions, full native member pixels,
alpha bounds, index lineage, exact declared-domain occurrences and aliases,
positive/negative port measurements, comparisons and recipe output pixels.
Reproduce with:

```sh
python3 scripts/semantic-map-fences-gates.py --check
python3 scripts/semantic-map-fences-gates.py --check --capture-dir /tmp/tilefun-semantic-E05/reproduced
```

No npm/build/browser or Git operation ran in this worker. Next: independent
candidate-by-candidate review and exact recipe replay, then coordinator adapter
integration if reconciled. Gate-side closure and any broader fence-junction kit
need further bounded investigation or owner discussion.
