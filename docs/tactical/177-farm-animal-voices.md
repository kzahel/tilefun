# Goat, donkey and piglet voices

Topic: wildlife-audio
Status: implemented and automation verified, 2026-10-22. Listening review pending.

Owner authorized the next three recorded voices after the familiar-animal slice.
Retain individually checked CC0 source previews and exact offline export receipts.
Use shared game/lab playback and existing lab auditions, without changing art,
authority, animations, saves or candidate review identities.

## Implemented

- Three real Freesound recordings in `art-source/animal-audio/farm-v1/`, five mono
  OGG excerpts (two goat, two donkey, one piglet). Source/export hashes, creators,
  license links, original public HQ MP3 previews, trims and filters retained.
- Goat bleats and donkey brays use existing bounded sparse idle playback. Calls
  stay quiet during browsing, hopping and dust baths; no forced action calls.
- The actual piglet recording is an angry squeal, so its profile disables idle
  calls and admits only a fresh replicated flee onset. The shared consumer permits
  that explicit alarm cue through its usual scared-actor rejection. Late joins,
  sustained fleeing and repeated updates cannot replay it. Existing cooldown,
  range, six-voice budget and cancellation rules remain shared.
- Existing Animal Browser sound filters/audition discover all three automatically.
  Recorded coverage is now thirteen entries/nine voice sets/sixteen takes; total
  call routes 48/206 with 158 unwired. No new signature AI behavior is counted.
- The original familiar bank is unchanged. Artwork and behavior review status
  remain unchanged; owner listening approval is not inferred from automation.

## Validation

Forty-nine focused native audio cases pass, including combined source/export pins,
piglet calm silence/fresh replicated alarm/deduplication/reset and resting versus
dust-bathing playback. Typecheck passes. The existing Web Audio boundary auditions
the new piglet file and checks rendered signal; no per-species browser matrix added.
Full native regression completed in 876.31 seconds: **6,693 passed, five known
Windows failures, ten skipped** (6,708 total). The failures match the prior
checkpoint: three dangling-symlink FsSecurity cases, SqliteRecordStore process-death/
WAL and privateDataPlugin symlink setup. staticFiles also retains its existing
Windows symlink setup/cleanup errors; no introduced native failure. Lint has zero
errors (121 existing warnings, 42 infos). Browser-free comparator passes.

Strict catalog, production build and normal Chromium retina manifest pass. All
1,980 existing candidate objects match HEAD exactly; only broad input digest
changes to `728fb3711eca3f116eb1d7cc895e9dcca2ae08b914db7533fddd8e449c6b4437`.
Both shared Web Audio boundaries pass, including actual new piglet decoding,
rendered signal, keyboard audition, lab action and normal Worker playback/cleanup.
The full browser run completed **834 passed, one failed** in 40.5 minutes. The
Canvas pinch preference case timed out waiting for Joystick while Options was
absent, matching the prior checkpoint symptom. Its exact unchanged cold rerun
passes in 8.1 seconds (11.2 seconds with setup). No pinch code, timeout or
assertion changed. Both audio boundaries and every other browser case pass.
[Structured validation](177-farm-animal-voices/validation.json) retains counts and
limitations; ignored raw logs are `data/farm-audio-{unit,browser,pinch-cold}.log`,
with the original failure context/screenshot in `data/farm-audio-browser-evidence/`.

Next: owner listening review, then crow/raven/pigeon/dove voices with separate
species choices, or existing robin/frog/duck game/lab parity.
