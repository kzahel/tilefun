# E04 / I02 / E05 implementation review

Date: 2026-10-04. Reviewer: independent E05 mapper, reviewing the other
worker's presentation adapter and the shared normalization implementation.
This note alone is owned by the reviewer. Frozen proposals, reviews and shared
implementation files are read-only in this audit. No human approval is implied.

## Presentation implementation

**Passed.** The three new families expose every one of the 64 frozen native
source records exactly once through 38 cards: E04 19/7, I02 18/6 and E05 27/25.
The complete catalog has 11 families, 169 cards and 255 source records.

The eight preceding family objects, including revisions and array ordering,
match the committed catalog at `c4eb6d6` exactly; its six ArtSheet source objects
also remain exact. This is an object-preservation comparison, not a promise that
the whole catalog's revision remains unchanged after adding families.

Independent disposable audit code loaded the committed catalog and public PNGs,
implemented its own native crop/copy/source-over renderer, and checked all 64
member RGBA hashes, full frame dimensions and alpha bounds against the pinned
proposals. It separately assembled all 20 displayed example variants from the
reviewed member frames and packet placement recipes: 12 matching bed/blanket
variants and eight fence examples. Every output hash matched the proposal and
the displayed recipe. Raw public-source fingerprints matched as well.

A whole-catalog adapter rebuild under a guard rejecting every `assets/` read or
image open exactly reproduced the catalog, with 92 permitted committed-file
reads. The presentation build does not execute research helpers or require
ignored originals. I inspected an independent contact sheet of all 64 native
frames and 20 example rasters at integer zoom:
[contact sheet](/tmp/tilefun-next-family-audit/contact.png).
Capture backing colors and zoom do not enter the source pixel hashes.

The critical distinctions survive the implementation:

- E04-03/04 reconstruct 32×64 transparent frames at `[0,11]`, and E04-15
  reconstructs 16×16 at `[1,2]`. Copies are unmasked, preserving translucent
  channels without alpha doubling. These are not full-frame master occurrences.
  Tree bases, flowerbeds and plants remain baked whole-object variants; the tan
  upright pot also changes foliage. Raised planter versus ground edging,
  species, material and game geometry remain qualified or unknown.
- I02 uses actual black-shadow vendor indices 424/425/486/487/480/542 rather than
  matching normal-export filename numbers. Packed index source filenames,
  source bounds and crops are verified. Complete beds need no blanket; the two
  blankets require matching bed underlays at `[0,16]`. All 12 examples keep
  source-over ordering, same-render provenance and matching pillow ends. Identical
  blanket pixels across shadow sets remain separately exposed source records.
- E05 keeps pickets, garden gates and the experimental whole shrub separate.
  All 22 partial fence pieces retain required neighbors; gates use kind
  `unknown`, preserving unresolved standalone use. Only seven finite closed
  examples and the separately headed open upper run enter browsing. Failed
  fence layouts and the two unproven hedge extensions remain research evidence.
  No arbitrary join, gate behavior, collision or material rule is introduced.

I ran 17 independent mutation checks: all six proposal/review raw pins and three
research-helper pins, changed plant padding and geometry, incorrect actual
black-shadow identity, required underlay offset, wrong-facing blanket placement,
packed alias filename provenance for identical pixels, gate gameplay, and a
misclassified open fence example. Every mutation was rejected. The adapter's
existing tests were read; broad project/browser suites belong to the coordinator
and are not claimed as independent evidence here.

Presentation audit SHA-256 references:

| File | SHA-256 |
| --- | --- |
| `scripts/build-family-next.py` | `7ca6192e1e096d530955e479b75f6c088290fac5b8d0151dce0125e92de18501` |
| `scripts/build-family-next.test.py` | `b146da6a09b22489d3689cfea1470e74269a193a62e9d07c9269df2519ffef8d` |
| `scripts/build-family-sheets.py` | `9c3fcff94f11ea8dda71b6b74fa879fa1c5c14fdc1d461fb82d036c6c1ff0037` |
| `public/data/family-sheets.json` | `e5683e0d4bf4476d785ce2c109995b6cdabf56b8d4b012e65c265daf1f9a02ad` |
| `src/workshop/FamilySheetTypes.ts` | `77bdcfe440eeb9cedbdfbc8565c4216afa53e15551979b25b2918af03a030dac` |
| `src/workshop/FamilySheetsPage.tsx` | `bd62941d19bab47f18bda9297ee01e2d41103fbcbaf9945b877ae86beb0a55e9` |
| `src/workshop/FamilySheetArt.tsx` | `698b6435db870bedc0bfa9c892da27fe7927de7b04f50d2053b085ded199def8` |

