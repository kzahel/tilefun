# 137 — Fierce creatures and a shared food web

Status: implemented and qualified; committed stages pushed to main. Human art review
remains pending. Owner authorized all five creatures, cross-species hunting,
natural-only meal replacement, autonomous delivery and per-stage commits/pushes
on 2026-10-18. Owns this bounded expansion; [wildlife](../topics/wildlife.md) owns
current contracts. Historical repair holds and human art review remain separate.

## Delivery

- [x] Natural-only replacement: durable origin, manual prey stays gone, repeated
  natural replacements retain lineage through reload, deletion never respawns.
- [x] Shared explicit food web covering native wildlife, existing predators and
  the five new species; no self-eating, player/pet/rider meals or duplicate catches.
- [x] T. rex: own biped source, head/tail/weight transfer, heavy patrol, roar,
  wind-up/short charge, feeding/rest and natural/editor/lab integration.
- [x] Small dragon: own winged body, guarded treasure, sleep/wake/display,
  hunting and natural/editor/lab integration.
- [x] Dire wolf: own canid source, howl, bounded pack coordination, hunting and
  natural/editor/lab integration.
- [x] Griffin: own eagle/lion source, perch, validated aerial approach and landing
  attack, hunting and natural/editor/lab integration.
- [x] Giant spider: own eight-leg source, web ambush, sudden scuttle/pounce,
  hunting and natural/editor/lab integration.
- [x] Final actual-world food-chain, natural/manual origin and reload evidence,
  production table refresh and clean pushed combined head.

## Contracts

One shared Realm implementation owns decisions, collision, meals and origin.
Canvas/GPU, single-player Worker, dedicated server and embedded labs consume it.
Food relationships are explicit game rules, with recognizable size/threat tiers;
new creatures can be prey themselves, including dire wolves eaten by T. rex.
Tamed/following/ridden actors, players and companion cats/dogs remain protected.
Only known natural-origin prey receives a same-species replacement. Preserve its
home and source lineage; assign a new durable ID and tombstone the old generated
individual. Do not infer origin from location, species or old unmarked offspring.
No generic removal/delete hook replenishes anything.

New art uses separate immutable revisions, editable Blender geometry, fixed
40-degree camera at native 10px/unit, physical body/limb motion, source audits,
native chronological review and reproducible palette masters. Registered review
is pending, never a synthesized human approval. Existing banks stay exact.

## Checkpoints

Origin implementation passes 57 focused predator/recipe checks, including manual
meals without replacement space and natural second-generation replay. Actual
Worker/editor/save/reload checks and the existing four predators pass all 13
browser cases. Typechecks, lint, build and 839 exact Workshop identities pass.
Full units: 2,728 pass; the same five Windows symlink/WAL failures and ten skipped
tests remain. Broader browser fail-fast: 45 pass, known GPU city-train reload
distance failure, one interrupted deer case and 615 unrun. No full browser pass
is claimed. All six streaming readiness phases pass. Natural-only replacement is
ready for its first commit/push; creature sources and the food web follow.

Natural-only replacement is pushed as `b2bfc745` (status formatter follow-up
`80350b16`). T. rex now has a separate 62-mesh biped source and 164 native poses.
Independent saved-scene audit passes 984 fixed-link checks, 272 planted contacts
and 104 stance/travel checks. Fresh replay reproduces twelve native/master/audit
artifacts byte-for-byte. Normal Chromium verifies all 41 chronological states at
native/4× scale, including 328 exact facing crops and 82 exact scenery comparisons.
Its new pending Workshop identity is registered; human review is separate.
Food-web, roar/wind-up/short charge, predator escape, generic species replacement,
spatial call onset/cleanup and existing hunting pass 82 focused unit checks.
Actual Worker, world spawn, picker and review checks are running before release.

T. rex release checkpoint: rebased onto the upstream racetrack work through
`41cbc0de`; both features remain intact. All 27 focused browser checks pass:
Canvas/GPU roar/audio/charge/feed, five predators' meals/reload, actual natural
spawn/editor/deletion/reopen, desktop/phone icons, native pending reviews and
racetrack gameplay. New fierce picker icons use the recognizable side silhouette.
World placement tests minimize the picker before clicking covered ground.
Typechecks, lint, build, 848 exact Workshop identities and streaming readiness
pass. Full units: 2,757 pass with the same five Windows symlink/WAL failures and
ten skips. Broader browser fail-fast: 45 pass, the same GPU train-reload distance
failure, one interrupted deer case and 623 unrun. Human art review is pending.

