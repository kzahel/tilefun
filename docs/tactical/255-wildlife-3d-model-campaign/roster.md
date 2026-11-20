# Tilefun 3D animal roster

[Campaign plan](../255-wildlife-3d-model-campaign.md)

Snapshot checked against the Tilefun runtime on 2026-11-19. **219 animal
identities**, comprising 206 Animal Browser entries and 13 classic animals.
All 219 are placeable from Edit → Entities. Match a row by runtime type.
Cat and Rabbit have earlier 3D work. Every entry starts with campaign
review pending.

Roster sources include the [Animal Browser entries](../../../src/workshop/AnimalBrowserData.ts),
[editor palette](../../../src/editor/EditorPalettes.ts),
[entity definitions](../../../src/entities/EntityDefs.ts), and
[classic sprite registry](../../../src/assets/GameAssets.ts).
The active gameplay sprite is the reference. Recheck it at authoring time
if the runtime bank has changed since this snapshot.

The two upright wildlife companions are in the roster. The character catalog
has five animal-themed player/NPC looks in its own asset system, including
Tiger, Tuxedo Cat, Floppy Dog, Russet Squirrel and Brown Bear.
[Character catalog](../../../src/characters/approved-v1.json)

## Animal Browser

### Bears (3)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Brown bear | `wildlife-brown-bear-predator-v1` | [brown-bear/hunt-v1](../../../public/demos/wildlife-v2/brown-bear/hunt-v1/sheet.png) |
| Panda | `wildlife-panda-provisional-v1` | [panda/roster-v2](../../../public/demos/wildlife-v2/panda/roster-v2/sheet.png) |
| Polar bear | `wildlife-polar-bear-predator-v1` | [polar-bear/roster-v2](../../../public/demos/wildlife-v2/polar-bear/roster-v2/sheet.png) |

### Birds (31)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Atlantic puffin | `wildlife-atlantic-puffin-provisional-v1` | [atlantic-puffin/finish-v1](../../../public/demos/wildlife-v2/atlantic-puffin/finish-v1/sheet.png) |
| Bald eagle | `wildlife-eagle-predator-v1` | [eagle/finish-v1](../../../public/demos/wildlife-v2/eagle/finish-v1/sheet.png) |
| Blue-footed booby | `wildlife-blue-footed-booby-provisional-v1` | [blue-footed-booby/finish-v1](../../../public/demos/wildlife-v2/blue-footed-booby/finish-v1/sheet.png) |
| Buff hen | `wildlife-chicken-provisional-v1` | [chicken/behavior-v1](../../../public/demos/wildlife-v2/chicken/behavior-v1/sheet.png) |
| Carrion crow | `wildlife-crow-provisional-v1` | [crow/finish-v1](../../../public/demos/wildlife-v2/crow/finish-v1/sheet.png) |
| Cassowary | `wildlife-cassowary-provisional-v1` | [cassowary/finish-v1](../../../public/demos/wildlife-v2/cassowary/finish-v1/sheet.png) |
| Dove | `wildlife-dove-provisional-v1` | [dove/finish-v1](../../../public/demos/wildlife-v2/dove/finish-v1/sheet.png) |
| Emu | `wildlife-emu-provisional-v1` | [emu/finish-v1](../../../public/demos/wildlife-v2/emu/finish-v1/sheet.png) |
| Flamingo | `wildlife-flamingo-provisional-v1` | [flamingo/finish-v1](../../../public/demos/wildlife-v2/flamingo/finish-v1/sheet.png) |
| Great blue heron | `wildlife-great-blue-heron-provisional-v1` | [great-blue-heron/finish-v1](../../../public/demos/wildlife-v2/great-blue-heron/finish-v1/sheet.png) |
| Great frigatebird | `wildlife-great-frigatebird-provisional-v1` | [great-frigatebird/finish-v1](../../../public/demos/wildlife-v2/great-frigatebird/finish-v1/sheet.png) |
| Great hornbill | `wildlife-great-hornbill-provisional-v1` | [great-hornbill/finish-v1](../../../public/demos/wildlife-v2/great-hornbill/finish-v1/sheet.png) |
| Kakapo | `wildlife-kakapo-provisional-v1` | [kakapo/finish-v1](../../../public/demos/wildlife-v2/kakapo/finish-v1/sheet.png) |
| Kiwi | `wildlife-kiwi-provisional-v1` | [kiwi/finish-v1](../../../public/demos/wildlife-v2/kiwi/finish-v1/sheet.png) |
| Mallard duck | `wildlife-mallard-v1` | [mallard-duck/draft-v1](../../../public/demos/wildlife-v2/mallard-duck/draft-v1/sheet.png) |
| Marabou stork | `wildlife-marabou-stork-provisional-v1` | [marabou-stork/finish-v1](../../../public/demos/wildlife-v2/marabou-stork/finish-v1/sheet.png) |
| Ostrich | `wildlife-ostrich-provisional-v1` | [ostrich/finish-v1](../../../public/demos/wildlife-v2/ostrich/finish-v1/sheet.png) |
| Parrot | `wildlife-parrot-provisional-v1` | [parrot/finish-v1](../../../public/demos/wildlife-v2/parrot/finish-v1/sheet.png) |
| Peacock | `wildlife-peacock-provisional-v1` | [peacock/finish-v1](../../../public/demos/wildlife-v2/peacock/finish-v1/sheet.png) |
| Pelican | `wildlife-pelican-provisional-v1` | [pelican/finish-v1](../../../public/demos/wildlife-v2/pelican/finish-v1/sheet.png) |
| Penguin | `wildlife-penguin-provisional-v1` | [penguin/draft-v1](../../../public/demos/wildlife-v2/penguin/draft-v1/sheet.png) |
| Raven | `wildlife-raven-provisional-v1` | [raven/finish-v1](../../../public/demos/wildlife-v2/raven/finish-v1/sheet.png) |
| Red-tailed hawk | `wildlife-hawk-predator-v1` | [hawk/finish-v1](../../../public/demos/wildlife-v2/hawk/finish-v1/sheet.png) |
| Robin | `wildlife-robin-v1` | [robin/behavior-v1](../../../public/demos/wildlife-v2/robin/behavior-v1/sheet.png) |
| Rock pigeon | `wildlife-pigeon-provisional-v1` | [pigeon/finish-v1](../../../public/demos/wildlife-v2/pigeon/finish-v1/sheet.png) |
| Ruby-throated hummingbird | `wildlife-ruby-throated-hummingbird-provisional-v1` | [ruby-throated-hummingbird/finish-v1](../../../public/demos/wildlife-v2/ruby-throated-hummingbird/finish-v1/sheet.png) |
| Secretary bird | `wildlife-secretary-bird-predator-v1` | [secretary-bird/finish-v1](../../../public/demos/wildlife-v2/secretary-bird/finish-v1/sheet.png) |
| Shoebill | `wildlife-shoebill-provisional-v1` | [shoebill/finish-v1](../../../public/demos/wildlife-v2/shoebill/finish-v1/sheet.png) |
| Sparrow | `wildlife-sparrow-provisional-v1` | [sparrow/finish-v1](../../../public/demos/wildlife-v2/sparrow/finish-v1/sheet.png) |
| Tawny owl | `wildlife-owl-predator-v1` | [owl/finish-v1](../../../public/demos/wildlife-v2/owl/finish-v1/sheet.png) |
| Toucan | `wildlife-toucan-provisional-v1` | [toucan/finish-v1](../../../public/demos/wildlife-v2/toucan/finish-v1/sheet.png) |

