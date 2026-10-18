# Predator hunting and prey replacement

Topic: wildlife
Status: complete; four implementation stages committed/pushed and final validation recorded.
Updated: 2026-10-18.

Owner explicitly authorized tiger gameplay with nearby replacement of eaten prey,
followed by panther, lion and brown bear artwork, world spawning and the same
hunting behavior. Commit/push each completed stage, rebasing if needed. This is
a bounded four-predator exception; historical repair gates/campaign stay stopped.

## Contract

- Shared authoritative game/Worker-lab behavior: patrol, sniff/display, stalk,
  chase, bounded pounce, feed, cooldown/rest. Players, pets and farm residents are
  not prey. Initial prey are natural deer and rabbits. A ball interrupts a hunt.
- Catch requires actual collision-resolved proximity, compatible ground height
  and a clear reach. Solid props, walls, water and unloaded terrain cannot be
  bypassed. Searches have fixed candidate/path budgets and no offscreen catch-up.
- One successful meal replaces exactly one prey with a fresh durable individual
  of the same species on safe nearby ground, outside the immediate feeding spot.
  Keep its home/habitat ownership; old killed identity stays removed. If no safe
  replacement location is available, defer the kill. Other removals never respawn.
- Persist predator phase/target/cooldown and both sides of replacement through
  ordinary actor records. Reopening must neither duplicate prey nor resurrect
  a killed/deleted original. Replacement/deletion share one persistence commit.
- Place all four predators manually in older worlds and seed rare suitable
  countryside deer-glade owners when absent. Previously visited regional glades
  can initialize missing predator owners too; saved identities/deletions take
  priority. Preserve the existing fauna roster IDs
  and homes. Embedded scenes use production AI/physics/persistence.
- Preserve tiger pilot-v1 and blocked historical bear sources. New art gets new
  identities, editable Blender sources, native motion inspection and exact pending
  Workshop review. No human art approval is inferred from authorization to build.

## Stages

- [x] Tiger behavior, replacement/persistence tests, editor/world/lab integration;
      validate, commit and push.
- [x] Panther own editable geometry/paint and pending review; same runtime;
      validate, commit and push.
- [x] Lion own mane/head/body and pending review; same runtime;
      validate, commit and push.
- [x] Brown bear own body/paws/gait and pending review, correcting the historical
      failed anatomy rather than adopting it; same runtime; validate/commit/push.

Default black panther is a melanistic leopard. Initial hunting is non-graphic;
feeding is a short visible native action followed by a long cooldown. Ecological
breeding and generic timed respawns are outside this bounded replacement rule.

## Validation

Meaningful unit/ScenarioSession tests cover target selection, prey fear, obstacles,
failed hunts, one-for-one replacement, deletion, safe spawn failure, cooldown,
multiple hunters, save/reload and origin tombstones. Native Canvas/full Chromium
checks cover art and actual shared hunting. Run required typechecks, lint, full
units/build/browser suites and streaming readiness; retain unrelated platform
failures honestly. Refresh inventories after final render inputs, preserve old
candidate identities and refresh the production table at checkpoints.

## Tiger checkpoint

Tiger uses the immutable pilot-v1 art in normal sprite loading, editor placement,
separate fixed predator habitat ownership, and a shared Worker laboratory. Hunting
is authority-owned, limited to unmounted/unattached deer and rabbits. Body contact
is resolved before a catch; ball hits and player landings interrupt it. A successful
meal first finds a clear loaded dry replacement footprint inside the old habitat,
then synchronously spawns a new persistent identity and deletes/tombstones the old
one. Actor records save both mutations together. Feeding lasts 3.84 seconds and
hunting cooldown is 35–55 seconds. Manual deletions do not use this path.

Art limitations remain explicit: stalking uses the existing planted walk; chase
is a speed-matched accelerated walk, the brief pounce is a grounded lunge with the
jaw display, and feeding reuses the lowered-head sniff cycle. No gallop, airborne
attack, carcass or gore has been invented. Existing tiger art review stays pending.

Seed 2026 / thicket has a repeatable natural tiger near tile (-140,-669), beside an
existing deer herd. The fixed four-species owner selection reserves future species
slots without converting existing tiger owners as additional profiles arrive.
Old fauna roster and home assignment are unchanged.