Small-dragon checkpoint: own 71-mesh horned/winged quadruped, keyed smoke, curled
tail rest and 196 native poses. Saved-source audit: 2,352 fixed links, 608 planted
contacts and 272 stance/travel checks. Thirteen native/accessory/master/audit
exports replay byte-for-byte; normal Chromium checks 49 states at native/4×,
392 facing crops and 98 exact scenery comparisons. The separate integer-vector
hoard recipe is pinned with the body bank in its pending review.

Shared Realm creates one ordinary durable hoard per owner. Dragons return home,
guard, sleep and warn visitors without targeting them. Deleting the hoard stays
durable; natural predator replacements retain den ownership without duplication.
All 86 focused units pass. Full units: 2,771 pass, the existing five Windows
symlink/WAL failures and ten skips. Typechecks, lint, build and 853 Workshop
identities pass. Browser hunting/audio/hoard reload, world placement/deletion,
picker and reviews pass after freezing AI for the editing-only fixture; live
food-web hunts otherwise legitimately remove the very actor being edited.
The hunting tests continue to run live authority. Streaming readiness passes.
Broader fail-fast: 45 pass, the existing GPU train-reload distance failure,
one interrupted deer case and 628 unrun. Art remains pending human review.

Dire-wolf checkpoint: separate 55-mesh canid, raised-muzzle howl and 164 source
poses. Saved-source audit passes 1,968 fixed-link checks, 608 planted contacts and
272 stance/travel checks. Twelve artifacts replay exactly; independent Chromium
checks 328 facing crops and 82 native scenery frames across native/4× playback.
Natural three-member packs have stable IDs/roles. Pack mates share a valid target
within the bounded candidate/path budget and flank from opposite sides; distinct
packs ignore one another's target. Eaten natural wolves retain pack membership,
while manually created wolves stay gone. Pack and paired natural/placed food-web
compositions are available in the shared Worker lab. Focused units: 102 pass.

Wolf release qualification: all 34 focused browser checks pass, including both
renderers, calls/charges/meals/reload, seven natural predator types, placement,
durable deletion, picker and exact pending reviews. Full units: 2,786 pass with
the same five Windows symlink/WAL failures and ten skips. Typechecks, lint,
build, 870 Workshop identities and streaming readiness pass. The first browser
attempt overlapped a build replacing dist and lost its server; the completed
build's clean rerun is the reported 34-pass evidence. Human art review is pending.

Griffin checkpoint: own 83-mesh eagle/lion anatomy, 196 source poses and native
rock-perch recipe. Saved audit: 2,352 fixed links, 608 planted contacts and 272
stance/travel checks. Thirteen exports replay exactly; Chromium checks 392 facing
crops and 98 scenery frames at native/4×. Review is registered and pending.

Shared Realm creates one durable rock, admits only unoccupied placement and
finds ordinary sufficiently broad tree/rock supports. PredatorMotion supplies
finite, speed-bounded flight arcs; EntityManager retains collision-owned XY and
actual landing support. Hunts warn, wind up, swoop, land and catch on the ground.
A scare cancels the target while the committed safe arc finishes. Mid-flight
save/reload preserves the path and phase. Cooldown returns to a perch; deleting
the perch stays durable. All three new movement integration checks and all 97
shared predator checks pass. All 39 focused browser checks pass, including both
renderers' visible swoop, warning/call, feeding and perch reload. Typechecks,
build, 875 Workshop identities and streaming readiness pass.

The wolf-stage broader browser run reached 44 passes before the existing GPU
train-reload failure (one interrupted deer case, 634 unrun).

Griffin release qualification: full units have 2,801 passes with the same five
Windows symlink/WAL failures and ten skips. Lint passes with the existing
119 warnings/34 infos. The 39 focused browser checks, types, build and streaming
are complete. This is provisional gameplay; human art review remains pending.

Giant-spider checkpoint: separate 52-mesh eight-leg source, alternating opposite
side tetrapods, fang/jaw warning and crouched ambush/rest. Saved audit passes
3,936 fixed links, 1,216 planted contacts and 544 stance/travel checks across
164 poses. Thirteen exports replay exactly; Chromium checks 328 facing crops
and 82 scenery frames at native/4×. The flat web is an authored integer-vector
accessory, registered with the body in an immutable pending review.