### Canids (wild) (4)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Coyote | `wildlife-coyote-predator-v1` | [coyote/roster-v2](../../../public/demos/wildlife-v2/coyote/roster-v2/sheet.png) |
| Grey wolf | `wildlife-wolf-predator-v1` | [wolf/roster-v2](../../../public/demos/wildlife-v2/wolf/roster-v2/sheet.png) |
| Red fox | `wildlife-fox-provisional-v1` | [fox/behavior-v1](../../../public/demos/wildlife-v2/fox/behavior-v1/sheet.png) |
| Spotted hyena | `wildlife-spotted-hyena-predator-v1` | [spotted-hyena/roster-v2](../../../public/demos/wildlife-v2/spotted-hyena/roster-v2/sheet.png) |

### Domestic pets (4)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Cat · Existing offline draft | `wildlife-cat-provisional-v1` | [cat/finish-v1](../../../public/demos/wildlife-v2/cat/finish-v1/sheet.png) |
| Dog | `wildlife-dog-provisional-v1` | [dog/behavior-v1](../../../public/demos/wildlife-v2/dog/behavior-v1/sheet.png) |
| Guinea pig | `wildlife-guinea-pig-provisional-v1` | [guinea-pig/finish-v1](../../../public/demos/wildlife-v2/guinea-pig/finish-v1/sheet.png) |
| Hamster | `wildlife-hamster-provisional-v1` | [hamster/finish-v1](../../../public/demos/wildlife-v2/hamster/finish-v1/sheet.png) |

### Farm & livestock (11)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Brown llama | `wildlife-llama-provisional-v1` | [llama/roster-v2](../../../public/demos/wildlife-v2/llama/roster-v2/sheet.png) |
| Brown mule | `wildlife-mule-provisional-v1` | [mule/roster-v2](../../../public/demos/wildlife-v2/mule/roster-v2/sheet.png) |
| Cream alpaca | `wildlife-alpaca-provisional-v1` | [alpaca/roster-v2](../../../public/demos/wildlife-v2/alpaca/roster-v2/sheet.png) |
| Goat | `wildlife-goat-provisional-v1` | [goat/behavior-v1](../../../public/demos/wildlife-v2/goat/behavior-v1/sheet.png) |
| Grey donkey | `wildlife-donkey-provisional-v1` | [donkey/finish-v1](../../../public/demos/wildlife-v2/donkey/finish-v1/sheet.png) |
| Horse | `wildlife-horse-provisional-v1` | [horse/behavior-v1](../../../public/demos/wildlife-v2/horse/behavior-v1/sheet.png) |
| Pasture cow | `wildlife-cow-provisional-v1` | [cow/behavior-v1](../../../public/demos/wildlife-v2/cow/behavior-v1/sheet.png) |
| Pig | `wildlife-piglet-provisional-v1` | [piglet/behavior-v1](../../../public/demos/wildlife-v2/piglet/behavior-v1/sheet.png) |
| Rabbit · Existing live model | `wildlife-rabbit-v1` | [rabbit/behavior-v1](../../../public/demos/wildlife-v2/rabbit/behavior-v1/sheet.png) |
| Sheep | `wildlife-sheep-provisional-v1` | [sheep/behavior-v1](../../../public/demos/wildlife-v2/sheep/behavior-v1/sheet.png) |
| Wild turkey | `wildlife-wild-turkey-provisional-v1` | [wild-turkey/finish-v1](../../../public/demos/wildlife-v2/wild-turkey/finish-v1/sheet.png) |

