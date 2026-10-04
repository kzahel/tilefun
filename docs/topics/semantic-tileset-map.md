# Semantic tileset map

Topic: semantic-tileset-map
Status: five family sheets delivered; 132 source records normalized; Room Builder, playground and animation expansion underway.
Updated: 2026-10-04.

Owns the continuing effort to identify and relate all in-scope Modern Exteriors
and Modern Interiors art, with autonomous investigation and final human judgment.
[Art review](art-review.md) owns approval and promotion rules; this effort extends
the existing catalogs and Workshop rather than replacing those contracts.

## Current direction

Start with source reconciliation and a broad thematic map of the master sheets.
Investigate seasonal trees, a suspected dumpyard area and an Interiors furniture
theme as contrasting trials before expanding. Categories guide investigation;
their boundaries and repeated patterns remain hypotheses to verify.

Use one GPT-6 Astra/high coordinator with up to four GPT-6.1 Sol/high workers,
subject to available session slots and independent work. Each worker owns separate
output paths; shared integration remains serial.
All non-coordinator agent sessions use GPT-6.1 Sol/high. Keep assignments,
evidence and handoffs in the dedicated plan folder so work can resume across
sessions. Only the coordinator integrates shared catalogs and inventories.

Track source occurrences, unique assets/families, semantic completeness and human
approval separately. Naming an object does not establish its gameplay geometry.
Agents record alternatives and reproducible refutation evidence; unresolved fields
remain visible. Original pixels and runtime definitions remain unchanged. Exact original exports
may be copied into committed review sources when no master crop exists.

Assembly topology is required metadata. The owner clarified that cabinet pieces
41–44 are non-standalone partials in all three shadow variants. Their
[topology supplement](../tactical/053-semantic-tileset-map/packets/P03-cabinets-topology.json)
records explicit member IDs, forbidden standalone placement, required left/right
connections, compatible members and complete-chain rules. This supplements the
frozen reviewed proposal; runtime enforcement is pending. V01 must validate these
constraints and preserve the distinction between valid topology, tested rendering
and human approval. Future catalogs/generators must not offer such pieces as whole
props; assembly editors can still expose them as components.

Owner-facing presentation is a large themed contact sheet with compact plain-language
facts and lightweight corrections/discussion. The lab visualizes durable catalog
knowledge; research stays in the plan folder. Reuse one quiet sheet for accepted
catalog browsing and pinned proposals, with proposal state clearly distinguished.
Default to representative variants, separate complete objects from pieces to
combine, and explain join requirements in ordinary language. Do not add a research
dashboard, agent states or technical identifiers to normal browsing. The
[family sheets](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/families?family=cabinets)
now cover cabinets, trees, scrapyard pieces, outdoor seating and sofas: 85 cards expose
132 source records through variant selectors. All five are marked Proposed. Notes reuse
the Workshop outbox/inbox and pin family revision, selected member, variant and
source layers. They do not approve or promote metadata. The current slice has no
approval buttons or generator placement enforcement. Asset families appears in the
sidebar with an active-page highlight. **Comment on whole sheet** remains visible
with a selected piece and saves a family-wide note; piece discussion remains separate.

## Plan and next work

The [source manifest](../tactical/053-semantic-tileset-map/source-manifest.json)
pins 29,449 original PNG files plus two committed references. Existing Exteriors
and Interiors indexed source crops match; this establishes source provenance,
not semantic completeness. The
[inventory note](../tactical/053-semantic-tileset-map/notes/2026-10-04-source-inventory.md)
owns counts, source limitations and reproducible verification. Original Interiors
masters remain ignored local inputs; the Exteriors master matches committed art.

[Tactical 053](../tactical/053-semantic-tileset-map.md) routes the
[dedicated plan folder](../tactical/053-semantic-tileset-map/README.md),
[queue](../tactical/053-semantic-tileset-map/queue.md) and
[notes](../tactical/053-semantic-tileset-map/notes/README.md).
The [packet index](../tactical/053-semantic-tileset-map/packets/README.md) routes
whole-master Exteriors and Interiors/Room Builder surveys. Their proposed windows
account for visible source regions but do not claim completed object semantics.
The three pilots contain 85 source records / 67 proposal units, including variants
and components; these are not unique-object or completion counts. The
[coordinator reconciliation](../tactical/053-semantic-tileset-map/notes/2026-10-04-pilot-reconciliation.md)
owns adopted corrections and qualifications, including refuted Exteriors region
labels. Apply it alongside the frozen proposal JSONs. That reconciliation predates
the owner feedback and bounded visual acceptance recorded below.