## Normalized model and coverage

**Passed against the final frozen implementation and reconciled registry.**
The model has 255 source records and 216 proposal units. New normalization adds
64 records / 52 units: E04 19/19, I02 18/6 and E05 27/27. E04 display grouping
into seven cards does not collapse its 19 proposal units; I02 shadow counterparts
form six semantic units; E05 duplicate exports remain separate records/proposals.

Against `c4eb6d6`, all preceding 191 records, 164 proposals, 156 relationships,
eight reviews and eight packet objects are exactly preserved. Each new record's
original evidence and topology exactly equal its frozen candidate. Record and
proposal membership partition the 64 IDs once; independent review scopes cover
all members. Agent disposition, proposed state, unknown geometry and unregistered
human approval remain distinct.

A real temporary checkout containing only copied committed references, input pins
and metadata, with **no `assets/` directory**, rebuilt the identical model and
passed committed-only validation. This verified all 64 new native frames and all
31 frozen probe rasters: 17 I02 bed/blanket layouts and 14 E05 fence/garden layouts,
including negatives, weakened alternatives and unresolved hypotheses. It checked
17 finite underlay topology probes, 12 fence port graphs, 40 fence seam
diagnostics, 47 pixel comparisons and 19 available committed visible crops.
A separate renderer independently replayed all 31 raster hashes from the catalog
native frames and frozen recipes; a bucket-based graph check independently
confirmed matched/unmatched port counts on all 12 fence probes.

That fixture correctly reports all 64 original native frames, 60 original
occurrences, 19 original visible correspondences, the I02 counterpart corpus,
six wrong-filename refutations and two original-master differences unavailable.
Committed pixels and body deltas do not manufacture fresh original-source or
uniqueness verification. The mapper reports full-original replay separately;
this audit did not duplicate its long full suite or rerun exhaustive searches.

Thirteen additional mutation checks rejected changed visible-crop coordinates,
plant comparison counts, source-over operation, blanket underlay offset, shadow
body signature, fence port origins, negative-probe disposition, seam diagnostics,
comparison masks, gate standalone topology, game height, incomplete review
membership and same-pixel packed-alias filename substitution. Both local evidence
checks and the canonical frozen adapter guard were exercised; no bypass was found.

The final coverage ledger also rebuilds identically in a copied committed-only
fixture with no originals. Its 64 new rows separately expose 49 exact-direct
records, three alpha-visible restorations and 12 subfile-only bedroom records,
plus all 64 committed rendering references. Restored E04-03/04/15 have no
whole-master rect credit, and I02 subfile-only records retain packed aliases
without invented original-master matches. Investigated and independently reviewed
stages have exact evidence; accepted stages remain no-evidence. Pending planter
identity annotations are clues, not approvals, and reconciled assignment state is
not human acceptance or runtime promotion. Actual byte changes to each of the
three proposals and reviews, and omitted registered membership for each packet,
were rejected in nine isolated fixture corruptions.

Final model/coverage audit SHA-256 references:

| File | SHA-256 |
| --- | --- |
| `scripts/semantic-map-model.py` | `7d505852f7dfb1b0bfc033cec4fc9dd0a01ec507ad56239fcea43b30846b1977` |
| `scripts/semantic-map-next-families.py` | `238ffd2e95e38b57a78d2b90b1961310e49c9a8a8557691313620234c0ee0e64` |
| `scripts/semantic-map-model.test.py` | `3e72e36d580331096b9fdadc9bbdf372fc5ed98f38e962df07677f736fd38193` |
| `semantic-model.json` | `edd116e96f8b7eba18e5cf0715e1354d14fcf16e99ff7cddaacfe96f899f45f7` |
| `scripts/semantic-map-coverage.py` | `f4217904529bc50f77bc70449bdaecaea90fd814b68e510d8fcf1aace773b679` |
| `scripts/semantic-map-coverage.test.py` | `3c5f7e37cc1f35c6c6d0c34996bfc07a3ef78c16aeb155105fd4d9cb1e4da33f` |
| `coverage-ledger.json` | `7ff1b4aa4de81b79f2e19dbe66b11e231874ac9172dcaaa03b468cd16ea86714` |

No blocking finding remains. Temporary audit code and captures are disposable
and do not modify frozen source packets. The coordinator owns broad project and
browser validation; no npm, build, browser or Git mutation ran in this audit.
Next: owner discussion of these proposed sheets, with gate-side closure and
broader fence junctions kept outside the checked finite scope.