### Felids (big cats) (7)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Bobcat | `wildlife-bobcat-predator-v1` | [bobcat/roster-v2](../../../public/demos/wildlife-v2/bobcat/roster-v2/sheet.png) |
| Cheetah | `wildlife-cheetah-predator-v1` | [cheetah/roster-v2](../../../public/demos/wildlife-v2/cheetah/roster-v2/sheet.png) |
| Eurasian lynx | `wildlife-lynx-predator-v1` | [lynx/roster-v2](../../../public/demos/wildlife-v2/lynx/roster-v2/sheet.png) |
| Jaguar | `wildlife-jaguar-predator-v1` | [jaguar/roster-v2](../../../public/demos/wildlife-v2/jaguar/roster-v2/sheet.png) |
| Leopard | `wildlife-leopard-predator-v1` | [leopard/roster-v2](../../../public/demos/wildlife-v2/leopard/roster-v2/sheet.png) |
| Lion | `wildlife-lion-predator-v1` | [lion/hunt-v1](../../../public/demos/wildlife-v2/lion/hunt-v1/sheet.png) |
| Wild tiger | `wildlife-tiger-predator-v1` | [tiger/pilot-v1](../../../public/demos/wildlife-v2/tiger/pilot-v1/sheet.png) |

### Fierce & fantasy (6)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Dire wolf | `wildlife-dire-wolf-predator-v1` | [dire-wolf/fierce-v1](../../../public/demos/wildlife-v2/dire-wolf/fierce-v1/sheet.png) |
| Giant spider | `wildlife-giant-spider-predator-v1` | [giant-spider/fierce-v1](../../../public/demos/wildlife-v2/giant-spider/fierce-v1/sheet.png) |
| Griffin | `wildlife-griffin-predator-v1` | [griffin/fierce-v1](../../../public/demos/wildlife-v2/griffin/fierce-v1/sheet.png) |
| Panther | `wildlife-panther-predator-v1` | [panther/hunt-v1](../../../public/demos/wildlife-v2/panther/hunt-v1/sheet.png) |
| Small dragon | `wildlife-small-dragon-predator-v1` | [small-dragon/fierce-v1](../../../public/demos/wildlife-v2/small-dragon/fierce-v1/sheet.png) |
| T. rex | `wildlife-t-rex-predator-v1` | [t-rex/fierce-v1](../../../public/demos/wildlife-v2/t-rex/fierce-v1/sheet.png) |

