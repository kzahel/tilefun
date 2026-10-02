# Outdoor asset catalog and scene review

Status: implementation in progress. Extends Workshop, its authenticated event
API and shared art inbox. Approved art and saved world revisions stay frozen.

## Accepted scope

1. Audit the Modern Exteriors complete sheet using committed PNG/index inputs.
   Account for every occupied 16px cell, distinguish indexed cells and gaps,
   group exact rectangle aliases, and report the old unmatched-single count
   without equating it with missing atlas objects.
2. Browse asset families with readable labels, categories, tags, settings and
   exact source rectangles. Preserve original keys. Automatic interpretation is
   explicitly inferred. Review/correct metadata through shared durable events.
3. Keep image bounds, anchor, footprint, collision and depth separate. Unknown
   geometry stays unknown. Review proposals in a playable isolated test scene
   using production props, collision resolution and rendering. Candidate geometry
   must not silently mutate old atlas props or pinned generations.
4. Select a world region in a full neighborhood review, browse suitable art and
   attach asset references to a shared location note. Notes record generation,
   seed, world coordinates, scene identity and source/metadata revisions.
   Crop views become navigation shortcuts, not extra default approval work.

## Delivery slices

- Shared schema, candidate definitions and deterministic coverage/catalog build.
- Authenticated metadata/scene events, immutable targets, CLI/inbox integration.
- Native Workshop catalog, coverage inspection, metadata editor and movement test.
- Full-neighborhood annotations, asset picker, linked notes and crop shortcuts.
- End-to-end persistence/auth/offline/phone tests, full regression validation,
  public deployment verification, commits and push.

## Data ownership

Source index and generated coverage/catalog are checked in. Shared candidate
geometry is checked in and reusable by the runtime factory under new explicit
asset identities. Human corrections/approvals stay in ignored append-only art
logs, with exact metadata payloads; proposals are visible immediately but need
explicit promotion to committed definitions before generation uses them.
No synthetic approvals or automatically guessed colliders are allowed.

Completeness means every visible source cell is accounted for as indexed or an
explicit gap. It does not claim every modular piece is a usable standalone prop.
Detailed geometry starts with seating, shade, planting and market families;
remaining atlas geometry can be reviewed incrementally.

## Human checkpoint and later work

Review catalog semantics and geometry, then annotate the square with preferred
assets. Existing grass-overlap and sparse-square requests remain pending until
scene changes are delivered. Next: promote accepted metadata, compose structured
plaza seating/shade and a market using the shared placement reservations.
