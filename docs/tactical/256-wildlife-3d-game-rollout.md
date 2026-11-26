# 256 Wildlife 3D game rollout

Owner requested the full rollout on 2026-11-20. On 2026-11-22 the owner
authorized ordinary-play activation by animation coverage. The default bank
now covers 113 animals.

[Animation ledger](256-wildlife-3d-game-rollout/animation-ledger.json) ·
[New-session handoff](256-wildlife-3d-game-rollout/handoff.md) ·
[Draft campaign and evidence](255-wildlife-3d-model-campaign/progress.md) ·
[3D assets topic](../topics/3d-assets.md)

## Goal

Ship all 219 Tilefun animal identities from the 255 roster as default 3D
animals in normal play. Give every reachable gameplay animation state its own
distinct, sprite-guided 3D animation. Preserve the animal's character and
behavior at game size, using the tuxedo cat as the finish benchmark. Retain the
editable sources and exact review evidence, and verify the shipped build,
shared game/lab rendering, sprite fallback and performance.

## Scope and starting point

- The [255 roster](255-wildlife-3d-model-campaign/roster.md) contains 206 Animal
  Browser entries and 13 classic editor animals. Use the stable runtime type
  for each entry, including coat variants. Animal-themed player and NPC looks
  belong to the separate character catalog.
- The existing rigid-part rabbit is the sole normal-game 3D entry. All 219
  campaign GLBs and editable Blender files are available as starting points.
  The opt-in development catalog drew 3,069 samples across 1,023 animation
  states. The snapshot found 219 states across 202 animals that bind to a GLB
  action already used by another state of the same animal. The remaining
  bindings still need their distinct motion and gameplay timing checked.
- The prior campaign left 211 animals at its two-pass review cap and eight
  reviews pending. Preserve its exact evidence and open findings. The current
  rollout authorizes authoring and polishing assets with the new motions.
  Preserve each exact candidate and its evidence under its own identity.
- Use one distinct animated performance for each existing reachable state of
  each animal. Qualify distinct motion from the poses and action curves at
  the actual gameplay speed.
  Shared rigs and authoring tools are appropriate. A coat-only variant can
  inherit a body-plan rig and motion set when that matches the reference, with
  every state verified for the exact shipped coat. For classic animals whose
  gameplay exposes an idle and one travel cycle, qualify those two states.
  Preserve the game's current behavior, event timing and world/save formats.

## Work in playable batches

1. **Establish the production path and qualify a representative first batch.**
   Use the cat, rabbit, one flier and one swimmer to prove the normal catalog,
   build asset paths, animation binding and play/lab workflow. Start with
   named behavior examples such as cat stalk, pounce, climb and flee and
   rabbit hop and eating. Use the game's actor clip and phase as the clock.
   Exercise actual gameplay transitions, contact, eye line, depth, occlusion
   and any carried item. Audit the roster against current entity definitions
   at launch and reconcile any differences in the ledger.
2. **Author and qualify the rest by shared body plan.** Use each active sprite,
   gameplay state and timing as the reference for posing, contact and action
   arcs. Prioritize shared-action bindings and the material silhouette and
   movement findings from 255. Inspect all states at native play zoom and a
   useful close view. Check entry, exit, one-shot completion, idle and loop
   seams, resets, facing changes and airborne or water contacts as applicable.
   Keep an editable Blender source, optimized GLB, matched stills and short
   action video per animal. Preserve existing sprite references for comparison
   and fallback.
3. **Register exact assets in batches.** Commit the GLB, Blender source and
   comparisons and register the model with the existing Workshop tools.
   Check each required action through the shared renderer. Workshop still
   accepts feedback on individual candidates.
4. **Ship through normal play.** The shared catalog uses the exact candidates
   selected in `src/wildlife/default-models.json` and checks their actions on load. A fresh
   browser shows eligible models by default. **3D animals** switches the
   whole view to sprites. In model mode animals with a default asset
   appear when it is ready. Animals without a default asset use sprites.
   Check existing and newly placed animals, save/reload and replicated play. Reuse the shared
   scene in Workshop. Production builds need the complete asset bank from
   a fresh checkout. Use the repository's [release and CI path](../topics/testing.md#ci-and-deployment)
   for the live build, and record the served revision and URL in the ledger.
   For a completed playable change in the shared development checkout, run
   `npm run dev:ready` after the final playable write and verification.

## Tracking and completion evidence

The [ledger](256-wildlife-3d-game-rollout/animation-ledger.json) is keyed by
runtime identity. `draft` pins the latest 255 input, including its hash and
review disposition. `previewClipsByState` records all required states and
their current preview bindings. Keep this starting snapshot and record any
runtime scope reconciliation in the execution notes.

- Add a key to `qualifiedClips` only after testing that state's own exported
  action, with its action name, exact candidate hash and evidence path.
- Fill `live` with the served revision, URL and verification result. Record
  any unresolved gap in the relevant animal or batch.
- Check the complete runtime definition and GLB registry below the browser.
  Assert that every required state reaches its own action and flag duplicated
  motion data as well as reused names. Extend the existing renderer harness
  for representative real gameplay transitions in the game and Workshop.
  Compare production model and sprite lanes for cold and warm loading,
  traversal and mixed-species crowds. Record desktop, phone and Steam Deck
  evidence or identify which device remains unverified. Use the
  [performance workflow](../topics/performance.md) and existing benchmark
  scripts. Run the affected tests, production build, art catalog and Workshop
  manifest checks.
