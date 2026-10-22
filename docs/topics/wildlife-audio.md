# Animal sounds

Topic: wildlife-audio
Status: initial 36-animal sound queue delivered; additional voices in progress, owner listening review pending.
Updated: 2026-10-22.

Owner asked to catalogue current animal SFX and plan wider coverage before more
signature behavior work. This topic owns sound selection, audible triggers,
coverage and listening review. The [animal-by-animal audit](../wildlife-audio-audit.md)
records all 206 current Animal Browser entries. The
[behavior topic](wildlife-behaviors.md) continues to own AI and animation progress.

## Overnight campaign

Owner authorized the full 36-animal queue and additional suitable animals, up to
11 hours, with incremental commits/pushes and **targeted tests only**. Follow the
[canonical per-animal sound ledger](../../art-source/animal-audio/sound-campaign.json)
and [delivery record](../tactical/185-overnight-animal-voices.md). Unavailable or
poorly identified sources remain documented gaps rather than invented recordings.

All 36 initial campaign animals are committed and pushed, plus upright elephant
inheritance. Six further animals add distinct owl/eagle/hawk recordings and camel,
warthog and bison sounds. Per-animal sources, triggers and validation live in the
ledger and delivery record. Owner listening review remains pending.

## Current coverage

**87/206 entries have sound routes: 62 recorded, 25 synthesized, zero game-only;
119 remain unwired.** Fifty-six real recorded sets supply ninety-four excerpts.
The [generated animal-by-animal audit](../wildlife-audio-audit.md) owns exact current
routing, shared designs and missing entries. This is source coverage, not owner
listening approval or a live deployment check. Inherited coats/panther count as
covered entries, not additional recordings.

Game and embedded labs share `AudioManager` / `AnimalAudio`. Recorded voices use
300-pixel squared attenuation, stereo pan, per-species cooldowns and a combined
six-source cap with synthesis. Ambient admissions are globally separated by at
least three seconds; initial stationary calls wait 8–20 seconds, later calls wait
24–42 seconds plus the species cooldown. Named replicated action onsets have a
180 ms freshness guard. First-observed mid-action snapshots stay silent. No new
authority/save fields or AI subsystems are introduced for audio.

Resting contact calls are separate from display-only roars/howls/growls and
warning-only piglet/meerkat/raccoon/llama sounds. Llama is an explicit non-vocal
defensive air burst. NPS river-otter chirps use stationary surface ambience; no
underwater listener contract is introduced. Recorded species suppress their old synthesized
placeholder, including when a recording fails to load. Wolf/coyote/hyena/lynx and
big predators do not emit idle roars while hunting. Fox remains quiet through
listening/stalking/pounce/eat. Cheetah has real contact meows. Dire wolf and other
fantasy creatures keep separate synthesized designs.

Peacock calls only on its existing courtship display; other bird contact calls
are sparse. Macaw/African-penguin source interpretations remain explicit.
Owl, eagle and hawk now use tawny owl, bald eagle and red-tailed hawk recordings
on fresh existing displays; the former synthesized shared raptor route is suppressed.
Bison's nasal huff is an explicit non-vocal breath sound. Warthog grunts and
camel groans are sparse, with camel also using its existing generic action.

Deer snorts only at fresh alarm stamps, never while browsing. Elephant trunk work
and animal feeding remain quiet. Elk bugles have a 75-second cooldown.

Existing dog ball-return and cat perch cues remain shared. Corvid voices stop
while beaks carry objects. Bee buzz is finite flight-only playback, cancelled on
landing/sipping; cricket phrases require stationary idle and group spacing.
Only one world insect source sounds at a time. Removal, distance, carried/dead
actors, late loads, pause/mute/focus and teardown have explicit silence/cleanup.

Animal Browser filters recorded/synthesized/missing coverage. Native buttons
support keyboard/controller/touch audition without enabling world ambience.
Repeated auditions cycle actual excerpts and supersede pending earlier gestures.
Public recording credits/licenses are linked there. Lab ambience remains opt-in.

The [overnight delivery record](../tactical/185-overnight-animal-voices.md) and
[per-animal ledger](../../art-source/animal-audio/sound-campaign.json) track the
36-animal queue. Aquatic listener context, movement Foley and deliberate silence
classification remain separate follow-ups. Broad placeholders still present in
small arthropods/crocodiles should be reviewed rather than treated as unique voices.

## Source strategy

Prefer short, clean **recordings for familiar real animals**, retaining synthesis
for fantasy voices or sounds where stylization is intentional. Target two or three
usable variations per common voice after listening; do not create variants merely
by strongly pitching one species into another. Preserve the original recording
and trim/export recipe; ship mono OGG playback copies with quiet edges and
matched perceived loudness. Keep runtime decoding lazy and buffers shared.

