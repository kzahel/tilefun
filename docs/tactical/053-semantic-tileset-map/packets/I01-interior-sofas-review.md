# I01 — Independent Interiors sofa review

2026-10-04. Reviewer: coverage-ledger/model-review worker, separate from mapper.
Scope: exact bounded source records, packed aliases and component/assembly evidence.
Agent review only; no human approval, gameplay geometry or runtime promotion.

## Initial observations before proposal comparison

I first viewed the unlabeled raw `context.png` capture, before opening the proposal
JSON or mapper note. The coordinator brief named the candidate range and topology
questions, so this was brief-informed observation, not blinded discovery.

The raw crop shows repeated front-like cushioned horizontal furniture, striped
blue-gray and light checker upholstery, followed by golden/white checked forms
and loose diamond-shaped cushions. Short square forms have raised top rails or
back-like structures and tiny feet. Long upright seat-like forms lie below larger
backs, but the crop alone does not settle whether they are freestanding low seats,
chaise extensions or pieces of a larger sofa. Two-tall-column samplers also occur.
Lower rows show long narrow furniture with a higher strip on one side, and mirror
looking opposite-side counterparts in several upholstery patterns. Bottom bands
include horizontal rail/seat samplers whose chopped edges suggest constituent
pieces. Adjacency alone does not define a valid completed sofa or a unique family.
Patterns and borders can shift phase at joins; unknown world orientation,
collision, height, seating mechanics and walkability remain unknown.

## Exact reviewed snapshot and disposition

Reviewed [proposal](I01-interior-sofas.json), revision 1, exact SHA-256
`75b0910c5565e9bff3db9b819f76fe2cca0e5e268b6438a2ff7023a061a260df`.
The hash was rechecked after verification. Source changes, new members, new
assembly layouts or changed roles require their own applicable review.

Supported with bounded qualifications: **20 source records**, comprising 18 normal
selected records and two additional render counterparts. These are not 20 unique
objects or completed regional semantics. The exact exports are Basement content;
S02-I16's navigation location does not make them Living Room singles. The raw
crop, member sheet and all 15 source-only assembly probes support the coarse
identities and the explicit distinction between components, unknown long-seat
roles and two small closed-seat proposals.

I viewed [raw context](/tmp/tilefun-semantic-I01/context.png), then compared the
proposal and mapper note, and viewed the [20-member sheet](/tmp/tilefun-semantic-I01/contact-sheet.png)
and [15 assembly comparisons](/tmp/tilefun-semantic-I01/assemblies.png).
This order preserves the initial raw-source reading above, while acknowledging the
coordinator's brief and the later visible labels.

## Explicit member dispositions

| Member | Independent disposition | Retained qualification |
| --- | --- | --- |
| I01-01 | Supported partial | Blue-gray front left cap; closed outer curve and open right cut; standalone forbidden, same-family/render neighbors required. |
| I01-02 | Supported partial | Blue-gray horizontal middle; both sides cut; no standalone object, bounded repeat evidence only. |
| I01-03 | Supported partial | Blue-gray front right cap; open left cut and closed outer curve; standalone forbidden. |
| I01-04 | Supported unresolved role | Normal 7 long blue seat-like form; padded surface/feet supported, backless seat versus extension unresolved; standalone eligibility unknown. |
| I01-05 | Supported unresolved role | Normal 8 opposite long blue form; same role alternatives; neither paired adjacency nor whole export establishes independent placement. |
| I01-06 | Supported closed-seat visual proposal | Normal 9 has closed rounded contour and feet; small upholstered seat supported, ottoman/footstool versus low chair unknown; geometry unknown. |
| I01-07 | Supported partial | Pale gray front left cap; matching outer closure and inner open join; standalone forbidden. |
| I01-08 | Supported partial | Pale gray middle with open left/right cuts; same-bank caps required; arbitrary repetition unreviewed. |
| I01-09 | Supported partial | Pale gray right cap; standalone forbidden; source/texture identity retained. |
| I01-10 | Supported unresolved role | Normal 13 long pale-gray seat-like form; specific seat/extension role and standalone eligibility unknown. |
| I01-11 | Supported unresolved role | Normal 14 counterpart long form; reversed local paired order versus normal 7/8 preserved; standalone unknown. |
| I01-12 | Supported closed-seat visual proposal | Normal 15 closed small padded form; ottoman versus low chair unresolved, no seating/physics inference. |
| I01-13 | Supported partial | Normal 27 side top with rail at image right; curved top and open lower edge; standalone forbidden. |
| I01-14 | Supported partial | Normal 28 side middle, open top/bottom; repeat proposal requires cap/end closure and same facing/palette/render set. |
| I01-15 | Supported partial | Normal 29 side bottom with feet/closed lower contour; open top needs connection; standalone forbidden. |
| I01-16 | Supported partial | Normal 30 opposite-side top, rail at image left; curved top and open lower edge; standalone forbidden. |
| I01-17 | Supported partial | Normal 31 opposite-side middle; open top/bottom; texture/shading repetition remains visible. |
| I01-18 | Supported partial | Normal 32 bottom/end with feet; matching top/middle needed, no standalone placement. |
| I01-19 | Supported render counterpart partial | Black-shadow normal-4 counterpart; same bounded body identity, 16 changed shadow pixels outside body; selected same-variant neighbors absent, no complete assembly claimed. |
| I01-20 | Supported render counterpart partial | Shadowless normal-4 counterpart; cap remains partial, no shadowless completed chain claimed from this packet. |

All 14 explicit cap/middle/end records, including the two extra render counterparts,
retain forbidden standalone status. The four ambiguous long-seat records retain
unknown status; this review must not convert that unknown into permission. The
two small closed-seat records have only proposed standalone **visual** eligibility.
No anchor, footprint, collision, walkability, height or world compass heading is
established for any member. The indexed export/alpha rectangle remains art bounds.

