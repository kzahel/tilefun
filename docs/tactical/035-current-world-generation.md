# 035 — One current world generator

Owner: [city generation](../topics/city-generation.md).
Authorization: 2026-10-03, user approved the recommendation to stop maintaining
historical playable generation determinism and requested implementation and commit.
Railway overworld integration was explicitly deferred.

## Delivered policy and implementation

- One regional runtime/creation version: `regional-v12`, composing the existing
  connected dense terrain and traffic. Classic/Island/Flat remain simple presets.
- Retired descriptors are metadata/provenance only. Creation, runtime load and saved
  inspection reject them. Automatic startup/resume skips incompatible saves.
- Shared `WorldCompatibility` decides save-format/generator eligibility. The menu's
  Recreate with same seed action makes a new container via the shared server API;
  original data remains intact. No terrain edits, interiors, actors or saved player
  positions are migrated. Remote recreation requires existing admin authorization.
- Removed historical runtime dispatch, SettledStrategy and old revision hash
  obligations. Commercial/city-place realization is retained as authoring studies,
  with geometry/clearance tests; it is not exposed as a historical playable version.
- Current replay/order independence and geometry tests replace historical world
  hashes. Exact promoted-bank hash tests remain.

## Review preservation

Captured twenty existing seed-2026 city scenes before removing historical runtime
selection: 726 terrain chunks with bounded neighbor halos, deduplicated exact props,
plans, bounds, arrivals and initial actor poses. The committed JSON archive is about
368 KB. It is finite review data and is never regenerated during builds.

The lab consumes these snapshots through the ordinary renderer. Explorer links
retain old descriptors as provenance and admit only the captured area/seed. The
coarse background is current geography. Their gameplay handoff says Create current
world with this seed and omits archived arrival/world ID. Existing prompts remain
part of historical candidate identities; they do not re-enable old gameplay.

All city candidate identities matched the pre-extraction manifest in the shared
checkout. Six character fingerprints change because their controller identity hashes the
entire `Realm.ts` source, including this regional cleanup. Character sprites/settings
are unchanged; the normal review identity rules still apply. No approvals are forged.
A unit test makes the evolving district planner throw and verifies that archived
terrain/props still replay unchanged. No human feedback or approvals were created.

## Validation

Validation uses isolated browser storage/auth and bundled Playwright Chromium.
A fixed temporary copy avoids concurrent source edits invalidating production
manifest freshness while browser tests run. It excludes unrelated renderer changes
already present in the shared checkout.

Completed 2026-10-04:

- `npm run typecheck`: passed (client/server/Worker).
- `npm test`: 159 files, 1,418 tests passed; the final dense-door policy cleanup
  also passed its focused 11-test run.
- `npm run check`: passed; existing warning/info diagnostics remain.
- `npm run art:catalog`, `npm run workshop:manifest`, `npm run build`: passed.
  The isolated commit snapshot and shared checkout both build. All twenty city
  fingerprints and all railway fingerprints match the pre-change manifest.
- Full Playwright suite: 277/285 initially passed. Updated retired test arrivals,
  condo/furniture fixtures and transition-readiness assertions; all eight remaining
  cases passed focused reruns. One failure was a temporary preview/server port
  collision, corrected only in the validation copy. All 285 cases passed overall,
  including same-seed recreation, archived reviews, multiplayer/filesystem saves,
  dev reload, room editing and 234 approved interior image references.
- `npm run streaming:bench -- --assert-ready`: passed for current seed 2026.
  Cold, standing, walk, sprint, reverse and zoom samples all had zero missing-data
  or incomplete-cache frames; sprint/reverse each traversed about 739 pixels.
  The runner now waits for the requested world identity/arrival before sampling.
- `npm run gameplay:bench`: passed in isolated Chromium; outdoor/indoor render
  p95 approximately 3.4/3.6 ms, with no browser errors. These are local desktop
  measurements, not device-wide performance claims.

Validation source files in the fixed copy were compared against the staged commit;
there were no differences. Browser-only port substitutions remained temporary.
Unrelated renderer/CI/documentation work is intentionally left in the checkout.

## Next work

Integrate a bounded two-town railway service only after separate authorization,
using the reviewed train patterns. Compose it into the current generator and bump
its version; add current topology/seam/replay tests without preserving another
historical runtime branch.