Validation: typecheck, build and lint succeed (lint retains repository warnings).
27 focused unit/scenario/scheduler tests pass. Fourteen full-Chromium browser
checks pass, including Canvas/GPU tiger feeding/reload, deer/rabbit interactions,
manual deletion and exact pending wildlife review. Full unit run found five
Windows symlink/process-death failures plus two new assertions fixed and rerun
successfully in the focused set; ten static-file tests were skipped by a Windows
symlink setup failure. The full browser suite will run again after the species
stages. Streaming benchmark initially timed out loading its isolated tools page;
retry is recorded separately. Evidence is in ignored data/predators-132/.

## Panther checkpoint

Panther hunt-v1 retains its own 47-mesh editable anatomy, unstriped charcoal/slate
paint and amber eyes. The fixed wildlife projection and grounded IK method reuse
the tiger authoring scaffold; the torso/pelvis/shoulders, smaller skull/cheeks and
longer tail differ. The 116 saved poses pass 1,392 fixed-link / 432 planted-contact
checks, actual native/4x Chromium playback covers all 29 chronological states and
232 exact crops, and fresh Blender replay matches all nine image/metadata exports
plus masters. Source, complete portable public bundle and exact pending Workshop
review are registered; historical receipts/fingerprints remain intact.

Shared runtime correction: enter a lunge based on footprint distance, retain
pursuit velocity/aim across phase changes, and leave a brief visible jaw display
before consumption. A production Realm test starts with an already fleeing deer
and catches it without a premature lunge failure. Stationary and airborne rabbit
cases also check replacement versus deferred catches. Panther patrol/stalk speed
is 8px/s, chase 48px/s with a matching accelerated walk phase. No gallop is claimed.
The seeded natural panther near tile (-461,-744), seed 2026 / thicket, belongs to
a separate fixed predator owner beside a deer glade. Its editor and shared lab
entry use the same definition/authority code.

The lab profile regression found after the tiger checkpoint was corrected by
keeping the flat hunting fixture free of the regional-only landscape setting;
its contract test now covers this distinction. The UI identifies the hunting
playground and omits misleading regional-map links for this flat fixture.

Streaming validation initially hung on Vite module/CSS requests before the game
loaded. A minimal diagnostic reproduced it; disabling filesystem watching for
fixed captures removed the stall. The benchmark now uses watch:null (matching
the manifest capture) and --assert-ready passes. It still uses the real game,
shared authority, isolated data and bundled Chromium. Logs/report remain under
ignored data/predators-132/streaming-verified.

Panther validation checkpoint: typecheck, build and lint pass; 31 focused predator
and scheduler checks pass, and the eight natural-recipe checks pass in the same
validation sequence (the later isolated run corrected the rabbit contact fixture).
Eight full-Chromium browser checks pass, including both renderers for tiger and
panther and exact pending art/player evidence. The frozen panther playback bytes
retain a narrowly scoped formatter exception; logic lint remains enabled and
receipt verification protects the original byte identity. Streaming readiness
passes after the capture-runner watcher correction above.

## Lion checkpoint

Lion hunt-v1 adds its own 58-mesh editable source with enlarged chest/skull and
twelve separately editable mane masses; dark mane paint was inspected after
native-size correction. All 116 saved poses pass the fixed-link/contact/weight
transfer audit. Fresh source replay matches nine image/metadata artifacts and
masters; actual Chromium visits 29 chronological states per scale with 232 exact
crop checks. Its complete 14-file public bundle and pending Workshop candidate
are portable and all prior review objects remain exact.

The lion shares ordinary world/editor/Worker authority behavior, at 8px/s patrol
and 44px/s chase with matching accelerated planted walk timing. A fixed natural
owner exists near tile (410,-674), seed 2026 / thicket, beside a deer glade.
Typecheck, build, lint and 41 focused predator/scheduler checks pass. Ten browser
checks cover tiger/panther/lion hunting, feeding and reload in both Canvas and
GPU plus exact pending-art review. All human art approvals remain pending.

## Brown bear and four-species checkpoint