- Completion means 219 campaign roster entries served and verified in normal
  play, with every reachable state qualified and each exact asset traceable
  to its model files. Recompute totals from current runtime definitions
  and verify the actual live build before closing the goal.

## Delivery log

### Small hunters and woodland mammals, 2026-11-26

Fossa, honey badger, mongoose and white-nosed coati use independent chase
motions. Panda, capybara, red panda and skunk have separate foraging and
escape poses. The koala, echidna, binturong and kinkajou complete the third
batch, with separate short, low escape steps. All 52 states played in
Workshop and in reopened game worlds with the exact models. [Small hunters](256-wildlife-3d-game-rollout/evidence/small-ground-hunters-v1-deployment.json) ·
[Forest mammals](256-wildlife-3d-game-rollout/evidence/forest-mammals-v1-deployment.json) ·
[Tree and scrub mammals](256-wildlife-3d-game-rollout/evidence/tree-and-scrub-mammals-v1-deployment.json)

### Bears and canids, 2026-11-26

The brown and polar bear have longer planted legs and heavier front
quarters. The coyote and wolf have pointed ears, dark feet and low tails.
Each has separate walk, feeding, display and pursuit motions. All 20
states played with the exact previews in Workshop and in reopened game
worlds. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/bears-and-canids-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/bears-and-canids-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-brown-bear-bears-and-canids-v1)

The deployed game now has full state evidence for 110 of the 113 selected
models. Six farm animals and the coconut crab passed. The hen needs contact
to flee, so the exact Workshop stage now offers the same landing test as
other wildlife. The frog and mallard stages contain both a bank and shallow
water. All three passed on the public development checkout and are ready
for the production repeat. [Animation ledger](256-wildlife-3d-game-rollout/animation-ledger.json)

### Woodland crawlers, 2026-11-26

The newt keeps a narrow orange stripe. The salamander lowers its head and
keeps a dark tail behind its spotted back. The Texas horned lizard raises
its crown, and the land tortoise reaches forward below the shell. The
four each have an independent escape gait. All 16 states played in the
exact previews and in reopened game worlds. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/woodland-crawlers-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/woodland-crawlers-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-newt-woodland-crawlers-v1)

Production checks now cover all previously selected swimmers and marine
hunters, including the remaining seals and shore animals. The rust crab
also played all four states. For these runs the full reopened-world evidence
is stored beside each animal's ledger row. [Animation ledger](256-wildlife-3d-game-rollout/animation-ledger.json)

### Lizards, 2026-11-26

The chameleon reaches forward over planted feet. The frilled-neck lizard
opens both halves of its collar. The gecko raises its head over splayed
feet, and the iguana lifts its head with the crest visible. Each has a
separate escape motion. All 16 states played in Workshop and in reopened
ordinary worlds with the exact previews. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/lizards-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/lizards-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-chameleon-lizards-v1)

Production evidence adds the dugong, humpback whale, manatee, manta ray,
whale shark, horseshoe crab, shrimp, sunfish and pufferfish. The cuttlefish,
dolphin and shark also chased, fed and displayed in reopened default
worlds. Their ponds contain ordinary prey, and the player provoked a
display with the Stick tool. The harbor seal, penguin and river otter
played both land and water escape states. [Production evidence directory](256-wildlife-3d-game-rollout/evidence/)

### Ground insects, 2026-11-26

The ant, earwig, leaf insect and roly-poly have separate escape gaits. The
earwig raises its pincers, and the roly-poly ripples seven pairs of feet
under its shell. All 16 states played in the exact Workshop previews and
after reopening ordinary game worlds. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/ground-insects-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/ground-insects-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-ant-ground-insects-v1)

The production verifier builds a pond through the ordinary terrain editor
and approaches from its bank. A running jump brings the player within
startle range of the largest swimmer. Full default playback passed for the
blue whale, three pond animals, four reef animals, and the jellyfish,
nautilus and octopus. [Blue whale](256-wildlife-3d-game-rollout/evidence/blue-whale-swimmers-v1-default.json) ·
[Pond animals](256-wildlife-3d-game-rollout/evidence/pond-fauna-v1-default.json) ·
[Reef animals](256-wildlife-3d-game-rollout/evidence/reef-fauna-v1-default.json) ·
[Marine invertebrates](256-wildlife-3d-game-rollout/evidence/soft-bodied-swimmers-v1-default.json)

### Flying insects and bat, 2026-11-26

The dragonfly and butterfly beat their rear wings independently, and the
bat folds its membrane wings around its body. The bee lowers its legs and
head toward the flower while its wings keep beating. All four have a
distinct escape. The exact candidate previews played all 17 states in
Workshop and in reopened game worlds. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/flying-insects-and-bat-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/flying-insects-and-bat-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-bee-flying-insects-and-bat-v1)

### Leopard, lion, tiger and panther, 2026-11-26

The leopard extends into a longer pursuit. The lion carries its mane
through a shorter bound, the tiger plants wider forepaws and the panther
keeps its head lower as it gathers. All 20 states played in Workshop and
reopened ordinary worlds with the exact review models. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/big-cats-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/big-cats-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-leopard-big-cats-v1)