Six first-slice recordings are retained in the
[source bank and exact receipts](../../art-source/animal-audio/familiar-v1/README.md).
The next three sources and five excerpts are retained in the
[farm bank](../../art-source/animal-audio/farm-v1/README.md).
Crow/raven/pigeon sources and seven excerpts are retained in the
[garden bird bank](../../art-source/animal-audio/garden-birds-v1/README.md).
Dove/bee/cricket and six excerpts are retained in the
[dove and insect bank](../../art-source/animal-audio/garden-v1/README.md).
These are public HQ MP3 previews, not lossless original downloads. Source/signal
inspection is complete; **owner listening approval remains pending**. The six familiar rows below are integrated; the Baby Animals pack supplied the
piglet source lead, but the exact original preview was downloaded directly. Other
rows remain researched candidates. The Jofae crow candidate was not selected;
[178](../tactical/178-garden-bird-voices.md) records the actual three bird sources:

| Candidate | Declared source/license | Possible use / qualification |
| --- | --- | --- |
| [Baby Animals pack](https://opengameart.org/content/baby-animals-sounds-pack) | Technopeasant; page declares CC0 and links original Freesound sources | Small farm/pet shortlist, especially piglet. Juvenile voices need age matching; not a blanket adult farm bank. |
| [Dog barking](https://freesound.org/people/krissyeliot/sounds/125523/) | krissyeliot; CC0 | Domestic dog candidate; 33-second indoor recording needs selection and room-noise assessment. |
| [Cat meow](https://freesound.org/people/Sadiquecat/sounds/689324/) | Sadiquecat; CC0 | Actual 0.877-second cat recording; compare with the creator's linked alternate takes before selecting variants. |
| [Cow moo](https://freesound.org/people/JarredGibb/sounds/233145/) | JarredGibb; CC0 | Mono field recording of a distant cow; check whether background/recording distance suits a close animal before selecting. |
| [Sheep bleat](https://freesound.org/people/Gitanki/sounds/172712/) | Gitanki; CC0 | Single 3.317-second bleat; trim and check fit with actual action timing. |
| [Chicken clucking](https://freesound.org/people/Breviceps/sounds/456803/) | Breviceps; CC0 | 14.953-second mono recording; select individual hen clucks and check the 16 kHz source quality. |
| [Horse whinny](https://freesound.org/people/3bagbrew/sounds/59569/) | 3bagbrew; CC0 | Original field recording with location/equipment provenance; select the call from the ten-second source. |
| [Crow caw](https://freesound.org/people/Jofae/sounds/361470/) | Jofae; CC0 | Short 0.432-second crow call; do not silently label it as raven. |
| [Kitten mew](https://opengameart.org/content/kitten-mew) | AntumDeluge; CC0 | Human-imitation option for a stylized cat, explicitly not a real adult-cat recording. |
| [Peacock chirp](https://opengameart.org/content/peacock-chirp) | AntumDeluge; page declares CC0, credits MediaCollege | Later peacock candidate; preserve upstream provenance. |
| [Bat screeches](https://opengameart.org/content/bat-screeches) | AntumDeluge, derived from polymorpheva; page declares CC0 | Later audible screech option; do not describe it as unmodified natural echolocation. |

[Freesound's own license guide](https://freesound.org/help/faq/) distinguishes
CC0, attribution and noncommercial uploads. Select and retain the exact individual
license and creator, including upstream sources for edited packs. Prioritize CC0
for assets committed to a public source repository; CC-BY is also possible with
complete credits. Some original downloads require a Freesound login.

Game-use permission alone does not establish source-file redistribution rights:
[Mixkit's SFX license](https://mixkit.co/license/modal/sfxFree/) allows game use
but forbids redistribution with source files. Do not choose it for a checked-in
raw-audio bank under those terms. Existing Kenney Foley/impact sounds remain
useful incidental audio, but the current committed bank contains no animal calls.

## Tracking and integration plan

The audio inventory is independent of the art/AI ledger. Runtime voice/action
mapping lives in `src/audio/AnimalVoice.ts`, take paths in `animal-recordings.json`,
and exact source/export receipts in the retained bank. Regenerate the full
206-entry audit with `npx tsx scripts/wildlife/audio-status.ts`; `--check` verifies
current mappings, browser identity coverage and report freshness. For each sound record:

- Sound ID, species/variants, vocalization versus movement/interaction category.
- Source page, creator, exact license, original file/hash and edited export/hash.
- Trigger, variants, gain, audible radius, per-animal cooldown and shared voice cap.
- Game/lab integration, source inspection, automation, listening-review outcome.
- Missing, candidate, integrated, deliberately silent or inherited status; silence
  and inheritance require a reason and do not count as unique voices.

The recorded bank uses one shared creature-audio consumer in the ordinary game and embedded labs.
Keep the authority responsible for meaningful action decisions; audio stays
client-side presentation. Decouple voice choice from `fierce.kind` and bare clip
indices. Prefer a small semantic cue/serial for action sounds if replicated pose
data cannot identify the event reliably; do not replicate audio buffers or add an
AI subsystem just for a cosmetic ambient call. Do not replay calls when loading a
scene in the middle of an action. Optional sparse idle calls can be local ambience.

Bound simultaneous voices, prioritize nearby meaningful cues, avoid repeated
variations, and stop owned voices on pause, hidden tab, scene teardown and mute.
Ambient calls must not obscure fetch/alarm/interaction cues or repeat per frame.
Keep browser gesture unlock and the lab's explicit opt-in. Add **Audition voice**
and audio coverage filters to Animal Browser during implementation, with ordinary
controller/keyboard/touch activation and useful silent/missing explanations.

Use native tests for profile coverage, correct voice selection (especially owl),
transition deduplication, cooldowns, distance and cleanup. A narrow real Chromium
audio test should exercise gesture unlock and actual rendered signal through the
shared game/lab consumer. Listening review must compare variants and a busy scene;
waveform tests alone cannot establish that a bark sounds good. Do not call a sound
approved or a species complete because a function is present.

## Audit evidence

Inspected `AudioManager.ts`, `CreatureCall.ts`, `PlayScene.ts`,
`FootstepSystem.ts`, `AmbientSystem.ts`, predator/raptor profiles, `HerdWork.ts`,
NaturalLandscapePage and the 206-entry behavior ledger. All calls above were
resolved using the actual routing precedence, now corrected to `callKind ??
fierce.kind`. [176](../tactical/176-familiar-animal-voices.md) records new playback,
source pins, UI and validation. Animation, AI and artwork review identities are
unchanged. [177](../tactical/177-farm-animal-voices.md) adds the three farm voices. Next:
owner listening review, then existing game/lab parity and predator voices. Bird delivery
is tracked in [178](../tactical/178-garden-bird-voices.md).

Initial audit validation: all 206 IDs match Animal Browser exactly, with no duplicates;
the original 35 call routes / 13 designs and named missing routes were checked against live
profile imports. All 29 existing CreatureCall/AudioManager tests, typechecks and
lint pass (lint retains 121 warnings and 42 informational diagnostics). The broad
`npm test` attempt encountered five Windows filesystem/WAL failures and orca/depot
scenario timeouts, then stopped making log progress with one busy worker. The
verified audit-owned Vitest process tree was stopped; no full-suite pass is claimed.
No runtime changes were made to address those unrelated diagnostics. No new
listening or browser-audio verification was performed for this documentation task.

Implementation [176](../tactical/176-familiar-animal-voices.md) subsequently passes
47 focused audio tests, typechecks, lint, strict inventories/build and unchanged
1,980-candidate retina raster verification. Final native: 6,691 passed, five known
Windows failures, ten skipped. Final browser: 834 passed, one GPU pinch Options
timeout; that exact unchanged case passes cold. All audio/browser boundaries pass.

Farm voices [177](../tactical/177-farm-animal-voices.md) pass 49 focused audio cases,
typecheck, lint and strict inventories/build; all 1,980 prior review objects remain
exact. Native regression: 6,693 passed, five known Windows failures, ten skipped.
Browser: 834 passed, one Canvas pinch Options timeout; the exact unchanged case
passes cold. Both audio boundaries pass. Nine recorded voices cover thirteen
entries with sixteen takes; owner listening review remains pending.

Bird voices [178](../tactical/178-garden-bird-voices.md) pass 52 focused audio
checks, typecheck, lint and strict inventories/build. All 1,980 prior candidate
objects remain exact. Native: 6,696 passed, five known Windows failures, ten
skipped. All 835 browser cases pass, including the new raven audition and both
shared Web Audio boundaries. Twelve recorded sets cover sixteen entries with
twenty-three takes; owner listening review remains pending.

Dove/insect sounds [182](../tactical/182-dove-and-insect-sounds.md) add three CC0
recordings/six takes, with flight-only bee buzz and group-limited cricket chirps.
All 56 focused audio checks, typecheck, lint and strict inventories/build pass.
All 1,980 prior review objects are exact. Native regression: 6,700 passed, five
known Windows failures and ten skipped. All 835 browser cases pass, including
cricket audition and real Worker bee flight audio. Fifteen recorded sound sets
cover nineteen entries with twenty-nine takes; owner listening review remains pending.

Delivery was rebased onto the incoming renderer-performance checkpoint
`26597576`. Full regression counts above refer to base `6f2915de`; combined-source
verification passes 58 focused native and 23 audio/GPU/vehicle-review browser
checks, types, lint, strict inventories and build. All 1,980 incoming review
objects remain exact. Sound source/export bytes are unchanged; current evidence
is in [182](../tactical/182-dove-and-insect-sounds.md).

Small-animal parity [183](../tactical/183-small-animal-sound-parity.md) moves the
three original provisional synthesized designs into shared game/lab playback and
adds auditions. Coverage remains 54/206 and 29 designs, now 19 recorded /35 shared
synthesized /0 game-only, with 152 unwired. The fifteen recordings/twenty-nine
exports are unchanged. All 66 focused audio checks and sixteen targeted browser
checks pass, plus typecheck, lint, strict inventories/build and the comparator.
All 1,980 prior review objects remain exact. Native regression: 6,712 passed,
five known Windows failures, ten skipped. Full browser run: 833/835 passed;
a train startup-travel boundary and GPU pinch/Joystick timeout both pass unchanged
in a fresh serial rerun. These original full-run failures remain recorded in
[183](../tactical/183-small-animal-sound-parity.md). Listening approval is pending.
