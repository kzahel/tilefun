# E04 — independent plants/planters review

Date: 2026-10-04. Reviewer: independent Bedroom mapper, after I02 freeze.
Review state: passed with the existing qualifications; no blocking findings.
No human approval or promotion is implied.
Only this review file is owned by the reviewer; mapper artifacts are immutable.

## Initial visual interpretation, before reading the proposal

I inspected the supplied contact sheet, tree-scope sheet and four source-context
captures before reading E04 JSON, Markdown or helper. Capture labels were visible,
but the following interpretation comes from the silhouettes and surrounding pixels.

I see two round green canopy sizes on narrow brown trunks. Each size appears with
bare trunk end, grass tuft, rectangular grass surround and rounded bordered grass
surround. They look like whole trees with alternative bases, not detached canopies
or separately placeable planters. The grass surrounds could be raised containers
or ground-level edging; pixels do not settle depth, material or species. Trunk and
canopy shading may differ between bases, so a display variant family need not mean
identical foliage pasted over four interchangeable components.

Three short and three longer rectangular flower-filled boxes have closed rims and
bottom shading. Their blossoms read as pink, warm orange/red, pale white/yellow,
and mixed combinations. A small standalone green dome carries yellow/white spots,
possibly a flowering shrub; identifying it as a different plant species or detached
flower tile would overstate the pixels. Four tiny potted plants show two foliage
silhouettes in reddish and tan/yellow containers. The larger foliage curls upward;
I cannot infer motion, animation, material or exact leaf species.

Whole bounded visual objects are plausible for all 19, with no join cuts visible.
The broader context shows other topiary shapes, repeated/partly clipped trees and
larger hedge/bush pieces; those cannot receive this packet's semantics merely from
proximity. A seven-card display could reasonably group two tree sizes, two flower
box lengths, the compact shrub, and two potted foliage silhouettes, while preserving
all exact source variants and distinguishing grouping from an assembly rule.

## Frozen references and replay

Reviewed immutable references:

- Proposal JSON SHA-256: `8fbca92889dd7bc587093eaa38d276b36d6ccbe22a8f748c79d4b4f6c4554f36`.
- Helper SHA-256: `8fc4a26872684f7719dbc8586c7356598b398f4110d7056543791eea983080c5`.
- Mapper Markdown SHA-256: `ef8569c3217cdd6cfcea06f7cd3daf30ff032602bd296ef60258767e7d8fa941`.

All three matched the supplied frozen hashes before review. The mapper helper
passed a fresh complete replay with originals available:

```sh
python3 scripts/semantic-map-plants-planters.py --check --capture-dir /tmp/tilefun-semantic-E04-independent
```

It reran grid1 full-frame and alpha-visible searches over the full master and all
24 theme sheets, the 12,448-file named alias domain with 5,154 fitting-size reads,
reconstruction and all recorded comparisons. This is the declared finite equality
domain, not a vegetation-pack semantic search.

A separate read-only Python audit did not invoke the mapper build function. It
verified all **71 source-file raw pins, dimensions and normalized hashes**, every
candidate source crop and measured alpha bound, all **19 committed reconstruction
frames**, both exact named aliases per candidate (**38**), all recorded full/visible
occurrence crops, all 14 crop/full-frame pixel-comparison counts, the two owner
annotation correspondences, and exact seven-group partitioning of the 19 IDs.
Fresh captures were visually inspected, including adversarial full-frame fallbacks.
The independent audit does not implement another exhaustive whole-domain matcher;
the exhaustive search was replayed through the pinned mapper/match helper.

## Per-member dispositions

“Accept” here means a supported agent proposal for bounded visual metadata. It
does not approve pixels, gameplay placement, collision, a botanical identity or
runtime behavior. Every row reconstructed the original full native frame exactly
from committed art and had two exact whole-file aliases.

