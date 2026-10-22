# Overnight animal voices

Topic: wildlife-audio
Status: executing the owner-authorized queue, 2026-10-22.

Owner authorized all 36 proposed land/air animals, additional suitable animals if
finished, up to eleven hours, incremental commits/pushes and targeted tests only.
The [canonical sound ledger](../../art-source/animal-audio/sound-campaign.json)
tracks every animal, delivery batch, source gaps and listening-review status.
This is an audio campaign; existing art and AI approval identities remain intact.

## Queue

1. Tiger, lion, panther, brown bear, leopard, jaguar.
2. Wolf, coyote, spotted hyena, fox, cheetah, lynx.
3. Elephant, elk, deer, moose, zebra, hippopotamus.
4. Peacock, parrot, wild turkey, sparrow, flamingo, penguin.
5. Gorilla, chimpanzee, orangutan, capuchin, ring-tailed lemur, Japanese macaque.
6. Guinea pig, meerkat, raccoon, river otter, alpaca, llama.

Real animal recordings only: CC0 preferred; CC BY 3.0/4.0 permitted with exact
creator/source/license and public edit credits. Human imitations, unidentified
mixed-species scenes and transformed other-species sounds do not establish real
species coverage. Source gaps remain explicit and do not block independent work.
No owner listening approval is inferred from source descriptions or signal checks.

## Batch 1: large predators

Five sources/seven exports cover all six entries. Panther explicitly inherits
leopard, which reflects the intended melanistic-leopard interpretation. All use
fresh replicated display/warning poses and disable idle ambience. Registered
predator types now select recorded voices. Synthesized fallback is suppressed for
recorded species, including quiet poses and failed loads, preventing doubled calls.
The shared six-voice/spatial/lifecycle rules remain. Native tests exercise actual
serialized predator poses, join silence, idle silence, correct recording selection,
deduplication, cleanup and absence of layered synthesis. All retained sources and
exports are hashed; public credits are linked in Animal Browser. An explicit
single-bank exporter refuses to overwrite frozen artifacts.

Validation: **65 focused native audio checks and both existing Chromium audio
boundaries pass** (31.9 seconds). Typechecks, targeted Biome checks (zero errors,
two existing optional-chain warnings), strict catalog, normal/retina Workshop
inventory and production build pass. All 1,980 prior candidate objects remain
exact. Source digest: `55024590382c9ed3b2ad46488a2e4a4ac8406b58017e055baaaf74d2360f9df3`. Broad native/browser suites
were deliberately excluded by the owner's latest instruction. Initial browser
collection exposed a missing JSON import attribute; that was fixed before the
successful run. Listening review remains pending.

Ignored evidence: `data/overnight-audio-first-{native,browser,types,lint,catalog,
manifest,build}.log`; source waveforms and candidate metadata under
`data/overnight-audio/`. Incoming renderer checkpoint `2754c5ae5` will be reconciled
before push; subsequent combined-source evidence is recorded below.

Combined-source verification after rebase onto `2754c5ae5`: 65 focused native
audio checks, both existing Chromium audio boundaries, targeted lint, strict
catalog, normal/retina manifest and production build pass. All 1,980 incoming
candidate objects remain exactly equal to the incoming renderer checkpoint.
Combined input digest: `e47ef5703f6100e7b49c396c86e451f4cf02bbbf2db097c7b4d68dd075db0133`.
No recording bytes changed during rebase. Broad suites were not run.

## Batch 2: other hunters

Wolf, coyote, spotted hyena, fox, cheetah and lynx: six sources/eight excerpts.
Wolf/coyote/hyena/lynx are display-only; fox calls at sparse stationary idle and
stays quiet through listening/stalking/pouncing/feeding. Cheetah uses real contact
meows rather than its old generic cat sound. Dire wolf retains separate fantasy
synthesis. One complete natural wolf howl is 7.7 seconds; the explicit exporter
allows up to twelve seconds, with per-species cooldowns still bounded. All existing
banks remain unchanged. Current source coverage: 59/206 (31 recorded, 28 synthesized,
zero game-only), 147 unwired. Owner listening review remains pending.

Validation: all 60 focused native checks and both existing Chromium audio
boundaries pass (31.9 seconds); typechecks, targeted lint, strict catalog,
normal/retina manifest and production build pass. All 1,980 prior review objects
remain exact. Input digest: `31ce80aa273968afe611e9fe64df621be985334b1766ba529794ef94a6383f39`.
Ignored evidence: `data/overnight-audio-hunters-{native,browser,types,lint,catalog,
manifest,build}.log`. No broad suites run; owner listening remains pending.

## Batch 3: large herbivores