The preceding wild-cat commit's deployment build rejected the Workshop
manifest after the review recipe moved between files. Both model batches
are included in the refreshed manifest. The full local production build,
including the manifest check, passed against the refreshed checkpoint.

### Bobcat, lynx, cheetah and jaguar, 2026-11-26

The four wild cats have distinct pursuit poses, dark paws and species-specific
ear, tail and coat profiles. The cheetah makes a longer extension than the
jaguar. The shared review scene uses ordinary rabbits for chase and feeding.
The deployed preview played all 20 states in Workshop and in reopened game
worlds. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/wild-cats-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/wild-cats-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-bobcat-wild-cats-v1)

The default game also replayed all states for the woodland browsers, both
upright variants, the elephant and giraffe, and the camel and mule.
[Woodland browsers](256-wildlife-3d-game-rollout/evidence/woodland-browsers-v1-default.json) ·
[Upright variants](256-wildlife-3d-game-rollout/evidence/upright-herbivores-v1-default.json) ·
[Elephant and giraffe](256-wildlife-3d-game-rollout/evidence/canopy-and-fruit-v1-default.json) ·
[Pack mounts](256-wildlife-3d-game-rollout/evidence/pack-mounts-v1-default.json)

### Hoppers and beetles, 2026-11-26

The cricket and grasshopper load their bent hind legs before kicking. Their
escape pushes farther and starts sooner. The ladybug and stag beetle open
their shell halves during flight and tuck their feet during the wider,
faster escape stroke. All 16 states played in Workshop and reopened game
worlds through the exact preview links. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/hoppers-and-beetles-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/hoppers-and-beetles-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-cricket-hoppers-and-beetles-v1)

Production playback also covered the four browsing antelopes, four heavy
herd species, four dryland grazers, and three pasture and savanna species.
[Browsing antelopes](256-wildlife-3d-game-rollout/evidence/browsing-antelopes-v1-default.json) ·
[Heavy herds](256-wildlife-3d-game-rollout/evidence/heavy-herds-v1-default.json) ·
[Dryland grazers](256-wildlife-3d-game-rollout/evidence/dryland-grazers-v1-default.json) ·
[Pasture and savanna](256-wildlife-3d-game-rollout/evidence/plateau-herbivores-v1-default.json)

### Insect-eating mammals, 2026-11-26

The aardvark scrapes with its forefeet and lowers its nose. The giant
anteater probes with its long snout, and the armadillo and pangolin use
shorter, lower scrapes. Each has a separate escape stride. All 16 states
played in Workshop and in reopened game worlds through the exact preview
links. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/insect-eating-mammals-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/insect-eating-mammals-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-aardvark-insect-eating-mammals-v1)

The deployed default game replayed all rabbit, robin and pond fish pilot clips
after reopening ordinary worlds with greens, seeds and a shallow pond whose
bank let the player approach close enough to trigger the fish's escape. It also replayed the
full default cycles for the macropods, cervids, great apes and urban small
mammals. [Rabbit](256-wildlife-3d-game-rollout/evidence/rabbit-pilot-v1-default.json) ·
[Robin](256-wildlife-3d-game-rollout/evidence/robin-pilot-v1-default.json) ·
[Pond fish](256-wildlife-3d-game-rollout/evidence/fish-pilot-v1-default.json) ·
[Macropods](256-wildlife-3d-game-rollout/evidence/macropods-v1-default.json) ·
[Cervids](256-wildlife-3d-game-rollout/evidence/cervids-v1-default.json) ·
[Great apes](256-wildlife-3d-game-rollout/evidence/great-apes-v1-default.json) ·
[Urban small mammals](256-wildlife-3d-game-rollout/evidence/urban-small-mammals-v1-default.json)

### Raptors, 2026-11-26

The bald eagle, red-tailed hawk and tawny owl have separate ground steps,
feeding, threat, sleep, cruise and pursuit clips. The secretary bird raises
its crest and stamps with one foot during the threat display. Without a perch,
an aerial hunter now naps on the ground and resumes patrol after the hunt
cooldown. The exact checks observed all 26 states in Workshop and after
saving and reopening ordinary game worlds. [Renderer evidence](256-wildlife-3d-game-rollout/evidence/raptors-v1-runtime.json) ·
[Public preview evidence](256-wildlife-3d-game-rollout/evidence/raptors-v1-deployment.json) ·
[Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-eagle-raptors-v1)

### Working and display birds, 2026-11-26

The carrion crow places twigs, the raven scrapes and buries, and the hummingbird
has separate sipping and guard hovers. The peacock opens seven articulated
feathers, holds the raised fan and closes it. [The exact preview report](256-wildlife-3d-game-rollout/evidence/working-and-display-birds-v1-deployment.json)
records all 25 states in Workshop and in reopened game worlds. The crow's
game check uses its original nest setup, then clears the remaining twigs and
tree through the editor to show the ground escape.

The [tuxedo cat](256-wildlife-3d-game-rollout/evidence/tuxedo-cat-v1-default.json),
[ginger tabby](256-wildlife-3d-game-rollout/evidence/ginger-tabby-v1-default.json)
and [black cat](256-wildlife-3d-game-rollout/evidence/black-cat-v1-default.json)
each played all nine states on the production revision, including after a
saved-world reload. The tester used the ordinary Ball hotbar tool and paced
its throws so the cat had three opportunities to play and climb.

