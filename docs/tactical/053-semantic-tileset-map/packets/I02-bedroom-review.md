# I02 — Independent review of side-view beds and blue cover pieces

Review date: 2026-10-04. Reviewer: separate mapping worker. State: pass with the
bounded qualifications below; ready for coordinator reconciliation.
Only this review file is reviewer-owned; mapper packets, helper, source pixels and
shared catalogs are unchanged.

## First interpretation, before reading semantic claims

The reviewer generated an unlabelled contact sheet using only candidate IDs,
source IDs, native rectangles and source paths, then inspected the actual pixels
before reading the mapper's labels, topology or experiment interpretation.

The 18 records look like three sets of six drawings: four complete horizontal
wood-framed beds with pale mattress surfaces, a raised head rail on either image
side, and blue versus white pillows; plus two separate bright blue textile pieces
with white motifs and an irregular hanging lower edge. Each bed has a closed
frame/mattress outline and legs, supporting a whole-bed visual role. The blue
pieces look like covers or blankets, though their required placement and relation
to individual beds need composition evidence. Those are potential overlays,
not enough evidence for a complete standalone furniture object. Differences
between the three sets appear chiefly in the lower shadow/support regions.
World compass direction, actual bed size and collision cannot be read from these
images. No human approval is inferred.

Initial evidence: [unlabelled source contact sheet](/tmp/tilefun-semantic-I02-independent/unlabelled-contact.png).

## Exact review receipt and independent checks

Reviewed proposal: [I02-bedroom.json](I02-bedroom.json), SHA-256
`9b951c075c0707f86391b14741f533c499a8b1938342db936e0b9dea29f7e0a5`.
Reviewed helper: [semantic-map-bedroom.py](../../../../scripts/semantic-map-bedroom.py), SHA-256
`4242f041621ccb19fa4f5134832b6437d3628faaaf5ca7e3c938a46c7dab7f31`.
The receipt applies to these exact revisions, not later edits. Both hashes and
every JSON dependency pin were verified against files on disk.

The mapper helper's full deterministic check/capture replay passed:

```sh
python3 scripts/semantic-map-bedroom.py --check --capture-dir /tmp/tilefun-semantic-I02-independent/replay
```

The reviewer also used a separate temporary audit that does not import the mapper
helper. It zeros RGB only at alpha zero, recomputes raw PNG/source hashes, validates
rectangles before cropping, measures alpha bounds and compares direct crop bytes.
That audit checked **153 materialized sources**, **18 candidates**, all **27 exact
sheet-occurrence links** (six master, 21 theme), **30 named/packed alias links**,
all dependency pins and every candidate's unknown geometry. All original frames
match their committed atlas crops exactly. No master near-match was accepted as
an alias. The audit then recomposed **all 17 recipe hashes from committed atlas
crops**, preserving full native padding, layer order, offsets and RGBA source-over.
Each layer fits the 48×48 output without clipping. This independently checks that
committed-only presentation can reproduce the original-source probes.

The full-origin absence/equality domain was replayed by the pinned helper; the
separate audit directly checked every saved occurrence rather than using a second
independent exhaustive search algorithm. It independently recomputed the six
unique black-shadow body matches across the declared 130-file counterpart pool,
and both master-difference masks, pixel counts and changed-color pairs. This is
bounded source evidence, not whole-pack coverage or a browser raster-parity check.

## Per-member dispositions

“Accept” means adopt as an agent proposal for this bounded kit, with unknown
gameplay geometry and no human approval. Every listed original full frame,
alpha-visible bounds, packed rendering crop and occurrence/alias reference passed.
Image left/right describes the depicted headboard end, not world direction.

