# Semantic tileset map

Topic: semantic-tileset-map
Status: three pilot contact sheets implemented and validated; owner discussion is next.
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
remain visible. No source art or runtime definitions have changed for this effort.

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
now cover cabinets, trees and scrapyard pieces: 52 cards expose all 85 source
records through variant selectors. All three are marked Proposed. Notes reuse
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
labels. Apply it alongside the frozen proposal JSONs. No new human approvals exist.

The contact-sheet adapter uses committed source images only and checks source
pins, available pixel hashes, exact frame bounds, all 85 record references and
cabinet component restrictions. Run `python3 scripts/build-family-sheets.py --check`
with Pillow to verify the saved output; ordinary browsing/builds use committed
JSON and images without original packs. Source images and metadata revisions are
also verified before browser notes can be submitted. Three discovery candidates
in one existing-inbox batch route directly to these sheets; notes remain discussion.

The first owner comments gave positive whole-sheet feedback on cabinets and
scrapyard, questioned the tree-base naming/color, and proposed repeating forest
centers. The [follow-up evidence](../tactical/053-semantic-tileset-map/notes/2026-10-04-family-contact-sheets.md#first-owner-comments-and-tree-follow-up)
confirms card 4 exactly matches tree 2’s base and card 5 matches tree 3’s base.
Horizontal center repetition is visually supported; dense vertical fill requires
a separate overlap/placement proposal. Display refinements are queued; formal
catalog status remains Proposed.

Next: present the tree-base relationships and repeated forest strips, then extend V01 beyond the presentation
adapter to the full source/relationship/review schema before expanding themes. Its
[criteria](../tactical/053-semantic-tileset-map/notes/2026-10-04-pilot-method-review.md#minimal-next-implementation-slice)
cover exact source references, all occurrences, compositions, derived variants and
review applicability. The user authorized reasonable checkpoint commits.
