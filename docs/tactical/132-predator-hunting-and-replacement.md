# Predator hunting and prey replacement

Topic: wildlife
Status: implementation in progress.
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
  countryside habitats in fresh areas. Preserve the existing fauna roster IDs
  and homes. Embedded scenes use production AI/physics/persistence.
- Preserve tiger pilot-v1 and blocked historical bear sources. New art gets new
  identities, editable Blender sources, native motion inspection and exact pending
  Workshop review. No human art approval is inferred from authorization to build.

## Stages

- [x] Tiger behavior, replacement/persistence tests, editor/world/lab integration;
      validate, commit and push.
- [x] Panther own editable geometry/paint and pending review; same runtime;
      validate, commit and push.
- [ ] Lion own mane/head/body and pending review; same runtime;
      validate, commit and push.
- [ ] Brown bear own body/paws/gait and pending review, correcting the historical
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
