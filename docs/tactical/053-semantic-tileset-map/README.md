# Modern Exteriors and Interiors semantic mapping plan

Status: fourteen family sheets delivered (583 cards / 1,257 displayed records); 255 records / 216 proposal units normalized; 1,002 broad first-pass records await semantic normalization.
Created: 2026-10-04.

Build an exhaustive semantic map of the Modern Exteriors and Modern Interiors
tilesets. Agents inspect the art, propose interpretations, explore alternatives
and test them before the owner gives final approval or rejection. Begin with
the broad organization of the master sheets, then investigate coherent themes
and families. The owner should not have to identify every object for the agents.

## Workspace and ownership

- [Queue](queue.md): assignments, dependencies, state and the next concrete action.
- [Packet template](packet-template.md): source evidence, hypotheses and review
  contract for a bounded investigation. Put completed packets in `packets/`.
- [Notes](notes/README.md): dated observations, experiments and execution records.
- [Pilot reconciliation](notes/2026-10-04-pilot-reconciliation.md): current
  corrections and qualifications to apply when using the frozen trial snapshots.
- [Topic](../../topics/semantic-tileset-map.md): current status and lasting decisions.
- [Art review](../../topics/art-review.md): authoritative human-review rules.

This folder is the durable coordination record. A conversation or agent's memory
is not the only copy of progress. Keep concise findings and reproducible evidence,
not raw agent transcripts. Link to shared human review records; do not copy private
inboxes, credentials or session state into this folder.

## Scope

Start with the native 16px Exteriors and Interiors masters, Interiors Room Builder,
and an inventory of associated theme sheets, singles, variants and animations.
The source manifest must declare the exact pack revision and included sources;
do not equate the game's currently packed assets with the entire tilesets.
Other resolutions, old pack versions, characters and UI are outside the initial
mapping scope unless needed as evidence or explicitly added. Record exclusions.

The first semantic layer describes identity, exact visual bounds, category,
family, facing, variants, component roles and assembly relationships. Gameplay
footprints, collision and walkable surfaces are a separate proposed layer, not
a prerequisite for identifying all art. Geometry remains unknown without evidence;
approval of a name does not approve physics. The initial scope prioritizes
semantics and assembly; full gameplay-geometry coverage is not yet agreed.

## Phase 1: source reconciliation and thematic reconnaissance

1. Record source paths, dimensions, SHA-256 hashes, coordinate conventions and
   provenance. Distinguish original-sheet coordinates from packed-atlas coordinates.
   Preserve existing atlas coordinates and approved snapshots.
2. Reconcile master-sheet appearances with named singles and packed entries.
   Preserve all exact occurrences and aliases; distinguish missing art from
   duplicate appearances, variants and failed matches.
3. Inspect each whole sheet through overlapping overview and detailed crops.
   Propose broad theme regions before individual-object assignments. Show source
   coordinates and uncertainty at region boundaries.
4. Build a navigable table of contents: region → families → assets/components.
   Allow overlapping themes and families spanning multiple regions. Spatial
   proximity is evidence for membership, not proof.

The owner's examples are starting hypotheses: seasonal tree groups down the
right side of the Exteriors sheet, and a dumpyard/scrapyard area. Verify their
bounds, identities and ordering from the pixels rather than treating those
descriptions as completed labels. Possible broad categories include vegetation,
buildings, streets/transport, waste/industrial, furniture and interior architecture.

## Phase 2: contrasting trials

Run these three theme investigations before expanding across the entire sheets:

| Trial | Questions to resolve |
| --- | --- |
| Seasonal trees | Which groups share a species/form, size or seasonal variant? Does the apparent repeated arrangement hold for every member? |
| Suspected dumpyard area | What constitutes one object, a pile, a component or a composition? Which boundaries and labels remain ambiguous? |
| Interior furniture theme | How do master-sheet objects match packed entries, facing and shadow variants, and example-room usage? |

Include an indexed modular family or a small architecture probe within the trials
if the selected themes do not exercise assembly relationships. The trial must
cover both indexed art and unexplained regions, plus original-to-packed matching.

Measure examined regions/assets, correction rate, unresolved fields, elapsed work
and owner review effort when available. Inspect systematic errors, revise the
packet format and estimate the full run from measured throughput. Do not invent
a completion date or infer accuracy from agent confidence alone. Routine internal
trial evaluation does not require an extra owner approval gate before continuing.

## Current execution policy: broad first passes

The owner's 2026-10-04 correction favors much larger sheets with plausible,
explicitly uncertain hypotheses over small batches optimized toward certainty.
Use the [compact packet contract](broad-packet-format.md), reusable presentation
adapter and targeted review. The earlier detailed trials remain evidence and
examples, not a mandatory amount of research per future record. Exact pixels,
source identity, component restrictions and human approval boundaries still apply.

