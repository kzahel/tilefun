# Full-source assignment ledger — 2026-10-04

[Coverage ledger](../coverage-ledger.json) is the reproducible navigation and
assignment ledger for the pinned native source inventory. It includes **163 survey
windows**: 45 Exteriors themes, 10 Exteriors pilot windows, 40 Exteriors residuals,
45 Interiors navigation bands, six Interiors family windows, 12 Room Builder
family windows and five Room Builder annotation windows. It also includes **all
18 inventory groups**: three masters, 14 supplemental groups and one group holding
the two committed references. The inventory selector and its hash retain access
to every one of the 29,449 original PNG paths without duplicating that large list.

These are navigation/accounting denominators. They do not provide an exhaustive
object or family denominator. The ledger deliberately has no semantic completion
percentage, alpha-pixel metric, unique-object count or per-member human approval
count. The original survey and independent reviews remain the evidence for broad
whole-sheet inspection and source-alpha union accounting; reproducing this ledger
does not reread ignored source pixels.

## Evidence and stages

Every window preserves its original source path, SHA-256 and half-open rectangle.
The generator applies the coordinator's E10 playground-tube, E15 ambulance,
E18 medical-bed/stretchers and E45 condition/style corrections while retaining
other supported families. The cabinet pilot window also carries the later P03
component interpretation and reflective-panel uncertainty. Frozen proposals stay
unchanged; evidence pins and superseded fields remain explicit.

`surveyed`, `investigated`, `independentlyReviewed`, `ownerFeedback` and `accepted`
are separate evidence stages with stated scope. All windows have independent
**survey-resolution** review. Sixteen overlapping windows have some pilot lineage
context; that makes their investigation partial, never complete. A frame can
intersect several windows. A navigation-band boundary can cut a frame. Neither
case creates additional objects or completed pixels.

The 85 pilot source records retain individual source references and exact primary
master lineage: **58 direct records, nine compositions and 18 counterpart-derived
records**. Composition rectangles are constituent evidence, not a missing whole
frame's synthetic occurrence. Shadow counterparts use normal-master lineage only
as context; their original-master occurrence is still absent. Packed Interiors
rectangles are separately pinned aliases, never original-master coordinates.
All 85 records have their explicit pilot independent-review references. The
67 proposal units remain the prior pilot-accounting count, not unique assets.

Positive cabinets/scrapyard sheet comments and tree questions are related owner
feedback. They do not grant per-record acceptance. The sole acceptance scope is
three depicted varied-offset forest interior-fill compositions: F02/F05/F08,
periods 128/128/112px, step 48px, offsets `[0,48,16,96,32]`, `#479757`, back-to-front
rows, 256px comparison crop shown at 2×. The ledger pins the documented
`2cb786c` checkpoint, original source and probe script hash. Edges/caps, chunking,
seeded phase selection, whole-family semantics and collision remain outside that
acceptance. No Workshop event or frozen pilot approval is fabricated.

## Unassigned domains and next packets

Every master window has further unsegmented/unassigned semantic work. All 40
Exteriors residuals remain visible. Room Builder annotation windows can overlap
art: only residual-alpha pixels outside family windows were classified as lettering
or arrows. An entire annotation rectangle cannot be excluded from future art work.

Nine supplemental groups have no pilot investigation: Exteriors animation,
autotiles and theme sheets; Interiors animation, home examples, Room Builder
subfiles and all three theme-sheet/shadow groups. Five supplemental groups contain
partial pilot records: the two Exteriors single groups and the three Interiors
single/shadow groups. A referenced master PNG does not mean its whole art is
investigated. All 6,224 byte-identical Exteriors theme/complete single pairs remain
separate source occurrences; duplicate content earns no inherited semantic credit.

The ledger includes ready bounded descriptors for a Room Builder path/arch test,
one Interiors sofa contrast, corrected Exteriors playground tubes and a limited
supplemental animation reconciliation. These are unassigned packet scopes rather
than completed work or a replacement for the coordinator's queue.

[Mapping registry](../mapping-registry.json) separately registers the current
E01 outdoor-seating assignment as investigating. Its 27 planned exports and
three context windows are task scope only. The first rectangle intersects both
E01 and E05, the second E03, and the third E35: four broad region references
from three context rectangles. No proposal, member records, independent review or source-unit
credit is asserted until the packet is pinned and reconciled.

## Scalable registration contract

Add a registration to `mapping-registry.json` with `packetId`, `assignmentState`,
`owner`, `taskDescriptor`, `regionIds`, `sourceGroupIds`, optional proposal and
independent-review `{path,sha256}` pins, `memberRecords` and `sourceRefs`.
Each member reference is `{id,jsonPointer}` pointing to the exact record object
in the proposal (for example `/candidates/0`). Source references use original
`{path,sha256,rect}`; do not put packed coordinates there.

Draft assignments cannot claim records, sources or reviews without a pinned
proposal. Proposal/review-ready assignment stages require the corresponding
pins; a registered review must explicitly contain the proposal digest. Unknown
regions/groups, duplicate IDs, mismatched member pointers and source-pin/bounds
errors fail verification. Registration always has `coverageCredit:false`:
validation of references does not validate an arbitrary future packet schema or
its semantics. Root reconciliation supplies explicit packet adapters/model
normalization and tests before records enter semantic counts. New acceptance
requires its own exact human scope and provenance, separately from task status.

## Reproduction and validation

```sh
python3 scripts/semantic-map-coverage.py
python3 scripts/semantic-map-coverage.py --check
python3 scripts/semantic-map-coverage.test.py
```

Generation changes only `coverage-ledger.json`; the separate registry is an input.
`--check` compares deterministic bytes and never writes. Both commands require
only Python stdlib and committed evidence/assets/indexes. They verify frozen
proposal hashes, exact review applicability, source inventory/group fingerprints,
source rectangles and actual portable source/index/builder bytes. They do not
verify ignored original PNG bytes. For that use the full source-inventory and
survey/pilot reproduction commands in their owning records.

Ten regression checks pass. They verify portable deterministic reproduction with
no original assets, no-write/stale failure, corrupted inventory/proposal/source
and packed-index rejection, review-digest mismatch failure, corrected themes,
bounded acceptance without member inheritance, original/packed distinction,
overlap accounting and extensible pinned registration without fabricated credit.
The coordinator owns repository-wide typecheck, unit tests and lint validation.

Next: freeze/review E01, register its exact proposal/member/source references, then
normalize its claims and reconcile the ledger without declaring whole regions
complete. Start the Room Builder path/arch packet when a worker slot is free.