### Hoofed & large herbivores (24)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| American bison | `wildlife-american-bison-provisional-v1` | [american-bison/roster-v2](../../../public/demos/wildlife-v2/american-bison/roster-v2/sheet.png) |
| Dromedary camel | `wildlife-camel-provisional-v1` | [camel/roster-v2](../../../public/demos/wildlife-v2/camel/roster-v2/sheet.png) |
| Elephant | `wildlife-elephant-provisional-v1` | [elephant/behavior-v1](../../../public/demos/wildlife-v2/elephant/behavior-v1/sheet.png) |
| Elk | `wildlife-elk-provisional-v1` | [elk/roster-v2](../../../public/demos/wildlife-v2/elk/roster-v2/sheet.png) |
| Gazelle | `wildlife-gazelle-provisional-v1` | [gazelle/roster-v2](../../../public/demos/wildlife-v2/gazelle/roster-v2/sheet.png) |
| Gemsbok | `wildlife-gemsbok-oryx-provisional-v1` | [gemsbok-oryx/roster-v2](../../../public/demos/wildlife-v2/gemsbok-oryx/roster-v2/sheet.png) |
| Gerenuk | `wildlife-gerenuk-provisional-v1` | [gerenuk/roster-v2](../../../public/demos/wildlife-v2/gerenuk/roster-v2/sheet.png) |
| Giraffe | `wildlife-giraffe-provisional-v1` | [giraffe/behavior-v1](../../../public/demos/wildlife-v2/giraffe/behavior-v1/sheet.png) |
| Hippopotamus | `wildlife-hippopotamus-provisional-v1` | [hippopotamus/roster-v2](../../../public/demos/wildlife-v2/hippopotamus/roster-v2/sheet.png) |
| Impala | `wildlife-impala-provisional-v1` | [impala/roster-v2](../../../public/demos/wildlife-v2/impala/roster-v2/sheet.png) |
| Malayan tapir | `wildlife-malayan-tapir-provisional-v1` | [malayan-tapir/finish-v1](../../../public/demos/wildlife-v2/malayan-tapir/finish-v1/sheet.png) |
| Moose | `wildlife-moose-provisional-v1` | [moose/roster-v2](../../../public/demos/wildlife-v2/moose/roster-v2/sheet.png) |
| Musk ox | `wildlife-musk-ox-provisional-v1` | [musk-ox/roster-v2](../../../public/demos/wildlife-v2/musk-ox/roster-v2/sheet.png) |
| Okapi | `wildlife-okapi-provisional-v1` | [okapi/roster-v2](../../../public/demos/wildlife-v2/okapi/roster-v2/sheet.png) |
| Saiga antelope | `wildlife-saiga-antelope-provisional-v1` | [saiga-antelope/roster-v2](../../../public/demos/wildlife-v2/saiga-antelope/roster-v2/sheet.png) |
| Springbok | `wildlife-springbok-provisional-v1` | [springbok/roster-v2](../../../public/demos/wildlife-v2/springbok/roster-v2/sheet.png) |
| Upright elephant | `wildlife-elephant-upright-provisional-v1` | [elephant-upright/finish-v1](../../../public/demos/wildlife-v2/elephant-upright/finish-v1/sheet.png) |
| Upright giraffe | `wildlife-giraffe-upright-provisional-v1` | [giraffe-upright/finish-v1](../../../public/demos/wildlife-v2/giraffe-upright/finish-v1/sheet.png) |
| Warthog | `wildlife-warthog-provisional-v1` | [warthog/roster-v2](../../../public/demos/wildlife-v2/warthog/roster-v2/sheet.png) |
| Water buffalo | `wildlife-water-buffalo-provisional-v1` | [water-buffalo/roster-v2](../../../public/demos/wildlife-v2/water-buffalo/roster-v2/sheet.png) |
| White rhinoceros | `wildlife-rhinoceros-provisional-v1` | [rhinoceros/roster-v2](../../../public/demos/wildlife-v2/rhinoceros/roster-v2/sheet.png) |
| White-tailed deer | `wildlife-deer-v1` | [deer/finish-v1](../../../public/demos/wildlife-v2/deer/finish-v1/sheet.png) |
| Wildebeest | `wildlife-wildebeest-provisional-v1` | [wildebeest/roster-v2](../../../public/demos/wildlife-v2/wildebeest/roster-v2/sheet.png) |
| Zebra | `wildlife-zebra-provisional-v1` | [zebra/roster-v2](../../../public/demos/wildlife-v2/zebra/roster-v2/sheet.png) |

### Insects & arthropods (17)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Ant | `wildlife-ant-provisional-v1` | [ant/draft-v2](../../../public/demos/wildlife-v2/ant/draft-v2/sheet.png) |
| Bee | `wildlife-bee-provisional-v1` | [bee/finish-v1](../../../public/demos/wildlife-v2/bee/finish-v1/sheet.png) |
| Centipede | `wildlife-centipede-predator-v1` | [centipede/finish-v1](../../../public/demos/wildlife-v2/centipede/finish-v1/sheet.png) |
| Cricket | `wildlife-cricket-provisional-v1` | [cricket/finish-v1](../../../public/demos/wildlife-v2/cricket/finish-v1/sheet.png) |
| Dragonfly | `wildlife-dragonfly-provisional-v1` | [dragonfly/finish-v1](../../../public/demos/wildlife-v2/dragonfly/finish-v1/sheet.png) |
| Earwig | `wildlife-earwig-provisional-v1` | [earwig/finish-v1](../../../public/demos/wildlife-v2/earwig/finish-v1/sheet.png) |
| Garden snail | `wildlife-snail-provisional-v1` | [snail/finish-v1](../../../public/demos/wildlife-v2/snail/finish-v1/sheet.png) |
| Grasshopper | `wildlife-grasshopper-provisional-v1` | [grasshopper/finish-v1](../../../public/demos/wildlife-v2/grasshopper/finish-v1/sheet.png) |
| Ladybug | `wildlife-ladybug-provisional-v1` | [ladybug/finish-v1](../../../public/demos/wildlife-v2/ladybug/finish-v1/sheet.png) |
| Leaf insect | `wildlife-leaf-insect-provisional-v1` | [leaf-insect/finish-v1](../../../public/demos/wildlife-v2/leaf-insect/finish-v1/sheet.png) |
| Millipede | `wildlife-millipede-provisional-v1` | [millipede/finish-v1](../../../public/demos/wildlife-v2/millipede/finish-v1/sheet.png) |
| Orange butterfly | `wildlife-butterfly-provisional-v1` | [butterfly/roster-v2](../../../public/demos/wildlife-v2/butterfly/roster-v2/sheet.png) |
| Praying mantis | `wildlife-praying-mantis-predator-v1` | [praying-mantis/finish-v1](../../../public/demos/wildlife-v2/praying-mantis/finish-v1/sheet.png) |
| Roly-poly | `wildlife-roly-poly-provisional-v1` | [roly-poly/finish-v1](../../../public/demos/wildlife-v2/roly-poly/finish-v1/sheet.png) |
| Scorpion | `wildlife-scorpion-predator-v1` | [scorpion/finish-v1](../../../public/demos/wildlife-v2/scorpion/finish-v1/sheet.png) |
| Stag beetle | `wildlife-stag-beetle-provisional-v1` | [stag-beetle/finish-v1](../../../public/demos/wildlife-v2/stag-beetle/finish-v1/sheet.png) |
| Wolf spider | `wildlife-spider-predator-v1` | [spider/finish-v1](../../../public/demos/wildlife-v2/spider/finish-v1/sheet.png) |

