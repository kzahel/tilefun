# Tree sheet integration — 2026-10-04

The Trees and forest sheet now shows the three exact varied-offset forest
interior examples accepted in the [owner feedback record](2026-10-04-family-contact-sheets.md#owner-acceptance-varied-offset-forest-compositions).
The adapter clips signed horizontal copies into the same 256px interior frame,
preserves back-to-front source-over drawing, and fills the sampled `#479757`
ground. This is the approved five-row recipe, not a general forest generator.
Outer edges, corners, chunking and gameplay geometry remain unresolved.

Cards 4 and 5 are called tree bases, with compact facts linking them to trees
2 and 3 in the selected palette. Original source images and frozen pilot packets
are unchanged. Cabinet and scrapyard family revisions are unchanged; the tree
family revision is
`b049e3e9dd662ebe3954a4cf5a59d685ba7c9b4de67e700893dce1c3ad85b930`.
The family remains Proposed; only the bounded examples carry their recorded
acceptance. Old revision links cannot submit notes against the changed sheet.

Eight Python adapter tests pass, including a regression distinguishing transparent
replacement strips from source-over forest overlap. All nine family browser tests
pass; an independent canvas recipe produces identical pixels for all three new
examples. Desktop, tablet and phone captures were inspected. Typecheck, the
1,514-unit-test suite, lint, catalog/manifest generation and production build pass.
The broad browser run passed 305 tests before 29 remaining tests lost a shared
test-session file during another session's run; one standalone test also timed
out. All 29 session-file failures pass on rerun (43 tests across the affected files).
The standalone test still fails: the shared checkout reports a stale manifest
while another session edits its inputs. An indexed-source snapshot passes all
nine family tests; its standalone startup check is being retried separately.

Next: finish the semantic model's independent review, reconcile the next seating
packet and present its exact sources in another quiet family sheet.
