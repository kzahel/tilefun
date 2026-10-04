# V01 — Shared semantic model and read-only pilot validation

2026-10-04. Foundation implementation over the three frozen pilots, followed by the explicit E01 extension below; no source art,
proposal JSON, runtime bank or owner review event changed. The
[model](../semantic-model.json) is deterministic adapter output, not a promoted
catalog. The [adapter](../../../../scripts/semantic-map-model.py) and
[regression tests](../../../../scripts/semantic-map-model.test.py) require Python
3 and Pillow.

## Model ownership and counts

Four views separate the pilot's **85 source records** from its **67 proposal
units**, relationships and independent reviews. Source-file identities pin raw
PNG SHA-256 and dimensions; record identities pin normalized RGBA and full frame
size. Every recorded named alias, master occurrence, packed alias and relevant
counterpart corpus file survives. P01 record IDs are namespaced `P01:T01` etc.;
P02 and P03 retain their already namespaced identities. Proposal membership
covers each record once, including the three P03 shadow records per concept.

| Packet | Source records | Proposal units | Direct | Composed | Derived |
| --- | ---: | ---: | ---: | ---: | ---: |
| P01 | 29 | 29 | 21 | 8 | 0 |
| P02 | 29 | 29 | 29 | 0 | 0 |
| P03 | 27 | 9 | 8 | 1 | 18 |
| Total | 85 | 67 | 58 | 9 | 18 |