### Waders and forest birds, 2026-11-26

The flamingo, great blue heron, marabou stork and shoebill use individual
neck and bill motions with planted feet. The great hornbill and toucan have
distinct bill profiles and separate cruise and escape wingbeats. The kakapo
uses a low ground gait, and the wild turkey raises its tail fan while holding
its red head upright. The public exact preview runs captured all 32 states
in Workshop and in ordinary saved worlds. [Waders](256-wildlife-3d-game-rollout/evidence/waders-v1-deployment.json) ·
[Forest birds](256-wildlife-3d-game-rollout/evidence/forest-birds-v1-deployment.json)

Production evidence also covers the classic yard and fliers, pet rodents,
forest primates and tricolor dog. The dog fetched and released the ball in an
ordinary reopened world with the default model. [Dog evidence](256-wildlife-3d-game-rollout/evidence/dog-fetch-v1-default.json)

### Flightless birds and golden retriever, 2026-11-26

The cassowary, emu, ostrich and kiwi use distinct walk and escape footfalls.
The cassowary lunges, the emu and ostrich dip their necks, and the kiwi probes
with its extended bill. The golden retriever carries a lower tail and uses a
separate bound when startled. The public preview checks exercised all 20
states in Workshop and after reopening editor-placed animals in the game.
[Flightless bird evidence](256-wildlife-3d-game-rollout/evidence/ratites-v1-deployment.json) ·
[Golden retriever evidence](256-wildlife-3d-game-rollout/evidence/golden-retriever-v1-deployment.json)

The public authoring checkout played all nine states for all three cat coats
in Workshop and in reopened ordinary worlds. The production repeat is tracked
separately. The earlier seabird commit failed formatting checks on newly
generated default evidence. The ledger uses the repository formatter and the
verifier's default reports use the same formatting exemption as preview reports.

Production checks also verified both default states on the classic fish and
worms, plus all four default states for the quokka and wombat after save and
reopen. These nine animals have exact release evidence in the ledger.

### Seabirds and cat canopy access, 2026-11-26

The Atlantic puffin, blue-footed booby, great frigatebird and pelican reuse
their archived draft rigs. The side profiles now match the sprite lengths
within two native pixels in both facings. The frigatebird has a forked tail.
The booby opens its bill and the pelican drops its pouch while scooping.
[Renderer evidence](256-wildlife-3d-game-rollout/evidence/seabirds-v1-runtime.json)
records 448 samples. The [public preview report](256-wildlife-3d-game-rollout/evidence/seabirds-v1-deployment.json)
records all 16 states in Workshop and in reopened game worlds. These exact
models are [open for review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-atlantic-puffin-seabirds-v1).

All three pilot and pet cat coats can reach a native oak crown under the
shared Realm. Their previous route rose into the canopy collider. They now
climb beside it, step over the lip and settle on top. The native regression
checks the third play, climb, actual perch height, save/reload and descent.

The [shepherd report](256-wildlife-3d-game-rollout/evidence/pointed-ear-shepherd-v1-default.json)
pins the deployed commit, manifest fingerprint and default GLB. All four
states, including the previously missing flee, played in Workshop and in a
reopened default game world. The release verifier accepts `--candidate=ID`
and `--revision=SHA`; `record-3d-default-evidence.mjs REPORT REPORT_NAME`
adds a ledger `live` entry after all states pass on both paths.

### Yard and canopy birds, 2026-11-26

The dove, sparrow, rock pigeon and parrot reuse their exact archived Blender
meshes and packed palettes. The updated rigs have four sprite-guided actions
each. The normal wingbeat folds through recovery. The escape pitches into a
wider stroke with tucked feet, and the peck keeps both feet planted. Palette
changes carry over the dove's rust wing edging, sparrow's bill and bib, pigeon
wingbars and parrot's red trim.

The [renderer report](256-wildlife-3d-game-rollout/evidence/yard-and-canopy-birds-v1-runtime.json)
records 448 samples across 16 states and the sprite preference. The
[public preview report](256-wildlife-3d-game-rollout/evidence/yard-and-canopy-birds-v1-deployment.json)
pins the exact files and records all four states for each bird in Workshop
and after saving and reopening a normal game world under the preview link.
The four candidates are [open for Workshop review](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-dove-yard-and-canopy-birds-v1).

The default catalog pins all 113 previously enabled model IDs. Future releases
can select qualified candidates individually through `promote-3d-rollout.mjs`.
The command requires the exact Workshop approval and includes its fingerprint
with the ledger's promotion record. The shared renderer rechecked all 515
enabled states in 14,420 samples. The resume check found no approved 3D
candidates in the Workshop inbox.

### Model-only rendering for registered animals

Every ready wildlife model in range draws when **3D animals** is on. The former
24-instance budget and automatic sprite fallback are retired. The four-load
concurrency limit remains, and idle model batches can be evicted above the
48-batch cache target. Sprite-scene reviews require the explicit sprite setting
when the view has selected models, including while those models are unavailable.

### Default activation, 2026-11-22

113 of the 219 campaign models cover all current sprite states with distinct
actions. The 111 existing registrations and the retained frog and mallard
GLBs now share the same paths in ordinary play and exact Workshop previews.
The shared renderer verified 14,420 samples across all 515 enabled states
and exercised sprite fallback with models disabled. The 106 other campaign
models reuse at least one action and remain on sprites. Farm-only rooster
and chick forms also use sprites.