### Marine & aquatic (35)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Anglerfish | `wildlife-anglerfish-predator-v1` | [anglerfish/finish-v1](../../../public/demos/wildlife-v2/anglerfish/finish-v1/sheet.png) |
| Blue whale | `wildlife-blue-whale-provisional-v1` | [blue-whale/finish-v1](../../../public/demos/wildlife-v2/blue-whale/finish-v1/sheet.png) |
| California sea lion | `wildlife-sea-lion-provisional-v1` | [sea-lion/finish-v1](../../../public/demos/wildlife-v2/sea-lion/finish-v1/sheet.png) |
| Coconut crab | `wildlife-coconut-crab-predator-v1` | [coconut-crab/finish-v1](../../../public/demos/wildlife-v2/coconut-crab/finish-v1/sheet.png) |
| Cuttlefish | `wildlife-cuttlefish-predator-v1` | [cuttlefish/finish-v1](../../../public/demos/wildlife-v2/cuttlefish/finish-v1/sheet.png) |
| Dolphin | `wildlife-dolphin-predator-v1` | [dolphin/finish-v1](../../../public/demos/wildlife-v2/dolphin/finish-v1/sheet.png) |
| Dugong | `wildlife-dugong-provisional-v1` | [dugong/finish-v1](../../../public/demos/wildlife-v2/dugong/finish-v1/sheet.png) |
| Electric eel | `wildlife-electric-eel-predator-v1` | [electric-eel/finish-v1](../../../public/demos/wildlife-v2/electric-eel/finish-v1/sheet.png) |
| Hammerhead shark | `wildlife-hammerhead-shark-predator-v1` | [hammerhead-shark/finish-v1](../../../public/demos/wildlife-v2/hammerhead-shark/finish-v1/sheet.png) |
| Harbor seal | `wildlife-harbor-seal-provisional-v1` | [harbor-seal/draft-v1](../../../public/demos/wildlife-v2/harbor-seal/draft-v1/sheet.png) |
| Horseshoe crab | `wildlife-horseshoe-crab-provisional-v1` | [horseshoe-crab/finish-v1](../../../public/demos/wildlife-v2/horseshoe-crab/finish-v1/sheet.png) |
| Humpback whale | `wildlife-humpback-whale-provisional-v1` | [humpback-whale/finish-v1](../../../public/demos/wildlife-v2/humpback-whale/finish-v1/sheet.png) |
| Leafy seadragon | `wildlife-leafy-seadragon-provisional-v1` | [leafy-seadragon/finish-v1](../../../public/demos/wildlife-v2/leafy-seadragon/finish-v1/sheet.png) |
| Lobster | `wildlife-lobster-predator-v1` | [lobster/finish-v1](../../../public/demos/wildlife-v2/lobster/finish-v1/sheet.png) |
| Manta ray | `wildlife-manta-ray-provisional-v1` | [manta-ray/draft-v1](../../../public/demos/wildlife-v2/manta-ray/draft-v1/sheet.png) |
| Moon jellyfish | `wildlife-jellyfish-provisional-v1` | [jellyfish/roster-v2](../../../public/demos/wildlife-v2/jellyfish/roster-v2/sheet.png) |
| Moray eel | `wildlife-moray-eel-predator-v1` | [moray-eel/finish-v1](../../../public/demos/wildlife-v2/moray-eel/finish-v1/sheet.png) |
| Narwhal | `wildlife-narwhal-predator-v1` | [narwhal/finish-v1](../../../public/demos/wildlife-v2/narwhal/finish-v1/sheet.png) |
| Nautilus | `wildlife-nautilus-provisional-v1` | [nautilus/finish-v1](../../../public/demos/wildlife-v2/nautilus/finish-v1/sheet.png) |
| Ocean sunfish | `wildlife-ocean-sunfish-provisional-v1` | [ocean-sunfish/finish-v1](../../../public/demos/wildlife-v2/ocean-sunfish/finish-v1/sheet.png) |
| Orca | `wildlife-orca-predator-v1` | [orca/finish-v1](../../../public/demos/wildlife-v2/orca/finish-v1/sheet.png) |
| Peacock mantis shrimp | `wildlife-mantis-shrimp-predator-v1` | [mantis-shrimp/finish-v1](../../../public/demos/wildlife-v2/mantis-shrimp/finish-v1/sheet.png) |
| Pond fish | `wildlife-fish-provisional-v1` | [fish/draft-v2](../../../public/demos/wildlife-v2/fish/draft-v2/sheet.png) |
| Pufferfish | `wildlife-pufferfish-provisional-v1` | [pufferfish/finish-v1](../../../public/demos/wildlife-v2/pufferfish/finish-v1/sheet.png) |
| Rust crab | `wildlife-crab-provisional-v1` | [crab/roster-v2](../../../public/demos/wildlife-v2/crab/roster-v2/sheet.png) |
| Rust octopus | `wildlife-octopus-provisional-v1` | [octopus/roster-v2](../../../public/demos/wildlife-v2/octopus/roster-v2/sheet.png) |
| Sea turtle | `wildlife-sea-turtle-provisional-v1` | [sea-turtle/finish-v1](../../../public/demos/wildlife-v2/sea-turtle/finish-v1/sheet.png) |
| Seahorse | `wildlife-seahorse-provisional-v1` | [seahorse/finish-v1](../../../public/demos/wildlife-v2/seahorse/finish-v1/sheet.png) |
| Shark | `wildlife-shark-predator-v1` | [shark/finish-v1](../../../public/demos/wildlife-v2/shark/finish-v1/sheet.png) |
| Shrimp | `wildlife-shrimp-provisional-v1` | [shrimp/finish-v1](../../../public/demos/wildlife-v2/shrimp/finish-v1/sheet.png) |
| Starfish | `wildlife-starfish-provisional-v1` | [starfish/finish-v1](../../../public/demos/wildlife-v2/starfish/finish-v1/sheet.png) |
| Swordfish | `wildlife-swordfish-predator-v1` | [swordfish/finish-v1](../../../public/demos/wildlife-v2/swordfish/finish-v1/sheet.png) |
| Walrus | `wildlife-walrus-provisional-v1` | [walrus/finish-v1](../../../public/demos/wildlife-v2/walrus/finish-v1/sheet.png) |
| West Indian manatee | `wildlife-manatee-provisional-v1` | [manatee/finish-v1](../../../public/demos/wildlife-v2/manatee/finish-v1/sheet.png) |
| Whale shark | `wildlife-whale-shark-provisional-v1` | [whale-shark/finish-v1](../../../public/demos/wildlife-v2/whale-shark/finish-v1/sheet.png) |

