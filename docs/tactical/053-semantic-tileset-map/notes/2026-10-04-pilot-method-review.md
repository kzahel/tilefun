# P04 — Pilot method review, 2026-10-04

Status: bounded method assessment complete; final P02/P03 reviews and coordinator
reconciliation remain pending at this checkpoint. P01 has a completed independent
review. P03's available review records initial observations only; P02's review
artifact is not yet present. This does not introduce a new owner-approval gate.

Read the three proposals/helpers and available pilot reviews:
[P01](../packets/P01-trees.md), [review](../packets/P01-trees-review.md),
[P02](../packets/P02-scrapyard.md), [P03](../packets/P03-cabinets.md),
[review checkpoint](../packets/P03-cabinets-review.md).
These JSONs are heterogeneous trial outputs, not a unified runtime schema.

## Accounting

| Pilot | Records | Direct exact master lineage | Composed lineage | Counterpart-derived lineage | Proposal units |
| --- | ---: | ---: | ---: | ---: | ---: |
| P01 | 29 | 21 | 8 | 0 | 29 |
| P02 | 29 | 29 | 0 | 0 | 29 |
| P03 | 27 | 8 | 1 | 18 | 9 |
| Total | **85** | **58** | **9** | **18** | **67** |

These are record-level lineage dispositions, not unique game objects, occupied
regions or whole-pack completion. P01 mixes whole trees, replacement strips and
forest segments; P02 mixes objects, components and baked compositions; P03 groups
three shadow-set records into each of nine proposals. The 58 direct records each
have one exact crop, but support pieces can overlap those crops and have multiple
appearances (the cabinet 38 cap has three). Do not sum support occurrences into
object counts. P02's 58 named-file occurrences are duplicated exports, not 58
distinct objects. Only P01 currently has final candidate dispositions (29 units).
No new human approval or registered semantic-review coverage exists in these pilots.

## Requirements before scaling

1. **Exact source references:** retain repository path, raw PNG SHA-256, dimensions,
   coordinate space and typed half-open rectangles. Distinguish exported frame,
   alpha-visible bounds, proposed body bounds and packed aliases. Arbitrary pixel
   origins are valid: P02 pile exports at Y3165/3164 refute grid-only absence.
2. **Occurrence accounting:** preserve every exact occurrence and file alias;
   record search domain, algorithm, normalization and negative-result limits.
   Separate direct crops, composed correspondence, derived counterparts and
   unresolved matches. No-match never implies missing art without further evidence.
3. **Composition proof:** name input identities/rectangles, operation, target
   offsets/order, canvas dimensions and output pixel hash; pin expected output
   identity where one exists. Verify bounds and exact reconstructed pixels.
   Explicit RGBA overwrite is sufficient for eight tree replacements; current
   binary equal masks also make alpha-over equivalent. Do not invent a failure.
4. **Variant correspondence:** retain actual visible-pixel/alpha deltas, masks,
   counterpart corpus and uniqueness limits. Pilot-specific normalization is a
   hypothesis, not a pack-wide rewrite rule. P01 has a one-pixel mask exception;
   P03 normal 38/40/42 change reflection pixels inside the body as well as shadows.
5. **Modular/context limits:** record positive and negative assemblies and their
   hashes. Alpha continuity is evidence, not seam quality or stand-alone identity.
   Preserve palette mixtures, shorter pieces and row-specific background colors.
   Ordered ends do not prove repeatable middles, corners or arbitrary terrain use.
6. **Semantic fields:** identity, family, role, facing, variant and bounds each
   need evidence, confidence/reason, alternatives and a disposition. Coarse nouns
   can be supported while mirror/glazing, appliance type or season stays unknown.
   Keep gameplay geometry separate and unknown; names do not approve physics.
7. **Review identity:** pin exact proposal JSON hash/revision, source hashes and
   explicit member lists. Preserve the reviewer's initial observations and
   briefing limits; independent does not mean blinded. Decisions need per-member
   dispositions/exceptions. Changed proposals require explicit review applicability.
   Agent agreement never creates human approval or runtime promotion.

## Minimal next implementation slice

Build one read-only packet adapter/validator and deterministic summary CLI for
these three saved trials, with separate source-record, proposal, relationship and
review views. Preserve original JSONs; expose mismatches without repacking or
creating a runtime bank. Defer Workshop registration/UI and new art expansion.

Completion: account for all **85 records / 67 proposal units** with explicit
types; validate source pins/bounds/aliases and all nine composed-lineage recipes;
retain all 18 derived records and every recorded variant exception; report review
applicability by proposal hash; distinguish unknown fields and unregistered human
approval. Repeated runs must agree, and missing refs/hash drift must fail visibly.
Use the existing helpers as evidence inputs, not substitutes for semantic review.
Measure examined units, changed/unresolved fields and actual elapsed/owner effort
going forward. Unclocked pilots support no throughput, accuracy or duration estimate.