The [frog and mallard report](256-wildlife-3d-game-rollout/evidence/frogs-and-ducks-v1-runtime.json)
pins both original GLBs and their 280 state samples. A fresh production game
placed the two cows and a fox. Both cows drew as models at default settings,
the fox drew as a sprite, and the global setting survived a saved-world reload.

### Initial registration, 2026-11-20

2026-11-20. Pinned 219 editable inputs and model fingerprints against the
current roster and checked all 1,023 draft bindings against the exported GLBs.

### Playable review batches

The active roster still has 206 Animal Browser entries and 13 classic animals.
The runtime definition audit found the same 1,023 states as the handoff.
The candidate bank and the runtime registry shared one scene and animation
clock. An explicit review link loaded the exact pending GLB in play or
Workshop, and ordinary play used the legacy rigid rabbit.

| Batch | Candidate animals | State bindings | Shared renderer samples | Review |
| --- | --- | ---: | ---: | --- |
| Pilot | Cat, rabbit, robin, pond fish | 22 | 616 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-cat-pilot-v1) |
| Pets | Ginger tabby, black cat, dog, pointed-ear shepherd | 28 | 784 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-cat-ginger-pets-v1) |
| Swimmers | Blue whale, humpback whale, dugong, West Indian manatee | 16 | 448 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-blue-whale-swimmers-v1) |
| Marine hunters | Dolphin, orca, narwhal, swordfish | 20 | 560 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-dolphin-marine-hunters-v1) |
| Pinnipeds | Harbor seal, California sea lion, walrus | 18 | 504 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-harbor-seal-pinnipeds-v1) |
| Sharks and rays | Shark, hammerhead shark, whale shark, manta ray | 18 | 504 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-shark-sharks-rays-v1) |
| Distinctive fish | Anglerfish, pufferfish, ocean sunfish | 13 | 364 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-anglerfish-distinct-fish-v1) |
| Eels | Electric eel, moray eel | 10 | 280 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-electric-eel-eels-v1) |
| Soft-bodied marine animals | Cuttlefish, rust octopus, nautilus, moon jellyfish | 17 | 476 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-cuttlefish-soft-bodied-marine-v1) |
| Marine arthropods | Lobster, peacock mantis shrimp, shrimp, horseshoe crab | 18 | 504 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-lobster-marine-arthropods-v1) |
| Reef fauna | Seahorse, leafy seadragon, starfish, sea turtle | 16 | 448 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-seahorse-reef-fauna-v1) |
| Shore fauna | Penguin, platypus, river otter | 18 | 504 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-penguin-shore-fauna-v1) |
| Pond fauna | Hippopotamus, axolotl, pond turtle | 12 | 336 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-axolotl-pond-fauna-v1) |
| Crabs | Rust crab, coconut crab | 9 | 252 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-crab-crabs-v1) |
| Farm herd | Pasture cow, sheep, horse, grey donkey | 34 | 952 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-cow-farm-herd-v1) |
| Farmyard | Goat, pig, buff hen | 23 | 644 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-goat-farmyard-v1) |
| Classic yard | Chicken, cow, pigeon, pigeon 2 | 8 | 224 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-cow-classic-yard-v1) |
| Classic fliers | Crow, seagull | 4 | 112 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-crow-classic-fliers-v1) |
| Classic fish | Fish 1, fish 2, fish 3 | 6 | 168 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-fish1-classic-fish-v1) |
| Classic worms | Worms 1–4 | 8 | 224 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-worm1-classic-worms-v1) |
| Browsing antelopes | Gemsbok, gazelle, springbok, gerenuk | 16 | 448 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-gemsbok-oryx-browsing-antelopes-v1) |
| Cervids | Elk, moose | 8 | 224 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-elk-cervids-v1) |
| Heavy herds | American bison, water buffalo, wildebeest, musk ox | 16 | 448 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-american-bison-heavy-herds-v1) |
| Dryland grazers | Impala, saiga antelope, zebra, white rhinoceros | 16 | 448 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-zebra-dryland-grazers-v1) |
| Woodland browsers | White-tailed deer, okapi, Malayan tapir | 16 | 448 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-deer-woodland-browsers-v1) |
| Pasture and savanna | Brown llama, cream alpaca, warthog | 12 | 336 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-llama-plateau-herbivores-v1) |
| Great apes | Silverback gorilla, chimpanzee, orangutan | 12 | 336 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-gorilla-great-apes-v1) |
| Forest primates | Japanese macaque, mandrill, proboscis monkey, ring-tailed lemur | 16 | 448 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-mandrill-forest-primates-v1) |
| Upright herbivores | Upright elephant, upright giraffe | 8 | 224 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-elephant-upright-upright-herbivores-v1) |
| Canopy and fruit | Elephant, giraffe | 15 | 420 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-elephant-canopy-and-fruit-v1) |
| Pack mounts | Brown mule, dromedary camel | 12 | 336 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-mule-pack-mounts-v1) |
| Macropods | Kangaroo, red-necked wallaby | 8 | 224 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-kangaroo-macropods-v1) |
| Pet rodents | Guinea pig, hamster, chinchilla | 12 | 336 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-guinea-pig-pet-rodents-v1) |
| Urban small mammals | Mouse, rat, Virginia opossum | 12 | 336 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-mouse-urban-small-mammals-v1) |
| Ground marsupials | Quokka, wombat | 8 | 224 | [Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Awildlife-3d-quokka-ground-marsupials-v1) |

