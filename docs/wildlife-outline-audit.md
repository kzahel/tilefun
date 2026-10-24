# Wildlife outline consistency audit

Snapshot: 2026-10-24. Owner reports heavy/inconsistent outlines on deer,
red panda, chinchilla, hedgehog and guinea pig. This is a source/PNG investigation,
not an art repair or a human-review verdict.

[Owning topic](topics/wildlife-behaviors.md#action-paint-consistency-investigation-2026-10-24)
· [Exact per-animal source and image hashes](research/wildlife-outline-audit.json)

This is the historical **pre-correction** snapshot. The subsequent
[shared finishing correction](tactical/187-shared-wildlife-finishing.md) replaces
137 active banks; [current contracts](../art-source/wildlife-v2/finishing.json)
record the retained predecessors and each complete bank's policy. Historical
image hashes and counts below deliberately remain unchanged.

## Counts

The scope is all **206 active Animal Browser entries** exported from
`ANIMAL_BROWSER_ENTRIES`, including coat variants and fantasy entries, rather
than all historical source folders. Each current image appears exactly once.

| Finding | Active entries | Meaning |
| --- | ---: | --- |
| New actions switch to a flat-hull painter with an outward border | 4 | Deer and the original, ginger and black cats |
| New actions switch to a flat-hull painter with an inward border | 1 | Donkey |
| Automatic outward border already used throughout the animal's sprite set | 132 | Includes red panda, chinchilla, hedgehog and guinea pig |
| Other paint/export methods | 69 | Not certified visually correct by this audit |
| Total | 206 | All current entries accounted for |

**136 entries use the automatic outward-border process** (four transition
mismatches plus 132 throughout). Donkey is an additional inward-border mismatch.
This is an exact implementation count, not a claim that all 136 look equally bad.
The five clear transition mismatches are five appearances across three species
(deer, cat, donkey); coat variants count separately in the browser.

## What changed in the new actions

The five transition cases append flat filled mesh hulls to an earlier painted
bank. The original coat/face/leg detailing is not carried forward by the new
painter. Four add a dark `MaxFilter(3)` alpha dilation: a one-native-pixel ring
outside the silhouette, including diagonal neighbors. Donkey instead recolors
the inner boundary using `MinFilter(3)`; it does not grow the silhouette.
Donkey idle versus the first lie-down frame confirms the style jump before the
body moves, independently of the dust-bath pose.

The original cat/deer parts and donkey painted masters are retained. Changed
art must use a new source/review identity; current registered banks stay immutable.

## The four reported small mammals

Red panda, chinchilla and guinea pig are active from `roster-v2`; they do not
have a later behavior sheet replacing their paint. Hedgehog's `behavior-v1`
appends curling poses to its original `roster-v2` cells. Both hedgehog exporters
use the same outward-ring technique. Their outline problem is present in idle
and travel as well as action, unlike the deer's transition-only discontinuity.

| Animal | Added outer ring as share of final opaque pixels |
| --- | ---: |
| Red panda | 31.6% |
| Chinchilla | 34.6% |
| Hedgehog | 33.5% |
| Guinea pig | 32.3% |

These are medians across sampled source poses and all four directions. They
measure only pixels added outside the unbordered mesh silhouette, not all dark
fur/marking pixels. A one-pixel limb can become three pixels wide. This makes a
uniform one-pixel border disproportionately heavy on these small animals.

All ten members of the original small-mammal family share this approach:
**mouse, rat, hamster, guinea pig, chinchilla, hedgehog, porcupine, raccoon,
skunk and red panda**. Raccoon/hedgehog/porcupine now use appended behavior banks,
which retain the same border style. These ten are the first family to review
alongside the five transition cases; the groups contain fifteen distinct entries.

## Evidence and limits

- All 206 active paths, source finishers and clip lists were inspected, including
  wrapper scripts, the pet painter, conditional branches and imported paint
  helpers. Beaver inherits an outward border through the forest-herbivore helper;
  cow/sheep use retained paint, and chicken explicitly avoids an outward ring.
  Merely searching files for `MaxFilter` gives incorrect counts because some
  uses expand a paint-selection mask rather than an animal's silhouette.
- The actual source painting functions reproduce **4,888 of 4,888 sampled
  cells** from the 136 outward-border banks and donkey's inward-border bank.
  Sampling takes the first, middle and last pose of each clip represented in
  the retained projection, in all four directions. It is not an exhaustive
  every-frame animation-quality verdict. Appended banks' old cells are compared
  to the whole pinned base sheet separately.
- All 26 banks declaring a copied base sheet retain those cells byte-for-byte.
  All 192 recorded sheet hashes match; 14 older descriptors do not declare one.
  This supports an authored finishing issue rather than corrupted local pixels.
- Visual contact sheets were inspected across all 206 entries, with additional
  four-facing deer/donkey comparisons and enlarged reported-animal comparisons.
  The broad contact sheet is a still-frame survey, not a substitute for motion
  review. Large-body native scale is preserved.
- Runtime assets, exporters, fingerprints and human-review decisions are unchanged.
  Local scripts, full sampled measurements and comparison PNGs are retained in
  ignored `data/wildlife-render-consistency-20261024/`. The tracked JSON pins the
  exact paths, source methods, image hashes and measured results.
- This follow-up changes documentation/evidence only. Earlier typecheck/lint,
  source replay and forest-behavior results remain in the owning topic; the full
  native suite's existing Windows failures are not reclassified as art failures.

## Repair order

1. Repair the five clear action painter discontinuities: deer, cat, ginger cat,
   black cat, donkey. Preserve body/face/coat paint through the new motion and
   compare transition endpoints in all four facings.
2. Review the ten small mammals as a family, including all four owner examples.
   Prototype the finish on a new identity before changing the remaining family;
   compare native scale beside the original painted deer/pets and person.
3. Audit other outward-border families using the table below. Twenty-two entries
   have a median added-ring share of at least 40%; this is a prioritization
   measurement, not an automatic rejection threshold. Cats/mouse overlap earlier
   priorities. Tiny insects, narrow reptiles and hummingbird are prominent.
4. Compare motion as well as outline: eliminating the ring alone cannot restore
   original painted detail, establish good anatomy or fix the five transition cases.

## Complete active list

Border share below is the median added exterior ring fraction for sampled poses.
A dash means that measurement does not apply to the painter. Source paths and
hashes for every entry are in the linked JSON. Other methods are an audit
classification, not an approval.

### Clear new-action outer-border mismatches (4)

| Animal | ID | Added border |
| --- | --- | ---: |
| Black cat | `cat-black` | 40.5% |
| Cat | `cat` | 40.5% |
| Ginger tabby | `cat-ginger` | 40.5% |
| White-tailed deer | `deer` | 34.3% |

### Clear new-action inner-border mismatch (1)

| Animal | ID | Added border |
| --- | --- | ---: |
| Grey donkey | `donkey` | — |

### Outward border throughout (132)

| Animal | ID | Added border |
| --- | --- | ---: |
| Aardvark | `aardvark` | 28.6% |
| American alligator | `alligator` | 27.6% |
| Anglerfish | `anglerfish` | 28.8% |
| Armadillo | `armadillo` | 29.7% |
| Atlantic puffin | `atlantic-puffin` | 37.8% |
| Axolotl | `axolotl` | 38.1% |
| Aye-aye | `aye-aye` | 35.5% |
| Bald eagle | `eagle` | 32.0% |
| Bat | `bat` | 39.6% |
| Beaver | `beaver` | 32.0% |
| Bee | `bee` | 46.6% |
| Binturong | `binturong` | 32.8% |
| Blue whale | `blue-whale` | 18.9% |
| Blue-footed booby | `blue-footed-booby` | 37.4% |
| California sea lion | `sea-lion` | 26.1% |
| Capuchin monkey | `capuchin-monkey` | 32.4% |
| Capybara | `capybara` | 26.1% |
| Carrion crow | `crow` | 38.4% |
| Cassowary | `cassowary` | 31.1% |
| Centipede | `centipede` | 30.6% |
| Chameleon | `chameleon` | 38.8% |
| Chimpanzee | `chimpanzee` | 26.7% |
| Chinchilla | `chinchilla` | 34.6% |
| Coconut crab | `coconut-crab` | 34.1% |
| Cricket | `cricket` | 48.6% |
| Cuttlefish | `cuttlefish` | 29.6% |
| Dolphin | `dolphin` | 33.6% |
| Dove | `dove` | 38.5% |
| Dragonfly | `dragonfly` | 44.2% |
| Dugong | `dugong` | 28.4% |
| Earthworm | `worm` | 48.8% |
| Earwig | `earwig` | 42.5% |
| Electric eel | `electric-eel` | 41.8% |
| Emu | `emu` | 30.6% |
| Flamingo | `flamingo` | 36.5% |
| Fossa | `fossa` | 34.3% |
| Frilled-neck lizard | `frilled-neck-lizard` | 38.4% |
| Gaboon viper | `gaboon-viper` | 39.3% |
| Garden snail | `snail` | 37.9% |
| Gecko | `gecko` | 40.1% |
| Giant anteater | `giant-anteater` | 27.1% |
| Grasshopper | `grasshopper` | 48.2% |
| Great blue heron | `great-blue-heron` | 36.2% |
| Great frigatebird | `great-frigatebird` | 35.7% |
| Great hornbill | `great-hornbill` | 36.6% |
| Guinea pig | `guinea-pig` | 32.3% |
| Hammerhead shark | `hammerhead-shark` | 31.5% |
| Hamster | `hamster` | 35.2% |
| Hedgehog | `hedgehog` | 33.5% |
| Honey badger | `honey-badger` | 30.7% |
| Horseshoe crab | `horseshoe-crab` | 31.7% |
| Humpback whale | `humpback-whale` | 22.6% |
| Iguana | `iguana` | 40.4% |
| Japanese macaque | `japanese-macaque` | 28.7% |
| Kakapo | `kakapo` | 28.6% |
| Kinkajou | `kinkajou` | 36.1% |
| Kiwi | `kiwi` | 33.8% |
| Koala | `koala` | 31.5% |
| Komodo dragon | `komodo-dragon` | 31.2% |
| Ladybug | `ladybug` | 46.1% |
| Land tortoise | `land-tortoise` | 35.2% |
| Leaf insect | `leaf-insect` | 39.0% |
| Leafy seadragon | `leafy-seadragon` | 40.1% |
| Lobster | `lobster` | 36.5% |
| Malayan tapir | `malayan-tapir` | 22.9% |
| Mandrill | `mandrill` | 25.6% |
| Marabou stork | `marabou-stork` | 32.3% |
| Meerkat | `meerkat` | 31.6% |
| Millipede | `millipede` | 27.7% |
| Mongoose | `mongoose` | 38.7% |
| Moray eel | `moray-eel` | 40.9% |
| Mouse | `mouse` | 42.7% |
| Narwhal | `narwhal` | 31.7% |
| Nautilus | `nautilus` | 30.2% |
| Newt | `newt` | 40.5% |
| Nile crocodile | `crocodile` | 28.0% |
| Ocean sunfish | `ocean-sunfish` | 26.0% |
| Orangutan | `orangutan` | 25.4% |
| Orca | `orca` | 27.9% |
| Ostrich | `ostrich` | 29.9% |
| Pangolin | `pangolin` | 27.9% |
| Parrot | `parrot` | 37.6% |
| Peacock | `peacock` | 26.1% |
| Peacock mantis shrimp | `mantis-shrimp` | 38.8% |
| Pelican | `pelican` | 33.0% |
| Platypus | `platypus` | 31.8% |
| Pond turtle | `pond-turtle` | 35.2% |
| Porcupine | `porcupine` | 31.1% |
| Praying mantis | `praying-mantis` | 39.3% |
| Proboscis monkey | `proboscis-monkey` | 31.9% |
| Pufferfish | `pufferfish` | 29.6% |
| Quokka | `quokka` | 36.9% |
| Raccoon | `raccoon` | 32.3% |
| Rat | `rat` | 39.4% |
| Raven | `raven` | 37.2% |
| Red panda | `red-panda` | 31.6% |
| Red-necked wallaby | `wallaby` | 36.6% |
| Red-tailed hawk | `hawk` | 32.3% |
| Ring-tailed lemur | `ring-tailed-lemur` | 34.5% |
| River otter | `river-otter` | 34.2% |
| Rock pigeon | `pigeon` | 38.3% |
| Roly-poly | `roly-poly` | 31.4% |
| Ruby-throated hummingbird | `ruby-throated-hummingbird` | 44.0% |
| Salamander | `salamander` | 40.1% |
| Scorpion | `scorpion` | 37.6% |
| Sea turtle | `sea-turtle` | 30.2% |
| Seahorse | `seahorse` | 40.6% |
| Secretary bird | `secretary-bird` | 34.1% |
| Shark | `shark` | 31.7% |
| Shoebill | `shoebill` | 31.3% |
| Short-beaked echidna | `echidna` | 31.1% |
| Shrimp | `shrimp` | 35.7% |
| Skunk | `skunk` | 33.1% |
| Sparrow | `sparrow` | 38.6% |
| Stag beetle | `stag-beetle` | 44.4% |
| Starfish | `starfish` | 42.3% |
| Swordfish | `swordfish` | 30.3% |
| Tasmanian devil | `tasmanian-devil` | 32.6% |
| Tawny owl | `owl` | 30.6% |
| Texas horned lizard | `texas-horned-lizard` | 36.1% |
| Three-toed sloth | `sloth` | 32.5% |
| Toucan | `toucan` | 37.3% |
| Upright elephant | `elephant-upright` | 27.8% |
| Upright giraffe | `giraffe-upright` | 33.1% |
| Virginia opossum | `opossum` | 36.4% |
| Walrus | `walrus` | 24.4% |
| West Indian manatee | `manatee` | 25.3% |
| Whale shark | `whale-shark` | 23.7% |
| White-nosed coati | `white-nosed-coati` | 34.8% |
| Wild turkey | `wild-turkey` | 31.9% |
| Wolf spider | `spider` | 36.2% |
| Wombat | `wombat` | 29.4% |

### Other finishing methods (69)

| Animal | ID | Added border |
| --- | --- | ---: |
| American bison | `american-bison` | — |
| Ant | `ant` | — |
| Bobcat | `bobcat` | — |
| Brown bear | `brown-bear` | — |
| Brown llama | `llama` | — |
| Brown mule | `mule` | — |
| Buff hen | `chicken` | — |
| Cheetah | `cheetah` | — |
| Coyote | `coyote` | — |
| Cream alpaca | `alpaca` | — |
| Dire wolf | `dire-wolf` | — |
| Dog | `dog` | — |
| Dromedary camel | `camel` | — |
| Elephant | `elephant` | — |
| Elk | `elk` | — |
| Eurasian lynx | `lynx` | — |
| Frog | `frog` | — |
| Gazelle | `gazelle` | — |
| Gemsbok | `gemsbok-oryx` | — |
| Gerenuk | `gerenuk` | — |
| Giant spider | `giant-spider` | — |
| Giraffe | `giraffe` | — |
| Goat | `goat` | — |
| Golden retriever | `dog-golden` | — |
| Grey wolf | `wolf` | — |
| Griffin | `griffin` | — |
| Harbor seal | `harbor-seal` | — |
| Hippopotamus | `hippopotamus` | — |
| Horse | `horse` | — |
| Impala | `impala` | — |
| Jaguar | `jaguar` | — |
| Kangaroo | `kangaroo` | — |
| King cobra | `king-cobra` | — |
| Leopard | `leopard` | — |
| Lion | `lion` | — |
| Mallard duck | `mallard` | — |
| Manta ray | `manta-ray` | — |
| Moon jellyfish | `jellyfish` | — |
| Moose | `moose` | — |
| Musk ox | `musk-ox` | — |
| Okapi | `okapi` | — |
| Orange butterfly | `butterfly` | — |
| Panda | `panda` | — |
| Panther | `panther` | — |
| Pasture cow | `cow` | — |
| Penguin | `penguin` | — |
| Pig | `piglet` | — |
| Pointed-ear shepherd | `dog-shepherd` | — |
| Polar bear | `polar-bear` | — |
| Pond fish | `fish` | — |
| Rabbit | `rabbit` | — |
| Red fox | `fox` | — |
| Red squirrel | `red-squirrel` | — |
| Robin | `robin` | — |
| Rust crab | `crab` | — |
| Rust octopus | `octopus` | — |
| Saiga antelope | `saiga-antelope` | — |
| Sheep | `sheep` | — |
| Silverback gorilla | `gorilla` | — |
| Small dragon | `small-dragon` | — |
| Spotted hyena | `spotted-hyena` | — |
| Springbok | `springbok` | — |
| T. rex | `t-rex` | — |
| Warthog | `warthog` | — |
| Water buffalo | `water-buffalo` | — |
| White rhinoceros | `rhinoceros` | — |
| Wild tiger | `tiger` | — |
| Wildebeest | `wildebeest` | — |
| Zebra | `zebra` | — |
