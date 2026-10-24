# Wildlife art and ecology

Topic: wildlife
Status: all 196 roster animals implemented and available in the animated lab.
New exact art remains pending human review; specialist behavior limits are
recorded in the individual checkpoints.
Updated: 2026-10-24.

[Shared finishing correction 187](../tactical/187-shared-wildlife-finishing.md)
audits all 206 active entries and introduces 137 complete `finish-v1` banks.
Deer, three cat coats and donkey retain original painted parts through their
new actions; the other 132 corrected banks use source material surfaces without
an automatic exterior dark halo. The 69 other banks retain explicit policies.
[Finishing contracts](../../art-source/wildlife-v2/finishing.json) and the
[versioned painter](../../art-source/wildlife-v2/finishing-v1/README.md) own this
contract. Game and Animal Browser share the same identities. Historical sources
and 264 review objects remain unchanged; all new art awaits human review.

Owner requested planning for distinct behavior and suitable animation for every
animal on 2026-10-20, starting with land and air animals. The
[behavior campaign plan](wildlife-behaviors.md) separates this new work from the
completed art roster, proposes a canonical per-animal ledger and defines
observable mechanics, animation, game/lab validation and human-review progress.
The behavior ledger and generated status report now cover all 206 current lab
entries, including all 196 roster entries. [Batch 155](../tactical/155-fetch-nests-and-caches.md)
adds dog ball fetching, crow twig collection/nesting and squirrel food caches,
with real carried objects, saved resource counts and new action clips. Animal
Browser exposes progress filters and demonstrations from this ledger. The other
177 animals still need detailed audits; new behavior/art review remains pending.

[Batch 159](../tactical/159-foraging-and-lookouts.md) adds finite rabbit plant
feeding, robin ground-food/perch trips and rotating meerkat lookouts with group
alarms. New action banks preserve native travel cells. Rabbit/meerkat food is
finite; robin groves share one seed patch per occupied chunk, retaining every
bird within the existing inspection cap. Editor food supports existing
worlds and placed animals. Shared lifetime and local predator-sensing corrections
keep consumed resources removed and actual nearby prey discoverable. The
[behavior ledger](../../art-source/wildlife-v2/behavior-campaign.json) owns progress
and pending human review for all twenty-seven implemented signature mechanics.

[Batch 161](../tactical/161-climbing-raids-and-play.md) adds supported capuchin
fruit climbing, conserved raccoon cache raids and cat physical toy play/tree rests.
It also adds saved bounded food growth and ten persistent thrown toys per player.
Ginger/black cats inherit the cat mechanic with their own new action banks.
Natural raccoon homes include a real caching squirrel; manually placed animals
create no hidden supplies. The [behavior topic](wildlife-behaviors.md) owns resource,
climbing, toy lifetime, lab demonstrations and progress contracts. New art remains
pending human review; automated evidence is recorded in the batch checkpoint.

[Batch 163](../tactical/163-browsing-rooting-and-trunks.md) adds goat shrub browsing
and actual low-rock hops, pig sniffing/rooting and elephant trunk fruit harvesting
and shaking. Fourteen entries now have targeted behavior verification: twelve
signatures and two inherited cat coats. New bounded shrubs/root patches, actual
carried roots/fruit and world/editor supplies use the shared saved resource rules.
The [behavior topic](wildlife-behaviors.md) owns the contracts and pending reviews.

[Batch 166](../tactical/166-scratching-and-pollination.md) adds chicken soil
scratching/seed pecking, bee cross-flower pollination and hummingbird nectar
hovering/territorial warnings. Seventeen entries have targeted automation
verification, with fifteen distinct signatures and two inherited cat coats.
Finite saved soil/nectar resources, bounded crop-timer advancement and cell-owned
natural supplies use shared Realm/Worker authority. Exact new art remains pending.

[Batch 168](../tactical/168-grazing-browsing-and-building.md) adds horse
grazing/drinking, giraffe actual canopy browsing and beaver conserved branch
construction on land. Twenty entries now have targeted verification, with eighteen
signatures and two inherited cat coats. New action banks preserve
all native travel pixels and retain exact pending review identities. The behavior
topic owns source renewal, support, building and controlled-actor protections.

[Batch 170](../tactical/170-rumination-flocks-and-dust-baths.md) adds paid cow
rumination, committed sheep flock regrouping and donkey dust bathing with saved
scuffs. Twenty-three entries have targeted behavior verification, covering
twenty-one signatures and two inherited cat coats. New pending action banks retain
native travel cells. Shared saved facing now preserves resting fauna headings
across reloads. Broad regression evidence belongs to the tactical.

[Batch172](../tactical/172-browsing-courtship-and-collecting.md) adds deer finite
browsing/alarm stamping, reciprocal peacock partner displays and raven conserved
shiny-object caches. Twenty-six entries have targeted verification: twenty-four
signatures and two inherited cat coats. World/editor resources, native travel,
readiness and saved attachments remain shared with the three Worker lab scenes.
Four new exact action/resource identities remain pending human review.

[Batch174](../tactical/174-curling-quills-and-fox-pounces.md) adds hedgehog
curling, directional porcupine quill deterrence and fox listening/stalking with
physical small-prey pounces. Defenses affect real catch eligibility; quill warnings
make actual predators retreat. Fox meals share delayed/distant natural-only
replacement with the existing hunters. Twenty-nine entries now have targeted verification, with twenty-seven signatures
and two inherited cat coats. Three new retained action banks preserve
native travel pixels and await human review. The behavior topic owns these
contracts; the tactical records exact validation.

[Explorer boats and large lakes](boats.md) add four natural fish schools, four
other water species and one aquatic hunter per new large lake. Existing water
refuges and the fixed ownership pools remain unchanged; normal shared habitat,
hunting and delayed natural-only return rules apply. The zebra inspection point
now uses a valid clearing under the updated current terrain. Exact animal art
and completed roster counts remain unchanged.

## Large predators can eat NPC people

Owner request, 2026-10-19: big predators can eat NPC people, while every
human-controlled player stays safe. The explicit food web now admits all twenty
street-person types, Trail Explorer and the four indoor human roles as `person`
prey for T. rex, dragon, brown/polar bears, lion, tiger, panther, jaguar, leopard,
wolf, spotted hyena, dire wolf and griffin. Small hunters, aquatic hunters and herbivores do
not gain human prey. Other approved character NPCs keep their existing behavior.

Eligibility uses the actor's actual type, never its sprite, player model, weight
or generic `npc` tag. Controlled actors retain type `player`, including co-op
players and every selectable character appearance, and fail both acquisition
and catch checks. Following buddies and attached/ridden actors retain protection.
Ordinary shared Realm pursuit, scare/flee behavior, body contact, terrain/height
checks, feeding and cooldowns handle these meals in the game and embedded labs.
NPC people flee at 1.5× walking speed so the named predators can catch them;
their previous ball-hit panic runs at 3×, faster than lions/tigers/bears. The
optional scare-speed override clears on calming down or a new ball hit. Ordinary
walking, predator speeds and ball-hit panic retain their previous behavior.

Eaten people use normal durable deletion and procedural tombstones. They do not
enter the animal-only delayed replacement queue, which would discard resident
homes/routes. No new art or review approval is involved.

[PeoplePredation tests](../../src/wildlife/PeoplePredation.test.ts) cover every
NPC type against every predator, every player appearance at acquisition/catch,
following/attachment and physical protections, scare recovery/ball hits and
fifteen real Realm hunts with saved deletion. The real Worker browser checks
also place NPC people beside the five named predators while the controlled
player wears a human appearance. The older predator feeding checks now assert
the existing delayed animal-return contract rather than an immediate replacement.

Validation: all 4,463 unit tests pass, plus 94 distinct browser cases across the
predator gameplay, origins, world, fierce-creature and food-chain suites (89
existing cases and five added NPC cases). Typecheck, lint and production build
pass; lint retains existing warnings. The art catalog and 1,391-candidate
Workshop manifest are regenerated. Next: playtest the new NPC pursuit pacing.

The production-table refresh cannot run in this checkout: its required local
`data/wildlife-campaign-v2/progress.json` is absent. The existing table is retained;
the status command and failure are recorded rather than inventing campaign state.
## Completed eight-hour continuation

Final verification closes the run with **196/196 roster animals implemented**:
122 from the preceding run and all 74 remaining animals completed here. Every
roster animal is present among **206 animated lab entries**. All new exact art
remains pending human review; no approvals were synthesized.

Animal source `9f2e5008` and the final verification corrections preserve remote
NPC predation and CI fixes. The complete corrected unit retry has **5,714 passes**, only the five known
Windows failures and ten skips. The earlier Workshop API timeout does not recur.
The full Playwright sweep has **1,463 passes, nine failures, one intentional skip
and one serially blocked case**. All affected cases and shared hosts are covered by
**51 successful focused browser rechecks**, covering all **1,473 runnable cases**
across the sweep and rechecks with no unresolved browser failures. Racer counts
now use actual racing-lane ownership; robin reload checks retain every saved pose
and a fixed view, with stronger headless durable-owner assertions.
Legacy driving checks select accepted authored models. Phone hotel voting fits
the viewport, and RTC fault probes derive their current wire header from the
codec. The dev-reload timeout is rechecked on unchanged code.
Typecheck, lint, production build, the 1,765-candidate normal Chromium manifest
and merged streaming readiness pass. All three prior vehicle review objects
remain exact. All 74 active new banks are registered; 740 replay artifacts,
33,104 exact native/3x crops, 1,677 pinned artifacts and 824 visible four-facing
previews support the delivered source and animation checks.

Shared authority owns their world/lab behavior. Hunters use the directed food
web; natural meals retain delayed distant replacement and placed animals remain
finite. Friendly companions are protected. Individual checkpoints describe
remaining specialist behavior such as open-air navigation, fishing, climbing,
camouflage and burrowing. The next step is human review of the newest browser
entries and a population-balance playtest after the hosted checkout deploys.


Owner authorized another approximately eight hours and said “good now proceed”
on 2026-10-19. Window: **11:06:24–19:06:24 UTC**.
[Tactical 147](../tactical/147-wildlife-continuation.md) and its
[ledger](../../art-source/wildlife-v2/autonomous-147.json) own new progress.
The previous run remains an immutable completed record: 122 roster animals
already implemented, 74 remaining. Register new exact pending art identities,
verify world/animal-browser animation and AI, commit and push finished batches.
This explicit scope supersedes historical expansion/sequencing holds for this
window; it does not invent human approvals or alter registered source banks.

First checkpoint: raven, carrion crow and Atlantic puffin `roster-v3` are active
in natural worlds, editor placement and the animal browser. Distinct original
bills, tails, wing proportions, puffin face/breast and webbed feet; fixed linked
legs and shoulder/elbow feather wings. Bounded landing-to-landing flights use
shared Fauna authority. These three use dry-ground homes; open-air navigation,
coastal swimming and corvid hunting are not implemented in this batch.
All 135 browser entries pass four-facing visible animation checks, and the three
new Watch AI paths show real moving natural animals. Twenty Canvas/GPU lab/game
browser checks, three byte-identical source replays and 984 exact source crops
pass. Typecheck/lint/build and streaming readiness pass. Full units had 4,456
passing and the five known Windows failures plus one stale roadkill type count;
authored crow legitimately joins legacy crow. Its explicit registration check
was corrected and all 30 affected bird/roadkill tests pass. Exact new art remains
pending human review. Roster: **125 of 196 implemented; 71 remaining**.


Second checkpoint: tawny owl, bald eagle and red-tailed hawk now join natural
world spawning, editor placement and the lab browser. They use shared bounded
predator flights, physical landings, ordinary perches, explicit diets, feeding,
quiet/alert cycles and species calls. Eagle can hunt owl/hawk; larger hunters can
hunt these birds. Natural meals retain the same delayed distant birth policy;
manual prey remain finite. No airborne near-miss catches are allowed.
The owl-v3 anatomy bank remains immutable; active owl-v4 raises chase speed from
30 to 40px/s with matching source timing. Eagle/hawk use roster-v3. All art is
pending human review. Browser **Action** now resolves hunters' display clips
instead of falling back to idle. Native fixture props retain production type
identity, enabling shared perch AI; custom fixture geometry remains anonymous.
Raptor landings publish their actual support height. Contact from above requires
real landed support/XY overlap and retains the airborne-prey meal guard.
Validation: **4,544 unit passes**, five known Windows failures, ten skipped;
388 focused hunting/source/audio checks; 27 real browser cases including 552
four-facing previews; four byte-identical banks and 3,872 exact source crops.
Typecheck, isolated lint/build, 1,423-candidate full Chromium manifest and
streaming readiness pass. **128 of 196 implemented; 68 remaining.** Chimpanzee
and orangutan follow in the next checkpoint below.


Third checkpoint: chimpanzee and orangutan now have natural woodland homes,
editor placement and browser entries. Narrow chimp torso/large ears and long-armed
orangutan cheek flanges/throat pouch/shoulder hair use connected fixed-volume
knuckle walks, body weight transfer and one-sided grooming. Ground behavior uses
shared Fauna; climbing/brachiation remain future work. Large predator diets include
both apes. Natural prey retain delayed distant replacements; placed prey are finite.

Adding the apes crossed the 256-type binary registry limit: worm4 wrapped to ball.
Baseline type indices now use u16, with frame tag 0x04 and explicit rejection of
the legacy layout. All endpoints require matching builds; deltas are unchanged.
The [network topic](multiplayer-networking.md) owns the wire contract.
Validation: **4,580 unit passes**, five known Windows failures, ten skipped;
1,170 focused ape/ecology and 109 codec/scenario checks; 19 browser cases including
real P2P host/join, fragmented transfer and reconnect; **560** visible previews;
two byte-identical banks and 784 exact crops. Typecheck/lint/build and streaming
readiness pass. All new pixels remain pending human review.
**130 of 196 implemented; 66 remaining.** Five remaining primates have audited
unregistered banks; four distinct fish prototypes are also in progress.

Fourth checkpoint: capuchin monkey, ring-tailed lemur, mandrill, proboscis monkey
and Japanese macaque complete the eight roster primates. They have distinct
faces/muzzles/ears, caps/cheeks, articulated tails (including lemur rings), buried
limb roots, planted feet, moving torsos and foraging actions. Ordinary shared
woodland authority owns movement, group spacing, escape and persistence; tree
climbing/brachiation remain future work. All join editor placement and the browser.
Explicit diets allow larger hunters to consume them; eagle can hunt capuchin/lemur.
Natural meals retain delayed distant replacement; placed prey remain finite.
Validation: **4,665 unit passes**, five known Windows failures, ten skipped;
120 focused checks; **31 browser cases**, including **580 visible previews**;
five byte-identical banks and 1,640 exact native/3x crops. Typecheck, isolated
lint/build and the 1,459-candidate full Chromium manifest pass. Mid-run Workshop
inbox and art notes have no pending requests; new exact art remains pending review.
**135 of 196 implemented; 61 remaining.** Four fish banks await runtime integration;
five ground-specialist source prototypes are underway.

Fifth checkpoint: ocean sunfish, pufferfish, swordfish and anglerfish spawn in
legal deep-water refuges and join placement/browser inspection. Sunfish paired
dorsal/anal paddles and clavus, swordfish bill/forked tail, puffer closed spines and
angler lure/toothed jaw use distinct editable anatomy. Fins remain attached and
tails retain fixed links. Source swim/chase clocks use separate non-overlapping
key ranges. Puffer inflation is not implemented; no animated scaling is used.

Swordfish and anglerfish use ordinary shared aquatic hunting. Explicit diets
include swordfish→anglerfish/pufferfish and shark/orca→all four new fish. Reverse
hunts are excluded; natural/placed lineage policy remains unchanged. Existing
lagoon hunters now validate source-specific anchors, and browser tests assert a
reduced live fish population during the delayed replacement period.
Validation: **4,718 unit passes**, five known Windows failures, ten skipped;
116 focused checks; **32 distinct browser cases**, including all seven aquatic
hunters in Canvas/GPU and **596 visible previews**; four byte-identical source
banks and 1,952 exact crops. Typecheck, isolated lint/build and the 1,479-candidate
full Chromium manifest pass. All new art remains pending human review.
**139 of 196 implemented; 57 remaining.** Five ground-specialist banks are ready
for runtime integration; four more flying-bird prototypes are underway.

Sixth checkpoint: meerkat, giant anteater, aardvark, armadillo and pangolin now
spawn naturally, support editor placement and appear in the browser. Distinct
snouts/ears/markings, the anteater's bushy tail and shoulder slash, eight closed
armadillo armor bands and 58 closed pangolin body/tail scales are editable volumes.
Buried fixed-length limbs, planted feet, linked tails and visible body paint motion
are audited. Ordinary shared ground walking, foraging, escape and persistence are
implemented; curling, burrowing and meerkat sentinel rearing remain future work.
Explicit prey rows retain the natural/placed replacement policy.
Validation: **4,803 unit passes**, five known Windows failures, ten skipped;
120 focused checks; **31 browser cases / 616 visible previews**; five byte-identical
banks and 1,640 exact crops. Typecheck, isolated lint/build and the 1,504-candidate
full Chromium manifest pass. All new art stays pending human review.
**144 of 196 implemented; 52 remaining.** Four new flying-bird banks are ready for
integration; five tall-bird prototypes have connected three-link necks and planted
biped gaits and are undergoing proportion refinement.


