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

Eight supplemental groups have no normalized investigation: Exteriors animation
and autotiles; Interiors animation, home examples, Room Builder subfiles and all
three theme-sheet/shadow groups. Six supplemental groups have partial normalized
evidence: the two Exteriors single groups, Exteriors theme sheets, and the three
Interiors single/shadow groups. E01 contributes 25 exact crops across three
Exteriors theme sheets; this is bounded occurrence evidence, not complete sheet
semantics or a new visual whole-sheet survey. A referenced master PNG does not mean its whole art is
investigated. All 6,224 byte-identical Exteriors theme/complete single pairs remain
separate source occurrences; duplicate content earns no inherited semantic credit.

The ledger includes ready bounded descriptors for a Room Builder path/arch test,
one Interiors sofa contrast, corrected Exteriors playground tubes and a limited
supplemental animation reconciliation. These are unassigned packet scopes rather
than completed work or a replacement for the coordinator's queue.

[Mapping registry](../mapping-registry.json) registers E01 outdoor seating as
reconciled and I01 Interiors sofas as review-ready. Explicit E01 normalization is
now pinned to semantic model SHA-256
`2f612b7fd2e2b9d07bd9c00bbf02cd4955210959b4a8a411857b0c6da93bbc26`.
Its 27 records/27 proposal units stay separate from the pilot 85/67 baseline,
giving 112 normalized records/94 proposal units. E01 primary master lineage is
25 direct records plus two original-only long benches. Its 54 named exports,
25 theme-sheet crops and two committed byte-identical integration copies are
separate evidence counts. Bench 5/6 retain no master rectangles or region links;
the committed copies do not invent occurrences. Original/committed master group
references point to the same 25 occurrences, counted once despite byte-identical
alias paths. Exact E01 links cover E01 (two), E05 (two), E03 (20) and E35 (one).
No owner feedback/acceptance is inherited for this new packet.

I01 is independently reviewed but has zero normalization credit in this ledger.
The sofa packet descriptor derives its review-ready status from that registration,
rather than continuing to offer an unassigned sofa task. I01's source/record
references remain registered evidence pending a versioned adapter; the total stays
112. Other ready bounded packet descriptors remain unassigned.

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
errors fail verification. Registration alone has `coverageCredit:false`: validation of references does not
validate an arbitrary future packet schema or its semantics. The explicit reviewed
E01 adapter marks its 27 bounded records credited and records the exact model pin;
I01 and unsupported future registrations remain uncredited. Root reconciliation supplies explicit packet adapters/model
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

Twelve regression checks pass. They verify portable deterministic reproduction with
no original assets, no-write/stale failure, corrupted inventory/proposal/source
and packed-index rejection, review-digest mismatch failure, corrected themes,
bounded acceptance without member inheritance, original/packed distinction,
overlap accounting, original-only export copies without invented master links,
separate pilot/expansion/supplemental counts and extensible pinned registration
without fabricated credit.
The coordinator owns repository-wide typecheck, unit tests and lint validation.

Next: normalize the frozen, independently reviewed I01 packet in a separate
versioned slice, preserving its partial/unknown placement policies and separate
accounting. The Room Builder path/arch packet remains unassigned. No further
semantic expansion is claimed by this checkpoint.