The skinned renderer verified each binding in four facings and compared its
sampled bone transforms to detect stationary or duplicate actions. Comparisons
include sprite and model at native scale and enlarged, with motion playback
paced by gameplay clips. The cat has independent instances and passes the
foreground and background occlusion check. The rabbit's feeding dip and the
robin's wing spread now have their own pose curves. The cat, pond fish and pet
variants use separate escape actions. The dog has separate pickup and release
curves.
The swimmers have separate escape motion and species-specific gestures, with
horizontal flukes or a rounded manatee paddle. The Blue whale's ordinary Animal
Browser arrival did not present its actor in the verification run. Exact review
links for deep-water fauna now open a staged pond using the ordinary Realm,
rules, and shared renderer. The staged scene has its own purpose and leaves the
ordinary landscape candidate's feedback disabled there.

The marine hunters use separate body and tail curves for pursuit, feeding and
display. Orca markings are painted into the surface. The dolphin has a tapered
beak, the narwhal a longer tusk, and the swordfish a thinner bill and raised
dorsal fin. Their staged pond contains live prey. The same ordinary Realm
stage provides sand and shallows for the pinnipeds, with one actor on shore and
one in the water. Their replacement rigs have independent front and rear
flippers. Harbor seal hauls belly down, sea lion raises its chest and steps,
and walrus carries its tusks and weight through the forelimb push.
The [marine hunter deployment report](256-wildlife-3d-game-rollout/evidence/marine-hunters-v1-deployment.json)
records all five gameplay states for each hunter in the public review stage,
including display after ordinary player landing contact. The
[pinniped deployment report](256-wildlife-3d-game-rollout/evidence/pinnipeds-v1-deployment.json)
records all six states for each species, including separate escapes triggered
by player landing on dry ground and in water.

The shark and hammerhead have separate feeding, pursuit and display curves.
The whale shark has painted spots and bars and a stronger escape stroke. The
manta ray has a continuous fin surface with separate cruising, escape and
feeding motion. The
[shark and ray deployment report](256-wildlife-3d-game-rollout/evidence/sharks-rays-v1-deployment.json)
records every gameplay state under the public review stage and placement and
reopen in the game with the candidate selected.

The anglerfish has an articulated lure and jaw. The pufferfish has an inflation
action and separate fin and tail motion. The ocean sunfish drives its dorsal
and anal fins independently around a tall, flattened body. The
[distinctive fish deployment report](256-wildlife-3d-game-rollout/evidence/distinct-fish-v1-deployment.json)
records all 13 states, including the anglerfish catching prey and feeding.

Both eels have continuous ribbon fins and articulated jaws. Their steady swimming
and faster chase send different waves along the body. Feeding works the jaw,
while display raises the head and curls the body. The cuttlefish ripples its
side fins and extends two longer tentacles to feed. The octopus fans and gathers
its eight arms, the nautilus extends or retracts its arms from a striped shell,
and the moon jellyfish contracts its lavender bell to pulse or escape. The
[eel report](256-wildlife-3d-game-rollout/evidence/eels-v1-deployment.json) and
[soft-bodied marine report](256-wildlife-3d-game-rollout/evidence/soft-bodied-marine-v1-deployment.json)
record all 27 states, model preference switching, placement and save/reopen
with the exact candidates loaded.

The lobster reaches and closes its pincers to feed. The mantis shrimp has a
faster strike and uses a separate raised display. The shrimp curls its abdomen
to escape, and the horseshoe crab has tucked paddling legs and a hinged rear
shield and tail. The seahorse's curled tail and upright body contrast with the
leafy seadragon's elongated body and articulated fronds. The starfish flexes
five arms from a low central disc. The sea turtle swims with broad foreflipper
strokes and tucks them through its faster escape cycle. The
[marine arthropod report](256-wildlife-3d-game-rollout/evidence/marine-arthropods-v1-deployment.json)
and [reef fauna report](256-wildlife-3d-game-rollout/evidence/reef-fauna-v1-deployment.json)
record all 34 states, including ordinary feeding and player contact, plus the
preference switch and placement and save/reopen with each candidate loaded.

The penguin waddles upright and pitches forward for both swim states. The
platypus paddles with a broad tail and the river otter undulates with a tapered
one. The hippopotamus has a hinged jaw, the axolotl fans its gills, and the pond
turtle retracts its head. The rust crab has a sideways gait. The coconut crab
walks, pursues prey, feeds and raises its pincers in separate performances.
The review stage provides shallows for the pond species and lets the coconut
crab hunt placed prey under the ordinary Realm rules. The
[shore report](256-wildlife-3d-game-rollout/evidence/shore-fauna-v1-deployment.json),
[pond report](256-wildlife-3d-game-rollout/evidence/pond-fauna-v1-deployment.json)
and [crab report](256-wildlife-3d-game-rollout/evidence/crabs-v1-deployment.json)
record all 39 states. Player landing contact exercised both escape media for
all three shore species, an escape for each pond animal and the rust crab, and
the coconut crab's display.