| Member | Actual source number / render set | Visual identity and role | Disposition |
| --- | --- | --- | --- |
| I02-01 | 1 / normal | Blue pillow, right headboard; complete bed | Accept |
| I02-02 | 2 / normal | Pale lilac pillow, right headboard; complete bed | Accept |
| I02-03 | 63 / normal | Blue pillow, left headboard; complete bed | Accept |
| I02-04 | 64 / normal | Pale lilac pillow, left headboard; complete bed | Accept |
| I02-05 | 57 / normal | Blue patterned cover, right pillow end; overlay component | Accept with cloth/rug uncertainty retained |
| I02-06 | 119 / normal | Blue patterned cover, left pillow end; overlay component | Accept with cloth/rug uncertainty retained |
| I02-07 | 424 / black-shadow | Blue pillow, right headboard; complete bed | Accept; reordered filename verified |
| I02-08 | 425 / black-shadow | Pale lilac pillow, right headboard; complete bed | Accept; reordered filename verified |
| I02-09 | 486 / black-shadow | Blue pillow, left headboard; complete bed | Accept; reordered filename verified |
| I02-10 | 487 / black-shadow | Pale lilac pillow, left headboard; complete bed | Accept; reordered filename verified |
| I02-11 | 480 / black-shadow | Right-end blue cover; overlay component | Accept; exact duplicate of I02-05/17 retained |
| I02-12 | 542 / black-shadow | Left-end blue cover; overlay component | Accept; exact duplicate of I02-06/18 retained |
| I02-13 | 1 / shadowless | Blue pillow, right headboard; complete bed | Accept |
| I02-14 | 2 / shadowless | Pale lilac pillow, right headboard; complete bed | Accept |
| I02-15 | 63 / shadowless | Blue pillow, left headboard; complete bed | Accept |
| I02-16 | 64 / shadowless | Pale lilac pillow, left headboard; complete bed | Accept |
| I02-17 | 57 / shadowless | Right-end blue cover; overlay component | Accept; exact duplicate of I02-05/11 retained |
| I02-18 | 119 / shadowless | Left-end blue cover; overlay component | Accept; exact duplicate of I02-06/12 retained |

All bed export frames are 48×48. Right-headboard beds have local alpha bounds
`[11,13,36,25]`; left-headboard beds have `[1,13,36,25]`. Covers are 48×32 with
local visible bounds `[11,1,23,20]` on the right-end type and `[14,1,23,20]` on
the left-end type. Original export padding is retained. The twelve beds are
complete visual props and may appear without covers. Six cover records lack a
frame, pillow or feet and should be shown as pieces to combine within this kit.
Their forbidden-standalone proposal does not prove that the same cloth art could
never be useful as a decorative cloth/rug elsewhere; that alternate semantic use
remains unresolved.

## Counterpart numbering, source pins and master exceptions

The independent token-normalized search confirmed the exact normal-to-black
source correspondence `1→424`, `2→425`, `63→486`, `64→487`, `57→480`, `119→542`.
Each has exactly one matching body signature in the 130 indexed Bedroom
black-shadow singles of the selected sizes. The observed `[58,58,80,100]` shadow
token alone is removed for this test; alias and occurrence comparison retains all
alpha and visible RGBA. The four bed bodies in each render set preserve the
shadowless body, with 53 added/different shadow pixels in each normal/black bed.
The two cover signatures are unchanged across all three sets. Fourteen distinct
selected pixel frames and six semantic units correctly preserve eighteen exports.

The actual wrong-number files were visually inspected: black 1/2 are bunk beds;
black 63/64 are front-view beds; black 57/119 are other front-view beds. Each
same-number shortcut fails the declared dimensions/body equality. These six
refutations are correct and material: index substitution would select different
furniture, not a different shadow rendering of the selected bed.

The original master and related named single images were compared visually and
by independent changed masks. I02-01 versus master `[96,11216,48,48]` changes 39
full-frame pixels; restricting to the original alpha bounding frame isolates 14
extra named-export headboard pixels, with no shared body-color changes. I02-03
versus `[48,11216,48,48]` changes 116 full-frame pixels; its alpha bounding frame
changes 41: fourteen extra headboard pixels and twenty-seven opaque wood-shading
changes. Neighboring master art also occupies original padding. These are real
source differences, unlike a padding-only reconstruction. Accept both comparisons
as related context only, never exact lineage or substitute render sources.

Exact selected master occurrences belong only to the two cover frames at
`[144,11360,48,32]` and `[0,11360,48,32]`, repeated as six record links because
all three source sets preserve identical cover pixels. The packet's counts retain
this duplication honestly. The indexed-single alias domain and three Bedroom
theme-sheet domain are explicit; other theme sheets and unindexed originals are
not silently claimed searched. No whole-bedroom completion follows from them.