Seventh checkpoint: pelican, blue-footed booby, great frigatebird and ruby-throated
hummingbird now spawn naturally and join editor placement and the lab browser.
Distinct bills/pouches, blue webbed feet, forked tail, gorget and wing proportions
use connected shoulder/elbow feathers and tucking fixed-link legs. Denser source
keys and independent eighth-pose audits preserve continuous leg planes. Physical
landing-to-landing flights use shared authority; dry-ground homes are deliberate.
Swimming, open-air navigation and sustained hummingbird hovering are future work.
Large hunters can eat them after landing; natural-only delayed births remain.
Validation: **4,871 unit passes**, five known Windows failures, ten skipped;
60 focused checks; **26 browser cases**, including **632 visible previews**;
four byte-identical banks and 1,312 exact native/3x crops. Typecheck, isolated
lint/build and 1,524-candidate full Chromium manifest pass. Exact art pending review.
**148 of 196 implemented; 48 remaining.** Five tall-bird banks have exact source
playback evidence; three distinct reptile hunters are in source refinement.



Eighth checkpoint: flamingo, shoebill, secretary bird, marabou stork and great blue
heron have distinct bills/crests/plumage, buried fixed-link legs, body weight
transfer, planted feet and connected three-link necks through forage poses.
Secretary bird uses terrestrial hunting with explicit snake/small-prey diets;
its lab contains an ordinary natural king cobra and one uneaten deer. Cobra
catches and delayed natural replacement queues persist on reload. The other
four use shared ground walking/foraging; wetland wading and flight are future work.
All join seeded worlds, placement and browser action/Watch AI. Exact art pending review.
Full units: **4,958 passed**, five known Windows failures plus one stale source
assertion assuming four feet and identical walk/chase paths. The corrected test
measures planted source geometry through the actual camera; all17 source banks
pass, and all52 source/ecology regression cases are covered passing across runs.
Also75 focused new-family checks; **32 browser cases /652 previews**; five exact
replays and1,960 native/3x crops; typecheck/isolated lint/build,1,549-candidate
manifest and streaming readiness pass. The ledger also corrects the prior four
flight birds to its expected finished-game-active state.
**153 of196 implemented;43 remaining.** Three reptile hunter banks have exact
replay evidence; seven forest-mammal/marsupial prototypes are under refinement.


Ninth checkpoint: crocodile, alligator and Komodo dragon now have distinct
closed snouts, scutes or forked tongues, buried splayed fixed-link legs, planted
travel, moving torsos and connected tails. Native96px canvases keep editor/lab
previews readable. Ground hunting bursts catch genuinely fleeing prey; explicit
diets include larger predators eating smaller hunters. Swimming is future work.
Natural-only delayed distant births and manual finite populations remain intact.
Validation: **5,023 full-unit passes**, five known Windows failures and one food-web
traversal timeout. Memoized completed DAG nodes remove repeated path expansion;
all five food-web regressions then pass in milliseconds, retaining cycle checks.
Also54 focused checks, **18 browser cases /664 previews**, three byte-identical
source replays and1,944 exact native/3x crops. Typecheck, isolated lint/build and
1,565-candidate full Chromium inventory pass. All three vehicle review records
are byte-identical; live scenario fingerprints follow current shared code.
**156/196 implemented;40 remaining.** Exact art pending human review. Seven forest
specialists and four mixed mammals have verified source prototypes; four shore
mammals are in source refinement.


Tenth checkpoint: sloth, binturong, aye-aye, kinkajou, opossum, echidna and
Tasmanian devil now join natural worlds, placement and the interactive browser.
Distinct masks, fingers, claws, whiskers, tails,49 closed echidna quills and devil
markings use planted fixed-link legs, buried roots and visible body weight transfer.
Six use shared ground walking/foraging; the devil hunts small prey. Climbing and
brachiation remain future work. Natural-only delayed distant replacement is retained.
Validation: **5,144 full-unit passes**, five known Windows failures and ten skips;
90 focused checks; **40 distinct browser cases /692 visible previews**; seven
byte-identical banks and2,616 exact native/3x crops. Two initial sloth tests exceeded
a fixed12-second wait; measured walking began after14seconds. Cadence-based waits
pass both renderers without changing gameplay. Typecheck, isolated lint/build and
1,600-candidate normal Chromium inventory pass. All exact art pending human review.
**163/196 implemented;33 remaining.** Mixed mammals4 and shore mammals4 have verified
sources; eight arthropods are in source authoring with species-specific leg counts.


Eleventh checkpoint: bat, wallaby, manatee and dugong join natural worlds,
editor placement and browser Watch AI. Bat has eight finger bones and14 closed
wing membranes; wallaby has fixed hind legs, connected forearms and balancing tail.
Both use physical bounded flights/hops and source-matched landing clocks. Hanging
roosts and open-air navigation are future work. Manatee paddle tail and dugong
forked flukes use closed volumes, attached flippers and shared deep-water authority.
Directed diets preserve airborne safety and delayed natural-only replacement.
Validation: **5,208 full-unit passes**, five known Windows failures and ten skips;
557 focused source/body/food-web checks; **30 browser cases /708 visible previews**,
including wombat regressions; four exact replays and1,312 native/3x crops. Typecheck,
isolated lint/build and1,620-candidate normal Chromium inventory pass. Exact pixels
remain pending human review. **167/196 implemented;29 remaining.** Shore mammals4,
arthropods8 and legless creatures5 remain in source verification/refinement.


Twelfth checkpoint: river otter, platypus, sea lion and walrus now have natural
shore homes, editor placement and browser action/Watch AI. Distinct muzzles,
bills, flattened tails, ear flaps, tusks and moustaches use fixed linked limbs,
planted ground travel, body weight transfer and a separate body-relative paddle
cycle. Shared amphibious walking/swimming, foraging and escape are active;
fishing is future work. Sea lions/walruses require lagoons; the other two can use
ponds or lagoons. Fixed slots and the southern arc preserve original shore homes:
558 pre-existing natural actor records around all four refuges are byte-identical.
New birth coverage exposed a shared habitat bug: amphibious births were rejected
in water. Birth placement now admits their legal wet/dry footprint, initializes
the water pose and checks deep fauna's complete deep-water footprint. Shallow or
internally invalid water retries; delays, distances and manual finite populations
are unchanged. Validation: **5,270 full-unit passes**, five known Windows failures,
ten skips;160 focused cases across corrected runs; **40 browser cases /724 visible
previews**, including all14 aquatic hunter regressions; four exact replays and
2,336 native/3x crops. Typecheck, isolated lint/build,1,640-candidate full Chromium
manifest and streaming readiness pass. Exact art pending human review.
**171/196 implemented;25 remaining.** Eight arthropods, five legless creatures and
five marine oddities are in source verification/refinement.


Thirteenth checkpoint: Gaboon viper, snail, earthworm, moray eel and electric eel
join seeded worlds, placement and the browser. Original closed fixed body chains,
overlap joints, attached jaws, moving painted bodies and exact loop seams replace
leg-based assumptions. Ground forms retain under0.03world-unit clearance; eels
use shared deep-water authority. Viper hunts mouse prey; eels hunt aquatic prey;
snail/worm crawl, forage and escape. Directed meals preserve delayed natural-only
replacement. Electrical discharge and burrowing are future work.
Natural hunter profiles can now specify their clearing prey. The viper receives
actual mice in both its lab and ordinary natural clearing; existing hunters keep
their rabbit defaults and stable identities. Shared source/ecology/meal tests
support the configured prey rather than assuming every hunter eats a rabbit.
Validation: **5,345 full-unit passes**, five known Windows failures and ten skips;
49 focused checks; **28 browser cases /744 visible previews**; five exact replays
and2,600 native/3x crops. Typecheck, isolated lint/build,1,665-candidate normal
Chromium inventory and streaming readiness pass. Inbox/art notes: no pending
requests. All exact art pending human review. **176/196 implemented;20 remaining.**
Eight arthropods, five marine oddities and five crustacean/chelicerate prototypes
are in source work; two upright companions remain queued.


Fourteenth checkpoint: spider, praying mantis, leaf insect, scorpion, roly-poly,
earwig, centipede and millipede now join seeded worlds, placement and browser AI.
Original6/8/14/28/48walking-leg rigs use fixed links, buried roots, planted
metachronal travel and moving torsos. Native review widened the stance, removed
inappropriate tails and separated antennae; mantis has a foreleg grasp, scorpion
has five linked tail segments and earwig has forceps. Four hunters receive actual
ant prey. The directed chain scorpion→centipede→spider→mantis admits larger hunters
without reciprocal cycles. The other four use ground forage/escape; webs, venom,
rolling and burrowing remain future work. Natural-only distant delayed births remain.
Validation: **5,486 full-unit passes**, five known Windows failures and ten skips;
97 focused checks; **42 distinct browser cases /776 previews** across corrected
runs; eight exact replays and3,904 native/3x crops. Millipede rest waits now follow
its slow cadence. Predator inspection queries adjacent chunks when rounding crosses
a boundary; actual scorpion spawning/placement/deletion passes. Typecheck, isolated
lint/build and1,705-candidate normal Chromium inventory pass. The two generated
projection guides over32MiB are excluded from Biome like existing cat/dog guides;
dedicated closed-volume, fixed-link and continuous source audits still validate them.
All exact art pending human review. **184/196 implemented;12 remaining.** Marine
oddities5 and crustaceans5 have source/playback work underway; the two upright
companion prototypes are refining dense arm keys and supported weight transfer.


Fifteenth checkpoint: cuttlefish, seahorse, nautilus, leafy seadragon and starfish
join deep-water natural refuges, placement and the animated animal browser.
Cuttlefish have eight linked arms, two feeding tentacles and attached mantle fins;
seahorses have a curled tail and upright body; nautiluses have a closed patterned
spiral shell and animated tentacle bundles; leafy seadragons have attached leaf
appendages and a linked tail; starfish have five articulated radial arms.
All use closed editable volumes, fixed links, moving painted bodies and exact
source loops. Cuttlefish hunt through shared aquatic authority; the other four
swim or crawl, forage and escape. Directed diets allow larger marine hunters to
eat them. Natural meals retain distant delayed replacement; placed prey stay
finite. Camouflage, ink and other special abilities remain future work.
Validation: **5,557 full-unit passes**, five known Windows failures and ten skips;
51 focused checks; **30 browser cases / 796 visible previews**; five exact replays
and 1,960 native/3x crops. Typecheck, isolated lint/build and the 1,730-candidate
normal Chromium inventory pass. All three vehicle review objects remain exact.
New art remains pending human review. **189/196 implemented; seven remaining.**
The five crustaceans and two upright companions have passed source replay and
native/3x playback verification and await runtime integration.


Sixteenth checkpoint: coconut crab, horseshoe crab, lobster, shrimp and peacock
mantis shrimp join seeded habitats, placement and the animated browser. Coconut
crabs hunt on land; lobsters and mantis shrimp hunt in deep water. Horseshoe crabs
and shrimp use deep-water forage, travel and escape. Distinct closed shields,
segmented bodies, stalked eyes, antennae, tail fans and telsons use fixed links.
Walking legs remain planted and attached; claws and club arms move independently.
The food web includes mantis shrimp→lobster and larger marine hunters→both, with
no reciprocal cycles. All retain natural-only delayed distant meal replacement.
Shock effects and other special abilities remain future work.
Validation: **5,627 full-unit passes**, five known Windows failures and ten skips;
48 focused checks; **28 browser cases / 816 visible previews**; five exact replays
and 2,600 native/3x crops. Typecheck, isolated lint/build and 1,755-candidate normal
Chromium inventory pass. All 72 registered banks retain 1,629 pinned artifacts
byte for byte. Three vehicle review objects remain exact. Art pending human review.
**194/196 implemented; two remaining.** Both upright companion source banks have
passed supported weight transfer, dense arm attachment, replay and playback checks.


Seventeenth checkpoint: the upright elephant and giraffe complete the roster.
They are friendly biped companions, separate from the immutable quadruped banks.
Two planted four-link legs support body bob and lateral weight transfer during
double support. Dense attached arm animation, fixed trunk/neck/tail chains and
closed editable volumes pass independent continuous source audits. Both use
ordinary ground travel, cautious interest, greeting/forage, escape and persistence.
All food-web hunters protect them; the browser explicitly labels them Companion.

An independent two-species natural bank preserves the 17/169/42 original pools.
The first clearing prototype removed trees and their robin owners; the corrected
admission rule fits existing open sites without changing scenery. Regressions
preserve prior actors, trees, homes and water refuges and check bounded cache
eviction/query-order independence. World placement, deletion and reopening pass.
Validation: **5,663 initial full-unit passes**, five known Windows failures,
ten skips and one Workshop API timeout; all 13 API tests pass isolated on unchanged
source. **43 focused checks; 16 browser cases / 824 visible previews**; two exact
replays and 656 native/3x crops. All 74 new banks retain 1,677 exact pinned artifacts.
Typecheck, isolated lint/build, 1,765-candidate normal Chromium manifest and streaming
readiness pass. Three vehicle review objects remain exact. All new art is pending
human review. **196/196 implemented; none remaining.** The run remains in final
verification for a full-unit retry and the complete browser suite.


## Small-animal roadkill

[143](../tactical/143-small-animal-roadkill.md) implements the owner's accepted
roadkill rule for frogs, rabbits, robins, mallards, chickens, both pigeon variants,
crows, seagulls and ants. Driven cars and all trains kill on moving physical body
contact, including reverse and slow travel. Stationary bodies, diagonal near misses
and height-separated animals do not cause deaths. Followers, attached/ridden
animals and companion species remain protected; larger animals retain gentle contact.

Deaths use ordinary durable removal, with no predator-meal replacement. Separate
inert remains reuse unchanged source pixels, flattened at ground level for 30 seconds
with a five-second fade. They have no AI, collision, support or shadow and reload
with their remaining lifetime. Shared game/lab authority, private car prediction
and Canvas/GPU presentation implement the behavior. Full unit/browser and streaming
readiness checks pass; 143 records the evidence and missing campaign-status input.

## Animal browser locomotion correction

The owner reported static dove/cobra previews on 2026-10-19. The browser's
hard-coded walk/hop/swim/flap fallback selected the single idle frame for sixteen
entries whose travel is named fly, slither, crawl, flutter, bound, jet or pulse.
Previews now use the ordinary travel clip from each shared wildlife definition,
matching the existing idle/travel/action ordering used by the AI. Mallard uses
its waddle clip for ordinary locomotion instead of the former swim fallback.
The preview readiness flag resets when its clip/facing changes and reports the
actual selected clip after drawing. Existing pixels and gameplay AI are unchanged.

The owner confirmed frog visibility recovered, consistent with a transient client
issue. Fresh live Chromium checks found visible frog/mallard cards and four frogs
with advancing AI in the pond scene. No frog-specific art or spawn correction is
included. Regression coverage now checks all 132 browser entries in four facings:
visible canvas pixels, the species travel clip, and a change in actual rendered
pixels through its animation. A separate read-only scan confirmed all 528 native
travel sequences contain visible frames and more than one distinct pose.

Validation: all 528 rendered browser previews advance their actual pixels, across
six passing full-Chromium cases including desktop/mobile browsing. Typecheck,
lint, production build and the 1,391-candidate Workshop manifest pass. Full units:
4,405 pass, five known Windows symlink/WAL failures and ten skips; static-files
symlink fixture setup also retains its existing failure. No new diagnostics.

## Animal browser and delayed natural returns

Owner request, 2026-10-19: extend the interactive lab with an animal browser and
make eaten natural animals return later, much farther away. The
[animal browser](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry)
uses the existing Natural Landscape/World Geometry scenario host. It lists 132
playable animals and coat variants, with name/family search, family filtering,
newest/oldest-added, recently-updated and alphabetical/family sorting. Visible
cards animate the current shared game banks, with locomotion/idle/action and
four facings. Watch AI selects the ordinary scenario and follows the selected
animal; the follow checkbox returns the camera to the player. Browsing creates no extra
simulation Workers. Hidden cards stop animating and load their sheets on demand.
Coat variants and the additional fierce creatures explain the difference from
the retained 196-species production roster. Addition dates use the completion ledger where it predates the first
committed species sheet; update dates use the ledger or active-bank addition. Regenerate the committed inventory explicitly with
`npx tsx scripts/build-animal-browser-dates.ts`; builds need no Git history.