The farm herd models share an articulated body and foot rig. The cow lowers
and raises its muzzle between grazing and cud chewing. The sheep opens its
jaw to bleat. The horse drinks, and the grey donkey lies down and rolls. Both
mounts have separate ridden and sprinting gaits. The goat rears to browse and
gathers its legs to hop. The pig sniffs, roots, picks up food and chews. The hen
rakes the soil, pecks and dips to eat. The exact model review runs the existing
farm behavior recipes with their real forage, dust, browse and perch fixtures.
The [herd report](256-wildlife-3d-game-rollout/evidence/farm-herd-v1-deployment.json)
and [farmyard report](256-wildlife-3d-game-rollout/evidence/farmyard-v1-deployment.json)
record all 57 states in the public review build. The player approached each
animal to trigger escape, landed on both mounts and used ordinary movement and
sprint input to exercise both ridden clips.

The classic editor animals use the existing replicated movement bit and
sprite frame timing to select idle and travel. The cow, chicken and fish
models follow the sprites' left/right mirror. The two pigeons keep their
front-facing presentation. Crow, seagull and worms use their ordinary
four-way direction. Their exact review stages place them through the same
entity factories that the editor uses. The
[yard](256-wildlife-3d-game-rollout/evidence/classic-yard-v1-deployment.json),
[flier](256-wildlife-3d-game-rollout/evidence/classic-fliers-v1-deployment.json),
[fish](256-wildlife-3d-game-rollout/evidence/classic-fish-v1-deployment.json)
and [worm](256-wildlife-3d-game-rollout/evidence/classic-worms-v1-deployment.json)
reports record both states for every animal in Workshop and again after
placing, saving and reopening it in the game with its candidate selected.

The [pilot deployment report](256-wildlife-3d-game-rollout/evidence/pilot-v1-deployment.json)
pins the public Workshop manifest digest, exact fingerprints and states seen
under live authority. All four loaded under the public review URL, exercised
the sprite switch, and appeared when placed and reopened in an ordinary game
world with the matching review link. The rabbit, robin and pond fish were
observed in every state. A separate headless run reached the cat's climb clip
with either an oak or a palm, then found the canopy obstructed the end of the
climb before the cat could sit. The
[pet deployment report](256-wildlife-3d-game-rollout/evidence/pets-v1-deployment.json)
records the same checks plus the dog picking up, carrying and releasing a ball
under live authority. The [swimmer deployment report](256-wildlife-3d-game-rollout/evidence/swimmers-v1-deployment.json)
records all 16 staged pond states and ordinary-world placement and reopen
checks for all four exact models. The state samples outside the observed
pilot and pet subsets come from the direct shared-renderer harness. All
111 registered candidates await their exact Workshop decisions. Their 505
state bindings have shared-renderer evidence. The public review build has
shown 489 states, with complete state coverage for 107 animals. Promotion,
production CI publishing and default-play acceptance are pending.

The four new grazer batches cover 14 animals and 56 states. They use active
sprite coat colors and per-species head drops and reaches. For the escape
clip, lighter grazers have a wider, quicker flex than the compact heavy herds.
The gemsbok's long narrow horns, the moose's broad pale antlers and the
zebra's striped coat were refined against the four game-camera facings.
All 14 played idle, walk, voluntary action and flee both in Workshop and in
a reopened normal game world under their exact review links. The game
verifier placed each animal through the editor, saved and reopened the world,
then walked the player toward the animal with the game's tap-to-move
controller to trigger the escape. Each Workshop run also round-tripped the
sprite preference. See the deployment reports for
[browsing antelopes](256-wildlife-3d-game-rollout/evidence/browsing-antelopes-v1-deployment.json),
[cervids](256-wildlife-3d-game-rollout/evidence/cervids-v1-deployment.json),
[heavy herds](256-wildlife-3d-game-rollout/evidence/heavy-herds-v1-deployment.json), and
[dryland grazers](256-wildlife-3d-game-rollout/evidence/dryland-grazers-v1-deployment.json).
The antlerless white-tailed doe now has separate motions for lowering its
head, browsing, raising its head and stamping a forehoof. Its escape raises
the white underside of the tail. The existing forest-work scenario uses a
reachable browse shrub and a player approach. The normal-world verifier
placed and saved the doe and a shrub through the editor and observed all
eight states after reopening. Okapi and Malayan tapir have distinct coat
boundaries, and the tapir's short proboscis follows its head gesture.
The great apes and forest primates use distinct walking and escape footfalls
with articulated hands and feet. The upright elephant and giraffe use
bipedal steps and arm swings, and the elephant's trunk responds independently
to the head gesture. All 15 animals played every state both in Workshop and
after save and reopen in the normal game under their exact review links. The
deployment reports cover
[woodland browsers](256-wildlife-3d-game-rollout/evidence/woodland-browsers-v1-deployment.json),
[pasture and savanna](256-wildlife-3d-game-rollout/evidence/plateau-herbivores-v1-deployment.json),
[great apes](256-wildlife-3d-game-rollout/evidence/great-apes-v1-deployment.json),
[forest primates](256-wildlife-3d-game-rollout/evidence/forest-primates-v1-deployment.json),
and [upright herbivores](256-wildlife-3d-game-rollout/evidence/upright-herbivores-v1-deployment.json).