## Assembly dispositions

Each disposition applies to the exact recorded source rectangles/offsets, overwrite
operation and output hash. “Supported closed proposal” means a bounded rendered
closure, not human acceptance or a claim that every topology-valid arrangement
has been visually tested.

| Probe | Independent disposition | Scope |
| --- | --- | --- |
| blue-front-closed | Supported closed proposal | 4→5→6 reproduces exact original master `[48,5456,48,32]`. |
| gray-front-closed | Supported closed proposal | 10→11→12 reproduces exact original master `[96,5456,48,32]`. |
| blue-front-short | Supported closed proposal | 4→6 closes both ends; new 32×32 arrangement, no exact whole master occurrence. |
| blue-front-repeated-middle | Supported closed proposal with seam limits | 4→5→5→6 retains two caps; visible periodic upholstery/feet shading remains, no unlimited seamless-repeat claim. |
| blue-front-reversed-caps | Rejected as complete object | 6→5→4 exposes cuts externally and puts rounded caps internally; occupied join pixels do not rescue topology. |
| blue-front-uncapped | Rejected as complete object | 5→5 leaves both outer sides cut; middle repetition alone is not a sofa. |
| gray-side-right-short | Supported closed proposal | 27→29 reproduces exact original master `[48,5520,32,48]`. |
| gray-side-right-extended | Supported closed proposal with texture limits | 27→28→29 closes top/bottom; internal horizontal rail shading and checker phase remain visible. |
| gray-side-right-repeated | Supported closed proposal with texture limits | 27→28→28→29 closes the extended shape; only this two-middle layout tested, periodic bands remain. |
| gray-side-left-short | Supported closed proposal | 30→32 reproduces exact original master `[80,5520,32,48]`. |
| gray-side-left-extended | Supported closed proposal with texture limits | 30→31→32 closes top/bottom in the opposite rail family; arbitrary length or mixed facing unreviewed. |
| gray-side-reversed-caps | Rejected as complete object | 29→28→27 puts feet at the upper end and an open cut at the bottom. |
| gray-side-source-sampler | Rejected as complete object despite exact source match | 27→29→28 exactly matches `[48,5520,32,64]`; middle extends below a closed foot end. Raw source adjacency is not complete-object topology. |
| blue-lower-seats-paired | Supported unresolved-role probe | 7→8 matches `[48,5488,32,32]`; pairing neither settles individual standalone use nor proves a chaise attachment. |
| gray-lower-seats-paired | Supported unresolved-role probe | 14→13 matches `[96,5488,32,32]`; ordering/identity retained, use remains unresolved. |

Front chains require closed left/right caps and 16px horizontal advance with constant
32px height. Side chains require a 32px-wide top of height 32, zero or more 16px-high
middles and a 16px-high foot end, with no middle after a closed end. Required ports
and same facing/palette/render policy are metadata constraints. Source sampling,
alpha continuity and exact equality establish different facts; none automatically
confers human approval or physics. Gray-front zero/two-middle and left-side
two-middle layouts were not tested. Mixed palettes/render sets, corners, L-shaped
attachments and arbitrary long chains remain outside this review.

## Independent checks

A separate [read-only review script](/tmp/tilefun-I01-independent-review.py), which
imports neither the mapper helper nor `Matcher`, verified:

- all 268 declared raw PNG pins, dimensions and normalized full-image hashes;
- all 20 selected frame hashes/alpha bounds and exact committed packed frames,
  including source-path/source-rectangle/packed-rectangle index linkage;
- all 28 exact declared named aliases without inflating the 20-record denominator;
- all 46 master/theme occurrences by independent full-origin search across the
  four declared source sheets: 18 master plus 28 theme crops;
- all 15 assembly output hashes, full-origin master-search results and exact
  occupied-alpha join arrays;
- all three conditional counterpart signatures against the 240-file shadowless
  Basement pool, with unique vendor-index-4 identity and 16/16/0 changed pixels,
  all outside the reference body.

The independent scanner chooses a complete normalized RGBA row from each target,
finds matching byte anchors in the full source, rejects unaligned/wrapped/out-of-bounds
origins, and compares every candidate row before keeping an occurrence. It searches
every fitting integer source-pixel origin without tile-grid restrictions. Pixel
normalization changes only hidden RGB under zero alpha; translucent RGBA remains
intact. Assembly replay pastes unresized source rectangles with RGBA overwrite.
Join occupancy is independently recomputed on the two columns/rows adjoining each
reported boundary. These checks reproduce evidence; they do not prove seamlessness.

The mapper's unchanged full check also passed:

```sh
python3 scripts/semantic-map-interior-sofas.py --check
```

That helper verifies the complete indexed 15,964-file alias domain and its 12,028
same-size reads. The separate review script verifies all declared alias identities
and full-sheet occurrences; it does **not** independently rerun that entire indexed
alias-corpus enumeration. This distinction remains explicit. Normal 27/28/30/31's
additional identical shadow-set exports are equality aliases, not extra concepts.
The three cap-4 render signatures justify only their observed shadow-token removal;
no cabinet reflection rule or pack-wide normalization is imported.

Disposition: all 20 members and 15 probes are explicitly reviewed at the scope
above, retaining four unresolved roles and bounded rendering limits. No blocking
source/identity/topology inconsistency found; no proposal/helper/source/packed data
was changed. Human approvals and runtime promotions remain zero. Next: serial
registration/model/coverage integration with explicit partial and unknown placement
policies, followed by owner discussion of the bounded sofa sheet.
