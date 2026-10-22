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