| Member | Source interpretation and native frame | Committed crop | Disposition and qualification |
| --- | --- | --- | --- |
| E04-01 | Small round broadleaf tree, bare trunk; 32×48 | `[256,48,32,48]` | Accept. Closed whole tree; species and season unknown. |
| E04-02 | Small round broadleaf tree, grass tuft; 32×48 | `[288,48,32,48]` | Accept. Grass is baked with the tree; not a detachable base. |
| E04-03 | Small tree in square bordered grass base; 32×64 | `[352,52,32,52]`, native offset `[0,11]` | Accept qualified. Exact alpha-crop reconstruction; **no whole-frame master occurrence**. Raised planter versus ground edging unknown. |
| E04-04 | Small tree in rounded bordered grass base; 32×64 | `[320,52,32,53]`, native offset `[0,11]` | Accept qualified. Exact alpha-crop reconstruction; **no whole-frame master occurrence**. Rim material and physical height unknown. |
| E04-05 | Larger round broadleaf tree, bare trunk; 48×64 | `[256,96,48,64]` | Accept. Whole native frame is exact; size is a visual/source variant, not game footprint. |
| E04-06 | Larger tree, grass tuft; 48×64 | `[304,112,48,64]` | Accept. Preserve native vertical padding and baked grass. |
| E04-07 | Larger tree in rounded grass surround; 48×64 | `[352,121,48,64]` | Accept qualified. Whole crop exact at a non-grid16 origin; planter/ground alternative must remain. Owner annotation is identity evidence only. |
| E04-08 | Larger tree in square bordered grass base; 48×64 | `[400,121,48,64]` | Accept qualified. Whole crop exact; square shape does not establish concrete/material/height. Owner annotation is not approval. |
| E04-09 | Short closed flowerbed, pink blooms; 32×16 | `[448,16,32,16]` | Accept. Closed rim and flowers are one composition; species/material unknown. |
| E04-10 | Short closed flowerbed, warm red/yellow blooms; 32×16 | `[416,16,32,16]` | Accept. Original content/color variant; no general recoloring rule. |
| E04-11 | Short closed flowerbed, pale white/yellow blooms; 32×16 | `[384,16,32,16]` | Accept. Portable box versus bordered planted bed unresolved. |
| E04-12 | Wider flowerbed, warm/pale mixed blooms; 48×16 | `[480,16,48,16]` | Accept. Whole closed composition, not repeatable side/middle pieces. |
| E04-13 | Wider flowerbed, pink/pale mixed blooms; 48×16 | `[432,32,48,16]` | Accept. Equal alpha supports a silhouette group, not a pure palette transform. |
| E04-14 | Wider flowerbed, white/yellow blooms; 48×16 | `[384,32,48,16]` | Accept. Source padding retained; no width-extension recipe. |
| E04-15 | Compact unboxed green flowering shrub/clump; 16×16 | `[225,80,14,13]`, native offset `[1,2]` | Accept qualified. **No whole-frame master occurrence**; exact restoration required. Low shrub versus compact flower clump remains unresolved. |
| E04-16 | Upright green plant in reddish pot; 16×16 | `[2768,5360,16,16]` | Accept qualified. Distinct distant source occurrence; paired tan form also changes foliage. No species/material inference. |
| E04-17 | Shorter upright green plant in tan pot; 16×16 | `[2288,5632,16,16]` | Accept qualified. Preserve the shorter/slightly different leaf silhouette; cannot present as a pot-only recolor. |
| E04-18 | Arching plant in reddish pot; 16×16 | `[2288,5616,16,16]` | Accept. Whole baked plant/pot; arching silhouette does not establish animation or growth stage. |
| E04-19 | Arching plant in tan pot; 16×16 | `[2288,5648,16,16]` | Accept. Exact paired foliage with local pot-area color changes; material unknown. |

## Challenges and refutations

**Whole-frame lineage cannot be inherited from an alpha crop.** Independent
reconstruction verified E04-03/04 use transparent 32×64 frames, exact crop copy at
`[0,11]`; E04-15 uses a 16×16 frame and `[1,2]`. The inferred whole master rectangles
`[352,41,32,64]`, `[320,41,32,64]` and `[224,78,16,16]` introduce respectively
**224, 224 and 32** changed pixels. Every changed pixel is transparent in the
original export: neighboring paving/rim art occupies its padding in the master.
The wrong full-frame render is visibly contaminated. Neither absence nor cropped
visible equality licenses calling those raw full master crops exact originals.
The typed `crop-into-transparent-frame` recipe correctly preserves all original
RGBA, including internal transparency, native dimensions and offset. It copies
without an alpha mask; changing this to opaque background fill or trimming the
native frame would violate the checked contract.