### Marsupials & monotremes (9)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Kangaroo | `wildlife-kangaroo-provisional-v1` | [kangaroo/draft-v1](../../../public/demos/wildlife-v2/kangaroo/draft-v1/sheet.png) |
| Koala | `wildlife-koala-provisional-v1` | [koala/finish-v1](../../../public/demos/wildlife-v2/koala/finish-v1/sheet.png) |
| Platypus | `wildlife-platypus-provisional-v1` | [platypus/finish-v1](../../../public/demos/wildlife-v2/platypus/finish-v1/sheet.png) |
| Quokka | `wildlife-quokka-provisional-v1` | [quokka/finish-v1](../../../public/demos/wildlife-v2/quokka/finish-v1/sheet.png) |
| Red-necked wallaby | `wildlife-wallaby-provisional-v1` | [wallaby/finish-v1](../../../public/demos/wildlife-v2/wallaby/finish-v1/sheet.png) |
| Short-beaked echidna | `wildlife-echidna-provisional-v1` | [echidna/finish-v1](../../../public/demos/wildlife-v2/echidna/finish-v1/sheet.png) |
| Tasmanian devil | `wildlife-tasmanian-devil-predator-v1` | [tasmanian-devil/finish-v1](../../../public/demos/wildlife-v2/tasmanian-devil/finish-v1/sheet.png) |
| Virginia opossum | `wildlife-opossum-provisional-v1` | [opossum/finish-v1](../../../public/demos/wildlife-v2/opossum/finish-v1/sheet.png) |
| Wombat | `wildlife-wombat-provisional-v1` | [wombat/finish-v1](../../../public/demos/wildlife-v2/wombat/finish-v1/sheet.png) |

### Other invertebrates (1)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Earthworm | `wildlife-worm-provisional-v1` | [worm/finish-v1](../../../public/demos/wildlife-v2/worm/finish-v1/sheet.png) |

### Pets (4)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Black cat | `wildlife-cat-black-provisional-v1` | [cat-black/finish-v1](../../../public/demos/wildlife-v2/cat-black/finish-v1/sheet.png) |
| Ginger tabby | `wildlife-cat-ginger-provisional-v1` | [cat-ginger/finish-v1](../../../public/demos/wildlife-v2/cat-ginger/finish-v1/sheet.png) |
| Golden retriever | `wildlife-dog-golden-provisional-v1` | [dog-golden/draft-v1](../../../public/demos/wildlife-v2/dog-golden/draft-v1/sheet.png) |
| Pointed-ear shepherd | `wildlife-dog-shepherd-provisional-v1` | [dog-shepherd/draft-v1](../../../public/demos/wildlife-v2/dog-shepherd/draft-v1/sheet.png) |