## All seventeen finite composition dispositions

The reviewer inspected every native-source probe at nearest-neighbor enlargement
and independently regenerated each hash from packed art. Matching overlays expose
the pillow/headboard, replace the mattress cover and hang the scalloped edge over
the near rail. The full cover frame must sit at `[0,16]` relative to the full bed
frame. The visible pixels alone cannot justify using trimmed origins instead.

| Experiment | Independent disposition |
| --- | --- |
| normal-bed-1-matching-cover | Accept finite source-over rendering / selected pairing |
| normal-bed-2-matching-cover | Accept finite source-over rendering / selected pairing |
| normal-bed-63-matching-cover | Accept finite source-over rendering / selected pairing |
| normal-bed-64-matching-cover | Accept finite source-over rendering / selected pairing |
| black-shadow-bed-1-matching-cover | Accept finite source-over rendering / selected pairing |
| black-shadow-bed-2-matching-cover | Accept finite source-over rendering / selected pairing |
| black-shadow-bed-63-matching-cover | Accept finite source-over rendering / selected pairing |
| black-shadow-bed-64-matching-cover | Accept finite source-over rendering / selected pairing |
| shadowless-bed-1-matching-cover | Accept finite source-over rendering / selected pairing |
| shadowless-bed-2-matching-cover | Accept finite source-over rendering / selected pairing |
| shadowless-bed-63-matching-cover | Accept finite source-over rendering / selected pairing |
| shadowless-bed-64-matching-cover | Accept finite source-over rendering / selected pairing |
| wrong-end-right-bed | Reject within selected rule; gray foot strip exposed and fold is at the wrong end |
| wrong-end-left-bed | Reject within selected rule; opposite strip exposed and fold is at the wrong end |
| unshifted-export | Reject within selected rule; cloth floats above the mattress |
| cover-raised-four-pixels | Weakened alternative; cloth rises above the mattress and hem stops higher |
| cover-only | Reject as a complete bed; complete supporting bed art is absent |

The twelve positive examples are convincing bounded overlay proposals. Their
absence as exact complete master occurrences remains explicit. No author-supplied
whole bed-and-cover export, physical drape rule, runtime drawing contract,
unselected bed palette fit, arbitrary layering or human approval was established.
Same-render pairing is identity bookkeeping because covers are pixel-identical
across those labels; it should not be presented as a physically necessary color
constraint. Required underlays apply to the component, while the bed's cover is
optional. No edge join or repeatable middle exists.

## Reconciliation and integration limits

No mapper correction is required for the reviewed frozen evidence. Keep the
medium-confidence blanket identity and documented cloth/rug alternative, exact
black-shadow filename correspondence, unrelated master matches and unknown
geometry visible in durable data. The six-card presentation grouping correctly
partitions all eighteen records: four complete-bed cards and two cover-component
cards, each retaining the three render labels. Member-specific overlay examples
can be drawn from the twelve positively reviewed source-over recipes.

This review verifies source research and finite rendering correspondence. It
does not approve art/metadata, promote game assets, add runtime topology
enforcement, or replace repository application/browser validation. Agent acceptance
must remain separate from human approval. Coordinator normalization should carry
the exact two compatible bed IDs per component/render label, underlay relation,
full-frame `[0,16]` offset, and source-over layer order without treating covers as
standalone furniture or requiring covers on the complete beds.

Replay evidence: [seventeen compositions](/tmp/tilefun-semantic-I02-independent/replay/assemblies.png),
[six wrong-name exports](/tmp/tilefun-semantic-I02-independent/replay/filename-refutations.png),
[master comparison](/tmp/tilefun-semantic-I02-independent/replay/master-differences.png),
[theme context](/tmp/tilefun-semantic-I02-independent/replay/context-2.png) and
[independent audit code](/tmp/tilefun-semantic-I02-independent/audit.py).

Next: coordinator normalization and quiet-sheet integration, followed by shared
validation; no source or proposal pixels changed in this review.