Elephant, elk, deer, moose, zebra and hippopotamus: six sources/eight excerpts.
Upright elephant explicitly inherits elephant; there are seven newly recorded
browser entries. Deer alarm snorts are restricted to a fresh replicated stamp,
with no browsing/idle audio. Its existing dedicated runtime type is mapped
explicitly. Elephant/elk/zebra have sparse stationary calls and generic action
cues, excluding actual eating/trunk work. Moose/hippo use sparse stationary
calls. Public-domain self dedication is distinct from CC0 in the moose receipt.
Deer identification/recording noise qualifications are explicit in the source bank.
Current coverage is 66/206 (38 recorded, 28 synthesized), 140 unwired, with 32
recordings/52 excerpts. Owner listening review remains pending.

Validation: 61 targeted native audio checks and both existing Chromium audio
boundaries pass (31.3 seconds). Typechecks, targeted lint, strict catalog,
normal/retina manifest and production build pass; all 1,980 prior candidate objects
remain exact. Input digest: `66e0b6b2baa42229cd46bb614b116572490cc92c32ad72735cf39be37e5fea82`.
Evidence: `data/overnight-audio-herbivores-{native,browser,types,lint,catalog,
manifest,build}.log`. No broad suites run; listening review remains pending.

## Batch 4: distinctive birds

Peacock, parrot, wild turkey, sparrow, flamingo and penguin: six sources/eleven
excerpts. Peacock uses fresh existing courtship displays only; turkey also uses
its generic action. Other calls are sparse stationary ambience. Parrot/sparrow
have explicit carrying silence. Macaw and African penguin interpretations and
sources with group/background/reverb are qualified in the source bank. The source
coverage is 72/206 (44 recorded, 28 synthesized), 134 unwired, with 38 recordings/
63 excerpts. Owner listening review remains pending.

Validation: 61 targeted native checks and both existing Chromium audio
boundaries pass (32.0s). Typechecks, targeted lint, strict catalog,
normal/retina inventory and build pass; all 1,980 prior candidate objects remain
exact. Input digest: `26be25c9d605738df5b4707e45aac52fa5354e75a9e129e7ec312440dd2ee061`.
Evidence: `data/overnight-audio-birds-{native,browser,types,lint,catalog,
manifest,build}.log`. Broad suites excluded; listening review pending.

## Batch 5: primates

Gorilla, chimpanzee, orangutan, capuchin, ring-tailed lemur and Japanese macaque:
six sources/ten excerpts. Gorilla/chimpanzee use fresh existing generic action
poses only; other voices are sparse stationary calls. Capuchin carrying stops
playback. Research sources establish chimpanzee/ape/macaque identities; macaque
uses original recorded coos rather than the study's manipulated stimuli. Source
sex/group/forest qualifications remain explicit. Coverage is 78/206 (50 recorded,
28 synthesized), 128 unwired, with 44 recordings/73 excerpts. Listening pending.

Validation: 61 targeted native checks and both existing Chromium audio
boundaries pass (30.8s). Typechecks, targeted lint, strict catalog,
normal/retina inventory and build pass; all 1,980 prior candidate objects remain
exact. Input digest: `21a72efd1e63019f17e5b595c4f8e6b0225d772c36a29d84429fc9c4114a17b8`.
Evidence: `data/overnight-audio-primates-{native,browser,types,lint,catalog,
manifest,build}.log`. Broad suites excluded; listening review pending.

## Batch 6: smaller mammals

Guinea pig, meerkat, raccoon, river otter, alpaca and llama: six sources/ten
excerpts. Guinea pig/alpaca/otter have sparse stationary calls. Adult meerkat
recruitment calls use existing threat-warning poses; raccoon defensive sounds and
llama's explicit non-vocal defensive air burst use fresh flee onsets only. Calm
rest, cache raids, feeding and unrelated work remain quiet. The existing piglet
native case now checks all warning-only mammal profiles without a browser matrix.
NPS otter public-domain attribution retains the original-work copyright notice.

All 36 initial campaign animals are wired, plus upright elephant inheritance.
Coverage is 84/206 (56 recorded, 28 synthesized), 122 unwired, with 50 recordings/
83 excerpts. Owner listening review remains pending.

Validation: 61 targeted native checks and both existing Chromium audio
boundaries pass (32.0s). Typechecks, targeted lint, strict catalog,
normal/retina inventory and build pass; all 1,980 prior candidate objects remain
exact. Input digest: `f7c7ed45f730bbd34dd92cf7131c19e2176f4dc2cf7582772baee32d32861565`.
Evidence: `data/overnight-audio-small-{native,browser,types,lint,catalog,
manifest,build}.log`. Broad suites excluded; listening review pending.