Brown-bear hunt-v1 retains a 40-mesh independently proportioned body, wider hips,
thicker legs, large paws, short tail and separate muzzle/ear volumes. Its .84-unit
stride and 4/10 front footfall landings differ from the cats; source rise/pitch and
grounded IK remain visible. All 116 source poses pass saved-scene projection,
1,392 fixed-link and 432 planted-contact checks; 29 chronological states play in
actual Chromium at both native and 4x scale with 232 exact crop checks. A fresh
Blender rebuild reproduces nine public raster/metadata artifacts and masters
byte for byte. The complete 14-file bundle is registered for exact pending art
review, with all historical bear/tiger sources untouched.

Bear patrol is 7px/s and chase is 42px/s with matched accelerated walk timing;
its body collider is 28x16px with a 24px physical height. It uses the same bounded
hunt, collision-resolved jaw-display lunge, feeding, cooldown and safe one-for-one
replacement as the other three. A seeded natural owner exists near tile
(-725,-611), seed 2026 / thicket, beside the ordinary deer habitat. The editor
labels the quadruped tiger **Wild tiger** to distinguish it from the previously
promoted upright **Tiger** character; both remain available.

Fifty-one focused predator/scheduler tests pass. Targeted full-Chromium evidence
covers all four predators hunting/feeding/reloading in Canvas and GPU, exact
pending art/player verification, and ordinary regional-game natural spawning,
editor creation, deletion and reopening. All sixteen checks pass across the main
run and the corrected Wild tiger selector rerun. A 150-second logical-time soak
with four predators produces 12 meals while maintaining exactly two deer and two
rabbits at all 1,500 samples; two reloads retain all current prey identities and
no old killed animal returns. Final streaming --assert-ready traversal passes.

Final typecheck/build/lint pass (119 existing lint warnings / 34 infos). Full unit
run: 2,660 pass / 5 fail / 10 skip across 2,675 tests. Failures are the same Windows
FsSecurity symlink cases (3), privateDataPlugin symlink case (1), and SQLite
process-death recovery case (1). Static-file symlink setup fails and skips its
10 tests. All remaining unit files, including wildlife, are green. The final full
Playwright result is recorded below.

Implementation commits (all pushed to main without a required rebase): tiger
cfa3bfb9, panther 8a5044fa, lion 2a7d7101, brown bear 9f662460. The final packaging
check finds all 75 distinct new predator receipt dependencies tracked; all three
new receipts and the original tiger/four-pet receipts verify without changed
artifact hashes. The full browser run used the committed source without further code or pixel
changes. Next product step: human native-motion review and playtesting
hunt frequency, with dedicated running/lunging art still a separate animation
refinement rather than a claim of the provisional accelerated walk/display reuse.

## Final validation and handoff

Completed the full browser run against the four-predator build: **632 passed,
13 failed, 1 skipped / 646 tests**, 33.4 minutes. All **16 predator and exact-art
browser checks pass**: hunting/feeding/reload in both renderers; real regional
spawning/editor placement/deletion/reopening for each animal; and pending-review
playback, integrity/tamper protection and archived-evidence guards.

All 13 failing browser test titles exactly match failures recorded before this
implementation in data/tiger-131/browser-tests.log. There are no new failing
browser cases relative to that run. The repeated failures cover city train GPU
riding (2), live renderer switching (1), phone building review layout (1), shared
apartment entry (1), gameplay room editing (1), hotel sign mobile review (1),
furniture review (1), interior review filtering/phone rounds (2), development
reload (2), and remote-world interior/explorer integration (1). These remain
unresolved; this result does not claim that the broad suite is green.

Final checks: typecheck and build pass; lint exits successfully with the existing
119 warnings / 34 infos; full units are 2,660 passed / 5 existing Windows failures /
10 skipped. The 51 focused predator/planning tests pass, as does the isolated
streaming --assert-ready traversal. Fresh authoring replay, source/crop audits,
75 tracked receipt dependencies and original tiger/common-pet receipt checks
all pass. The repeated-meal/two-reload soak retains constant prey population.

Raw evidence is in ignored data/predators-132/: final-validation.json,
unit-full-final.log, browser-full-final.log, population-soak.log, per-stage logs,
native/4x art and gameplay captures, and streaming-final/report.json. All owned
test/benchmark browser processes and servers finish with their runners.

Human art approval remains pending. Next: review the native animations and
playtest hunting frequency; dedicated run/lunge animation is a further refinement
of the explicitly provisional accelerated walk/jaw-display runtime.