Shared Realm authority now queues natural meal replacements for a randomized
60–120 seconds of simulation time. A new individual returns 512–1,024 world
pixels (32–64 tiles) from the meal, at least 512 pixels from every player, with
its own home/shelter. Social group and natural lineage survive; old hunt/target
state and old territory do not. Each full footprint must fit ready terrain,
water/land policy, elevation, props and other solid actors. Unsafe or unloaded
sites retry after five seconds; the catch itself need not wait for a birth site.
Player-created prey and ordinary deletions still have no replacement.

Pending returns are independent, bounded jobs (maximum 128) persisted as scoped
`meta` records through the ordinary SaveManager transaction. The meal tombstone
and queued birth commit together; the new actor and completed-job removal do too.
Pause stops countdowns. Reload restores them without restarting the delay or
resurrecting eaten actors. Jobs survive the hunter being removed. Reaching the
queue limit defers additional natural catches rather than silently losing births.
Game and embedded lab share these rules through Realm and the same raw behavior
inputs in scenario review identities. The other machine owns live deployment;
push publishes the implementation without claiming that it is already deployed.

Validation: 4,362 unit tests pass; five known Windows symlink/WAL failures,
static-files symlink fixture setup failure and ten skips remain. New tests cover
the randomized countdown, distant placement, retries, manual origins, the queue
limit, independent hunter lifetime, and real Realm save/reload through a complete
return. Family lineage tests now step the delay and verify the new home. Desktop
and 390px mobile browsing, actual animation/family/date sorting, the visible
selected gorilla, Canvas/GPU food chains and manual-prey deletion pass browser
checks. Typecheck/lint/build and isolated streaming readiness pass. The clean
animal snapshot retains 1,380 Workshop identities; concurrent vehicle work has
its own manifest refresh. Next: inspect the browser and return pacing on the live
machine after it pulls these commits, then tune timings if playtesting warrants.

## Focused gorilla shoulder review

On 2026-10-19 the owner requested clearer historical rejection labels and one
focused gorilla adjustment to inspect. The status generator now calls the eight
old visual failures **Previous draft rejected**, keeps their evidence, and shows
current blockers separately. Historical holds do not describe the latest banks.

The [shoulder study](../../art-source/wildlife-v2/gorilla/shoulder-study-v1/README.md)
lowers the shoulder contour and replaces the raised silver cap with a closed
patch conforming to the actual torso surface. The existing fixed-volume limbs,
planted knuckle gait, body weight transfer and alternating chest beat are retained.
It has a separate pending review identity and preserves `roster-v2` gameplay.
This explicit request is independent of the expired eight-hour authorization.
The [study record](../../art-source/wildlife-v2/gorilla-shoulder-study.json) owns
its current state. The owner called the shown shoulder animation “Acceptable.
Good.” on 2026-10-19; the Workshop decision record remains independently owned.

Validation: the new bank replays ten artifacts byte-for-byte; both old and new
gorilla receipts pass all 25 artifact checks each. Saved-scene checks retain
2,112 fixed walk links, 416 ground contacts and 1,088 chest-beat links. Full
Chromium verifies 392 exact crops at native/3x; all four Workshop browser cases
pass, including this new candidate at retina scale. Typecheck/lint/build and
1,380 manifest identities pass. Full units: 4,379 pass, ten skip; the five known
Windows symlink/WAL failures and static-files symlink setup failure remain.

## Completed eight-hour completion run

Window closed at 04:05 UTC after eight hours. 122/196 entries are implemented:
106 added/repaired in this run and sixteen preserved; 74 remain queued. There
are no unfinished in-progress entries. All verified work is committed locally.
New art remains pending human review. Final typecheck/lint/build, 1,379-candidate
manifest, 60 distinct browser cases and streaming readiness pass. The full unit
suite has 4,338 passes, the five known Windows failures and ten skips. All 106
new receipts retain their exact bytes (3,185 checks across 2,359 unique files).
See the tactical/ledger for remaining families and the next continuation scope.

The owner explicitly authorized all remaining animals in the retained
196-animal list, autonomously for up to eight hours. That window has ended. [140](../tactical/140-autonomous-wildlife-completion.md)
owns this run (2026-10-18 20:05:24 UTC to 2026-10-19 04:05:24 UTC) and its
[tracked ledger](../../art-source/wildlife-v2/autonomous-140.json). Start with
sheep/pig and the remaining frozen-torso repairs, then unfinished families.
The accepted horse/giraffe work sets the motion/connection standard. This latest
authorization supersedes historical expansion and sequencing holds for the run;
old campaign records remain history, and exact banks/human art review ownership
stay immutable. Commit completed verified batches; report incomplete work
honestly at the deadline. No claim that every remaining species fits in eight hours.

Sheep and piglet now use repaired `motion-v2` banks in the game and lab. Their
32-pose walks retain the original coats/scale, move the torso/head and carry
connected fixed-volume cloven limbs through planted steps. Native paint moves
2px in each facing; root travel matches their existing movement speeds. Both
source replays and 328 native/enlarged Chromium crops pass; six shared game
checks pass. These exact finished identities await human art review. Deer and
goat also use repaired banks, retaining the doe tail flag and goat horns/beard.
Their 960ms walks match 18px/s; source replay and six game/browser checks pass.
Cow and fox also use moving-body repairs, retaining their original coats and
actions. Their 1.6s/640ms cycles match 12px/s and 22px/s; source, playback and
six shared game checks pass. Cat and dog now also have repaired torso/limb
motion, separate source-driven coat paint and retained face templates. Their
640ms walks match 16px/s and 22px/s. All 18 base/coat browser checks pass; the
four existing coat banks own their clip ranges independently of base repairs.
Elephant now completes the frozen-torso queue: broad column limbs, moving
paint and its retained trunk/tail action; 1.6s walk at 14px/s. Source/replay,
playback and three game/browser checks pass. The eleven other existing banks
were inspected read-only and retained; [preservation observations](../../art-source/wildlife-v2/autonomous-140-preserved.json)
pin their original hashes. Nine repairs and a fresh buff hen now complete ten new entries; sixteen were
already delivered, leaving 170 remaining. The hen has a two-legged planted
walk and peck, and spawns through a separate fixed expansion bank. New profiles
leave existing habitat owner selection intact; the shared world/editor/lab
consume the same definition and ordinary natural-origin meal policy. Ground-
bird source/playback, three game tests and streaming readiness pass. Butterfly also now spawns as a fresh orange/black/cream flutterer. Shared
physical short flights land/rest between trips and preserve midair save phase.
Spiders can hunt it after landing; catch resolution rejects jumpZ above 1px.
Natural replacements retain lineage and placed butterflies remain finite.
Source/replay/crops, seven game/food-chain browser tests and the final full
unit rerun pass apart from the five documented Windows failures. Red squirrel now also spawns with a physical bound, connected curled tail
and held-nut feeding. It is explicit small prey for the existing predators.
Source/replay/crops and three game tests pass; the full suite retains only
the five known Windows failures. Gorilla now also spawns as a fresh silverback:
connected diagonal knuckle walk, moving chest and 16-pose chest-beat display.
T. rex and dragon explicitly include it as prey. Independent source/replay,
392 exact playback crops and three gorilla game checks pass. A new land-profile
admission regression protects original water refuges; six existing aquatic
browser checks and streaming readiness also pass. The full suite has 2,881
passes and the five known Windows failures. Crab now also spawns in compatible
ponds/lagoons through a fixed 42-species aquatic expansion pool. Its eight
connected walking legs carry a moving shell sideways; the shared body-facing
map preserves local +X travel and saved phase in all four world directions.
Original water actors retain identity/position/RNG, and small ponds separate
crabs from the existing fish school. Bears explicitly include crab as prey.
Source/replay/crops, nine aquatic/game browser checks and streaming readiness
pass; the final full suite has 2,899 passes and the five known Windows failures.
Octopus now also spawns in compatible deep lagoons. Its rust mantle moves
above eight five-link arms with source-driven sucker marks and a curl action.
Source/replay/crops and three game/browser checks pass; the full suite has
2,910 passes and the five known Windows failures. Its deep-water lab uses
.4 inspection zoom to include both dry arrival and animal. Jellyfish now also
spawns as small deep-water groups. Its closed Blender bell actually deforms
with reciprocal radial/height factors, preserving volume and attached rim
arms. The native silhouette changes four pixels across the 1.28s pulse.
Source/replay/crops and three game/browser checks pass; full units have 2,921
passes and the five known Windows failures. Wolf, coyote and spotted hyena
now also spawn as distinct natural hunters with their own 32-pose walking and
chasing strides, feeding/jaw motion and warning displays. Existing hunter banks
keep their original clips. Fixed expansion slots own new natural clearings and
small legal prey groups; real generated populations hunt and preserve replacement
lineage through reload. Explicit food-web tiers allow larger predators to eat
these hunters. A player-placed wolf eaten by T. rex remains gone after reload.
Calls are distinct bounded synthesizers and footsteps use the shared weights.
Source/replays and 1,944 exact crops pass; ten world/lab browser checks and
streaming readiness pass. Full units have 2,971 passes and the five known Windows
failures. Donkey, mule, llama and alpaca now also spawn as distinct pasture
groups. Their independent two-link necks carry the head through grazing above
planted limbs, with retained native jaw motion. Native silhouette review led
to longer llama/alpaca necks and a clearer grey donkey coat. Donkey and mule
ride through shared mount code at 64/80px/s; riders remain protected prey.
Source/replays and 1,312 exact crops pass. Twelve Canvas/GPU/body/ball browser
checks, streaming readiness and the 964-candidate manifest pass. Full units have
3,023 passes and the five known Windows failures. Jaguar, leopard, cheetah,
Eurasian lynx and bobcat now also spawn and hunt with distinct coats, anatomy,
tails and feeding/growling jaws. Separate walk/chase travel matches runtime;
cheetah reaches 64px/s. Canonical diets determine their local natural prey.
Five byte-identical replays, 3,240 exact crops, fifteen browser cases and streaming
readiness pass. Typecheck/lint/build and the 989-candidate manifest pass. Final
full units: 3,104 pass, five known Windows failures, ten skipped. Crossing and
world-reopen checks use 15-second integration allowances after initial render-
load timeouts; isolated and final full reruns pass. Twenty-eight new entries
plus sixteen delivered leave 152 remaining. Six horned grazers begin next.
Gemsbok, gazelle, impala, springbok, saiga and gerenuk now also spawn in natural
herds with distinct horns, coats, skulls and articulated grazing necks. A fixed
seven-species companion bank gives hunter clearings varied legal grazers through
canonical diets. Generated meals/lineage reload and twelve natural/manual
antelope catch cases pass. All six replays and 1,968 exact crops pass, alongside
24 game/browser cases, streaming readiness and the 1,019-candidate manifest.
Typecheck/lint/build pass. Full final units: 3,195 pass, five known Windows
failures, ten skipped. Initial concurrent-load Workshop timeouts pass isolated
and in the clean full rerun; finish inventories before tests and avoid heavy
render jobs during HTTP validation. Thirty-four new entries plus sixteen
already delivered leave 146 remaining. Four heavy bovids begin next.
American bison, water buffalo, musk ox and wildebeest now also spawn as distinct
heavy herds with fixed articulated necks/limbs, swept horns and separate coats.
Four source replays and 1,312 exact crops pass. A generated buffalo landing
exposed stale herd-alarm echoes; shared fauna now broadcasts the brief startle
display rather than an ongoing escape. The regression rejects old behavior and
passes the fix. Existing herd fixtures sample the display through bounded ticks.
Sixteen browser cases are covered, with all eight motion cases rerun after the
fix. Typecheck/lint/build, 1,039-candidate manifest and streaming readiness pass.
Full final units: 3,248 pass, five known Windows failures, ten skipped. Thirty-
eight new entries plus sixteen delivered leave 142 remaining. Zebra, okapi,
camel, panda and polar bear are underway. New mounts must be reachable with a
normal ground jump; verify donkey/mule support heights during camel integration.
Zebra, okapi, camel, panda and polar bear now also use fresh world/editor/lab
banks. Actual source ribbon quads and articulated limb/neck markings distinguish
the striped grazers; camel has its own hump, lips and padded toes. Panda forages
with jaw-attached bamboo and keyed source visibility; polar bear hunts local
natural prey, retains lineage through reload and has a bounded original growl.
Five source replays and 2,280 exact crops pass. Default ground jumps board
camel and the earlier donkey/mule: their back supports now use reachable
20/18/20px heights. Riding keeps species speeds/phase and reloads correctly;
mounted animals remain protected prey. Earlier source banks stay immutable.
Typecheck/lint/build, 1,064-candidate manifest, 23 browser cases and streaming
readiness pass. Full final units: 3,320 pass, five known Windows failures,
ten skipped. Forty-three new entries plus sixteen delivered leave 137 remaining.
Moose, elk, rhinoceros, warthog and hippo now also use fresh world/editor/lab
banks. Antlers, horns, tusks, cheek warts and independently counted toes distinguish
their anatomy; all retain fixed linked limbs and visible torso/head motion.
Hippo opens its linked jaw and uses pond-only bottom walking; amphibious
transitions are not implemented. Five source replays and 1,640 exact crops,
twenty browser cases, typecheck/lint/build and streaming readiness pass.
Full bounded units: 3,383 pass, five known Windows failures, ten skipped;
initial unbounded contention timeouts disappear with two test workers.
Forty-eight new entries plus sixteen delivered leave 132 remaining.
Shark, hammerhead and orca now also hunt in deep lagoons. Their rigid bodies,
fixed tail chains, attached fins and linked jaws have independent swimming,
feeding and pursuit clips. Native countershading follows source surface faces.
Complete collider footprints constrain shared hunting paths and replacement
predators to deep water; existing land hunters keep dry paths. Fixed lagoon
slots add nearby legal natural fish while preserving earlier water owners.
Explicit diets permit orca to eat either shark; no reciprocal cycles. Generated
fish meals persist replacement lineage and feeding pose through reload; placed
fish stay finite. Three source replays, 1,944 exact crops, nine browser cases,
typecheck/lint/build and streaming readiness pass. Full bounded units: 3,405
pass, five known Windows failures, ten skipped. Fifty-one new entries plus
sixteen delivered leave 129 remaining. Mouse, rat, hamster, guinea pig,
chinchilla, hedgehog, porcupine, raccoon, skunk and red panda now also use fresh
world/editor/lab banks. Anatomy includes distinct cheek pouches, ears, quills,
masks, stripes and tail shapes; tail rings follow source surfaces. Quills are
closed 3D volumes, and limb roots remain buried through motion. Each has 164
poses with at least 1px of native torso motion and matched planted travel.
Ten source replays, 3,280 exact crops, forty browser cases, typecheck/lint/build
and streaming readiness pass. Full bounded units: 3,553 pass, five known Windows
failures, ten skipped. Wild prey retain natural-only replacement; domestic
hamster/guinea pig are protected. Sixty-one new entries plus sixteen delivered
leave 119 remaining. Ostrich, emu, cassowary, kiwi, kakapo, wild turkey and
peacock now also use fresh world/editor/lab banks. Planted biped legs, moving
bodies, fixed linked necks and attached wings retain distinct bills, casques,
coats, toe layouts, wattles and feather fans. Quarter-pose source keys and a
stable neck bend plane keep eighth-pose joins within .079 native px. Peacock
spreads sixteen fixed feathers; turkey opens a banded fan. Ground locomotion,
foraging/display and escape are active; no new airborne controller is added.
Seven source replays, 2,296 exact crops, twenty-eight browser cases,
typecheck/lint/build and streaming readiness pass. Full bounded units: 3,644
pass, five known Windows failures, ten skipped. Corrected review wrappers for
thirteen ocean/small-mammal galleries replace generic grazer copy while keeping
immutable banks unchanged; 5,224 exact wrapper crops and controls pass.
Sixty-eight new entries plus sixteen delivered leave 112 remaining.
Six marine sources are underway.
All exact new identities remain pending human art review.

## Horse and giraffe motion

The owner rejected the old horse/giraffe animation's frozen body and disconnected
legs, then authorized a horse-first slow side-view clay prototype in
[139](../tactical/139-horse-motion-study.md). The separate `horse/motion-study-v3`
source moves the torso, carries buried shoulder/hip articulation with it and
uses distinct fore/hind joint solves with fixed lengths and planted hooves.
Side, world travel and four unchanged native game projections are under review.
The owner accepted the prototype in chat on 2026-10-18 and explicitly authorized
finishing both animals and committing them. New `horse/motion-v2` and
`giraffe/motion-v2` retain the existing coats, sizes, anchors and physical bodies,
with source-driven body/head paint, articulated limbs and grounded stance.
The shared game/lab profiles select these repaired banks. Horse walk covers
32px in 1.6s at 20px/s; giraffe covers 44.8px in 3.2s at 14px/s, with paired
lateral footfalls. Flee and riding retain their ordinary proportional timing.
The prototype's chat acceptance does not invent a Workshop vote for changed
finished pixels; new exact identities remain pending human review. Other
historical species holds and immutable original banks remain unchanged.

