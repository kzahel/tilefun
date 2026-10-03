# Railway Workshop preview batch

Status: delivered for human review, 2026-10-03; no approvals recorded.
Parent: [023 Generated railways](023-generated-railways.md).
Owner: [Trains](../topics/trains.md).

The user requested isolated previews, a commit and live review links before any
overworld railway work. This slice supplies review fixtures only, not generated
railways, train collision, passenger boarding or an approved gameplay asset bank.

## Review scope

32 exact candidates in four batches:

- Track patterns: grey/brown straight repeats and directional pairs, four corner
  joins, and original diagonal junction pieces.
- Trains: five source families travelling east, west, north and south. All pieces
  retain native pixels; no rotating or mirroring. The orange family has no audited
  vertical middle piece, so both axes use two end cars. Other proposals join three
  source sections, not a claim of three complete independent locomotives.
- Plans: through station, terminal/crossover, local/express hub, regional network,
  long-car bend and shallow crossover motion. Native source art is distinguished
  from schematic routes, town blocks, structures and access paths.
- Structures: bridge layout/clearance proposal and native double tunnel portal
  with moving trains and cutaway. Bridge deck/piers, access and mountain/floor
  shapes are placeholders; their collision and complete source kits remain gaps.

Bend/crossover motion intentionally exposes cardinal-pose popping, coupler gaps
and sideways movement. This evidence is for a design decision, not a claimed
working railway. No train/station candidate is promoted or placed in the overworld.

## Implementation contracts

- `src/railway/RailwayPreview.ts` contains deterministic isolated scene recipes
  and motion sampling; it is not imported by the game/server world generator.
- `RailwaySource.json` pins a 53-sprite atlas plus original vendor filenames,
  per-file SHA-256 and visible bounds. `pack-railway-review.py` explicitly extracts
  from the purchased local pack; builds use committed pixels, never repack them.
- `RailwayCandidates.ts` hashes source, recipe, renderer/motion source and ten
  deterministic animation samples. Static layouts use one sample. Platform text
  remains outside hashed canvases; CPU review contexts match full Chromium.
- The shared Workshop review page supplies exact verification, user notes,
  approve/report, draft/outbox persistence, changed-state detection and per-batch
  two-report pause. Railway playback adds pause, restart, slow speed, time scrub,
  four-direction links, geometry and tunnel cutaway. View controls do not modify
  the canonical reviewed recipe or scene identity.
- Candidate compatibility records use `pattern:rail-v1-*` keys with a distinct
  `railway` kind and four independent batches. The source inspector and art
  catalog expose the new atlas and every packed source use.
- Manifest generation verifies railway identities in both headless-shell and
  full Chromium at retina scale, before publishing; unrelated candidate identities
  must remain unchanged. No real owner feedback is written during validation.

## Validation and delivery record

- Typecheck, production build and lint passed (existing warnings remain).
- Clean railway commit snapshot: 138 unit files / 1,344 tests passed. A separate
  combined-workspace run hit five unrelated timeouts under concurrent browser
  load; both affected files passed with bounded workers on retry (20 tests).
- Full isolated browser run: 284 passed, one skipped, one railway batch-pause
  failure. Fixed shared legacy queue keys and constrained reports to their own
  batch; the affected railway/Workshop/index suite then passed (14 tests).
- Final visual inspection caught duplicate sibling React keys during candidate
  navigation. Unique playback keys fix retained controls; the railway suite now
  checks a single playback/canvas and console errors on every candidate. All four
  final railway tests pass, including phone playback, saved/stale decisions and
  independent batch pauses. The shared Workshop tests also pass after this fix.
- Manifest generation verified 222 identities in normal Chromium at retina scale,
  including all 32 railway cases. All 517 pre-existing candidate identities remain
  unchanged. Catalog and manifest contain committed source pixels only.
- Read-only live verification confirmed review controls enabled and all railway
  candidates unchecked. Desktop horizontal, vertical, corner and station scenes
  were inspected. Browser tests used isolated feedback/auth data; no real owner
  reviews were submitted.

Validation uses snapshot copies and bundled Chromium because another task is
editing persistence/streaming in the same checkout. The commit contains only
railway work, with generated inventories calculated against its committed inputs.
The live checkout inventory may also reflect the other task's pending inputs.

## Next step

Present [Railway previews](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/railways)
for human review. Follow the two-report pause rule. Resolve requested source,
composition, layout or motion changes only after the user says “ready” for that
batch. Overworld implementation remains behind the explicit human review gate.