The contact-sheet adapter uses committed source images only and checks source
pins, available pixel hashes, exact frame bounds, all 132 displayed record references and
cabinet component restrictions. Run `python3 scripts/build-family-sheets.py --check`
with Pillow to verify the saved output; ordinary browsing/builds use committed
JSON and images without original packs. Source images and metadata revisions are
also verified before browser notes can be submitted. Five discovery candidates
in one existing-inbox batch route directly to these sheets; notes remain discussion.

The first owner comments gave positive whole-sheet feedback on cabinets and
scrapyard, questioned the tree-base naming/color, and proposed repeating forest
centers. The [follow-up evidence](../tactical/053-semantic-tileset-map/notes/2026-10-04-family-contact-sheets.md#first-owner-comments-and-tree-follow-up)
confirms card 4 exactly matches tree 2’s base and card 5 matches tree 3’s base.
Horizontal center repetition is visually supported. The owner approved the three
depicted varied-offset, vertically overlapping forest compositions on 2026-10-04;
[exact acceptance scope](../tactical/053-semantic-tileset-map/notes/2026-10-04-family-contact-sheets.md#owner-acceptance-varied-offset-forest-compositions)
pins the source and recipe. Before that acceptance, an owner correction exposed an
incorrect dark background in the F05 probe; all three centers share the sampled
base ground color `#479757`. Vertically overlapping rows need varied horizontal
phases to avoid obvious columns. The [phase probe](../../scripts/semantic-forest-repeat-probe.mjs)
compares aligned, alternating and varied offsets; boundary rules remain unresolved.
The approved examples and corrected tree-base relationships are now integrated in
the sheet; [delivery and validation](../tactical/053-semantic-tileset-map/notes/2026-10-04-tree-sheet-integration.md)
record the exact revision. The family metadata remains Proposed.

The [normalized semantic model](../tactical/053-semantic-tileset-map/semantic-model.json)
now covers 132 source records / 112 proposal units: 85 pilot records / 67 units,
27 outdoor seating records / units and 20 sofa records / 18 units, with separate source, semantic, relation
and review views. Its [independent audit](../tactical/053-semantic-tileset-map/notes/2026-10-04-semantic-model-review.md)
checks exact pixels, missing-source mode, stale reviews and arbitrary cabinet
chains. Topology validation does not grant visual or gameplay approval.

The [coverage ledger](../tactical/053-semantic-tileset-map/coverage-ledger.json)
accounts for 163 survey windows and all 18 source-inventory groups, distinguishing
survey, investigation, review, feedback and bounded acceptance. Every window still
contains unassigned semantics; no percentage of semantic completion is claimed.
The separate [mapping registry](../tactical/053-semantic-tileset-map/mapping-registry.json)
tracks assignments and exact proposal/review references without automatically
crediting unrecognized packet formats.

The [outdoor seating delivery](../tactical/053-semantic-tileset-map/notes/2026-10-04-outdoor-seating-delivery.md)
adds 15 cards with four-color chair variants. Two benches use byte-identical
original PNG copies and retain original-only master lineage. All five family
sheets support exact piece/variant and whole-sheet discussion.

The [I01 sofa packet](../tactical/053-semantic-tileset-map/packets/I01-interior-sofas.md)
is independently reviewed: 20 records, including 14 forbidden-standalone partials,
two complete-seat proposals and four unresolved lower-seat roles. Its 15 assembly
probes distinguish a pixel-exact source sampler from a complete usable chain.
Its explicit adapter preserves 18 direct master records and two derived render
counterparts. The general chain checker uses the actual 32px side top and 16px
middle/end advances; unknown roles never grant standalone permission. The sofa
sheet exposes 18 cards and nine positive assembly probes. Only the verified left
end offers extra shadow variants, through a piece-specific control. Those variants
do not change the complete examples or whole-sheet discussion context. No source
member or gameplay geometry is human-approved by that review.

The [sofa model audit](../tactical/053-semantic-tileset-map/notes/2026-10-04-sofa-model-review.md)
and [sheet delivery](../tactical/053-semantic-tileset-map/notes/2026-10-04-sofa-delivery.md)
record independent source replay, adversarial checks and application validation.

Next: finish the bounded Room Builder path/arch and playground tube packets, then
reconcile a small animation family. Separate mapper/reviewer paths keep work independent. The [bounded expansion audit](../tactical/053-semantic-tileset-map/notes/2026-10-04-expansion-audit.md)
tracks duplicate/gap/source consistency; it does not exhaustively segment the packs.
The user authorized reasonable checkpoint commits. The broader plan remains active;
these records cover a small part of the entire packs.
