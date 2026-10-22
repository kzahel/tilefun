# Dove and insect sounds

Topic: wildlife-audio
Status: implemented and automation verified, 2026-10-22. Listening review pending.

Owner authorized the next dove/bee/cricket batch after crow/raven/pigeon. Use real
recordings with retained source/license/export provenance. Keep game and embedded
lab on one presentation consumer; preserve animal artwork, authority and saves.

## Implementation

- Three individually verified CC0 recordings and six excerpts in
  `art-source/animal-audio/garden-v1/`. Dove is mourning-dove cooing; bee is
  bumblebee wing buzz; cricket is close single-cricket stridulation. Mechanical
  insect sounds are explicitly distinguished from vocalizations. Public HQ MP3
  previews, original/export hashes, exact offline recipe and credits are retained.
- Dove uses sparse stationary idle calls independently of pigeon. Bee uses finite
  1.05-second buzz bursts only in moving replicated `fly` poses, with 4–7-second
  spacing. Landing/flower sipping invalidates pending requests and stops current
  buzz. No ambient or alarm buzz is added while stationary, carried or scared.
- Only one world insect source may play at once, inside the combined six-creature
  limit. Cricket groups admit no more than one phrase per twelve seconds; individual
  cooldown and existing ambient spacing also apply. Chirping stops on hopping.
  Cadence is local presentation, not an invented nighttime or authority event.
- Existing controller/keyboard/touch auditions cycle the real takes. Recorded
  coverage: nineteen entries/fifteen sets/twenty-nine takes. All sound routes:
  54/206, 152 missing and 29 effective designs. AI and art completion are unchanged.

## Validation

All 56 focused audio checks pass. Native checks exercise real serialized poses,
bee flower contact, land/takeoff cancellation before decode, stationary-clip
rejection, cricket group cadence and shared insect capacity/removal. All fifteen
source and twenty-nine export hashes are pinned. Existing Web Audio browser
boundary now auditions cricket, measures real decoded stereo rendering and runs
the ordinary Worker bee pollination scene. No per-species browser matrix is added.

Typecheck and lint pass (zero errors, 121 existing warnings, 42 infos). Strict
catalog, normal Chromium retina manifest and production build pass. All 1,980
prior candidate objects remain exact; source digest:
`d44a62cc670650a37b43d00f0e5c9b2c857cbbb835225945768aa605e475b1e5`.

Full native regression: **6,700 passed, five known Windows failures, ten skipped**
(6,715 total), 907.03 seconds. Failures match preceding checkpoints: FsSecurity
three dangling-symlink cases, SqliteRecordStore process-death/WAL and
privateDataPlugin symlink setup. staticFiles retains its Windows symlink
setup/cleanup errors. No introduced native failure. Browser-free comparator passes.
All **835 browser cases pass** in 40.5 minutes, including cricket audition,
real Worker bee flight audio, ordinary game playback and pause/focus cleanup.
The existing pinch Options cases pass without changes or retries.

[Structured validation](182-dove-and-insect-sounds/validation.json) records counts
and limitations. Ignored evidence: `data/garden-audio-{focused,unit,browser}.log`,
`data/garden-audio-inventory-evidence.json` and the six-take
`data/dove-insect-sounds-sampler.mp3`. Source/signal inspection is complete;
owner listening approval remains pending.

Two renderer-performance commits landed during delivery. Rebase onto
`265975760e94a43a12f559427889d6c8c459af00` preserves every incoming candidate;
the source digest above is the combined revision. The full 6,700-native /835-browser
runs were on original base `6f2915de311ab543ac8d2d7d114d17a383451910`.
After rebase, all 58 focused native checks (56 audio, two incoming car-cache)
and all 23 audio/GPU/vehicle-review browser cases pass, along with typecheck,
lint, strict catalog/normal-retina manifest and build. Tactical 179 was taken by
the incoming work, so this delivery record moves to 182. Sound implementation
and retained source/export bytes are unchanged.

Next: listening review, then share robin/frog/mallard playback with the lab, followed
by the four large predator voices.