Spiders remain still at their web, detect only nearby edible small prey, warn,
scuttle/pounce, feed and return. Natural habitats add two stable natural rabbit
placements because this diet excludes deer; manually created spiders never
create prey. Web ownership/deletion is durable. Rabbit pursuit now delays the
pounce through startle/hop, catching after landing rather than timing out in air.

All 137 focused units pass, including spider ambush/home/web deletion, original
predators, aerial movement, packs, real T. rex/wolf meals, full natural vs placed
food-chain populations through repeated reload and a live three-wolf pack.
Types, build and 880 exact Workshop identities pass; final browser and full unit
qualification are running. The griffin broader browser run reached 45 passes,
the existing GPU train-reload failure, one interrupted deer case and 638 unrun.

Final integration checkpoint: all five retained sources/exports pass their pinned
receipt checks. The full suite has 2,820 passing units, the same five pre-existing
Windows symlink/WAL failures and ten skips. Typechecks, lint, build and the
880-candidate native Workshop inventory pass. A descending griffin now uses the
shared landing-surface query each tick, so a perch edited beneath its committed
arc catches it at the actual height; the added regression includes reload.
Live review fingerprints include the actual Realm, EntityManager, food-web,
profile, den and movement sources.

The initial main-world wolf-origin fixture assumed a guaranteed catch in open
ground. Fast wolf escape is a valid result of the telegraphed short charge, and
starter actors also compete as prey. The origin-only main-world fixture now
isolates unrelated actors and uses slower brown-bear prey. Both deer/tiger and
brown-bear/T. rex meals stay gone after main-world reload. Actual Worker lab and
Realm food-chain cases separately verify T. rex/wolf consumption and both origin
policies, preserving natural counts and declining manual populations.

Final browser qualification: all 52 distinct focused cases have passing evidence.
The combined final-runtime run passed 51 cases; the pack's duplicate audio check
missed its immediate first howl before sound opt-in. Restarting after opt-in
matches the no-late-replay audio contract. All five food-chain/pack cases then
passed twice (10/10), including the corrected pack onset. Both renderers verify
species warnings, calls, charges, feeding, durable dens and reload. Actual world
checks cover all nine predator types, manual placement and durable deletion; the
origin fixture covers manual deer and a manual brown bear being eaten and staying
gone. Picker and immutable art/character feedback checks pass as well.

Final broader fail-fast: 45 pass, the same existing GPU train-reload distance
assertion, one interrupted deer case and 649 unrun. Full units: 2,820 pass,
five existing Windows symlink/WAL failures, ten skips. Typechecks, lint (existing
119 warnings/34 infos), build, 880 exact Workshop identities, final streaming
readiness and all five pinned art receipts pass. No normal build regenerated a
retained animal bank. Historical campaign/repair holds remain unchanged.

Pushed prior stages: natural-only origin b2bfc745 (formatter 80350b16), T. rex and
food web 1a9dc980, small dragon 6693616a, dire wolf 069cbe14, griffin 00f76d0a.
The final spider commit also includes grounded rabbit pounce timing, edited-perch
landing, shared runtime review fingerprints and complete integration evidence.
Next: owner playtest of the natural/placed food-web scenes and visual review of
the five pending creature identities; further art changes require new revisions.

## CI simulation budget (2026-10-19)

Run [39170512267](https://github.com/kzahel/tilefun/actions/runs/39170512267)
hits Vitest's default five-second timeout in the natural food-chain integration
case at 5.124s; the placed counterpart passes at 4.184s. This case executes up to
2,100 real Realm ticks and two persistence reloads. It now has an explicit
15-second wall-clock budget for hosted CPU contention. Simulation steps, meal,
population, origin and reload assertions are unchanged. No art or gameplay changes.
All 2,871 unit tests, the three focused food-chain cases, typechecks and lint pass
locally. The required
production-status refresh was attempted, but this checkout lacks the local
`data/wildlife-campaign-v2/progress.json`; existing production status is preserved.

The next CI run reaches small-dragon editing but fails deletion (two animals
remain instead of one). Like the train renderer fixture, this test can capture
an old-world entity ID before the requested new world joins. Waiting for the
creation menu to close before querying animals fixes the fixture; all nine
predator species pass twice (18 browser checks), including durable reopening.
The shared creation-fixture audit is recorded in 139. No wildlife runtime,
artwork, population rules or assertions changed.
