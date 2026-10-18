# Lived-in interiors

Owner: [Patterns and interiors](../topics/patterns-and-interiors.md).
Status: implemented and validated, 2026-10-18.

The owner authorized the recommended first slice: a furnished home with an indoor
cat, a working restaurant, a recognizable shop, entrance presentation improvements,
and a persistent NPC entering, doing an activity and leaving. Commit after validation.

New versioned recipes apply on first visit; existing saved interiors and exact
review compositions retain their identities. Reuse source pixels, register new
review cases, and distinguish provisional gameplay shapes from human approval.
Shared Realm simulation, collision, animation and presentation own all behavior;
do not implement a separate lab simulation. Activity uses clear interaction spots,
bounded navigation and durable state. Door transfers must preserve one NPC identity
and atomically move its saved record between the parent world's realm namespaces.

Validation: furniture/exit accessibility, occupied/blocked activity handling,
resident persistence, transfer failure/restart, real gameplay traversal and both
renderers; then typechecks, unit suite, lint, build/browser suite and streaming readiness.

Broader building-family expansion and refreshing previously visited rooms remain
follow-up work; this slice does not overwrite player edits.

## Implementation

- Added `home-v3`, `restaurant-v3`, `market-v3`, twelve whole furniture sprites,
  three purpose palettes and short, grounded street thresholds. Existing saved
  identities and player edits retain their old recipes.
- Added four source-extracted indoor role sheets with provenance/hashes and the
  existing provisional cat. Reader/cleaner/cook/diner activity clips and normal
  directional walking run through the ordinary replicated entity pipeline.
- Added bounded navigation, station reservations scoped to each home, occupied
  footprint checks, displaced-actor recovery and durable activity clocks.
- Visitors walk out and return through one atomic shared-world writer transaction.
  Acknowledgement precedes live ownership changes; failed transfers restore both
  pending ownership intents, and blocked arrivals retry at the source.
- Limited background work to four nearby visited rooms and visible/home-active
  visitors, with streaming leases during handoffs. No city-wide offline simulation.
- Registered three new rooms-17 review candidates. Old review candidates keep
  their compositions; source art and approved promotion banks are unchanged.

## Verification

Unit coverage checks every station/door route, source tile presence, edit
occupancy, blocked movement, activity persistence, atomic round-trip identity,
occupied arrivals and rejected-write recovery by an unrelated storage producer.
The shared server test observes a full restaurant visitor exit/return while the
player stays indoors, asserting exactly one live owner throughout.

Browser coverage opens all three new purposes in full Chromium on Canvas/GPU,
checks activity animation and actual movement, and captures each room. Existing
multi-door traversal/reload and registered-review tests remain part of the full
suite. Validation results are recorded below.

- Typechecks and lint pass (existing repository warnings remain).
- Full unit suite: 273 files, 2,680 tests pass. After final seat placement,
  the affected layout/transfer/shared-server set passes all 53 tests.
- Focused full-Chromium gameplay/review set: all seven tests pass, including
  home/restaurant/market motion on both Canvas and GPU.
- Production build and generated asset freshness checks pass. Manifest generation
  verifies all 819 identities in normal Chromium at retina scale; existing
  interior review fingerprints remain unchanged.
- Streaming readiness passes six samples with no errors/failures; evidence:
  [streaming report](/tmp/tilefun-lived-in-streaming/report.json) (local, not committed).
- Full-room gameplay captures (temporary diagnostic camera framing only):
  [home capture](/tmp/tilefun-lived-in-full-condo-bay.png),
  [restaurant capture](/tmp/tilefun-lived-in-full-bakery.png),
  [market capture](/tmp/tilefun-lived-in-full-butcher.png).

The broad browser run exposed five stale fixture assertions: sparse furniture
counts/IDs in entry/reload, shared remote rooms and room editing, plus the four-layout canvas-creation
budget after adding three layouts. Updated those expectations to the v3 recipes,
kept the review resource budget bounded per building case, and retained the
small-sprite byte limit. All five affected gameplay/review checks pass, including
furniture edit/delete persistence and extending, walking through and restoring a
room with residents present.

Final browser evidence: the full 647-test run passed 642 checks and exposed only
those five stale expectations. The normal Playwright `--last-failed` run then
passed all five (22.6s), including two-client filesystem save/restart, furniture
edits and room extension/reload. No production behavior changes were needed for
those failures. Typechecks, lint, unit suite, production build, raster identity
verification and streaming readiness also pass. All 245 pre-existing interior
review fingerprints remain unchanged.

Next: expand purpose-specific shops and household/play routines, then design an
explicit opt-in refresh for already visited interiors that preserves player edits.

## Entrance wall follow-up (2026-10-18)

The owner reported a remaining wall beside the entry door. Shortening the floor
had left the original one-tile jamb cap inside a two-tile threshold, creating an
isolated wall strip and an L-shaped floor opening. The shared apartment compiler
now supports full-width exterior cutaways; production room compilation uses them
for compact legacy rooms, saved v2 layouts, v3 layouts and player-edited rooms.
Internal doorway jambs stay intact. No saved recipe, connection, furniture or
anchor migration is needed. Static historical wall/v2 review compositions retain
their exact trim, and the three current lived-in review candidates renew normally.

Regression coverage checks both halves of every entrance for stray geometry and
usable ground, preserves adjacent wall collision and checks internal divider
jambs across original and edited plans. Fresh ordinary-gameplay Canvas/GPU
captures cover the home, restaurant and two-door market.

Follow-up validation passes: all three typechecks; 279 unit files / 2,773 tests;
lint with the existing 119 warnings and 34 infos; production build; and all 670
browser tests (29.5 minutes). Browser checks include both renderers, real multi-door
traversal/fades, room edits/reload, two-client persistence and all 234 approved
interior visual references. Catalog generation is current. Manifest generation
verified all 848 candidates in normal Chromium at retina scale; only the three
lived-in room fingerprints changed, preserving all 245 older interior identities.
[Door close-up before (left) and after (right)](/tmp/tilefun-door-before-after.png)
is temporary local evidence.
