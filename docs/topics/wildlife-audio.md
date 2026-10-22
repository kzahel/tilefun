# Animal sounds

Topic: wildlife-audio
Status: first six recorded voices implemented and automation verified; owner listening review pending.
Updated: 2026-10-22.

Owner asked to catalogue current animal SFX and plan wider coverage before more
signature behavior work. This topic owns sound selection, audible triggers,
coverage and listening review. The [animal-by-animal audit](../wildlife-audio-audit.md)
records all 206 current Animal Browser entries. The
[behavior topic](wildlife-behaviors.md) continues to own AI and animation progress.

## Current coverage

Source inspection finds call wiring for **45/206 entries (21.8%)**, using **20
effective sound designs**: six recorded voices covering ten entries, eleven
shared synthesized hunter designs and three game-only synthesized calls. Before
this slice, 35 entries shared thirteen synthesized designs. The 73 existing OGG files cover
footsteps (30), impacts (25), jumps (4), UI/ghosts (11) and campfire crackle (3).
The new bank adds eleven short OGG excerpts. These are source-level coverage counts, not a listening approval or live-deployment
check. Related animals sharing a voice count as covered entries, not unique sounds.

| Effective design | Animals currently routed to it | Trigger / consumer |
| --- | --- | --- |
| Recorded bark | Dog, golden retriever, pointed-ear shepherd | Actual carried-ball return near a player (also base release pose), sparse idle; shared game/lab |
| Recorded meow | Cat, ginger tabby, black cat | Perch-rest sit onset, sparse idle; shared game/lab |
| Recorded moo | Cow (also legacy cow) | Sparse idle, excluding grazing/rumination; shared game/lab |
| Recorded bleat | Sheep | Actual flock-regroup bleat onset, sparse idle; shared game/lab |
| Recorded cluck | Chicken (also legacy chicken) | Peck onset, sparse idle; shared game/lab |
| Recorded whinny | Horse | Sparse idle; shared game/lab |
| Robin chirp | Robin | Enter calling clip 3, or become scared; ordinary PlayScene only |
| Frog croak | Frog | Enter croaking clip 3, or become scared; ordinary PlayScene only |
| Duck quack | Mallard duck | Become scared; ordinary PlayScene only |
| `wolf` | Grey wolf, dire wolf | Enter clip 3; game and Natural landscapes lab |
| `coyote` | Coyote | Enter clip 3; game and lab |
| `hyena` | Spotted hyena | Enter clip 3; game and lab |
| `cat` | Jaguar, leopard, cheetah, lynx, bobcat, mongoose, fossa, white-nosed coati | Enter clip 3; game and lab |
| `bear` | Polar bear, honey badger, Tasmanian devil | Enter clip 3; game and lab |
| `owl` | Tawny owl | Enter clip 3; game and lab |
| `raptor` | Bald eagle, red-tailed hawk, secretary bird | Enter clip 3; game and lab |
| `rex` | T. rex, Nile crocodile, American alligator | Enter clip 3; game and lab |
| `spider` | Giant spider, Komodo dragon, Gaboon viper, wolf spider, praying mantis, scorpion, centipede, coconut crab | Enter clip 3; game and lab |
| `griffin` | Griffin | Enter clip 3; game and lab |
| `dragon` | Small dragon | Enter clip 3; game and lab |

The shared synthesized calls use a 1.28-second buffer, distance attenuation to
480 world pixels, stereo pan and a six-voice limit. Calls are keyed from replicated
sprite transitions, with an onset-age check to avoid replaying old displays on
join/reload. Clip 3 also represents scared poses for predators; the trigger is not
restricted to a semantic vocalization event. Robin/frog/duck use a separate
PlayScene path with a 300-pixel radius. Lab sounds default off behind **Enable
creature sounds**; enabling them does not connect that separate three-animal path.

Recorded calls use shared `AnimalAudio` under `AudioManager.updateCreatureCalls`:
300-pixel attenuation/pan, per-animal cooldowns (8–30 seconds), initial idle delay
8–20 seconds, subsequent idle spacing 24–42 seconds and at least three seconds
between ambient admissions. Named replicated clips identify action onsets; no
new authority or save fields are needed. Six voices is the combined recorded/
hunter-synthesis cap; the three older game-only oscillator calls retain their
separate path until the parity slice. Action candidates precede ambience and
nearest actors win.
The older golden/shepherd banks lack a release clip, so a real replicated
carried-ball drop beside a player also supplies the dog return cue. Deletion,
transfer, alarm and distant drops are excluded; no animation or save data changes.
Loads and decoded buffers are shared per take. Late requests, first-observed
mid-action poses, removed/carried/dead actors and out-of-range actors stay quiet.
Pause/mute/focus/scene exit cancel pending starts and stop active recorded voices.