## Phase 3: bounded agent investigation

Use GPT-6 Astra at high reasoning (`gpt-6-astra`, `high`) for the coordinating
session. Every other agent session, including mappers, independent reviewers and
follow-up investigators, uses GPT-6.1 Sol at high reasoning (`gpt-6.1-sol`, `high`).
Allow up to four workers active at once, subject to the session's available agent
slots (which may include the coordinator). This is a ceiling, not a target: use
fewer workers when dependencies or integration work would leave them idle. A useful
four-worker mix is two mapping separate themes and two independently reviewing
completed packets. Set worker model and reasoning
explicitly rather than inheriting the coordinator's model. Use fresh bounded
assignments rather than accumulating the whole atlas inside a worker's context.

The coordinator owns the manifest, thematic index, shared vocabulary, queue and
integration. Workers write only their assigned packet/notes artifacts; only the
coordinator updates shared catalogs and generated inventories. Give every worker
exclusive output paths; reviewers write separate review artifacts rather than
editing an active mapper's packet. Shared source images are read-only. Queue
cross-theme questions for the coordinator and exchange bounded handoffs instead
of requiring all agents to coordinate with one another. Serialize shared builds
and mutations. Do not create branches or worktrees by default.

Each packet follows this process:

1. **Observe:** inspect actual source pixels at useful scales, their surrounding
   context, related variants, names, existing annotations and example compositions.
2. **Propose:** identify regions, objects and component relationships. Record
   evidence and confidence separately for each material semantic field.
3. **Review independently:** the reviewer first records a fresh interpretation of
   the source, then compares it with the mapper's claims. Existing names are
   evidence, not authority; human decisions keep their exact original scope.
4. **Challenge:** identify plausible competing interpretations and a discriminating
   check. Do not invent alternatives merely to fill a form when the evidence is clear.
5. **Test and reconcile:** compare variants, inspect alternate boundaries, or render
   assemblies. For example, distinguish roof edge from wall trim by testing matching
   widths, seams, shading, caps and neighboring pieces. Record failures as well as
   successful compositions. Agreement between agents is not independent proof.

Default to at most two challenge/revision rounds per disputed item, then retain the
best-supported candidate and explicit unresolved alternatives. The coordinator
can schedule a focused follow-up when new evidence is available. Never fill an
unknown with a confident guess just to close the queue.

## Phase 4: expansion and global audit

Expand across the thematic queue using the improved trial process. Exact duplicate
matches can share evidence while retaining every source occurrence. Near-matches,
recolors and directional/seasonal variants need verification before inheriting
semantics. Recheck family boundaries and apparent regular patterns for exceptions.

After theme work, inspect overlaps, crop boundaries, unexplained leftovers and
related families elsewhere. Every visible region needs a disposition; a giant
bounding box or one vague unknown region cannot stand in for an object-level audit.
Explicitly reconcile supplemental singles, theme sheets and animations that are
not represented in the masters or current packed atlas. A complete master survey
cannot close the broader source inventory on its own.

Report separate denominators for source occupancy/occurrences, segmented candidate
regions, semantic field completion, independent review and human approval. Existing
index coverage is only a baseline, not a semantic completion metric. Distinguish
fully examined from fully understood, and review-ready from approved.

## Phase 5: owner review

Owner clarification, 2026-10-04: keep the lab a quiet visualization of durable
catalog knowledge. Research packets, agent deliberation, experiment logs, confidence
scores and queue states stay in this plan folder. The owner-facing format is a
large themed contact sheet with compact, ordinary-language metadata, suitable for
pointing at pieces and discussing them. This supersedes the earlier dashboard-like
proposal. The first three proposed sheets are implemented; integration evidence is
recorded in the [delivery note](notes/2026-10-04-family-contact-sheets.md).

Use one reusable contact-sheet view for catalog browsing and lightweight proposal
review. The normal catalog shows accepted values and explicit unknowns. A review
link opens a pinned proposed revision with a small “Proposed” indicator; discussing
or viewing it does not replace the durable catalog. Reuse existing review storage
and controls rather than introducing another top-level research dashboard.

- Let the art occupy most of the page, at consistent integer pixel zoom, grouped
  by recognizable theme/family. Give pieces short names or stable small numbers
  the owner can refer to in conversation; no packet IDs, hashes or acronyms in
  ordinary labels.
- Show whole objects and pieces for combining in distinct groups on the same
  sheet. For cabinets, label groups “Complete cabinets” and “Pieces to combine”.
  A small assembled example can explain how parts connect.
- Keep shared facts beside the family, with member exceptions on selection:
  what it is, whether it can be used alone, how it joins, and available variants.
  Write “Needs a piece on each side”, not internal schema/connector terminology.
- Default to one representative shadow/color variant; offer a small variant
  switch or comparison control instead of repeating every member three times.