## Fierce creatures and natural-only replacement

The owner explicitly authorizes T. rex, small dragon, dire wolf, griffin and giant
spider, their distinct behaviors and cross-species hunting in [137](../tactical/137-fierce-creatures-and-food-web.md).
The [fantasy manifest](../../art-source/wildlife-v2/fantasy-batch.json) tracks only
these five; historical campaign/repair holds stay active and art approval remains
human-owned.

T. rex is now available in the world, editor and shared Worker lab. It roars and
scatters edible prey, winds up, makes a bounded 88px/s charge, feeds and rests.
The explicit `FoodWeb.ts` catalog covers every recognized wildlife species and
defines predator-to-predator meals, including T. rex eating wolves; players,
companion cats/dogs, following and ridden animals stay protected. Smaller
predators abandon their own hunts and escape. The lab's **Who can eat whom?**
table exposes the rules. Spatial synthesized calls and weight-scaled footsteps
share game/lab audio code. Its 164-pose source/portable pending review reproduces
byte-for-byte. The small dragon now adds a guarded, durable treasure hoard,
return-home patrol, crouched/curl-tail sleep and smoky warnings. Visitors wake it
without becoming prey. Hoards are ordinary editor props, created once per owner;
deleting one remains durable. Its 196-pose body and separate accessory recipe
have a portable pending review and exact replay.

Dire wolves spawn in stable three-member packs, howl, share valid prey and flank.
Natural replacements preserve pack membership. Griffins add collision-owned
swoops, durable rock perches, tree/rock return, mid-flight reload and landing on
supports edited into a descending path. Giant spiders wait at durable floor
webs, warn and scuttle after nearby small
prey; natural web clearings include two natural rabbits. Hunters wait for a
rabbit to land before pouncing. All five authorized creatures now spawn
naturally and are independently editor-placeable. Pack and natural/placed
food-web lab compositions expose live shared-authority ecology; 137 owns evidence.

Meal replacements now require known world origin: `proceduralId` identifies
existing generated animals and durable `naturalSpawnId` carries that lineage
through their offspring/reloads. Player-created animals have neither and are
eaten without replacement, even when no safe replacement position exists. Natural
meals still defer until a safe replacement exists. Ordinary deletion never
respawns an animal. Unmarked offspring from old saves are not guessed natural.
This supersedes the unconditional meal-replacement contract from 132.

## Entity picker visibility

The Entities placement palette uses **88 × 76px named tiles**, with an **80 ×
48px side-view preview** above an 11px caption. Four-direction animal sheets use
the right-facing row; older one/two-row animals, resources and legacy people keep
their existing first-row poses.
Transparent animation/anchor margins are trimmed only in the thumbnail, and a
slate background keeps dark animals visible. Names remain visible after assets
load and truncate with ellipses when long. Existing full `Place … (click map)`
accessible action names and hover titles remain stable. Tile wrapping stays inside the existing scrollable half-screen panel;
mouse, touch and controller selection keep the same placement action. Source
sheets, world facing, world size and anchors retain their existing contracts.
Desktop (1280px) and phone (390px) browser checks cover every entity's visible
fill, side-facing proportions, readable name placement, ellipsis styling and
button bounds, plus actual selection. Existing mobile-editor checks cover
scrolling/minimizing and placement.

Validation, 2026-10-24: all **6,821 native tests**, Node integration and **838
full-Chromium browser tests** pass. The 11 focused picker, mobile-editor and deer
creation/deletion/reload checks pass. Typechecking, lint (existing warnings),
production build, refreshed art catalog and all **1,980 Workshop candidate
identities** pass. Desktop and phone captures were visually inspected. Source
images and exact artwork identities are unchanged.

## Authorized predators and eaten-prey replacement

The owner now authorizes tiger hunting and nearby replacement of eaten prey,
then panther, lion and brown bear with their own art, world spawning and shared
hunting. [132](../tactical/132-predator-hunting-and-replacement.md) owns stages and
validation; [the predator manifest](../../art-source/wildlife-v2/predator-batch.json)
tracks the completed implementation batch. Tiger, panther, lion and brown bear
now share world/editor/Worker hunting and safe prey replacement. Use **Wild tiger**
in the editor for the quadruped; the older upright Tiger character remains. All
four art reviews remain pending. Replacement applies only to predator meals, one new
same-species individual per eaten prey. Ordinary deletion stays durable. This
supersedes the no-replacement rule only for this explicit event, and opens these
four predators only; historical repair/campaign holds and art review remain.

## Proposed predator and prehistoric batch

On 2026-10-18 the owner said “ok do tiger then,” authorizing the first natural
quadruped tiger pilot in 131. The bounded [tiger manifest](../../art-source/wildlife-v2/tiger-batch.json)
owns its status. Use the proposed elephant-style Blender/pixel workflow and
independently inspect source-driven weight transfer, planted feet and fixed
volumes. This authorization creates a tiger-only exception; the sheep/pig repair
gate, historical campaign and other new-species holds remain active. Gameplay
integration is a later slice.

Tiger `pilot-v1` now retains an editable 46-mesh Blender source, palette masters,
96px four-facing sheet and portable native animation/review evidence. Its idle,
12-frame walk and eight-frame sniff/display clips total 116 poses. Saved-source
audit passes 1,392 fixed-link checks, 432 planted contacts and 160 stance/travel
checks. Body rise survives native finishing (1.455–1.595px projected range).
Fresh replay reproduces nine sprite/metadata/player artifacts byte-for-byte;
bundled full Chromium verifies all 29 chronological states at native/4× size,
including 232 exact facing-crop checks. The new `wildlife-v2-tiger-131` Workshop
batch is pending; no human approval or natural spawning is implied. `check-tiger.mjs`
verifies its exact receipt without changing historical campaign gates. Tactical
131 and the retained source README own delivery details and remaining limits.
Final typechecks, lint, build, 19 historical gate tests, exact receipts and
normal-Chromium manifest parity pass; all 811 prior fingerprints remain exact.
The full browser run passes 610 with 23 failures in unchanged layout/gameplay/
reload cases and one optional skip; all wildlife and tiger review/player checks
pass. Full units pass 2,617 with five Windows filesystem/process failures plus
two timeouts that pass on the focused one-worker rerun. See 131 for limitations.

The owner's 2026-10-18 planning request covers lions, panthers, tigers, bears and
possibly T. rex. [131](../tactical/131-predators-and-prehistoric-creatures.md)
proposes a tiger-first Blender/pixel pilot, subsequent big cats, a separate bear
family and an optional prehistoric biped pilot. Output format and gameplay tone
remain discussion points. This is planning only: existing production scope,
motion holds, immutable revisions and human review decisions remain unchanged.
The historical natural bear failed visual inspection; upright Tiger/Brown Bear
characters do not substitute for these proposed quadrupeds.

## Horse riding

Landing on a horse's back now mounts it through the existing Realm mount path.
Its 34 × 14px ground footprint is unchanged; physical support is 18px above its
feet, so a normal jump with default gravity reaches the back. The taller head
remains visual. Nearby ground landings do not mount horses, and one player owns
the mount at a time. Other wildlife keeps its ordinary standing/startle behavior.

Movement controls steer at 160px/s (2.5× ordinary walking), or 320px/s with Sprint.
Shared authority/prediction uses ordinary solid/water/terrain collision, native
direction rows and faster existing walk frames. Wildlife travel and alarms pause
while ridden; Jump gets off, suppresses immediate remount and resumes wildlife
around the actual dismount position. Rider identity/height survives save/reload.
The game and the natural Worker playground share these rules; **Hop onto Horse**
now boards rather than starting an escape. No artwork or recorded human decisions changed.

