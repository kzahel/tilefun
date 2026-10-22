# Familiar animal voices

Topic: wildlife-audio
Status: implemented and automation verified, 2026-10-22. Owner listening review pending.

Owner authorized the first slice of the [sound plan](../topics/wildlife-audio.md).
Implement recorded dog/cat/cow/sheep/chicken/horse voices and coat inheritance,
bounded spatial playback shared by game/lab, and Animal Browser audition/coverage
controls. Preserve existing sprites, behavior, saves and source/review identities.
Correct owl voice precedence while touching the shared sound consumer. Existing
robin/frog/duck game-only playback is recorded as subsequent parity work.

Retain exact CC0 source bytes, provenance/license evidence, reproducible editing
recipe and exported hashes. Source and signal inspection do not count as owner
listening approval. No new animal art is authorized by this slice.

Validate selection, action onsets, ambient cadence, range, load cancellation,
mute/pause/removal and bounded voices below the browser. Use one focused Chromium
boundary for actual decoding/signal, user unlock, audition and game/lab integration.
Run type/lint/units, inventories/build and appropriate existing browser checks.

## Implemented

- Six CC0 recorded voice sets, eleven excerpts, ten browser entries including
  pet coats. Exact public HQ MP3 previews, creator/license provenance, original
  and exported SHA-256, trim/filter recipe and signal metrics are retained in
  `art-source/animal-audio/familiar-v1/`. Normal builds use the frozen OGG bank.
- `AnimalAudio` shares lazy decode/cache, spatial gain/pan, bounded idle cadence,
  per-actor cooldowns, nearest/action admission and a six-voice combined budget
  with existing synthesis. Game and lab use the same AudioManager consumer.
- Base dog release, cat perch rest, sheep regroup bleat and chicken peck clips
  supply authoritative action cues. Cow/horse use sparse idle calls. Existing dog
  coats lack release clips: their actual replicated carried-ball return beside a
  player supplies the cue without new art, simulation or protocol fields.
- Deleted/transferred/distant balls and alarmed dogs cannot fake a return bark.
  Mute/pause/range/removal/suspension/scene reset stop voices and invalidate pending
  starts; resetting observations prevents reused IDs replaying an old drop.
- Animal Browser has explicit recorded/synthesized/game-only/missing filters and
  keyboard/touch audition buttons. Audition cycles actual takes in an independent
  opt-in context. Lab focus loss stops playback. Owl voice selection now prefers
  its explicit hoot over its raptor movement profile.
- Generated audio audit covers all 206 current browser/ledger identities: 45 call
  routes (ten recorded, 32 shared synthesis, three game-only), 161 without calls.
  Twenty voice designs include inherited/shared voices once each. Behavior and
  artwork completion/review counts remain unchanged.

## Validation checkpoint

Final source is frozen for regression verification. Forty-seven focused native
audio cases pass; typecheck, lint, strict build, audio audit freshness and current
835-case browser collection verification pass. Six source files and eleven runtime
files are hash-pinned; every exported clip was decoded and measured by the recipe.
The replay recipe's JSON formatting matches the retained metadata without changes.

The first affected browser run passed all 89 cases, including real Web Audio
decode/render, keyboard audition, live sheep lab cues, ordinary Worker cow
playback, focus/menu cleanup, all animal previews and existing fierce/pack sounds.
The first full native run completed 6,684 passed, five known Windows failures and
ten skipped in 847.91 seconds. After the coat/reset correction, the final full
native run completed **6,691 passed / five known Windows failures / ten skipped**
(6,706 cases) in 894.05 seconds. Failures are the three FsSecurity symlink cases,
SqliteRecordStore process-death/WAL case and privateDataPlugin symlink case;
staticFiles also has its existing Windows symlink setup/cleanup errors. There are
no introduced native failures. The final 835-case browser sweep completed
**834 passed / one failed** in 40.6 minutes. The GPU pinch-zoom preference case
timed out waiting for the Joystick control in Options; the unchanged exact case
passed cold in 8.1 seconds (11.4 seconds including setup). No pinch code, test,
assertion or timeout was changed. All new animal/audio boundaries passed.

The browser-free comparator passes. Migration verification retains all 403
decisions and records 835 browser cases. The source audit reports 45/206 call
routes and verifies all current identities. [Machine-readable evidence](176-familiar-animal-voices/validation.json).

All 1,980 prior Workshop candidate objects remain exactly unchanged. The updated
source digest is regenerated and normal full Chromium retina parity passes.
An intermediate manifest run correctly rejected source edits made during capture;
it was regenerated after source freeze. An intermediate full browser attempt was
stopped after 108 successful cases to rebuild with the coat correction; it is not
claimed as a completed run.

Owner listening approval remains pending. The source dog is a small indoor dog;
the cow was recorded at a distance. Cat, sheep and horse each currently have one
complete take, rather than fabricated pitch variants. Remaining robin/frog/duck
lab parity, movement Foley and later voice sets remain in the owning topic.
