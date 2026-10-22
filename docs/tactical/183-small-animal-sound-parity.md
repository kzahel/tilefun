# Robin, frog and duck sound parity

Topic: wildlife-audio
Status: implemented and automation verified, 2026-10-22. Listening review pending.

Owner authorized the next three-animal sound slice after dove/bee/cricket.
Move existing provisional synthesis into the common game/lab consumer and expose
auditions without changing artwork, authority, save data or adding recordings.

## Implementation

- Original three-note robin, two-pulse frog and descending nasal duck contours
  are sampled into cached buffers in `SmallAnimalCall.ts`. Duck retains a
  band-limited saw through a 950 Hz / Q=1.5 bandpass. Quiet endings and short
  0.36/0.32/0.21-second lengths bound playback. These remain code-generated
  provisional sounds, separate from the fifteen recorded sets and their licenses.
- All three use `AudioManager.updateCreatureCalls` in game and embedded labs.
  The old PlayScene call triggers/oscillators are removed. Replicated named
  `action` transitions retain robin/frog cues; duck's existing calm quack pose now
  also sounds. Frog's action includes blink/startle artwork: this is preserved
  provisional cueing, not a new semantic croaking event or approved animation.
- Fresh observed alarm transitions also sound, including alarms during an old
  committed hop. The first observed snapshot stays silent. Action poses older
  than 180 ms do not replay. Two-second per-actor cooldowns, nearest-first
  admission, 300-pixel squared attenuation, world-space pan and the combined
  six-creature limit replace the separate uncapped route.
- Carried/dead/out-of-range actors stay quiet; removal, range, mute, pause/focus
  and teardown retire owned sources. Scene reset forgets small-animal observations
  so reused IDs cannot invent an alarm. Existing hunter triggers remain shared.
- Keyboard/touch/controller button auditions now include all three synthesized
  calls. Cross-kind auditions cancel pending recordings/resume requests and
  supersede current audition playback. Browser coverage labels them Synthesized.
  Shared coverage is 54/206 (19 recorded, 35 synthesized), zero game-only;
  152 remain unwired and effective designs remain 29. There are 22 auditionable
  entries; recorded source/export counts remain fifteen/twenty-nine.

## Validation

All 66 focused audio checks pass. Native coverage checks actual serialized
robin/frog/mallard poses, first-snapshot/action/alarm handling, spatial mix,
cooldown and flock caps, carried/dead/mute/range/removal cleanup, audition races
and bounded synthesized signals. Existing bird/frog/duck browser probes now
observe successful shared playback rather than calls to removed oscillator APIs.
The existing audio boundary also auditions a robin and enables the actual
Worker robin scene, without adding a per-species browser matrix.

Typecheck, lint and production build pass (zero lint errors, 121 existing warnings,
42 infos). Strict catalog and normal Chromium retina manifest pass; all 1,980
prior candidate objects remain exact. Source digest:
`1470f26fdfe73e16db32b17c3d90fa42475c008b3259dac07d18a5781c9b5d81`.

Full native regression: **6,712 passed, five known Windows failures, ten skipped**
(6,727 total), 885.80 seconds. The failures match preceding checkpoints:
FsSecurity dangling database symlinks (3), SqliteRecordStore process-death/WAL (1)
and privateDataPlugin symlink setup (1). staticFiles retains its Windows symlink
setup/cleanup errors. Browser-free comparator passes.

All sixteen focused animal/audio browser cases pass. Full browser regression:
**833/835 passed** in 41.0 minutes. The train reload startup-travel check received
exactly 192px against its strict <192 limit; the GPU pinch flow timed out waiting
for Joystick. Both exact cases pass unchanged in a fresh one-worker run
(two passes, 28.3 seconds). Their assertions, tolerances and runtime code are
unchanged. No sound boundary fails. This records observed intermittent failures,
rather than treating the original full run as an all-pass result.

[Structured validation](183-small-animal-sound-parity/validation.json) retains
counts and limitations. Ignored evidence: `data/parity-audio-{focused,unit,browser,
browser-focused,browser-cold}.log`, `data/parity-audio-inventory-evidence.json`,
`data/parity-audio-{train,pinch}-failure/` and the listening sampler
`data/robin-frog-duck-sampler.mp3`. Listening review remains pending;
all fifteen recorded source files and twenty-nine exports remain unchanged.

Next: owner listening review, then recognizable tiger/lion/panther/brown-bear voices.