### Primates (8)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Capuchin monkey | `wildlife-capuchin-monkey-provisional-v1` | [capuchin-monkey/finish-v1](../../../public/demos/wildlife-v2/capuchin-monkey/finish-v1/sheet.png) |
| Chimpanzee | `wildlife-chimpanzee-provisional-v1` | [chimpanzee/finish-v1](../../../public/demos/wildlife-v2/chimpanzee/finish-v1/sheet.png) |
| Japanese macaque | `wildlife-japanese-macaque-provisional-v1` | [japanese-macaque/finish-v1](../../../public/demos/wildlife-v2/japanese-macaque/finish-v1/sheet.png) |
| Mandrill | `wildlife-mandrill-provisional-v1` | [mandrill/finish-v1](../../../public/demos/wildlife-v2/mandrill/finish-v1/sheet.png) |
| Orangutan | `wildlife-orangutan-provisional-v1` | [orangutan/finish-v1](../../../public/demos/wildlife-v2/orangutan/finish-v1/sheet.png) |
| Proboscis monkey | `wildlife-proboscis-monkey-provisional-v1` | [proboscis-monkey/finish-v1](../../../public/demos/wildlife-v2/proboscis-monkey/finish-v1/sheet.png) |
| Ring-tailed lemur | `wildlife-ring-tailed-lemur-provisional-v1` | [ring-tailed-lemur/finish-v1](../../../public/demos/wildlife-v2/ring-tailed-lemur/finish-v1/sheet.png) |
| Silverback gorilla | `wildlife-gorilla-provisional-v1` | [gorilla/roster-v2](../../../public/demos/wildlife-v2/gorilla/roster-v2/sheet.png) |

### Reptiles & amphibians (16)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| American alligator | `wildlife-alligator-predator-v1` | [alligator/finish-v1](../../../public/demos/wildlife-v2/alligator/finish-v1/sheet.png) |
| Axolotl | `wildlife-axolotl-provisional-v1` | [axolotl/finish-v1](../../../public/demos/wildlife-v2/axolotl/finish-v1/sheet.png) |
| Chameleon | `wildlife-chameleon-provisional-v1` | [chameleon/finish-v1](../../../public/demos/wildlife-v2/chameleon/finish-v1/sheet.png) |
| Frilled-neck lizard | `wildlife-frilled-neck-lizard-provisional-v1` | [frilled-neck-lizard/finish-v1](../../../public/demos/wildlife-v2/frilled-neck-lizard/finish-v1/sheet.png) |
| Frog | `wildlife-frog-v1` | [frog/draft-v1](../../../public/demos/wildlife-v2/frog/draft-v1/sheet.png) |
| Gaboon viper | `wildlife-gaboon-viper-predator-v1` | [gaboon-viper/finish-v1](../../../public/demos/wildlife-v2/gaboon-viper/finish-v1/sheet.png) |
| Gecko | `wildlife-gecko-provisional-v1` | [gecko/finish-v1](../../../public/demos/wildlife-v2/gecko/finish-v1/sheet.png) |
| Iguana | `wildlife-iguana-provisional-v1` | [iguana/finish-v1](../../../public/demos/wildlife-v2/iguana/finish-v1/sheet.png) |
| King cobra | `wildlife-king-cobra-provisional-v1` | [king-cobra/draft-v1](../../../public/demos/wildlife-v2/king-cobra/draft-v1/sheet.png) |
| Komodo dragon | `wildlife-komodo-dragon-predator-v1` | [komodo-dragon/finish-v1](../../../public/demos/wildlife-v2/komodo-dragon/finish-v1/sheet.png) |
| Land tortoise | `wildlife-land-tortoise-provisional-v1` | [land-tortoise/finish-v1](../../../public/demos/wildlife-v2/land-tortoise/finish-v1/sheet.png) |
| Newt | `wildlife-newt-provisional-v1` | [newt/finish-v1](../../../public/demos/wildlife-v2/newt/finish-v1/sheet.png) |
| Nile crocodile | `wildlife-crocodile-predator-v1` | [crocodile/finish-v1](../../../public/demos/wildlife-v2/crocodile/finish-v1/sheet.png) |
| Pond turtle | `wildlife-pond-turtle-provisional-v1` | [pond-turtle/finish-v1](../../../public/demos/wildlife-v2/pond-turtle/finish-v1/sheet.png) |
| Salamander | `wildlife-salamander-provisional-v1` | [salamander/finish-v1](../../../public/demos/wildlife-v2/salamander/finish-v1/sheet.png) |
| Texas horned lizard | `wildlife-texas-horned-lizard-provisional-v1` | [texas-horned-lizard/finish-v1](../../../public/demos/wildlife-v2/texas-horned-lizard/finish-v1/sheet.png) |

