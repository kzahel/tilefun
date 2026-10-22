# Crow, raven and pigeon voices

Topic: wildlife-audio
Status: implemented and automation verified, 2026-10-22. Listening review pending.

Owner authorized crow, raven and pigeon calls after the farm-voice checkpoint.
Use separate real recordings, retain exact license/source/export receipts, and
extend existing game/lab playback and auditions without changing animal art,
authority, save fields or review identities.

## Implementation

- Three individually verified CC0 sources and seven exports in
  `art-source/animal-audio/garden-birds-v1/`: two crow, three raven and two pigeon
  excerpts. Public HQ MP3 source previews, original/export hashes, creators,
  licenses, trims and offline export recipe retained. No generated/pitched takes.
- Sparse stationary idle calls share existing AudioManager/AnimalAudio consumers.
  No new calls start in flight, feeding/work action clips or alarmed states.
  Short existing tails may finish during movement; corvid pickup stops them
  immediately. No decorative call is attached to burying or nest building.
- Explicit corvid profiles suppress calls while replicated child actors occupy
  the beak. A single shared child-parent observation pass stops active calls and
  invalidates pending ones on pickup, including non-ball twigs and shiny objects.
  No server/AI/protocol changes or hidden supplies are added.
- Existing lab auditions rotate real takes and the recorded filter finds all three.
  Recorded coverage is now sixteen entries/twelve sets/twenty-three takes. Total
  call routes: 51/206, with 155 unwired and 26 effective designs. Dove stays separate.
  Behavior signature and human art/listening review counts are unchanged.

## Validation

Fifty-two focused audio checks pass. Source/export byte pins now cover twelve
recordings/twenty-three takes. Native coverage exercises replicated corvid twig/
shiny pickup, active/pending cancellation, distinct bird routing, quiet flight/work
and actual resting playback. Existing browser audio boundary auditions a new raven
file and checks decoding/rendered signal; no per-species browser matrix is added.
Typecheck and lint pass (zero errors, 121 existing warnings, 42 infos). Strict
catalog, normal Chromium retina manifest and production build pass; all 1,980
prior candidate objects are exact. Source digest:
`5c9a734cc0b0039bded2f6998d27622f69ee3e05ee1d2e5d901b9fcec50d7f02`.

Full native regression: **6,696 passed, five known Windows failures, ten skipped**
(6,711 total), 882.38 seconds. Failures match previous checkpoints: FsSecurity
dangling-symlink cases (3), SqliteRecordStore process-death/WAL (1) and
privateDataPlugin symlink setup (1). staticFiles retains its known Windows
symlink setup/cleanup errors. No introduced native failure. Browser-free comparator
passes. Both real Web Audio boundaries pass, including the new raven recording.
All **835 browser cases pass** in 40.6 minutes. The previously intermittent
pinch Options cases also pass without code, assertion or timeout changes.
[Structured validation](178-garden-bird-voices/validation.json) retains full counts
and limitations. Ignored evidence: `data/bird-audio-{focused,unit,browser}.log`,
`data/bird-audio-inventory-evidence.json` and the seven-take local sampler
`data/garden-bird-voices-sampler.mp3`.

Next: owner listening review, then dove/bee/cricket with deliberate flight buzz
and bounded insect ambience, or the existing robin/frog/duck game/lab parity gap.