These are proposal/lineage counts, not unique-object counts, whole-pack coverage,
semantic accuracy or human approval. All 67 pilot proposal units remain Proposed;
registered human approvals and runtime promotions are zero. Later bounded owner
acceptance of particular forest recipes is owned by the
[family-sheet record](2026-10-04-family-contact-sheets.md#owner-acceptance-varied-offset-forest-compositions);
it does not retroactively approve this frozen pilot schema or its gameplay data.

Fields expose identity, family, component role, facing and variant with original
confidence/evidence and explicit alternatives/dispositions. All gameplay anchors,
footprints, collision, walkability and heights remain unknown. Frozen source
wording survives in `originalEvidence`; adapter fields adopt rounded-canopy tree
wording, the ladder-like alternative for P02-09, and the qualification that whole
cabinet roles rest on their own contours, rather than the modular negative probe.
Raw review text preserves initial observations, briefing limits, explicit member
dispositions and qualifications. Review applicability requires the exact frozen
proposal hash and member list; changed identities cannot inherit review.

## Interpretation scope and later evidence

Normalized P01 fields describe the frozen pilot plus its pinned coordinator
reconciliation. They are not the complete latest state of all subsequent tree
research. For example, F05's pilot component-role wording retains the original
repeatability limitation. The later bounded forest-repeat/phase evidence and
owner acceptance are recorded in the
[family delivery note](2026-10-04-family-contact-sheets.md#owner-acceptance-varied-offset-forest-compositions)
and [coverage ledger](../coverage-ledger.json). Those approved exact varied-offset
examples supplement the pilot interpretation; they do not approve every member,
repeat length, boundary condition, gameplay use or this model. Consumers seeking
current delivery/review state must consult that separately scoped evidence. This
adapter does not compile an unrestricted forest generator or inherit example
approval onto P01 proposals.

## Verification behavior

```sh
python3 scripts/semantic-map-model.py --check
python3 scripts/semantic-map-model.py --check --summary
python3 scripts/semantic-map-model.py --check --committed-only
python3 scripts/semantic-map-model.test.py
```

`--check` never writes. It verifies frozen packet/review/reconciliation/inventory
pins, reconstructs the expected adapter output, compares the saved model, checks
all available raw file hashes/dimensions, validates typed half-open bounds and
coordinate spaces, and checks recorded crop pixels and packed catalog lineage.
The exported validator also compares the complete model to the canonical adapter; recomputing a model revision cannot bypass source, semantic, topology or review-scope invariants. The stable JSON report contains no timestamps, elapsed timings or machine paths.
Ordinary invocation regenerates only the model, after validation succeeds.

All nine composed-lineage recipes specify ordered RGBA overwrite inputs, source
rectangles, target offsets, canvas dimensions, expected record identity and
normalized output hash. Full validation independently compares reconstruction
to pinned target PNG pixels. The cabinet shared upper strip retains and verifies
all three occurrences, including off-grid origins; its lower strip also retains
its recorded occurrence. The eight tree replacements are explicit overwrite
recipes; the recorded successful alpha-over controls are preserved, without a
claim that overwrite is uniquely necessary for those eight examples.

Full validation also checks the P01 alpha-mask/color-mapping exceptions, all 27
P03 raw deltas and pilot-normalized body hashes, and uniqueness against all 122
pinned shadowless living-room sources. Normal 38/40/42 preserve their 32/16/32
on-body reflection differences. The normalization remains a measured pilot
hypothesis, not a pack-wide conversion rule. P02's duplicated exports remain 58
source-file references for 29 records; origins Y3165/Y3164 remain arbitrary-pixel
coordinates. The warning-triangle relation retains both tied 40/174 offsets and
unknown identity/occlusion. Forest and refuse assembly/negative-probe evidence
and unresolved repetition/ground/seam limits remain recorded.

The validator checks every **listed** exact occurrence; it does not claim to
rerun exhaustive absence searches. Those search algorithms, domains, original
results and limitations remain source evidence. The original pilot verification
helpers and independent review records provide reproducible exhaustive checks.
This distinction prevents a successful bounds/crop check from becoming a new
claim that every possible occurrence was independently found.

## Cabinet topology

The reusable `check_topology(topology, member_ids)` function accepts concrete
variant record IDs and evaluates declared start/end/middle roles, reciprocal
edge compatibility, required joins, forbidden internal closed ends, minimum
middle count and the conservative same-variant rule. It permits left + zero or
more middles + right, including repeated/reordered middle kinds. Standalone
partials, missing caps, reversed ends, internal caps, unknown IDs and mixed
variants are rejected. Mixed variants are outside the evidence scope, rather
than a proven visual failure. All 12 explicit member records are checked against
proposal membership and frame/variant metadata. Owner clarification forbids
standalone pieces 41–44 in every variant; it does not approve every assembly.

Topology validity, tested rendering and human approval remain separate. The
report checks 21 recorded positive topology sequences across variants and all
recorded invalid examples. It does not render or approve every topology-valid
length or combination; components stay assembly-editor-only metadata and
runtime placement enforcement remains pending.

## Original-pack limitations and extension contract

Full mode fails when any pinned source reference is absent or changed.
`--committed-only` permits absent ignored `assets/` originals, with their paths
and unchecked obligations listed explicitly; committed input absence and any
**present** file hash drift still fail. Adapter output is identical in both
modes. In a fresh-copy regression fixture without original packs, the eight tree
recipes replay against the committed master but cannot independently compare
named target PNGs; the Interiors master recipe is unavailable, and 122-file
counterpart uniqueness is not rechecked. None is reported as a completed check.

Future packets need a versioned adapter with explicit pin/revision/member and
accounting contracts. Unsupported packets fail visibly rather than entering
counts through guessed field names. Extend `build_model`, `PACKET_ACCOUNTING`
(or a subsequent versioned registry), and the packet-specific evidence checks
with named sources, typed bounds, searches/limits, recipes/variants and per-field
unknowns. Add independent tamper fixtures before admitting a new packet. Keep
record, proposal, occurrence, tested-assembly and human-approval accounting
separate; agent agreement and proposed labels must never become approval totals.
No mutable family-sheet presentation artifact is an input pin.

The pilots were not clocked; no throughput/accuracy/completion-time estimate
follows. Future packets should record examined units, changed/unresolved fields,
elapsed effort and owner effort as the method-review acceptance criteria require.

## Bounded validation checkpoint

Local originals were available. Full model generation and `--check` verified all
85 records / 67 units, nine exact composition target comparisons, 27 raw variant
deltas and the 122-file counterpart corpus. The foundation 13-test regression suite covers
repeatable read-only JSON output, committed-only limits, source and reference
drift, coordinate-space/bounds violations, composition-offset tampering, raw
variant-delta tampering, review applicability, aliases/exceptions and topology
positive/negative cases. The coordinator owns integrated repository typechecks,
unit tests, lint and the separate family-sheet rendering checks.

Next: independently review this adapter and admit the next bounded theme packet
through an explicit source/review contract; keep exact owner metadata approval as
a separate later decision.


## E01 versioned adapter extension

The foundation was checkpointed in commit `2f53abd` after independent review.
E01 uses the explicit `E01-outdoor-seating-v1` adapter for packet schema 2,
proposal revision 1, with proposal SHA-256
`9562c3956611af40245966284ad5614bbff9a7c11a07fac78c9b9a6a5c5bd62b` and
[independent review](../packets/E01-outdoor-seating-review.md) SHA-256
`5b85986b906910e857549c7528b33ef70b995fb7c5ec7276d1e65a01d6ee1ef0`.
All 27 members have separate proposal/source/review identities and retained
field alternatives. The adapter verifies all 80 frozen source pins, 54 named
aliases, 25 master and 25 theme occurrences, 18 exact variant-delta/mask
experiments and two long-bench partial/row-exception probes. All 24 theme sheets
remain explicit search-domain evidence, without a new exhaustive absence claim.
The review separately reproduced the exhaustive full-origin searches.

Aggregate accounting is now **112 records / 94 proposal units**. The stable
report preserves `pilotAccounting` as **85 / 67**, independent from
`extensionAccounting.E01` as **27 / 27**. Aggregate primary master lineage is
83 direct, nine composed, 18 derived and two original-only. E01's 27 proposal
units are 25 direct master matches plus **two original-only master records**;
the latter retain exact full exported-source identities. Empty master occurrence
lists do not become absent-source claims or invented reconstructions.

Bench 5/6 have supplementary serial-integration aliases at
`public/assets/semantic-sources/exteriors-bench-5.png` and
`public/assets/semantic-sources/exteriors-bench-6.png`, raw PNG hashes
`a20540ddc069f247d4ea6550deba55d4e69a44d3e57a0636d04b155ad08c33fa` and
`a009c6d2666cf55b4f05a1b8307f84d147f3434aba2ccfc956ce7a46ee63f74f`.
Their `integrationAliases` and explicit source-alias relationships are separate
from the frozen packet's original `committedRendering` handoff. The alias PNGs
must match the pinned original bytes, dimensions and normalized full frames;
they are required committed references. They allow full mirror/partial checks
on fresh clones without original packs. Their presence changes neither the two
original-only master dispositions nor unregistered human approval.

E01 whole-object topology remains a visual proposal: no required neighbors and
no proposed repeats. Cabinet component topology remains governed by its separate
supplement. Bench mirror exceptions, exact side-chair mirror pairs, panel/frame
color correspondences, Generic Buildings bench 7, and the taller decorated-table
frame are preserved. Gameplay geometry remains unknown for all 94 proposals.
Human approvals and runtime promotions remain **zero**.

The expanded regression suite adds separate pilot/extension accounting,
original-only absence/source distinction, supplementary-alias scope, exact E01
deltas, fabricated-occurrence rejection and fresh-clone committed-only checks.
The latter verifies both committed bench aliases while still reporting absent
original packs and unavailable Interiors reconstruction/corpus verification.
The coordinator owns repository-wide and presentation validation.