### Small & exotic mammals (26)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Aardvark | `wildlife-aardvark-provisional-v1` | [aardvark/finish-v1](../../../public/demos/wildlife-v2/aardvark/finish-v1/sheet.png) |
| Armadillo | `wildlife-armadillo-provisional-v1` | [armadillo/finish-v1](../../../public/demos/wildlife-v2/armadillo/finish-v1/sheet.png) |
| Aye-aye | `wildlife-aye-aye-provisional-v1` | [aye-aye/finish-v1](../../../public/demos/wildlife-v2/aye-aye/finish-v1/sheet.png) |
| Bat | `wildlife-bat-provisional-v1` | [bat/finish-v1](../../../public/demos/wildlife-v2/bat/finish-v1/sheet.png) |
| Beaver | `wildlife-beaver-provisional-v1` | [beaver/finish-v1](../../../public/demos/wildlife-v2/beaver/finish-v1/sheet.png) |
| Binturong | `wildlife-binturong-provisional-v1` | [binturong/finish-v1](../../../public/demos/wildlife-v2/binturong/finish-v1/sheet.png) |
| Capybara | `wildlife-capybara-provisional-v1` | [capybara/finish-v1](../../../public/demos/wildlife-v2/capybara/finish-v1/sheet.png) |
| Chinchilla | `wildlife-chinchilla-provisional-v1` | [chinchilla/finish-v1](../../../public/demos/wildlife-v2/chinchilla/finish-v1/sheet.png) |
| Fossa | `wildlife-fossa-predator-v1` | [fossa/finish-v1](../../../public/demos/wildlife-v2/fossa/finish-v1/sheet.png) |
| Giant anteater | `wildlife-giant-anteater-provisional-v1` | [giant-anteater/finish-v1](../../../public/demos/wildlife-v2/giant-anteater/finish-v1/sheet.png) |
| Hedgehog | `wildlife-hedgehog-provisional-v1` | [hedgehog/finish-v1](../../../public/demos/wildlife-v2/hedgehog/finish-v1/sheet.png) |
| Honey badger | `wildlife-honey-badger-predator-v1` | [honey-badger/finish-v1](../../../public/demos/wildlife-v2/honey-badger/finish-v1/sheet.png) |
| Kinkajou | `wildlife-kinkajou-provisional-v1` | [kinkajou/finish-v1](../../../public/demos/wildlife-v2/kinkajou/finish-v1/sheet.png) |
| Meerkat | `wildlife-meerkat-provisional-v1` | [meerkat/finish-v1](../../../public/demos/wildlife-v2/meerkat/finish-v1/sheet.png) |
| Mongoose | `wildlife-mongoose-predator-v1` | [mongoose/finish-v1](../../../public/demos/wildlife-v2/mongoose/finish-v1/sheet.png) |
| Mouse | `wildlife-mouse-provisional-v1` | [mouse/finish-v1](../../../public/demos/wildlife-v2/mouse/finish-v1/sheet.png) |
| Pangolin | `wildlife-pangolin-provisional-v1` | [pangolin/finish-v1](../../../public/demos/wildlife-v2/pangolin/finish-v1/sheet.png) |
| Porcupine | `wildlife-porcupine-provisional-v1` | [porcupine/finish-v1](../../../public/demos/wildlife-v2/porcupine/finish-v1/sheet.png) |
| Raccoon | `wildlife-raccoon-provisional-v1` | [raccoon/finish-v1](../../../public/demos/wildlife-v2/raccoon/finish-v1/sheet.png) |
| Rat | `wildlife-rat-provisional-v1` | [rat/finish-v1](../../../public/demos/wildlife-v2/rat/finish-v1/sheet.png) |
| Red panda | `wildlife-red-panda-provisional-v1` | [red-panda/finish-v1](../../../public/demos/wildlife-v2/red-panda/finish-v1/sheet.png) |
| Red squirrel | `wildlife-red-squirrel-provisional-v1` | [red-squirrel/behavior-v1](../../../public/demos/wildlife-v2/red-squirrel/behavior-v1/sheet.png) |
| River otter | `wildlife-river-otter-provisional-v1` | [river-otter/finish-v1](../../../public/demos/wildlife-v2/river-otter/finish-v1/sheet.png) |
| Skunk | `wildlife-skunk-provisional-v1` | [skunk/finish-v1](../../../public/demos/wildlife-v2/skunk/finish-v1/sheet.png) |
| Three-toed sloth | `wildlife-sloth-provisional-v1` | [sloth/finish-v1](../../../public/demos/wildlife-v2/sloth/finish-v1/sheet.png) |
| White-nosed coati | `wildlife-white-nosed-coati-predator-v1` | [white-nosed-coati/finish-v1](../../../public/demos/wildlife-v2/white-nosed-coati/finish-v1/sheet.png) |

## Classic editor animals (13)

| Animal | Runtime type | Sprite |
| --- | --- | --- |
| Chicken | `chicken` | [assets/sprites/chicken.png](../../../public/assets/sprites/chicken.png) |
| Cow | `cow` | [assets/sprites/cow.png](../../../public/assets/sprites/cow.png) |
| Pigeon | `pigeon` | [assets/sprites/pigeon.png](../../../public/assets/sprites/pigeon.png) |
| Pigeon 2 | `pigeon2` | [assets/sprites/pigeon2.png](../../../public/assets/sprites/pigeon2.png) |
| Crow | `crow` | [assets/sprites/crow.png](../../../public/assets/sprites/crow.png) |
| Seagull | `seagull` | [assets/sprites/seagull.png](../../../public/assets/sprites/seagull.png) |
| Fish 1 | `fish1` | [assets/sprites/fish1.png](../../../public/assets/sprites/fish1.png) |
| Fish 2 | `fish2` | [assets/sprites/fish2.png](../../../public/assets/sprites/fish2.png) |
| Fish 3 | `fish3` | [assets/sprites/fish3.png](../../../public/assets/sprites/fish3.png) |
| Worm 1 | `worm1` | [assets/sprites/worm1.png](../../../public/assets/sprites/worm1.png) |
| Worm 2 | `worm2` | [assets/sprites/worm2.png](../../../public/assets/sprites/worm2.png) |
| Worm 3 | `worm3` | [assets/sprites/worm3.png](../../../public/assets/sprites/worm3.png) |
| Worm 4 | `worm4` | [assets/sprites/worm4.png](../../../public/assets/sprites/worm4.png) |
