# I01 sofa sheet — independent integration review

2026-10-04. Reviewer: sofa model worker, separate from the sheet/UI author.
This reviews exact source presentation and variant/note routing. It is agent
review, not human approval or runtime placement promotion. The coordinator brief
and frozen sofa proposal/review were known; this was not blinded discovery.

## Reviewed snapshot

| Artifact | Raw SHA-256 |
| --- | --- |
| scripts/build-family-sheets.py | `2bee0d5e5dbe604804cbd33acd59a10c4a95a7322be03145d7914fd5d601f048` |
| scripts/build-family-sheets.test.py | `7300ee11a471cc310b271b32c98c5d59d1a8e6e6b9a4e8824e7052e2d1b6cf1c` |
| src/workshop/FamilySheetsPage.tsx | `6afa3c980213038c0a62e0109a0d52d5c641799a6d70d44d751f63a7eeadcb6a` |
| src/workshop/FamilySheetNotes.ts | `d846e33eff0a4c7df90b4579cf6e880dd6541ce491677e5ebd5bb0a4757ccc07` |
| src/workshop/FamilySheetNote.tsx | `ac108fc16a288696cedae1c9c13b082158a94a89411831eafd630a7c71b69f3c` |
| src/workshop/FamilySheetTypes.ts | `ab06a2aebd6232fd53e9a0644989b3e17255b478903e6c193165e5fe12b6d40d` |
| public/data/family-sheets.json | `d13b49bcf9fc0095a0bab3f57392002514717588964e4c8691dca0795438eb99` |

Sofa family revision: `e0c30f0530f49fe6a1ec823b68d806f274a14f0a25c3f2ee620dc3694bc13ea0`. Catalog revision: `a33f904cbeb7b6720c29810c2153b839a9e5dac118cd0c8e493194a84793a5f7`.
The I01 proposal/review remain frozen at
`75b0910c5565e9bff3db9b819f76fe2cca0e5e268b6438a2ff7023a061a260df` /
`1b93f7b2b438eb4f74f3e01f898b746bd5f0f7a5a36eb48e4b23f7651cc256fb`.
Changes to these reviewed adapter/UI/catalog bytes require a scoped recheck.

## Disposition and evidence

Supported for the bounded presentation contract; no blocking inconsistency found.
A separate raw-Pillow compositor imports neither the family adapter nor semantic
model helpers. It reads the saved catalog's committed source layers, pastes them
unresized with RGBA overwrite, normalizes only hidden RGB under zero alpha, and
compares outputs directly with the frozen I01 proposal. It verified:

- 18 cards expose exactly 20 source records, once each through variants;
- all 20 displayed member hashes equal their original pinned export hashes;
- all nine examples have the precise recorded member order, layer offsets and
  normalized output hashes, including 32px-tall side tops with 16px later pieces;
- only the nine positive probes appear as examples; the pixel-exact but incomplete
  top/end/middle source sampler is excluded;
- four long-seat cards remain `unknown`, two closed-seat cards remain visual
  proposals, and all front/side pieces retain cannot-stand-alone wording;
- only front cap card 1 has normal/dark/shadowless choices; every other card and
  all nine examples stay normal.

I visually inspected the independent integer-zoom diagnostic composition
[member and assembly replay](/tmp/tilefun-sofa-sheet-independent.png). It preserves
closed outer caps, feet, side-rail direction and the visible texture/shading bands.
This image is temporary diagnostic evidence, not a new source asset or a browser
layout approval. The independent compositor was an ephemeral review tool; the
committed adapter tests supply reproducible ongoing exact-source checks.

Static UI tracing confirms a member-supported URL variant drives only the selected
piece. The global family variant resolves to normal for sofas, so example art and
whole-sheet notes stay normal when cap 1 is dark/shadowless. A selected-piece note
receives the exact selected variant and source layers; the existing event keys pin
family/catalog revisions, member, variant, raw source fingerprint, source rectangle
and layer offsets. Saved-note deep links reconstruct that member/variant selection.
Piece appearance choices disappear for members lacking extra variants, and stale
revision links disable note submission until the current proposal is opened.

No shared npm, build or browser tests were run by this reviewer. Browser behavior,
mobile layout and note submission need the coordinator's isolated validation.
This review establishes bounded adapter/source correctness and static route
consistency; it does not independently execute DOM interactions, change original
pixels, approve semantic/gameplay metadata, or prove complete pack coverage.

Next: retain the coordinator's isolated browser evidence with this exact snapshot
and present the proposed sofa sheet for owner discussion.