**Tree display variants are complete objects, not detachable bases.** Six aligned
upper-crown comparisons independently reproduced zero changed pixels. This
supports same-size tree grouping despite different native vertical offsets. It
does not establish trunk/base interchangeability. The square-versus-rounded
whole-frame comparisons reproduce 472/461 RGBA changes and 159 alpha changes
per pair. The outlines change; neither a pure recolor nor arbitrary base replacement
is supported. All eight selected trees retain the complete visual role, null
geometry and no required component neighbor. Tree3–8 and clipped Tree15 remain
unmapped exclusion context rather than being credited through broad similarity.

**Pot variants need their foliage exception.** E04-16/17 reproduce 61 RGBA changes,
12 alpha changes and different upper extent, so a pot-color-only selector would
hide source differences. The packet and per-member facts correctly say leaves
also change, with “Tan pot with shorter leaves” as the displayed alternative.
E04-18/19 instead reproduce 28 RGBA changes, zero alpha changes, all within
`[4,9,12,16]`; its upper foliage is unchanged. This supports that bounded pair,
without proving a universal palette transform for pots or plants.

**Flowers share outlines without becoming generic color recipes.** The two short
flowerbed comparisons reproduce 105 RGBA changes each, and the wider comparisons
71/94, all with zero alpha changes. Closed borders and finite original content
variants support the proposed two size cards. Equal alpha alone does not prove
all flower positions/colors are generated by one palette substitution. Preserve
the original members. E04-15 stays separate because it has no visible rim/pot;
its species and low-shrub versus flower-clump identity remain qualified.

**Planter appearance is not material, height or approval.** Rounded tan and square
gray/violet rims are visible. Raised containers versus ground-level edging remains
undetermined; the packet already exposes this ambiguity in member facts. The two
owner selections recreate exactly by placing E04-07/08 at `[0,9]` within 48×80
transparent selections. Their extra padding is not object geometry, and the
saved pending comments do not approve art, semantics or placement. This review
checks the pinned annotation snapshot only, not subsequent live decision state.

## Counts, presentation and remaining limits

The reproduced count is **19 source records**, **16 exact full-frame master
occurrences**, **19 alpha-visible master occurrences**, and **38 named single
aliases**. The three missing full-frame matches remain explicit. Full/visible
match views, master coordinates, source frames and legacy index navigation aliases
remain separate. Null legacy index entries for newly measured forms do not block
committed rendering and must not be filled with invented rectangles.

All seven display groups partition the 19 IDs exactly once: small trees four,
large trees four, narrow flowerbeds three, wide flowerbeds three, small unboxed
bush one, upright pots two, arching pots two. Defaults and variant labels select
actual whole exports. Accept this compact presentation provided it retains the
upright foliage exception, planter-versus-ground uncertainty, null gameplay
geometry, proposal state and the three exact transparent-frame recipes. “Plants
and containers are drawn together” applies to container-bearing members; the
bare/grass tree and unboxed bush facts correctly avoid claiming hidden pots.
No detachable plant/base editor or assembly example is justified.

No blocking corrections are required for the frozen packet. Accepted qualified
alternatives remain visible; human approval is still absent. No shared model,
mapper artifact, UI, npm/build/browser or Git work was performed by this reviewer.
Original availability allowed full source replay, while eventual ordinary browsing
can use the checked committed reconstruction recipes alone.

Independent disposable evidence:
[contact sheet](/tmp/tilefun-semantic-E04-independent/contact-sheet.png),
[padding adversary](/tmp/tilefun-semantic-E04-independent/padding-adversary.png),
[per-member reconstruction summary](/tmp/tilefun-semantic-E04-independent/independent-summary.json).

Next: serial reconciliation can normalize the 19 supported visual records and
integrate the seven-card quiet sheet, preserving typed native-frame restoration
and every qualified alternative. The topiary/conical-strip family stays queued.