Regression coverage: `HorseRiding.test.ts`, the horse cases in `FaunaBodies.test.ts`,
`tests/horse-riding.spec.ts` and the Canvas/GPU horse cases in `tests/fauna-gameplay.spec.ts`.
The keyboard browser check stages the nearby horse with the existing debug pause,
then resumes and delivers Jump/movement through the normal keyboard handlers in
one browser task. The horse starts inside its 38px alarm radius; waiting for
editor exit on slow CI otherwise lets it flee before the jump. A 1.2-second
handoff reproduces the failure in both renderers; ten delayed checks pass with
the staged setup (2026-10-12). Gameplay and startled-horse unit coverage are unchanged.
The fixture also removes randomly seeded solid chickens through editor commands:
the [CI failure capture](https://github.com/kzahel/tilefun/actions/runs/38291733989)
shows one overlapping the horse's path, consistent
with its unchanged X despite a 160px/s commanded velocity. A full-suite prediction
recovery capture independently showed the same chicken obstruction. The riding,
speed, travel and dismount assertions remain unchanged (2026-10-12). Staging a
chicken at the horse's front reproduces the exact CI result in Canvas and GPU
(X remains 28, expected greater than 58); both forced-obstruction checks pass
with the fixture cleanup.
All twelve repeated horse/frog checks (three per fixture and renderer) pass after
both corrections; typechecks, lint, build and all 2,627 unit tests also pass.
Robin reopening
checks the manual actor's persistent identity and the deleted generated actor's
tombstone instead of a total count that varies with streamed nearby populations.
Aquatic ball-hit fixtures start 75px away, within a minimum-force throw's first
descending arc; at 100px the ball can splash before reaching the small fish body.
Typechecks, lint, production build, 2,244 units, seven focused browser checks and
all six streaming readiness phases pass. Mounted screenshots were inspected in
the game and natural playground. Production-table refresh was attempted after
persisting this checkpoint, but ignored `data/wildlife-campaign-v2/progress.json`
is absent; the existing production table and art-review state remain intact.
The full browser run passed 531/533. Its two car tap-to-drive failures pass on the
isolated staged build without the pre-existing touch-control edits; horse cases
and all other browser checks pass. The scoped build and both generated inventories
also verify independently of those unrelated edits.
Next: playtest mounting approach and riding/sprint speeds on touch controls.

## Robin CPU follow-up

[085](../tactical/085-robin-search-cost.md) removes whole-actor copies from robin
path samples and unnecessary crown discovery during safe timer waits in the
shared game/lab AI. Existing motion/RNG/candidates and current-tree alarm rules
are preserved. All 480 decision traces and 55,740 occupancy samples match the
original; warmed desktop decision CPU is approximately 42% lower. Phone A/B is
pending foreground availability. All 2,108 units and seven focused game/lab browser
checks and six-phase streaming readiness pass. Production-table refresh cannot
run because ignored campaign progress is absent in this checkout; retain the last
validated table and review state.
[088](../tactical/088-wildlife-work-budgets.md) now supplies shared contact-aware
wildlife sleep and bounded robin candidate/path work. These runtime quotas change
which fully checked candidate is selected; the earlier parity result covers only
085's unbudgeted allocation optimization. The phone capture establishes the old
offscreen cost; new physical moving-gameplay timing remains follow-up. Final runtime validation
passes 2,133 units, 18 focused browser reruns and streaming readiness. Two full-suite
review fixtures still require absent historical fox archives; feedback fails closed.
Art production, review decisions, individual generation and saved phases are
unchanged. [Performance](performance.md) owns whole-tick measurements.

## Shared planning scheduling

[113](../tactical/113-shared-ai-planning.md) extends the deer pilot to all six native
AI families, including every common fauna/pet profile, under Realm-owned cadence,
shared bounded search work and aging admission. Generic ambient wander uses the
same gate; immediate alarms, native motion, following/chase/route steering and
contact physics retain their existing rates. Cohesion is sensed only for admitted
goals. Desktop regressions and native game/lab checks pass across the full roster;
113 records bounded burst measurements, final waterline checks, streaming
readiness and a GPU upload-test flake reproduced on original source. Production-table
refresh was attempted after persisting this checkpoint; ignored campaign progress
is absent in this checkout, so the last validated table is retained. Art production,
frozen snapshots and human review decisions remain unchanged.

## Common pets: bounded resumption

On 2026-10-10 the owner requested recording familiar-animal/variation ideas,
proceeding with cats and dogs, and committing incrementally. [084](../tactical/084-common-pets-and-variations.md)
owns ginger tabby, black cat, golden retriever and pointed-ear shepherd drafts,
corrected source-driven body/hip motion, exact pending Workshop review and
reuse of existing pet gameplay. This supersedes the older no-variant rule only
for this named batch. The generic 196-entry campaign remains disabled, and its
sheep/pig repair gate is not cleared by pet work. Existing frozen revisions,
receipts and human review decisions remain unchanged.

All four new exact drafts are registered in `wildlife-v2-common-pets-084`, with
editable sources, motion audits and native playback. Fresh settlement greens
choose seeded coats independently of their stable cat/dog family IDs. Rural
habitat ownership and all original art remain intact; older saved chunks are
not backfilled. **Edit → Entities** creates durable individuals of each new pet.
The four new Worker inspection cases use real settlement populations and share
game AI, collision, support, saved phases and harmless reactions. Native gait
speed follows each new sheet's authored stride; art is still pending human review.
084 is complete and retains source/capture and validation evidence. Its full
browser run passes 499 cases, including all wildlife/settlement checks, with
four unchanged phone-review/GPU diagnostic failures and one optional capture
skip. All animal units, typechecks, lint, build, inventory/parity checks and
six-phase streaming readiness pass. The full Windows unit run has five unrelated
symlink/process-kill harness failures; 084 records their exact limits.

Live follow-up on 2026-10-10: the shared origin still serves the earlier fauna
module, without `PetVariants.ts` or the four new draft assets. Local delivery is
complete; live checkout synchronization is still needed before reviewing these
four drafts at the shared origin. Missing draft JSON paths currently return the
Vite HTML fallback. A fresh live game loads successfully; the owner's phone JSON
parse error has not yet been reproduced or attributed to a specific request.

The [ideas backlog](../ideas.md#living-world-and-inhabitants) records common birds,
garden insects (especially bees), small animals, farm/pond additions and further
coat/breed/age variations. These are suggestions, not authorized production.

## Autonomous completion of existing gameplay roster

On 2026-10-09 the owner authorized integrating all 17 remaining existing drafts,
autonomously, with a written tracker and incremental commits. [082](../tactical/082-complete-provisional-wildlife.md)
owns slices A–E and per-species completion/evidence. This continues provisional
gameplay with unchanged art: fox; cat/dog and five pasture animals; elephant,
giraffe, kangaroo, cobra and ants; fish, penguin, seal and ray; final habitat and
regression pass. Five existing implementations stay intact. Durable seeded
individuals, suitable accessible homes, varied native cycles, shared game/lab
behavior, manual creation, harmless reactions and no automatic bounce remain the
contract. Art production/approval holds are separate and unchanged.

All 17 remaining species are integrated and committed: fox; cat, dog, cow, sheep,
horse, pig and goat; elephant, giraffe, kangaroo, king cobra and ant; pond fish,
penguin, harbor seal and manta ray. Together with duck, frog, rabbit, robin and
deer this completes the **22-species existing-sheet roster**. Zero animals remain
in this authorized scope. Shared profiles preserve species-specific bodies,
speeds, spacing, grouping, native walk/hop/swim/action clips and saved phases.
Kangaroo has physical timed push/flight/landing; penguins/seals change gait at
resolved shores; fish/rays follow full-body water/depth constraints. Existing
five gameplay implementations remain intact.

Regional homes reserve appropriate dry clearings, ponds and rare broad water
refuges with accessible sandy shores, outside infrastructure and protected dry
homes. Four production seeds admit every added dry species plus water refuges;
planner caches remain bounded. Species need exploration: this does not promise
every animal beside every starting area. Saved chunks are not backfilled.
**Edit → Entities** exposes all species for durable manual creation. Individuals
seed once, retain activity/RNG/motion across return/reload and remain deleted when
removed; no automatic respawn or offscreen catch-up. Approach, landing and balls
cause bounded harmless escape/recovery. Player standing never receives a bounce.

[Inspect the water refuge](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-manta-ray&landscape=thicket#/tool/world-geometry)
at seed 2026, -656,-2997;
[inspect kangaroos](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-kangaroo&landscape=thicket#/tool/world-geometry)
at -21,-22. These are shared in-memory production Worker scenes with native
framing, Pause, Save / reload and contact controls. 082 lists all species arrivals,
captures, incremental commits and detailed validation.

Final evidence: **2,031 units**, typechecks, lint, inventories/build and six-phase
streaming readiness pass. All 70 added-profile/scene-switch browser checks pass.
Complete browser suite: **476/479** (18.4m), with all wildlife regressions passing.
Failures are the two known archived fox-preview reviews and intermittent Canvas
train roof-support loss after reopening; the unchanged isolated complete train
journey passes in 1.5m. GPU journey and phone ride pass. The train topic retains
this unresolved intermittent evidence. The earlier close-camera duck recovery
probe was strengthened to require the same present, grounded, recovered duck;
both renderers pass. No duck physics changed. All 27 exact wildlife review
objects, frozen pixels, receipts and approval events remain unchanged.
At 082 completion the production-table helper lacked ignored campaign state.
084 now has the retained local progress state and refreshes the table while
preserving historical art counts/holds and tracking the four pets separately.
Next gameplay work is density/habitat/activity playtesting, separate from
existing art motion holds.

## Settlement pets and farm residents

[083](../tactical/083-farms-town-pets-and-larger-cities.md) adds one seeded cat and
one dog per settlement green, alongside small mixed cow/sheep/goat/pig pastures
at admitted farmsteads. They reuse the delivered native profiles, shared AI,
records and harmless reactions. A saved optional `habitatBounds` rectangle in
world pixels constrains the complete physical footprint along routine and escape
paths, keeping pets in pedestrian-safe yards/greens away from road traffic.
Initial positions avoid existing green furniture and each other. Manual animals
keep their own ordinary homes; generation does not add respawns or catch-up.
Deletion and exact individual phase/RNG survive reload. New profiles explicitly
start at ground height zero, including individuals frozen outside active support.
The village/city pet scenes and farm scene use production regional populations.
083 is complete: final full units and native animal/settlement gameplay checks
pass, including bounded homes, motion/contact, saved phase and deletion. Its
completion record retains the two known immutable art-preview failures and the
missing ignored campaign-progress file that prevents production-table refresh.
Art motion holds remain unchanged.

## Provisional woodland deer

The owner accepted the robin grove and authorized deer on 2026-10-09.
[081](../tactical/081-durable-woodland-deer.md) implements the unchanged adult doe
`draft-v1` drawing-03 / walk-tailflag-01: native 48px cells, anchor 24,36, idle,
12-frame walk and eight-frame ear/tail alert action at 100ms. A provisional brisk
escape reuses the same grounded walk at 50ms with twice the movement speed
(36px/s versus 18px/s). There is no invented gallop, airborne gait or new art.
Art remains pending human review, separate from gameplay availability.

Two or three seeded individuals share a glade/herd identity, with separate saved
per-member RNG, targets, timers and activity. They pause, walk and play quiet
alert cycles, loosely favor company and share nearby herd alarms. Generated homes
have a 112px radius, with target margins for normal separation. Approach within
38px, landing contact or balls produce one alert, a 48–80px bounded grounded
escape toward accessible cover, then three seconds of recovery. Repeated hits
never restart it. A mid-walk alarm preserves the committed walk before fleeing;
closed habitat settles in place. Paths reject water, collision, abrupt height
changes, occupied landings and escapes toward the threat. Normal collision owns
actual XY, and edited obstacles stop the animal at its real resolved position.
There is no forced arrival teleport or upward player impulse.

Wider glades reserve scattered-tree clearance while preserving solid forests,
pond banks, roads/rail and rabbit homes. Same-seed stable world/glade/member IDs
seed only new eligible chunks; ordinary records retain moved/manual individuals
and deletion across visits/reloads. No timers replace populations, no offscreen
time catch-up and no backfill of already seeded saved chunks. **Edit → Entities →
Deer** creates a saved individual; manual deer have their own home and no implicit
herd assignment. Native timed walk/flee frame phase is saved and replicated.

[Inspect the deer glade](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-deer&landscape=thicket#/tool/world-geometry):
in-memory production Worker at seed 2026, -164,-460 tiles, beside deer-glade:-3:-8.
Pause, Save / reload scene and **Hop onto deer** use common game/lab behavior.
Headless checks cover habitat/seams, group alarm/cohesion, dry grounded movement,
mid-walk hydration/binary phase, closed/edited paths, balls and ordinary standing
in authority/prediction (with/without player input). All 1,808 units, typechecks,
lint and build pass. All 22 focused wildlife browser checks pass, also passing
inside the full **406/409** run (13.5m). Two known archived-preview art failures
remain. Canvas train riding loses roof support on the onward post-reopen leg
(expected 44px, received 43.583168px); its isolated complete-journey rerun passes
in 1.5m. GPU and phone train checks pass in the full run. No train behavior or
assertion changed; the train topic retains this intermittent evidence. Isolated
streaming readiness passes all six phases with zero final missing/incomplete/stale
caches, errors and failures (functional Canvas evidence). 081 records details. Catalog: 220 sheets / 1,065 source uses; manifest:
657 verified candidates, all 27 exact wildlife review records unchanged. No new
art production or approval is implied. The art table's ignored campaign state
remains absent; checkpoint and completion refresh attempts preserve the last
validated table.

## Provisional woodland robins

The owner authorized the next robin slice on 2026-10-09, including tree perching.
[080](../tactical/080-durable-woodland-robins.md) owns implementation and validation.
Unchanged draft-v2 drawing-03/motion-02 supplies native 32px idle/hop/flap/song
cycles (anchor 16,25; 120ms frames). This remains unapproved provisional gameplay.
Sparse individuals seed once beside eligible existing oaks with dry clear ground,
world/tree/member IDs, independent RNG and 112px home ranges. No timed replacement,
catch-up or backfill of previously seeded chunks; manual **Edit → Entities → Robin**
creates an ordinary saved individual. Deletions remain tombstoned.

The routine alternates grounded hops, quiet rests, short flights to tree crowns,
perched rests/songs and flights back down. Actual oak/palm crown walls supply
perches (32px/48px tops), including manually placed trees; moved/deleted trees
immediately change eligible perches and normal support tracking. No decorative
branch points or scenery-only collision is introduced. The normal shared depth
ordering keeps elevated birds visible above their tree. Native hops have a 0.24s
stationary push, 5px physical arc and landing/settle; flights take 1.6s with a
44px arc and looping native flap frames. Both use ordinary collision-resolved XY,
not teleports, and restore elevation/timeline/frame phase on hydration.

Approach, landing contact and balls queue one bounded escape followed by 2.5s
recovery. An alarm during motion preserves its trajectory before escape; repeated
hits do not restart it. Clear routes reject water, solid paths, occupied landings
and targets toward the threat; enclosed birds recover in place. Player landing
is ordinary support without an upward impulse; Jump remains explicit. The main
game plays a quiet provisional spatial three-note chirp on songs/startles.
Interactive labs intentionally remain silent.

[Inspect the robin grove](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-robins&landscape=thicket#/tool/world-geometry):
production seed 2026 at -163,-519 tiles, in-memory Worker world, with Pause,
Save / reload scene and **Hop onto robin**. Shared headless crown support, tree
edits, physical trajectories, binary phases, player contact with/without input,
no-bounce prediction and durable residency checks pass. All 1,795 unit tests,
typechecks, lint and build pass. All 18 focused wildlife browser checks pass,
including Canvas/GPU robin flight/perching, pause/reload, contact, ordinary balls
and manual creation/deletion. The full browser run passes **403/405** (13.5m):
all 18 wildlife checks and both complete city-train journeys pass; only the two
previous archived-preview review failures remain. The earlier intermittent train
failure did not recur in either renderer. Isolated streaming readiness passes all
six phases with zero final missing/incomplete/stale caches, errors and failures;
functional Canvas readiness evidence only. 080 retains the detailed evidence. Catalog contains 219 sheets / 1,064 source uses; manifest verifies 653
candidates, with all 27 exact wildlife review candidates unchanged. Art production
is still repair-only; the production-table helper lacks ignored campaign state,
so preserve the validated table rather than fabricate receipts.

## Wildlife support: no automatic player bounce

On 2026-10-09 the owner explicitly rejected trampoline behavior on every animal.
Wildlife bodies are ordinary solid support: landing completes at the body top,
clears player jump velocity and reports contact to authority AI. Standing never
adds a jump impulse. Players jump through the normal Jump input; an escaping
animal can move out from under them, causing an ordinary fall.
This supersedes the bounce introduced in 077–079, without changing animal startle,
ball ricochets, physical hops/flights, durable identity or population policy.
The rule is shared by prediction, input-driven authority and missing-input gravity.

Automatic landing impulses and their species constants are removed for
ducks, frogs and rabbits. Focused headless checks pass, including sustained idle
standing, explicit Jump, body blocking and contact/startle with and without input.
Canvas/GPU labs record maximum player vertical velocity after their controlled
landing to verify that an animal escape never relaunches the player.
Typechecks, lint, build, all 1,784 unit tests and all 14 focused wildlife browser
checks pass. The full browser run passes **398/401** (12.6 minutes), including all
14 wildlife checks and affected game/lab movement checks. Two previously recorded
archived-art review failures remain. The Canvas train journey lost roof support
on the onward leg after reopening; its isolated full-journey rerun passes, while
the full run's GPU train journey also passes. Both results are recorded in the
[train topic](trains.md#current-regression-evidence); no train test or physics was
changed. Isolated streaming readiness passes: cold, standing, walk, sprint,
reverse and zoom-out finish with zero missing/incomplete/stale caches. This is
functional Canvas/headless evidence, not a GPU frame-pacing claim. All 27 exact
wildlife review candidates remain unchanged. Art-table refresh was attempted after
persisted checkpoints and completion, but still lacks the ignored campaign state;
the last validated art table is preserved.

Local evidence: [unit log](/tmp/tilefun-wildlife-standing-unit.log),
[focused browser checks](/tmp/tilefun-wildlife-standing-browser-focused.log),
[full browser log](/tmp/tilefun-wildlife-standing-browser-full.log),
[streaming report](/tmp/tilefun-wildlife-standing-streaming/report.json).

## Provisional gameplay: durable pond ducks

On 2026-10-09 the owner requested populating wild areas with existing imperfect
assets, habitat support and baseline AI rather than waiting for perfect art.
They selected a first deep animal slice and prefer seeded initial populations
that persist, with manual creation instead of periodic replacement spawning.
This supersedes the previous prohibition on provisional gameplay integration;
it does not resume new-animal art production or invent human approvals.

[Tactical 076](../tactical/076-durable-pond-wildlife.md) implements the mallard
first: unchanged drawing-02 with idle, waddle, swim, flap and quack clips, open
pond banks, small seeded flocks, bounded home-area behavior and ordinary actor
persistence. The existing World geometry pond scene runs the same production
Worker behavior. Gameplay availability is provisional, distinct from the art
production receipts/table and Workshop approval states.

The duck-only delivery in 077 passed typecheck, lint, build, 1,760 unit tests, all six wildlife
Canvas/GPU/game browser checks and isolated streaming readiness. The full browser
run passed 389/393: two missing archived art-preview failures remain; a Canvas
train boarding check passes in isolation, and an initially single-shot duck test
now accounts for intentional throw spread and passes with a short aimed volley.
See 076 for initial integration history and 077 for current interaction evidence.

Generated ducks are seeded deterministically from world seed and pond identity,
with stable per-member IDs and owner chunks. On first residency they become
ordinary saved actors. Movement, home, destination, behavior timer and per-duck
random state persist; leaving an area freezes distant animals without elapsed-time
catch-up. Deleted individuals remain deleted. There is no replacement timer,
breeding or automatic population replenishment. Editor-created ducks persist too.
Ghost/baddie spawning remains its separate system. Same-seed reproducibility is
for the current generator, not historical landscape compatibility.
Previously seeded saved chunks are not backfilled; manual placement supplies ducks
there while new pond chunks receive their initial flock.

The owner subsequently requested physical/playful interactions. [077](../tactical/077-duck-contact-and-startle-flight.md)
supersedes 076's non-solid bodies: ducks now block body movement and support the player
when landed upon. The owner later removed the original automatic landing bounce.
The same landing rule runs in prediction and authority, including missing-input gravity. Landing or a ball hit starts a quack,
then a short bounded escape flight using unchanged flap frames. The duck settles
for two seconds before returning to its pond routine; repeated hits do not restart
the escape. If no clear destination exists, it quacks and settles in place.

The destination, flight timeline, elevation and identity survive save/reload and
residency. Normal collision still owns movement; landing uses the actual resolved
position rather than teleporting through a new obstacle. The ordinary game plays
a provisional synthesized quack on the replicated alarm transition. The pond lab's
**Hop onto duck** control uses the existing authority teleport/fall command and the
same production physics. Flight frame phase remains transient. The original ball
scare cancellation gap is resolved; launched balls also ignore their thrower's
collider until they clear it, avoiding an immediate self-hit at chest height.

Art checkpoint refresh was attempted, but this checkout lacks the ignored
`data/wildlife-campaign-v2/progress.json`. Preserve the last validated production
table rather than fabricate receipts; gameplay work/evidence belongs in 076/077.

For the whole-roster completion table and local animation links, see the generated
[production status table](../wildlife-status.md). Agents persist fresh progress
then regenerate it with `node scripts/wildlife/status.mjs` after task selection,
meaningful checkpoints, completion, blocking or receipt revision, and before final
handoff. Checkpoint helpers can call its exported `writeStatus()` automatically.
Rows come from validated receipt hashes; do not hand-edit them or infer readiness
from an attempt's existence. Its timestamp is explicit; reopen it to load updates.
The ignored background checkpoint remains the detailed live execution record.

The owner requested a fresh start after the stopped overnight campaign produced
flat animal views and shrinking head animation. The entire previous tracked
campaign is preserved on `backup/wildlife-low-20261004`, commit
`059124d0666139d52792f55657972d7d6b4fe64e`. Its ignored checkpoints/logs are
archived locally. They are historical evidence, not inputs to this campaign.

Use gpt-6.1-sol with high reasoning effort, explicitly pinned for every session.
The original owner authorization for whole-roster production is superseded by
repair-only scope below. This authorizes corrections, not human art approval,
publication or gameplay promotion. See [060](../tactical/060-wildlife-fresh-production.md).

## Provisional gameplay: pond frogs

The owner selected frogs next and requested implementation on 2026-10-09.
[Tactical 078](../tactical/078-durable-pond-frogs.md) records the slice and validation:
unchanged existing draft, seed-determined small bank populations, physical hops,
swimming, rest/blink cycles, spatial croaks and player/ball escape reactions.
They share the duck persistence policy (including no timed respawns), open-bank
habitat and editor creation. Their smaller body uses shared predicted landing
support. The in-memory pond lab adds **Pond · frogs & shallows** and **Hop onto frog**.
The slice passes 1,771 units, typecheck, lint, build, all ten frog/duck browser checks
and isolated streaming readiness. The full browser suite passes 395/397, with the
two previously recorded missing archived fox-preview failures. Gameplay evidence
is in 078; all 27 exact wildlife review candidates remain unchanged. No art approval
or new art production is implied. The rabbit follow-up is recorded below.

CI browser timing correction (2026-10-12): `tests/frog-gameplay.spec.ts` waits for
the **Hop onto frog** control's first eligible target to be resting, and retries
real landing attempts within ten seconds. A grounded pose alone can be a hop's
push-off or scared recovery; the control ignores scared/airborne frogs and can
have no eligible target. Clicking in that window reproduced the former escape-hop
assertion failure in both renderers. Three GPU runs with the same forced window
pass after the correction. The physical escape-hop, recovery and player-velocity
assertions remain intact; no simulation, art or review identity changes.

## Provisional gameplay: meadow rabbits

The owner accepted the next rabbit slice on 2026-10-09. [079](../tactical/079-durable-meadow-rabbits.md)
implements the unchanged existing pilot with physical native hops, quiet action
cycles, player/ball reactions, woodland-facing grassy glades and durable groups.
The same no-respawn/manual-creation policy applies: 2–3 seed-determined individuals
per admitted dry glade, no timer or distant catch-up, durable moved/manual/deleted
actors and saved physical hop phases. Rabbits reject water and obstacles, escape
away from threats toward accessible cover, and recover before returning to their
routine. Mid-hop alarms finish the original hop before an escape.

[Inspect the rabbit meadow](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-rabbits&landscape=thicket#/tool/world-geometry)
uses the same production Worker; **Hop onto rabbit** demonstrates shared body
contact and grounded support. Older saved chunks use **Edit → Entities → Rabbit**.
Typechecks, lint, build, all 1,784 units, all 14 wildlife browser checks and isolated
streaming readiness pass. Full browser suite: 398/401; two existing archived-art
failures and a GPU train roof-reopen failure that passes an isolated full-journey
rerun. See 079 for evidence and limits. All 27 exact wildlife review records remain
unchanged; art production and approval remain separate. Art-table refresh still
lacks the ignored campaign state. Next: owner rabbit playtest, then robins.

## Historical repair-only scope (bounded pets supersede it above)

The owner canceled new-animal work. The [repair scope](../../art-source/wildlife-v2/repair-scope.json)
freezes the22 already-produced draft IDs and lists11 existing walking quadrupeds
for inspection. The196-species roster remains historical backlog, not an active
production target. Unfinished entries are out of scope; partial/blocked attempts
remain evidence, without authorizing completion or unrelated fixes.

Order: sheep/pig corrections first, then inspect the other existing walkers.
Change art only where torso motion is frozen or disappears at native resolution.
Preserve appearance, scale, camera, palette and action states; change hips/limbs,
head follow and finishing only where necessary for the motion repair. Already
convincing motion stays byte-for-byte unchanged. Use new revisions for corrected
pixels. No new species, variants, companions or animation states.

The generic production queue/launcher stays disabled even after motion gates
pass, and registration rejects animals outside the repair list. `campaign.mjs
--repairs` lists existing unresolved candidates; it cannot select unproduced IDs.
Passing a sheep/pig gate authorizes only bounded existing-animal repairs, never
roster expansion. No worker is currently running; do not revive the old broad
background brief or the06:00 deadline as an authorization to produce new animals.

For an existing walk that passes inspection without changes, the coordinator
can record a separate `body-motion-audits.json` entry with observer=coordinator,
result=already-compliant, exact revision, receipt/contract hashes and concrete
weightTransfer observations. This clears its repair hold without modifying its
old receipt or art. Changed/corrected art still needs new revision receipts and
review. Agents may not claim these coordinator audits or alter the frozen scope.

Scope verification: nineteen queue/gate tests pass, including new-species
selection after all motion gates pass, candidates without existing receipts,
and unchanged-art coordinator audits versus worker/wrong-hash claims. Live
`--next` returns null and registration rejects an unproduced probe before any
artifact write. The table shows166 unfinished entries out of scope, zero queued
and11 unresolved repair candidates. Typecheck/changed-file lint pass; full suites
retain the documented five Windows unit failures and two immutable HTML encoding
errors. No animal art changed and no repair worker was launched by this plan edit.

## Art and projection contract

Tilefun uses a square-grid 2D renderer with three-quarter top-down artwork.
There is no perspective transformation in the normal 2D camera: elevation,
top surfaces, foreshortening and near/far limb separation belong in the art.
Match the actual Modern Exteriors atlas and the approved Explorer/cat/bear.
An animal facing left still shows its upper body and near/far legs; it is not
a flat side elevation. This is not a diamond-grid isometric scene.

Calibrate a fixed orthographic Blender camera against the actual scenery before
settling its elevation. Record angle above the ground, target, scale, aspect,
four model yaw angles and ground anchor. Use that same calibrated projection
for the campaign. Retain species-specific editable 3D pose sources and projected
guides; integer drawings do not substitute for independent anatomical guides.

Use authored palette-letter pixel masters and deterministic Pillow composition.
Blender supplies volume, contacts and pose projection; deliberate pixel drawings
supply the final aesthetic. Maintain natural silhouettes, restrained palettes,
large readable heads where appropriate, binary alpha and identical world-pixel
density. Fox/rabbit profile scale starts at 14/13 visible pixels; elephant/giraffe
at 51/75. Different facings can have different projected bounds without changing
world scale. Never resize a sprite to fill a cell or force equal facing bounds.

Keep head/body scale fixed in the 3D source. Preserve full head/marking drawings
during translation-only walk poses. Actual head turns or pitching require fixed
volume geometry and reviewed replacement drawings; smaller head templates are
not a substitute for motion. Simpler credible actions are preferable to a
complex action with weak anatomy. Ground contact, gait timing, rear anatomy,
occlusion and continuous transitions require visual checks, not frame counts.

## Owner body-motion correction, 2026-10-04

The owner rejected the stationary torsos in sheep/pig and reported the same bad
walk trend across animals. Coordinator review had missed this while checking
stable volume and contacts. Sheep/pig builders explicitly set BODY.location to
zero every pose; deer/horse/goat do the same. All their projected body landmarks
are constant per facing. Cow only authors0.025-world-unit lateral sway, projecting
to at most0.3165px of vertical range in profiles, which may vanish in finishing.
Opened exact native sheep/pig all-frame sheets and inspected their source; no
old art, source or receipt was rewritten to manufacture a fix.

Fixed ground anchor/root motion and constant mesh volume DO NOT require a
stationary torso. The revised workflow requires species-appropriate rigid body
rise/fall and shoulder/pelvis transfer tied to support changes, head/neck follow
or stabilization, and constant-length leg solves from moving hips. Final native
integer drawings must retain that movement. Small sheep/pig walkers should test
1-2px peak-to-peak rise/fall as a readability starting point; it is not a universal
biological amplitude. Do not bounce the whole sprite, scale volumes, animate
shading or use moving appendages as a substitute. Export pose landmarks from
evaluated world matrices and inspect all facings in continuous native/enlarged
in-place AND matching travel playback, with grounded/sliding-contact checks.

The [tracked body-motion contract](../../art-source/wildlife-v2/body-motion-contract.json)
owns the affected exact revisions and correction prototype IDs. All11 completed
walking quadrupeds are now motion-review-required, including the old walking
pilots, without claiming that every one has the identical defect.22 retained
completed draft receipts become11 still ready plus11 needing motion re-review;
eight earlier quality failures remain blocked. The interrupted ladybug task is
paused. Receipt fields, artifact hashes, registered identities and human review
decisions remain unchanged. The generated table reflects these separate holds.

Stopped the verified background02 launcher and its16 descendants after preserving
the owner-stop record; its watchdog then exited. The interrupted lock and original
checkpoint remain evidence. Active-session metadata records the stop; no worker
or automatic continuation is running. The former06:00 Berlin deadline is
historical; it no longer authorizes broad production or bypassing repair-only scope.

`campaign.mjs` rejects background launch under an active local production hold.
The tracked contract ALSO requires a new coordinator body-motion gate, even if
the local hold is missing. It pins the contract and new sheep/piglet receipt
hashes, rejects old revisions/worker-as-coordinator claims, and requires concrete
weightTransfer observations. Future walking receipts must name this contract and
include native body-motion observations. Old held revisions cannot unlock their
families or count as ready. Mechanical fields are gate prerequisites, not visual
approval or proof of animation quality.

Next: author corrected sheep then pig in new revisions, inspect body/hip/foot
landmarks plus full native/4x in-place/travel playback, and record actual
coordinator observations. Only after those prototypes pass can the coordinator
write the pinned gate and release the repair hold for explicitly assigned
existing walkers. Re-audit/correct only existing frozen torsos. The production agent cannot
clear the hold, create the coordinator gate or retrofit old receipts. Broad
background production remains stopped; this prompt change is not an art fix.

Source audit, owner stop, old progress/checkpoint snapshots and inbox/art-note
reads are retained under ignored coordinator-review/background-02-worker. No
formal Needs changes votes/notes existed at this checkpoint; the owner's direct
chat rejection is the authority for this hold, not an invented Workshop event.
Primary biomechanical context: [Griffin et al.2004](https://pubmed.ncbi.nlm.nih.gov/15339951/)
models distinct fore/hind-quarter movement and phase coordination; it does not
provide the pixel amplitude target, which is an explicit art/readability choice.

Verification: sixteen wildlife queue/gate tests pass, including holds without
local state, changed prototype bytes, old revisions, absent observations and
future walking receipts. Typecheck, changed-file lint and Git whitespace checks
pass. Full unit run retains1357 passes/five Windows platform failures/ten skips;
full lint retains only the two preserved fish/robin-v1 invalid-UTF8 errors.
All22 completed receipts are unchanged and all2516 referenced artifact hashes
still match. Status refresh reports11 ready,11 motion-review-required,eight
blocked,one paused,165 queued; live launch assertion rejects both missing motion
gate and active hold. Detailed motion-* logs are under coordinator-review.

## Production gate

Coordinator manually produces and visually reviews fox, elephant and rabbit
with fixed-camera guides, all facings and full motion/action cycles. Inspect
native-size and enlarged art in actual Modern Exteriors scenery beside Explorer.
Record rejected iterations and fixes honestly. Only after those pilots pass
coordinator review can background draft authoring begin. This is an agent
production gate; exact human approval remains pending for every new candidate.

Background work starts a new task/checkpoint namespace and never loads the
previous campaign's pixels, recipes, completion records or claimed inspections.
Use the mclone checklist for roster breadth only. Scope remains 194 natural
animals plus two upright companions; no fantasy, breeds/ages or ecology simulation.
Every new locomotion family needs its own inspected prototype before expansion.
Mechanical validation establishes integrity, not artistic quality.

Existing approved gameplay art/settings and promoted banks remain immutable.
Register new exact candidates in the Workshop, obey saved feedback and pause
rules, and retain source, hashes, camera evidence and actual visual observations.

## Current reviewed drafts and execution

Coordinator accepted `fox-pilot-v2-drawing-03` as a draft production reference
following rejection of v1 and two internal v2 finishing attempts. The revised
rigid skull/cheeks/ear spread produce an 11px front/rear head beside a 7px torso,
separated ears, front eyes/tapered cream muzzle and rear cap without front facial
features. Profiles stay 14px tall. Full head patches remain identical throughout
walk/tail-action poses. Rear-foot occlusion, restrained body transfer, basic idle
paw resets and coarse extreme tail contours remain explicit limitations. Human
approval is pending. V1 is historical rejected art and cannot seed continuation.

The coordinator-selected orthographic contract is
`art-source/wildlife-v2/camera.json`: 40 degrees above ground, 10 world pixels
per unit, direction yaws 180/0/100/260. Exact coordinator receipt and hashes are
in ignored `data/wildlife-campaign-v2/progress.json`. Elephant `pilot-v2` is also
coordinator-accepted as a draft reference. Rabbit `pilot-v1`, drawing-04, passed
coordinator scene/guide/playback inspection after three rejected drawing attempts;
its final supervised handoff is frozen. All three exact coordinator receipts and
the camera are pinned in the fresh pilot gate; unchanged hashes are required for
background launch. The prototype key includes
roster family, body plan, media and gait set, so unrelated animals cannot inherit a
fox or rabbit quality gate.

Fresh Workshop candidates pin sheet, native scene/contact, GIF and playback
source bytes, and remain human-unchecked. Both fox and elephant initial/corrected revisions are registered in supervised
batch 01; initial revisions are clearly labeled and excluded from production seeds. Only registered wildlife affects
manifest freshness; unrelated drafting cannot invalidate frozen candidates.
These new review pages have been verified locally; no deployment was performed.

Source cleanup preserves all22 retained drafts and27 registered review revisions.
Git retains editable sources, cut/timing definitions, player source and small native
sheet/scene/contact PNGs. Generated animation, guides and diagnostics remain in a
verified separate archive; its checksum and restoration command are recorded in
the [source bank](../../art-source/wildlife-v2/README.md). Manifest builds require
only committed native render inputs; browser review and server feedback submission
still verify every original artifact pin. Missing/changed animation evidence blocks
feedback, including when the broader development manifest is advisory. Review
renderer edits mint fresh pending fingerprints and confer no approvals. New-animal
production remains disabled; this cleanup makes no art corrections.

Cleanup/rebase verification, 2026-10-04: typecheck, lint,19 queue tests, all three
wildlife browser checks and builds pass. The cache-free staged checkout rebuilds
the identical585-candidate manifest, with every identity matching full Chromium;
all357 retained source/render hashes and4465 archived artifacts verify. Full unit
results are1493 passes/five Windows symlink/process failures/ten skips. Full browser
results are332 passes/four failures/one skip; the two mobile-layout and two GPU
failures also reproduce in an unchanged origin/main snapshot on this machine.
The wildlife tactical is now060 to resolve its numbering collision with upstream.
Source and review cleanup does not fix the11 held walks or resume production.

Actual manual 02 rollout confirms Sol 6.1/high, CLI 0.160.0 and thread
`01a104af-470f-7601-9e6c-2dd203c972e9`; its source audit, deterministic finishing
and 17.278-second full Chromium capture pass. Typecheck/lint, focused feedback/
projection/service tests, eight queue tests, catalog/manifest and build pass.
Final integrated inventory counts are recorded in tactical 060 after all pilots
are registered.
Two new browser checks pass: zero-event registration/exact native preview pixels
in full Chromium, and disabling review when pinned playback bytes change.

The broad unit/browser suites remain failed: Windows symlink EPERM/SIGKILL
expectations, denied C:/tmp screenshot writes and remaining rendering/phone
assertions are retained with exact diagnostics in tactical 060. Introduced test
loader/type/formatting issues were corrected and checked again; no test or
permission rule was weakened. See [060](../tactical/060-wildlife-fresh-production.md)
for session history and the exact retained review observations for art evidence.

The corrected elephant preserves fixed 40-degree geometry/density, 51/52px
profiles, a twelve-pose 2.4s walk and articulated trunk/tail action. Its actual
landing table is hind-left, fore-left, hind-right, fore-right at poses 0/3/6/9;
[primary locomotion research](https://pubmed.ncbi.nlm.nih.gov/16985198/) supports
that lateral sequence. Coordinator inspection rejected front toenail clusters
on rear heels; v2 changes 170 pixels across 21 rear frames to gray heel pads,
with geometry/camera/contacts/motion/head/body/trunk and other facings unchanged.
Actual Chromium cycles at native/4x scale were opened, and source/finishing/diff
audits pass. Angular bends, hidden far feet, tiny front eyes and abrupt stopping
remain explicit draft limits. All human approvals remain pending.

Large retained guide JSON is still parsed/checked by Biome, with a 32MiB limit
scoped to wildlife JSON rather than disabling its checks. Future guide exports
use compact serialization. The bounded watchdog now records Windows' actual
wake-request result in ignored power.json; the rabbit session request was
accepted, and display sleep remains available. No persistent power/global
configuration was changed.

The rabbit uses a 32px canvas, 13px profiles and a dedicated fixed-volume model.
The eight-pose hop has gather/push/flight/fore/hind/settle phases, staggered fore
landings at 4/5, paired hind landing at 6 and two fully airborne poses. The final
ear-listening action uses the same letter masters, corrected after browser review
exposed false ear-length growth. Coordinator opened all facings, actual volume
guides, scenery and chronological frames from the final 17.293-second Chromium
capture. Source/contact/head/replay audits pass. Front/rear articulation is
subtler than profiles; far feet overlap, ear movement is coarse and stopping is
basic. These remain draft limits, with human review pending.

Rabbit is registered in supervised batch 02; batch 01 retains both initial and
corrected fox/elephant revisions. Only the three accepted receipt identities
can seed production. At launch the queue has 3 valid fresh drafts out of 196 and
selects giraffe next. Final catalog/manifest/build pass: 554 candidates and 227
normal-Chromium identity checks. Both targeted wildlife browser tests pass with
all five registered supervised revisions. The final unit run has 1,357 passing,
five failing and ten skipped tests, retaining Windows symlink/signal failures.

Bounded background continuation started at 04:00 UTC on 2026-10-04, with a hard
deadline of 12:00 UTC (14:00 Berlin). Actual rollout metadata confirms
`gpt-6.1-sol`/`high`, `codex_exec`, CLI 0.160.0 and thread
`01a10511-b3f4-7bc3-b82a-6f836ba8056e`. Local activity is under
`data/wildlife-campaign-v2/background-01-worker/`; the outer watchdog/power
evidence is under `background-01/`. Windows accepted the bounded wake request.
Serial authoring must retain honest checkpoints and inspect every species before
counting it. Three drafts are accepted for production, not human-approved;
193 roster entries remain at launch. No completion guarantee for one session.

Background checkpoint, 2026-10-04 04:54 UTC: giraffe/draft-v1 and
mallard-duck/draft-v1 are registered pending drafts in background batch 001.
Their exact validated receipts increase fresh draft integrity to 5/196, including
the three frozen pilots. These are production-agent visual gates, not coordinator
or human approvals. Giraffe profiles are 75px with a dedicated sixteen-pose lateral
walk; mallard profiles are 13/14px with separate eight-pose waddle/swim/flap clips.
Opened all facings, native/enlarged vendor scenes and chronological full Chromium
cycles. Giraffe inspection corrected neck/leg proportions and an ear-patch flicker;
mallard inspection corrected hanging folded wings, floating webs, a dark far-wing
blob and a rear neck gap. Exact evidence and limitations live in each revision's
`review-observations.md` and ignored session captures. Angular giraffe limbs,
occlusion, small duck contacts and missing water/transition context remain explicit.
Camera and pilot bytes remain unchanged. Catalog/manifest/build pass with 556
candidates and 229 Chromium identities; typecheck/lint pass after formatting new
playback sources. Broad final suites remain to run at handoff.

Next: continue the queue serially with independent family prototypes, while
checking saved owner feedback before each new batch.

At 05:14 UTC robin/draft-v1 (drawing03, motion02) becomes the third pending
background batch001 draft, for6/196 fresh integrity receipts. Its dedicated
three-segment legs gather/tuck through airborne hop2/3/4 and paired landing5;
small shoulder/elbow fans fold through an eight-pose flight cycle. Inspection
corrected a merged eye, hidden rear tail action and false pale rear collar.
All92 poses and actual native/4x chronological cycles were opened;184 source
contacts/wing links,92 whole-head checks and290 browser parity samples pass.
Tiny toes/eyes, a coarse front far-tail stalk, angular wings and abrupt clip
transitions remain limits in its exact review observations. Catalog151,
manifest557 candidates/230 Chromium identities and build pass. Queue selects
the independent pond-fish aquatic prototype next. Fresh inbox/art notes still
report zero pending requests or notes; no human approval is recorded.

At 05:46 UTC the first background batch holds four species: giraffe, mallard,
robin and pond goldfish. Fish profiles are10px, with a dedicated posterior-body/
vertical fork-tail wave and revised rigid cheek-hinge gape. Opened all60 poses,
native/enlarged pond/vendor scenes and both complete Chromium cycles per facing.
Fresh source120 axial/1080 underwater bounds checks and248 browser comparisons
pass. Small front/rear edge-on tail, subpixel operculum and absent water effects
remain explicit in its observations. Total fresh species integrity is7/196.

Batch-boundary lint exposed Windows-encoded middle dots in robin/fish preview
HTML. Frozen draft-v1 files and receipts remain intact; draft-v2 corrects UTF-8
and source routing with identical PNG/GIF/Blender bytes. Both exact revisions
are registered pending in batch002; receipt history preserves draft-v1. Fresh
source/replay/Chromium checks pass on each new route. Catalog154 sheets,
manifest560 candidates/233 identities and build pass; typecheck passes. Lint
exits0 but still reports the two retained immutable draft-v1 UTF-8 diagnostics,
alongside existing warnings. This is a retained limitation, not a clean lint claim.
Inbox/art notes report no requests/notes. Next independent prototype is monarch
butterfly, including reduced forelegs and coordinated fore/hindwing articulation.

At 06:03 UTC butterfly/draft-v1 fails the production-agent visual gate and is
blocked, unregistered, with no ready receipt. All92 poses and actual two complete
Chromium sequences per facing at native/4x were opened. Down walk remains nearly
stationary and closed front/rear wings read as dark fork shapes with weak body/
antenna distinction. Fixed source limbs/wing panels,92 stable head checks and336
browser comparisons pass but do not establish good art. The oversized/dense first
finish and current exact failure findings are retained. Butterfly siblings stay
locked; continue only to another eligible prototype.

At 06:22 UTC ant/draft-v1 (drawing03) is the third pending background002 identity;
fresh species integrity is8/196 including frozen pilots. Its dedicated37-mesh/
60-pose red wood-ant source keeps six fixed-length limb chains, alternating
tripods with actual landings0/4 and double support0/1/4/5. Opened all final poses,
native/enlarged vendor scenes and actual two-cycle crawl/scan/idle playback per
facing at native/4x. Rounded head, warm dark gaster and beneath-body joint finishing
correct earlier flat/faint art.1080 segments/312 contacts,60 full-head/120 body
checks and218 actual Chromium pixel comparisons pass. Small limbs overlap and
profile7px exceeds provisional5; exact limitations remain pending human review.
Catalog155 sheets, manifest561 candidates/234 identities and build pass. Blocked
butterfly's130 source/output evidence files are hashed without a ready receipt.
Next independent queue prototype is king cobra, using its own serpentine anatomy.

At 06:42 UTC king-cobra/draft-v1 drawing02 closes background002 with four exact
pending identities. Fresh species integrity9/196 includes the frozen pilots.
Its40-mesh/60-pose source uses15 fixed .24-unit tapered links, a raised fixed hood
and skull, eight posterior travelling-wave poses and tongue/tail action. Opened
all native/enlarged poses/scenes and actual28-state sequences per facing/scale.
900 fixed-length/1800 sliding-belly checks,60 head checks,86-file replay and243
Chromium pixel comparisons pass. Profile18/17px, angular one-pixel tail and alert
fixed forebody remain limits. Initial clipped64px canvas and rear-static action
were rejected/fixed before registration; full96px canvas retains10px/world unit.
Catalog156, manifest562/235, build and typecheck pass. Batch lint exposes missing
button types in frozen ant/draft-v1 and unregistered blocked butterfly preview;
corrected ant revision is needed without changing its pinned original bytes.
Frozen robin/fish v1 UTF8 diagnostics remain retained. Frog is next prototype
after this packaging correction; no human feedback requests or approvals.

At 07:07 UTC ant/draft-v2 corrects preview button types with all79 copied
PNG/GIF/Blender files unchanged; frozen v1 is retained. Fresh source/replay and217
Chromium checks pass. Blocked butterfly's unregistered HTML receives the same
packaging correction, with original page/hash manifest retained and current130
evidence files rehashed; its visual family gate stays blocked. Lint diagnostics
in immutable ant/robin/fish originals remain retained failures.

Frog/draft-v1 geometry02/drawing02 is the second background003 identity and brings
fresh species integrity to10/196. Dedicated45-mesh92-pose brown common frog has
fixed fore/hind segments, actual hop supports4,4,2,0,0,2,4,4 with fore-first
landing, paired aquatic kick and rigid-eye blink. Opened every pose, native/4x
vendor/water scene and actual44-state two-hop/two-swim/action/idle timelines.
920 segment/192 planted toe/128 aquatic foot checks,68 stable full-head/body
patch comparisons and336 browser pixel checks pass. Near-leg overpainting was
retained/rejected before final finishing. Native profile11 versus10 proposal,
thin toes, vertical in-place hop and abrupt media switch remain pending-review
limitations; exact134-file source/output receipt is frozen, not human approved.
Catalog158, manifest564/237 and build pass. Next independent prototype is gorilla.

At07:45 UTC gorilla/draft-v1 is blocked after final geometry04/drawing03 visual
inspection. Opened all92 poses, native/4x vendor scenes and all40 actual browser
states per facing/scale,348 readbacks over13.524/13.503s. Source736 limb/1472
digit/240 contact checks and52 head/body patch comparisons pass; those integrity
results do not overcome a pack-like profile back, rigid hunched chest rise and
face-adjacent palm action with weak rear reading. Three rejected construction/
display revisions and current134-file evidence are retained without registration
or ready receipt; primate/hand-walk siblings remain gated. Kangaroo is the next
independent prototype. Draft-ready species count stays10/196 including pilots.
At08:09 UTC kangaroo/draft-v1 is the third background003 pending identity,
118 exact pinned files; ready species11/196 includes frozen pilots. Fresh69-mesh
76-pose red kangaroo has ten synchronous hind-hop poses and independent ears.
Actual support2,2,2,0,0,0,0,0,0,2, paired landing9, fixed608 limb/380 tail checks
and208 actual heel/fourth-toe contacts pass. All76 heads stay stable;298 browser
comparisons cover11.553/11.551s at native/4x. Opened all34 chronological states
per facing/scale, actual vendor/Explorer comparisons and separate travel frames.
Retained failed rig/flat heel/front-eye/tail-gap iterations; final joint-center
composition fixes distal fragments. Profile43 versus36 proposal, quiet ear action,
vertical in-place hop and mirrored shading remain explicit owner-review limits.
Catalog159, manifest565/238 and build pass. Crab is next independent prototype.

08:33 UTC: crab/draft-v1 failed native anatomy/action clarity and is blocked,
112 hashed evidence files, no registration/receipt/family unlock. Fresh56 meshes,
68 poses,1632 fixed leg links and480 actual pointed-toe contacts pass; source
tetrapod supports8,8,4,4,8,8,4,4 and planted preview compensation are computed.
Opened all68 poses and all30 chronological actual Chromium states for each
facing at1x/4x (266 samples,10.328/10.305s), committed scenery/Explorer and
actual guides. Initial18px profile was oversized; fresh half-initial-world-size
geometry and reauthored9px profiles fixed scale, not the visual gate. Front
pincers collapse into cream brackets, rear action barely reads and profile
claws/legs merge into buglike fringes. Octopus is next queued prototype; ready
species stay11/196, including frozen pilots. No human approvals.

08:50 UTC: octopus/draft-v1 blocked,110 hashed retained evidence files. Fresh
247 meshes68 poses,4352 arm links6528 actual sucker center/normal checks and
16796 floating water bounds pass;24 output replay and1064 actual browser pixel
comparisons pass. Opened all68 poses/current guides and all30 chronological
states for each facing/1x/4x (266 samples10.311/10.303s). Rejected identical
rosette01 and thick leaf-lobe02; final thin open arms still read spiderlike,
distal diagonals fragment, small crown and hidden collar stroke fail natural
silhouette/jet propulsion. No receipt/registration/soft-aquatic sibling unlock.
Penguin is next independent ground-bird ground/water walk/swim prototype.

09:28 UTC: penguin/draft-v1 registered as fourth background003 identity,146
pinned files; nine new species this worker,12/196 including frozen pilots.
Fresh30 meshes100 poses, rigid emperor head/gold marks, eight-pose waddle,
hind-ground-contact weight transfer, articulated underwater flippers and stretch.
Actual support2,2,2,1,2,2,2,1;8 torso-over-single-support placements,400 leg600
flipper links128 actual floor webs pass. Opened all100 final poses and all46
chronological browser states per facing/native4x,400 frames15.531/15.500s;
3999 visible head-template pixels and28-file replay pass,176 rear-swim lower-head
pixels legitimately occluded. Rejected rectangular underside, wrongly signed
weight shift and invisible profile stretch, retaining exact failed evidence.
Profile22 vs26 proposal, quiet profile stretch, stylized swimming skull counter-
pitch and abrupt media transitions remain review limits. No human approvals.
Harbor seal is next independent flippered haul/swim prototype.

Background003 inventory/check boundary: catalog160; first manifest navigation
timed out and dependent build correctly failed freshness. Exact failure logs
retained; bundled-browser retry rendered566 candidates/239 parity identities and
build passed. Typecheck passes; lint retains two invalid-UTF8 errors in immutable
robin/fish v1 and existing warnings. Formatting corrected only unregistered
blocked crab/octopus pages/capture scripts, original bytes retained;112/110
blocked files rehashed without changing pixels or their visual gates.

10:01 UTC: harbor-seal/draft-v1 registered pending background004 first identity,
138 pinned files; ten new species this worker,13/196 including frozen pilots.
Fresh25 raw meshes22 visible,92 poses; fixed276 spine368 fore-link checks,
24 planted-tip travel compensation checks,38520 actual floor vertices pass.
Continuous dual-quaternion torso replaces rejected beads; measured skin volume
range0.505% is explicit, head92 orientations/4508 full-template pixels stable.
Computed haul support3,3,1,1,1,1,1,3 has sliding body support and pulling tips
locked7/0/1. Opened all92 poses and all44 actual state/facing/native4x timelines,
383 frames14.822/14.874s plus decoded travel;28-file replay1532 browser checks.
Rejected rear-static action, washed-out head/inward spot normals and first
sliding-contact capture retained/fixed. Profiles15 vs23 proposal, quiet stretch,
idealized low-speed haul and abrupt media remain limits; no human approval.

Harbor-seal inventory boundary: catalog161, manifest567/240 full-Chromium parity
identities, build pass. Manta ray selected next eligible swimmer, but receives
its own giant-manta disc/pectoral oscillatory prototype rather than a fish repaint.

Background01 continuation10:38Z: manta-ray/draft-v1 registered pending in004,
127 pinned files;24 full meshes84 poses1260 links, base/tip stroke apices3/4.
All poses and38 actual state/facing/native4x timelines opened,335 captures
13.002/13.014s,25-file replay1340 browser checks. Fixed disc/head4263 pixels;
profile41 vs24 proposal and angular two-panel fins/quiet cephalic action are limits.
Catalog162, manifest/build refreshed successfully. Eleven new species ready,
14/196 including unchanged pilots, no human approval.
Jellyfish/draft-v1 failed independent style/motion gate: opaque front badge,
rear saucer, stiff short oral/marginal fringe and weak front feeding action.
Retained77-mesh64-pose source,3328 links, all64 poses/all29 actual states opened;
259 captures10.010/10.078s,24-file replay1036 readbacks pass integrity only.
Blocked/unregistered; no soft-aquatic pulse family expansion. Five failed
prototypes remain evidence rather than templates.

11:26Z background01 authoring close: cat/draft-v1 (125 pinned files) and
dog/draft-v1 (141) complete pending batch004 with seal and manta. Thirteen new
species this session;16/196 including unchanged coordinator pilots, five blocked,
175 queued, no in-progress task. Next eligible red-squirrel is not selected:
remaining time reserved for validation/handoff. No human approvals or publication.

Cat: fresh35 meshes84 poses,12-pose lateral walk and eight ear/tail poses;
HL0 FL3 HR6 FR9,1428 links304 contacts160 travel checks. All84 poses/all38
real browser states in every facing/native4x opened,336 captures13.068/13.034s,
2688 full head-template pixels,23-file replay. Profile15 vs13 proposal; quiet
ear action/tiny partly hidden paws remain limitations. Rejected paw-over-face,
paw-on-rear-back and short-ear finishing stages retained before final pinning.
Dog: fresh36 meshes100 poses,16-pose lateral walk plus eight wag poses;
HL0 FL4 HR8 FR12,1800 links352 contacts208 travel checks. All100 poses and46
actual browser states/facing/native4x opened,413 captures16.008/16.033s,
1652 pixel checks and23-file replay. Profile17 exact proposal/down26/up23;
walking head pattern3760 pixels stays fixed, action near-ear cheek occlusion
is explicit. Hidden pendent ear and lost white tail tip iterations rejected
and fixed. Angular saddle, restrained ear follow, tiny paws/white tip and partly
occluded rear wag remain limits. Generic canine timing is not measured beagle gait.

Read-only handoff integrity:16 receiptErrors-valid receipts,2295 receipt/blocked
artifact hashes checked, zero mismatches. Catalog164/manifest570 candidates,
243 full-Chromium parity identities and build pass. Final typecheck passes;
unit suite1357 passed/five failed/ten skipped (Windows symlink EPERM and process
SIGKILL expectation), lint two immutable robin/fish-v1 invalid-UTF8 errors,
124 warnings34 infos. Exact worker logs retained in ignored session folder.
Windows tool process creation failed with1909 from11:28 to11:41, then recovered;
no settings/permissions changed. Full bundled-Chromium project suite and final
manifest retry/handoff results are retained there when complete.

11:49Z final background01 handoff saved atomically with checkpoint/heartbeat and
regenerated status. Explicit bundled manifest retry passes570 candidates/243
full-Chromium parity identities; subsequent build passes. Full Chromium project
run preserves all290 reporter outcomes:227 pass,62 fail,one skip; both wildlife
review tests pass. Exact62 failure contexts retained:52 Windows C:/tmp screenshot
EPERM, five readiness timeouts and five other assertions (phone width, PWA
incognito and streaming travel). Non-platform failures remain unresolved.
After all outcomes, teardown stopped producing output at11:34:57; interrupted
only run-owned exec session93419 at11:44, returned exit1, port4174 no longer
listening. Process command-line query denied; no broad process killing or claim
that every system Chrome exited. Per-animal captures close their owned browsers.
Detailed final.md, outcome/context hashes and command logs remain under ignored
data/wildlife-campaign-v2/background-01-worker. No further animal selection.
Next: coordinator/human review exact pending drafts, then fresh red-squirrel
prototype with its own family/body-plan/gait gate; five failed families stay blocked.

## Owner deadline correction and background02, 2026-10-04

The owner clarified continuation should run through 06:00 Europe/Berlin on
2026-10-05, not the coordinator's earlier eight-hour assumption. Launcher now
accepts an absolute DeadlineUtc, rejects past/offset-free/conflicting values
before session creation, and passes one identical UTC instant to worker prompt,
worker metadata and watchdog. Owner stop is 2026-10-05T04:00:00Z; selection
cutoff is03:30Z only to reserve final validation/handoff time.

Background02 launched12:48:15Z, launcherPID27312/watchdogPID39536. Actual normal
rollout confirms Sol6.1/high, codex_exec CLI0.160.0, thread
01a106f5-371a-77a2-891d-27de9440901a. All three deadline channels match; Windows
accepted the bounded wake request. Resumed at red-squirrel from16 ready/five
blocked/175 queued; new session checkpoint records actual selection and guide
modeling, not another reset. Old exact receipts/candidates remain frozen and
failed families remain blocked. Current metadata/commands/checkpoint are under
ignored background-02-worker; outer watchdog/power evidence under background-02.

Active-session metadata now routes the generated table to this continuation's
checkpoint instead of the prior finished run. Three deadline rejection probes,
eight queue tests and status/hash/link smoke pass; typecheck passes. Full unit
rerun retains1357 passes/five failures/ten skipped; lint retains only the two
preserved robin/fish-v1 invalid UTF-8 diagnostics. Inbox/art notes report no
pending fixes/notes and no wildlife review approvals/changes. Logs are under
ignored coordinator-review/deadline-* and continuation-*.

## Version-control direction: source and small runtime assets

The fresh source/native-sheet checkpoint is separate from the still-uncommitted
review integration on main; the stopped campaign's backup is on
backup/wildlife-low-20261004. Production workers author drafts and
leave Git to the coordinator. Commit proposed workflow/tooling/docs separately
from frozen ready animal batches; a Git checkpoint is not human art approval.
Do not stage an animal while its source/drawing revision is still changing.

2026-10-04 measured nonignored working-tree snapshot: approximately305MB raw,
126MB estimated new compressed/deduplicated Git blobs before pack deltas. Omitting
Blender saves only5.3MB raw (about4.6MB Git). All authoring sources, code/docs,
registered exact review deliverables and review notes are about96MB raw/25MB
estimated Git; remaining public inspection caches can be separately archived.
Large guide PNGs/GIFs dominate compressed storage; .blend scenes are small and
valuable editable sources. JSON projects are bulky raw but compress well.

The owner refined the goal to required sources and sheet-cut definitions, with
generated GIFs and similar previews outside Git. Recommended commit contents:

| Keep in Git | Reason |
| --- | --- |
| Camera, species roster, authoring/export/finishing/audit scripts and source notes | Reproducible projection, anatomy, drawing and motion decisions |
| Final revision's editable .blend and authored masters.json | Blender owns geometry/keyed poses; palette-letter masters own the final pixel style |
| Sprite definitions and explicit animation timing | Cell dimensions, direction rows, frame rectangles, ground anchor, clip order/count, durations and in-place motion are essential behavior |
| Final native sheet.png | Recommended small generated runtime exception: normal builds use committed assets without Blender/Pillow |
| Exact revision identities, checksums and review observations | Preserve what was inspected without interpreting a draft checkpoint as approval |

Exclude generated preview/scene/travel GIFs, native/enlarged comparison panels,
guide renders, contact sheets, browser captures, repeated public guide JSON and
failed/superseded render trees from routine animal commits. Do not use a blanket
PNG ignore: final runtime sheets and existing committed game assets still belong
in Git. Failed/reviewed evidence is preserved separately, not discarded.

Read-only measurement of the 16 draft-ready receipt revisions, excluding blocked,
in-progress and superseded revisions (decimal MB; animal-specific files only):

| Set | Current raw / estimated compressed blobs | Mean extrapolation to 200 |
| --- | --- | --- |
| Sources, definitions, checksums and small player source files | 9.71 / 3.21 MB | 121 / 40 MB |
| Above plus final runtime PNG sheets (recommended) | 9.89 / 3.36 MB | 124 / 42 MB |
| Above plus current projected-guide JSON cache | 39.59 / 8.37 MB | 495 / 105 MB |

The 16 editable Blender scenes total2.72MB; all final sheet PNGs total0.185MB.
Shared tooling/docs add a fixed overhead. Estimates use unique zlib-compressed
Git blobs before pack deltas, not exact clone sizes; the 16-species mean is not
a promise for the remaining roster, and subsequent revisions add history.
The earlier305MB measurement included duplicated public/source guides, failed
attempts and inspection caches; it is not the cost of16 final animals.

Authoring dependency: fox/rabbit/elephant and most current finishers place
compact pixel parts using projected-guides.json. That file can be regenerated
from Blender, but a source-only clone needs a tested guide-export/finish command
and pinned toolchain first. Cat/dog/harbor-seal/manta-ray masters already contain
complete final frames. A scratch replay of all360 frames rebuilt those four
sheet PNGs byte-for-byte with the current Pillow installation; no registered
files were overwritten. This does not yet prove every animal or every GIF can
be reproduced byte-for-byte on another toolchain.

Definition gap: cat/dog/seal/manta timing is currently encoded in playback.js
(160ms per frame), not in sprite.json. Keep those small player source files in
the first source checkpoint; future revisions should carry explicit frame
durations in their sprite definition. Keep current registered descriptor bytes
unchanged. An eventual compact runtime descriptor can omit 3D contact/hull audit
data, while retaining rectangles, anchors, clips, timing and identity; that is a
new descriptor/review identity, not an in-place rewrite of existing candidates.

Commit sequence: shared source/tooling, this policy and the first immutable ready
animal source batch, then the runtime/review integration after its generated
evidence dependencies are portable. Only final draft-ready revisions enter the
animal source set; pending human review stays explicit. Working and blocked
animals remain outside these batches. Required current source files include
the saved scene, masters, all revision scripts/README/checksums, and existing
sprite.json/playback.js/index.html; add sheet.png for the recommended runtime set.

Before applying excludes to the review integration, retain an immutable
checksum-addressed archive and test restoration. Existing receipts AND Workshop
candidate registries pin GIFs and comparison PNGs. An ignored local folder alone
is not a durable backup, and a fresh clone must not silently advertise missing
review evidence. Preserve current pins; archive/restore exact old evidence, and
use a revised portable evidence contract for future candidates. No old candidate
may be weakened merely to reduce Git size. No ignore/LFS/archive migration or
fresh commit was applied during this measurement; the overnight worker remains
unchanged. The concrete read-only file inventory and scratch replay evidence are
under ignored coordinator-review/source-set-size.json and source-rebuild/.
Exact proposed staging inventories are source-only.paths.txt (207 files) and
source-and-runtime.paths.txt (223 files), including shared camera/roster; these
are inventories, not staged changes. Read-only validation: typecheck and Git
whitespace check pass; unit suite retains1357 passes/five platform failures/ten
skips. Full lint reports four errors in preserved/current background artifact
files, including red-squirrel's unformatted player. No pinned/blocked evidence
was edited to clear those diagnostics. Logs are coordinator-review/storage-*.

Owner authorized the source commit after reviewing this plan. The first source
checkpoint contains the measured16 final revisions, camera/roster, native
sheets, existing descriptors/player sources, workflow tools and documentation.
No blocked, working or superseded animal revision is included. Byte-preserving
Git attributes protect hash-addressed wildlife files across platform checkouts.
The [source bank README](../../art-source/wildlife-v2/README.md) explains the
generated-guide dependency and incomplete preview-page dependencies on a plain
clone. [Dated checkpoint](../../art-source/wildlife-v2/source-checkpoint-20261004.json)
records223 exact source/runtime file hashes and the external archive checksum.

Before staging, preserved3528 stable source/evidence files (including blocked
and superseded attempts) in a checksum-addressed163MB local ZIP outside the
repository. Verified every archived file and restored a GIF, projected guide
JSON and native sheet to scratch with matching hashes. The archive contains
receipt/registry snapshots and its own complete file manifest, but no tools,
credentials or session histories. This is persistent local preservation, not a
remote backup. No live output was removed or repinned; the worker continues.
Commit verification covers241 staged files/10.25MB raw, with all223 inventoried
animal/shared source and native-runtime blobs matching their SHA-256 records.
No generated GIF, projected-guide JSON, guide-render tree, blocked/current animal
or review-integration code is staged. Typecheck, eight queue tests, staged-file
Biome checks and staged Git whitespace checks pass; two Biome infos only.
Full-suite platform/retained-artifact failures above remain separate unresolved
diagnostics. No human approval, gameplay promotion, push or deployment occurs.

Background02 continuation began 12:48 UTC on 2026-10-04, with actual rollout
Sol6.1/high/thread01a106f5-371a-77a2-891d-27de9440901a verified. Owner deadline is
04:00 UTC on 2026-10-05; new-task cutoff03:30 UTC. New session helpers and logs
are under ignored background-02-worker; active-session pointer remains unchanged.
At13:12 UTC red-squirrel/draft-v1 is blocked, unregistered, with116 hashed fresh
source/output files. Opened all76 poses and actual338 Chromium samples/two full
sequences per scale. Rear paws remain lost and right plume reads shallow despite
608 limb/380 tail/228 planted-floor checks, stable head and finishing replay.
Exact rejected attempts and final observations remain evidence, not masters.
Ready16/blocked6; no prior receipt/pilot bytes changed. Brown bear is next separate
prototype. Production quality remains distinct from pending human review.

At13:59 UTC this continuation registered `deer/draft-v1` (adult white-tailed
doe) pending in `wildlife-v2-background-005`:125 exact source/output hashes,
30 retained meshes,84 poses, full head/ear replay and360 actual Chromium samples
over two complete sequences at each scale. Native heights front27/rear38/profile31
at the fixed40-degree-above-ground camera and10px/unit. Actual contralateral
walk landings and all facing/action/idle transitions were inspected; detailed
limits include tiny hoof clefts and a foreshortened rear flag. Brown bear's fresh
prototype is instead blocked with141 evidence hashes: flattened profile body,
narrow angled legs and weak rear anatomy/rake failed visual inspection despite
passing integrity checks. Neither failed bear nor squirrel is a master. Counts
are17 ready/seven blocked/172 queued, with all prior receipts preserved. Session
commands, captures and exact observations route through background-02-worker;
inventory/build refresh follows this registration before serial continuation.

At14:25 UTC `cow/draft-v1` joins batch005 pending, with141 exact hashes. Its
fresh48-mesh/100-pose Holstein source uses three fixed leg segments and paired
hoof toes; actual hind/front tracking residual is0.000000033 world units, with
the preceding forefoot lifted and three supports at every walk sample. Opened
all facing cycles, stable complete head/coat patches,601 actual Chromium samples
and twelve forced reset-clock regressions. The negative-frame reset failure and
earlier geometry/drawings remain rejected evidence. Native profile25/front29/
rear33px at10px/unit; small teats/hooves and front/profile tail occlusion are
recorded limitations. Ready18/blocked7; batch005 currently contains doe and cow.
Catalog/manifest/build refresh and serial queue continuation retain exact prior
bytes and receipts. All human review remains pending.

At14:47 UTC `sheep/draft-v1` joins pending batch005 as its third member with141
exact source/output hashes. Fresh44-mesh/100-pose Suffolk ewe source and authored
fleece/black-face masters retain fixed camera/density; native profile18/front20/
rear21px. Short profile muzzle and weak ear motion were rejected and retained;
revised rigid ears now visibly lift/widen without skull resizing. Opened every
facing, two walks/action/idle return at native/enlarged sizes beside vendor scenery
and Explorer;603 actual Chromium samples/19.784s cover both48-state sequences
per scale. Fresh source/replay/contact audits passed; three supports, fixed links
and ~0.00000006 world-unit hind/front tracking residual. Quiet native ear action
and tiny hoof/eye detail remain limitations. Ready19/blocked7; human review pending.
Receipt validation initially rejected a session-data artifact path; it was removed
from the allowed source/output map and separately hashed as evidence before the
validated receipt was persisted. Catalog/manifest/build refresh precedes horse.

At15:07 UTC `horse/draft-v1` fills pending batch005 (doe/cow/sheep/horse),141
exact hashes. Fresh47-mesh/100-pose bay horse has four fixed leg links including
pasterns, solid hooves, own raised neck/long face/mane/blaze and five-link tail.
Black-only rear neck and profile shoulder seam were rejected and corrected in
drawing02. Opened every facing at native/enlarged scale through two walks/action/
idle return;604 actual Chromium samples/19.792s and12 reset probes pass. Actual
footfalls HL0 FL4 HR8 FR12 alternate3,3,2,2 supports; no flight, tracking residual
0.000000013 world units. Profile37/front38/rear49px at10px/unit; upright rear neck,
steady head without natural nod and quieter profile tail are recorded limitations.
Catalog168 sheets/manifest574 candidates/247 identities and build/typecheck pass.
Queue tests8/8 pass; global lint currently4 errors, exact diagnostics retained.
Ready20/blocked7/queued169; next is piglet. All human review remains pending.

Batch005 validation at15:15 UTC: wildlife feedback unit2/2 and Workshop Chromium
2/2 pass. Browser output was buffered during preview teardown; test-port4174
PID3220/start15:09:58UTC was identified, taskkill was denied, native Stop-Process
succeeded and the runner returned exit0. Logs retain the5.6m teardown delay.
Current-session squirrel JS formatting was fixed with original bytes retained,
blocked evidence hashes refreshed and status regenerated; art/geometry unchanged.
Remaining global lint errors are prior registered ant button types and fish/robin
HTML UTF-8 failures, preserved exact bytes. Batch006 inbox/art notes have no
pending feedback. Piglet selected15:14; ready20/blocked7/in-progress1/queued168.

At15:44 UTC `piglet/draft-v1` is the first exact pending draft in batch006,
125 source/output hashes. Fresh44-mesh/84-pose domestic pig has own low barrel,
rigid broad snout, fleshy triangulated ears, paired bearing toes/elevated dewclaws
and editable mesh curl. Two finishing attempts were retained as evidence:
incorrect near-ear occlusion/thick closed curl, then needle-like profile ears.
Drawing03 fills independent ear hulls. Opened every facing native/enlarged through
two12-pose walks/eight ear-curl poses/idle return;500 actual Chromium samples over
16.559s,12 reset probes pass. HL0 FL3 HR6 FR9 alternates3,3,2 support without flight;
hind undertracks0.45units. Profile18/front23/rear24px at10px/unit; tiny curl,
subtle profile action and covered far roots are recorded limits. Source audit
and explicit replay pass. Initial Windows quoting broke registration and caused
premature receipt persistence; corrected structured registration succeeded,
exact receipt/registered hashes revalidated before selecting anything else.
Concurrent initial manifest/build failed changed-input/stale-inventory checks;
after registration catalog169 and manifest575 candidates/248 identities pass.
Ready21/blocked7/queued168; next eligible is goat. All human review pending.

At15:59 UTC `goat/draft-v1` is pending batch006 animal2,140 exact hashes.
Own43-mesh/100-pose horned tawny buck retains curved horns/beard/raised neck,
cloven toes/mobile ears/upright tail. Rejected bright horn bars and overlong tail
were corrected in drawing02/geometry02; no per-frame scaling. Opened every facing
native/enlarged through two16-pose walks/eight ear-tail poses/idle return:
600 actual Chromium samples/19.776s and12 reset probes pass. HL0 FL4 HR8 FR12,
supports3,3,3,2/no flight and0.02000005unit hind track; fixed segments/actual toe
floors and deterministic replay pass. Profile/front23px, rear28px at10px/unit;
simple narrow rear neck and quiet profile action documented. Catalog170,
manifest576 candidates/249 identities and build pass. Session receipt helper now
requires exact registered hashes and batchsize<=4 before persistence; quoted
commands use structured files. Ready22/blocked7/queued167, human review pending.

At16:35 UTC `chicken/draft-v1` is blocked,124 evidence hashes, no registration.
Fresh47-mesh/84-pose ground-bird prototype geometry04/drawing03 passed actual
toe-floor/fixed wing/head-volume and deterministic replay audits.503 actual
Chromium samples/16.583s cover two walks/action/idle at native/integer4x in every
facing, all opened. Front dark tail post/indistinct face and bare rear neck still
fail the visual gate despite connected wing action and alternating contacts.
Retained three rejected revisions include the corrected0.008unit toe-floor gap.
Native profile15/front16/rear17px; primary anatomy text available, direct image
downloads blocked WinError10013. Full findings in its review-observations.md;
ground-bird siblings stay gated. Ready22/blocked8/queued166, no human feedback.

Predator 132 gameplay checkpoint: tiger now has provisional editor placement,
rare deer-glade world ownership and the shared hunting/feeding behavior. A meal
replaces one deer/rabbit with a new durable identity in its existing habitat;
manual deletion remains permanent. Players, pets and farm animals are excluded.
Existing tiger pixels remain pilot-v1; accelerated walk/lowered-head feeding and
a grounded jaw-display lunge are provisional animation reuse. All art review
remains pending. The other three authorized predators are the next stages.

Predator 132 panther checkpoint: new hunt-v1 Blender/pixel source and complete
portable pending review are registered; rare world spawning, editor placement,
shared hunting and Canvas/GPU reload checks pass. The common lunge now begins at
footprint contact distance, carries pursuit through phase changes and briefly
shows the jaw before a catch. Already-fleeing deer and airborne/grounded rabbit
cases cover the corrected behavior. Tiger and historical source pixels remain
unchanged. Lion and brown bear remain the next authorized stages.

Predator 132 lion checkpoint: new editable hunt-v1 with a twelve-piece mane,
complete portable pending review, fixed natural owner, editor placement and
shared hunting is implemented. Both rendering paths preserve feeding on reload;
41 focused checks pass. The authorized brown bear is the remaining stage.

Predator 132 brown-bear checkpoint: all four authorized predators now have natural
world owners, editor placement and shared bounded hunting/feeding. Brown bear has
its own broad-body, short-tail editable hunt-v1 source with distinct footfall
sequence; all new art is registered and pending human review. Exact receipts,
51 focused checks, both renderers, ordinary-world creation/deletion/reopening,
repeated replacement and two reloads pass. Full units are 2,660 passed with five
existing Windows platform failures and ten static-file skips. Full browser
validation completes with 632 passed / 13 failed / 1 skipped; all 16 predator/art
checks pass and all failing test titles match the pre-implementation run. Evidence
and unresolved broad-suite limitations belong to tactical 132. Next
product step is playtesting hunt frequency and reviewing the native animations.

The completion push rebased over concurrent city/vehicle/resident work. Combined
head revalidation passes typecheck/build/lint, all 23 targeted predator/art and
lived-in-interior browser checks, streaming readiness and a fresh repeated-meal
population/reload soak. Full combined units: 2,706 passed / the same five Windows
failures / ten skips. Tactical 132 distinguishes this evidence from its earlier
full 646-case browser run. All four implementation stages and art receipts remain
intact; human animation review and hunt-frequency playtesting are next.