- A selected piece or group gets a compact note/correction affordance using the
  existing review infrastructure. Show a short specific question only when it
  matters, such as “Mirror or glass?”; do not expose the whole research backlog.

The first presentation slice covers cabinets, trees and scrapyard groups in the
same format. It uses validated metadata and exact pixels;
the owner does not need to read or operate the validator. Keep provenance and
full research available to agents without making them the main browsing surface.

Current delivery exposes proposed metadata and shared discussion. Accepted-catalog
promotion and family-level approval controls remain future work; notes never
silently change the catalog or game placement rules.

Support family-level review of an explicit member list with individual exceptions.
Repeated views should not create duplicate approval work. Register candidates and
pin source hashes, member identities and semantic proposal revisions. Preserve the
existing exact-source approval contract and separate semantic decisions from
gameplay geometry and runtime promotion. Agent review never creates human approval.
Follow the existing two-Needs-changes pause rule for applicable review batches.

## Completion and validation

The autonomous investigation is complete when every in-scope source region has
been examined, every proposed family/object has an independent review disposition,
global gap/overlap checks are complete, and uncertainties are explicitly presented
for owner review. Full semantic completion must separately report any unresolved
identities or relationships. Human approval coverage is a separate final result.

Use deterministic checks for source hashes, bounds, alias identity, references,
coverage accounting and review revisions. Use rendered evidence for visual and
assembly claims. Prefer repository capture/harness tools and bundled Playwright
Chromium over manual browser operation. Follow repository typecheck, unit-test and
lint requirements; implementation involving rendering/integration also needs the
build/browser checks and relevant art inventory/manifest regeneration. Do not
regenerate promoted banks or repack the source atlases as routine mapping work.

## Resuming coordination

Read the topic, this plan, the queue and the latest relevant notes. Read the current
Workshop/art inbox before acting on human feedback. Verify sources before reusing
evidence, reconcile stale assignments with saved artifacts, and pick the first
unblocked queue item. Update the queue and link findings before ending a work session.

## Investigation tools

- `python3 scripts/semantic-map-model.py --check` validates the normalized eleven-packet
  model, exact source lineage and review applicability; `--committed-only` permits
  missing ignored originals but reports that limitation. See the
  [model note](notes/2026-10-04-semantic-model.md) and
  [independent review](notes/2026-10-04-semantic-model-review.md).
- `python3 scripts/semantic-map-coverage.py --check` reproduces the complete
  assignment ledger from committed evidence. The separate mapping registry is
  its extensible input; registration alone earns no semantic completion credit.


These are offline evidence tools; they do not repack assets or change gameplay.
Use Python 3 with Pillow for image inspection and full inventory validation.

- `python3 scripts/build-family-sheets.py --check` verifies the fourteen contact
  sheets against pinned proposals and committed atlases, including all 1,257 source
  records and the cabinet component restrictions. Omit `--check` to regenerate
  the JSON. `python3 scripts/build-family-sheets.test.py` exercises source drift,
  frame replacement, record coverage and component/unknown placement distinctions.
  `python3 scripts/build-family-expansion.test.py` additionally exercises the
  Room Builder, playground and animation adapters; `python3 scripts/build-family-next.test.py`
  covers plants, beds and fences. `python3 scripts/build-family-broad.test.py` checks
  the reusable broad-packet source/topology contract. `python3 scripts/semantic-map-next-families.test.py`
  checks their normalized semantics and absent-original reporting. These commands do not require
  ignored original packs. Normal app builds consume
  the committed output; they do not regenerate it or require Pillow.

- `python3 scripts/semantic-map-inventory.py --check` verifies the saved manifest
  against original packs, committed atlas/index inputs and indexed source pixels.
  `--check --committed-only` verifies the saved ledger and committed references
  on a fresh clone, explicitly without checking absent original-pack pixels.
- `python3 scripts/semantic-map-match.py --master SOURCE.png --candidate SINGLE.png
  --output /tmp/semantic-matches.json` finds every exact grid-aligned occurrence.
  Repeat `--candidate` or provide a directory to compare a family. The default
  16px grid starts at the source origin; `--grid 1` checks arbitrary pixel origins
  using a streamed row search rather than a per-pixel index. Hidden RGB under zero alpha is
  ignored; all visible pixels and alpha must match. Unmatched means no match under
  that search, not proof of missing art. Empty sprites are reported separately.
- `python3 scripts/semantic-map-match.test.py` checks duplicate occurrences, full
  rectangle verification, alpha handling, partial-tile sizes, off-grid padded sprites
  and rejection of row matches that wrap across a source edge.

Source-specific survey helpers and their capture commands are linked from the
investigation packets. Generated proposals retain deterministic formatting.
The large source-file ledger is checked by the inventory script rather than
Biome; formatting of the smaller generated JSON is excluded alongside other
generated inventories.
