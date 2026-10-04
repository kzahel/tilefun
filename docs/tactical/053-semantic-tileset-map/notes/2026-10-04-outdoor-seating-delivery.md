# Outdoor seating delivery — 2026-10-04

The fourth [family sheet](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/families?family=outdoor-seating)
presents all 27 E01 exports as 15 cards: seven benches, four chair views/frame
styles with four panel colors each, and four picnic-table compositions. It uses
the existing compact facts, selected-piece discussion and whole-sheet comments.
No research dashboard or approval workflow is added.

The [proposal](../packets/E01-outdoor-seating.json) and
[independent review](../packets/E01-outdoor-seating-review.md) are hash-pinned by
the presentation adapter. The review supports the 27 bounded visual proposals,
including exact chair mirrors, refuted bench mirrors and the brown bench's
Generic Buildings occurrence despite its City Props filename. Collision,
anchors, compass headings, folding mechanics and sitting positions remain unknown.

Bench 5/6 have no exact whole-frame master/theme-sheet occurrence. The adapter
uses two byte-identical original PNG copies in `public/assets/semantic-sources/`,
registered in the art catalog with attribution in `public/assets/SOURCES.md`.
Their original paths and SHA-256s remain in E01. Existing source atlases are
unchanged. All 25 other exports render from verified complete-master crops.
The adapter checks every displayed variant against its normalized source pixels,
including the original-only benches, and preserves the full exported frames.

The new family revision is
`02e667bf94babe9f5b1f9057536a7ccbeae82087484f80af67af51deb2da30bf`.
The existing three family revisions are unchanged. Adding sources changes the
catalog revision and discovery fingerprints; existing notes still retain their
exact original family/catalog/source identities. New sources and this family
are Proposed, with no human approval or gameplay promotion inherited.

Nine Python adapter tests pass, including committed-only reproduction, original
PNG drift rejection and the side-chair palette correspondence. Desktop/tablet/
phone layouts are inspected. The browser regression exercises the original-only
bench note's exact source and chair-color switching alongside the existing
revision/source drift and forest pixel checks. Final repository checks are
complete: typecheck, all 1,514 unit tests, lint (existing warnings only),
production build, catalog/manifest checks and all 340 browser tests pass.
The full browser run includes all ten family-sheet regressions.

A separate GPT-6.1 Sol/high worker audited the presentation without importing the
adapter: all 27 displayed variants re-render to their original full-frame pixels,
all 16 chair/color assignments are correct, both bench copies are byte-identical,
and family/catalog revisions and proposal/review pins recompute exactly. The
worker made no UI or source edits and found no blocking presentation discrepancy.

Next: finish explicit model/ledger normalization for E01. I01 sofa components
are now independently reviewed and registered; normalize their component rules
and unresolved long-seat roles before another owner-facing family sheet.