Animal Browser has Recorded / Synthesized / Game-only / No call wired filters,
plus keyboard/touch/native-button **Audition voice**. Auditions explicitly unlock
their own audio context and cycle actual recorded takes without enabling world
ambience. Dog/cow/chicken have multiple excerpts; cat/sheep/horse currently use
one complete take each. No artificial pitch variants are counted.

### Important gaps and corrections

- **Tiger, lion, panther and brown bear have no call routing.** Their display
  animations alone do not produce roars or growls.
- Goats and donkeys still have no vocalizations. The hunter `cat` synthesis and
  new domestic-cat recording are separate voice sets; coats explicitly inherit.
- Owl routing is corrected: explicit `callKind` now takes precedence over the
  locomotion/behavior `fierce.kind`. A native test asserts the selected hoot.
- Several species have broad placeholder voices: crocodiles share the rex
  design; coati/mongoose share the cat design; small arthropods share the giant
  spider design. Review these independently of whether a sound technically plays.
- Most authored fauna lack movement Foley as well. `FootstepSystem` admits
  terrestrial predator profiles and legacy `chicken`/`cow` types, but not authored
  provisional chicken/cow or generic fauna such as horse. Vocalization coverage
  must remain separate from footsteps, wingbeats, splashes and interaction sounds.
- The 161 entries without calls have not been classified as intentionally quiet.
  Silence can be correct; adding a constant voice to every animal is not the goal.

## Recommended delivery order

Keep the first slice about audible animals and reuse their existing behavior.
No new art, elaborate mimicry AI or animal production is needed to prove it.

| Slice | Animals / scope | Audible result |
| --- | --- | --- |
| 1: familiar voices | Dog and two coats; cat and two coats; cow, sheep, chicken, horse | Implemented in [176](../tactical/176-familiar-animal-voices.md); six voice sets cover ten entries. Shared action/idle playback and auditions; owner listening review pending. |
| 2: farm and garden | Goat, donkey, piglet; crow, raven, pigeon, dove; bee, cricket | Species-specific calls/buzzes; distinguish crow and raven, pigeon and dove. Buzz only while the bee flies; insect ambience must not multiply into a swarm of loops. |
| 3: existing-call corrections and predators | Connect robin/frog/duck in lab; tiger, lion, panther, brown bear; review hunter placeholders | Owl routing completed in slice 1. Remaining work: game/lab parity, recognizable large predators, quieter and more appropriate small hunters. |
| 4: specialist land/air | Peacock, parrot, elephant, primates, other birds and mammals | Fill prioritized gaps with explicit species/context choices. Parrot starts with its own call; imitation remains a separate proposed behavior. |
| 5: aquatic and deliberate silence | Marine mammals, amphibious animals, quiet species | Decide surface/listener context before whale/dolphin playback. Document quiet animals and appropriate incidental sounds without inventing roars for fish or insects. |

Slice 1 raises raw call coverage from 35 to **45/206 (21.8%)**. Improving existing
voices and classifying deliberate silence are useful even when that count stays
unchanged. Track entries, voice sets, appropriate contexts and listening approval
separately.

## Source strategy

Prefer short, clean **recordings for familiar real animals**, retaining synthesis
for fantasy voices or sounds where stylization is intentional. Target two or three
usable variations per common voice after listening; do not create variants merely
by strongly pitching one species into another. Preserve the original recording
and trim/export recipe; ship mono OGG playback copies with quiet edges and
matched perceived loudness. Keep runtime decoding lazy and buffers shared.

Six first-slice recordings are retained in the
[source bank and exact receipts](../../art-source/animal-audio/familiar-v1/README.md).
These are public HQ MP3 previews, not lossless original downloads. Source/signal
inspection is complete; **owner listening approval remains pending**. Other
entries below remain researched candidates and have not been integrated:

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
unchanged. Next: owner listening review, then farm/garden or predator voices.

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
