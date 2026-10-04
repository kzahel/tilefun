# Investigation packet template

Copy into `packets/PACKET_ID-short-name.md` for an assignment. This is a proposed
working format to improve during the trials, not an implemented runtime schema.

## Assignment

- Packet ID, theme/family, owner, reviewer and dates:
- Scope, dependencies and source revision:
- State and next action:
- Allowed output paths:

## Source evidence

- Source image path, SHA-256, dimensions and exact rectangles:
- Coordinates: original pixels; packed coordinates listed separately as aliases.
- Overview, detailed crops and neighboring context:
- Existing names, annotations and exact human-decision references:
- Related singles, variants and example compositions:
- Regions or occurrences still unexplained:

## Proposed interpretation

Record candidate IDs and exact member/occurrence lists. Separate object identity,
segmentation/bounds, family, facing, variants and assembly roles. For each material
field, record the proposed value, evidence, confidence (high/medium/low with a
reason) and unresolved alternatives. Unknown gameplay geometry stays unknown.

For components, record topology explicitly, not only a descriptive role:

- Standalone eligibility: allowed, forbidden or unknown; never default to allowed.
- Required assembly/family and the exact member variants to which rules apply.
- Open join edges versus closed outer ends, compatible neighbors/ports, source
  alignment/offsets, repetition limits and variant compatibility.
- Completeness constraints and examples of valid and invalid assemblies.
- Separate topology validity from tested render quality and human approval.
- Whether the restriction is metadata only or enforced by a catalog, generator
  or editor; components may appear in an assembly editor without becoming props.

The [cabinet topology supplement](packets/P03-cabinets-topology.json) is the first
concrete example: pieces 41–44 cannot stand alone in any of their three variants.

## Independent review

Record the reviewer's initial visual interpretation before comparing the mapper's
proposal. Then list agreements, corrections and challenges with source references.
Every candidate needs a review disposition; family checks name their members and
exceptions explicitly.

## Alternatives and experiments

For each substantive ambiguity record:

- Competing hypotheses and what would disprove each.
- Reproducible comparison, crop or assembly experiment.
- Observed result and evidence artifact.
- Which interpretation is supported, weakened or refuted, and why.
- Remaining uncertainty and whether another investigation would help.

## Reconciliation and handoff

- Final proposed values and changes from the original hypothesis:
- Unresolved fields, alternatives and follow-up questions:
- Coverage changes, overlaps, aliases and boundary exceptions:
- Validation performed and its limits:
- Candidate revision and review link when registered:

Agent reconciliation is a proposal for human review, not approval or promotion.