The full-size elephant's three trunk joints produce distinct reach, curl,
eat and shake motions. The giraffe keeps its neck length through the reach,
browse and return. The deployed verifier used reachable forage and native
trees in both Workshop and the reopened game world. Player proximity
triggered both escape states. The kangaroo and wallaby retain the Realm's
physical travel height and tuck their hind legs differently during escape.
The rodents and marsupials use their active sprite palettes, short voluntary
head dips and escape footfall cycles. Their deployment reports cover
[canopy and fruit](256-wildlife-3d-game-rollout/evidence/canopy-and-fruit-v1-deployment.json),
[macropods](256-wildlife-3d-game-rollout/evidence/macropods-v1-deployment.json),
[pet rodents](256-wildlife-3d-game-rollout/evidence/pet-rodents-v1-deployment.json),
[urban small mammals](256-wildlife-3d-game-rollout/evidence/urban-small-mammals-v1-deployment.json),
and [ground marsupials](256-wildlife-3d-game-rollout/evidence/ground-marsupials-v1-deployment.json).
The [pack-mount report](256-wildlife-3d-game-rollout/evidence/pack-mounts-v1-deployment.json)
also verifies idle, walk, action, flee, ride and ride-sprint for both the mule
and camel. In the reopened game world, the verifier used an editor-placed
mount to repeat the player's jump, ride and sprint.

At the pause checkpoint all 14 animals in these six batches played every
state in Workshop and in reopened normal game worlds under their exact review
links. The Workshop inbox recorded 35 pending batches and zero approvals.
The next material group is the unregistered birds, using the remaining
ledger entries and existing flight and work scenarios. The older pilot and
pet gaps and production default verification remain open.

The renderer admits 24 model instances per view, starts four model loads at a
time and keeps at most 48 recent model batches. Sprites cover pending downloads,
failed models and bodies outside the model budget. The browser test verified
the switch, deferred rabbit sprite load and GLB 404. Workshop blocks feedback
when the exact GLB differs from its registration. Focused validation passed
130 unit tests, both browser regressions, typechecks and the production build
on Node 24.22.1. Node 27 alpha fails in the existing PNG parser before the build.
For the latest marine batches, 296 focused Workshop, renderer, landscape and
shore mammal unit tests and both browser regressions passed. The latest
production build and 365 targeted habitat, crustacean and scenario unit tests
passed on Node 24.22.1. The farm checkpoint passed the production build, 334
targeted behavior and scenario tests, and both browser regressions. The
classic checkpoint passed the production build, 412 targeted renderer, lab,
scenario, movement and network codec tests, and both browser regressions.
The grazer checkpoint passed the production build, typechecks, 808 focused
fauna, recipe and lab unit tests, and both browser regressions.
The woodland and primate checkpoint passed the production build, typechecks,
322 focused deer, fauna, recipe and lab unit tests, and both browser
regressions.
The large and small mammal checkpoint passed the production build, typechecks,
320 focused fauna, work, recipe and lab unit tests, and both browser regressions.
A two-client Playwright run placed the
cat through the host's normal editor command and verified that host and
guest drew the same entity and observed two matching replicated clips.

The [desktop crowd report](256-wildlife-3d-game-rollout/evidence/pilot-v1-desktop.json)
records a warm fixed-camera check on Apple M4 Pro. Both lanes held 16.8 ms p95
frame intervals with zero missed intervals in 300 frames. The 24-model lane
measured 0.60 ms GPU p95 and the sprite lane measured 0.47 ms. The
[desktop traversal report](256-wildlife-3d-game-rollout/evidence/pilot-v1-traversal.json)
records passing ready-data checks in both lanes through walk, sprint and
reverse. The [reef crowd report](256-wildlife-3d-game-rollout/evidence/reef-fauna-v1-desktop.json)
compares 24 animals across four reef species on the same Mac's 120 Hz display.
Both lanes recorded zero missed intervals across 600 frames. The model and
sprite lanes measured 10.3 and 10.0 ms p95 frame intervals, with 0.67 and
0.51 ms p95 GPU time. Physical phone and Steam Deck measurements are pending.
At the shore and pond checkpoint, the configured Android testbeds were
disconnected. The Steam Deck was reachable, but its graphical session failed
the testbed check.

Use `node --import tsx scripts/wildlife/audit-3d-rollout.mjs --drafts` to check
the inventory, draft hashes and registered action names. Run
`verify-3d-campaign-runtime.mjs --rollout=BATCH REPORT` for render samples and
`verify-3d-campaign-runtime.mjs --defaults REPORT` for every default model.
Run `verify-3d-rollout-deployment.mjs BASE_URL BATCH REPORT` for served evidence,
using the same Node invocation. The renderer report pins the GLB bytes returned
to the browser in exact batch mode. The deployed verifier checks that the
requested animal's mesh was drawn, even when another species also drew as
a mesh. Append `--review` to verify an exact preview instead of normal entry.
`record-3d-rollout-evidence.mjs BATCH RUNTIME_REPORT DEPLOYMENT_REPORT` checks the
matching fingerprints before adding per-state ledger entries. Biome skips formatting
the generated deployment reports so the tracked copies retain the verifier's output.
Keep each revision's review files immutable.

The CI repair records the committed rollout's size and complexity in five
code-health baseline entries for mesh drawing, sprite collection, the wildlife
review recipe and the two Workshop pages.
