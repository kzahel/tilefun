# Character models and Workshop validation

Topic: characters
Status: six approved characters promoted to Entities; per-profile player model selection implemented.
Updated: 2026-10-03.

## Current slice

[Workshop → Character lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/character-lab)
contains Tiger, Tuxedo Cat, Floppy Dog, Trail Explorer, Russet Squirrel and Brown
Bear. It uses the existing authored 32px sheets: four directional rows, four
poses at 4 fps, centered horizontal pivot and initial vertical offset 5px.
No source pixels were changed. The 16px and rendered tiger alternatives remain
in the original galleries. Source provenance is in the [roster](../pixel-character-roster.md)
and [Blender workflow](../blender-pixel-characters.md).

`src/characters/CharacterCatalog.ts` separates appearance/physical configuration
from control. `createCharacterEntity` supplies sprite and collider components,
without NPC AI or player input. The six upright models carry explicit player eligibility. Gameplay uses the
separate immutable `approved-v1.json` snapshot through `PromotedCharacters.ts`;
Workshop drafts do not modify it. All six are registered in `ENTITY_DEFS`,
factories, gameplay assets and the Entities palette.

## Validation tool

Select a character, focus the canvas and use arrows/WASD or hold the touch
buttons. Space/Jump exercises height; Reset position returns to the start.
Cycle poses in place inspects all four directions without travel. Zoom supports
1:1 through 4× with a scrollable viewport. Turn geometry overlays off to judge
ordinary rendering.

Live settings adjust vertical sprite offset, depth sorting offset, collider
X/Y offsets, ground width/depth, physical height, walk speed and animation FPS.
The test scene now runs a memory-backed Realm in a Worker with the gameplay
player controller, binary replication and client prediction. Candidate geometry,
walk speed and animation FPS are scoped to that session. Drawing still uses
`collectScene`/`drawScene2D`; the static pose fixture has no simulation loop.
See [Gameplay scenarios](gameplay-scenarios.md).

The fixture has a wall, 16px passage, 4/8/12px passable steps (the existing
playground stair convention), a beam with 20px clearance and the current player
for scale. Overlays show the full sprite frame, ground footprint, physical
height, anchor, sort line and obstacle footprints. The ground collider uses the
game's center/bottom convention, not an image bounding box.

## Exact review and storage

Six zero-event candidates are registered in the global inbox. Candidate identity
pins source PNG bytes, default settings, sixteen rendered pose/fixture snapshots
(without platform-dependent text labels)
and the recipe, Realm host, collision, surface, gravity and animation source.
The runtime migration changes these behavior identities and reopens review;
the immutable approved-v1 gameplay bank and saved human decisions remain intact.
Images are verified before display; stale inventories disable saves.

Save settings / reopen, Approve character and Needs changes use authenticated
Workshop events and the existing outbox. Each saved `characterAnnotation` in the
art-note log contains candidate/source identity, validated canonical settings,
a server-derived settings fingerprint, verdict and original decision time.
Saved tuning is human input for a later promotion; it does not edit runtime
configuration. Editing a local draft never changes a prior approval. Saving a
new settings proposal reopens the candidate. Agent replies preserve decisions.

Draft settings/notes live in the existing Workshop browser storage, keyed by
candidate identity. Shared saves restore on a fresh browser; local drafts take
precedence until Load last saved settings or Reset to proposal. Offline writes
retry with the same event ID. Requests, Activity, threads and `npm run art:notes`
include the exact character settings. Two Needs changes reports pause the batch;
wait for the user's “ready” before implementing that batch's art fixes.

## Validation checkpoint

On 2026-10-03, typechecks, build and lint passed (lint retains existing repository
warnings); all 1,229 unit tests passed. New simulation tests check wall/passage
collision, step climbing and overhead clearance. Browser coverage exercises
movement/directional animation, stopping/jumping, actual touch release, draft
restoration, exact shared saves, offline retry and the two-report pause.
Desktop and phone captures were visually inspected.

The full browser run passed 250 cases; 13 were disrupted by concurrent work
removing the shared test login state and a standalone-server timeout. All affected
cases passed on isolated reruns with a separate server, copied build and storage.
One test's hard-coded login-state path was redirected in an ignored test copy.
No unrelated application changes were made for that interference. The character
suite also passed again in isolation. At that initial delivery checkpoint the human inbox had six unchecked
characters; automated verdicts were confined to test directories. The later
human approvals are recorded below.

## Normal-browser verification fix

The initial delivery missed normal Chromium coverage: all six fresh verification
canvases differed from headless-shell despite a current manifest. Reproduction
showed all six matching immediately when every 2D canvas used CPU rasterization.
This was the same failure mode previously fixed for Vehicles, not a missing
manifest rebuild. The misleading rebuild instruction was replaced with an
explicit rendering-mismatch message.

Character fixture and verification canvases now use the shared `reviewContext2D`
helper, also used by Vehicles. Label text remains visible but is excluded from
hashed snapshots to avoid system-font dependence. Manifest generation now
compares all six characters and 180 vehicles against a fresh normal Chromium
render at retina scale before writing, and rejects changes to inputs during the
run. Dedicated browser tests cover all six enabled reviews and rejection of a
mismatched manifest. Existing vehicle and other pre-character candidate identities
are unchanged; six unapproved character identities were regenerated.

Fix validation: typechecks, build, 1,229 unit tests and all 267 browser tests
passed; lint passed with the existing warnings. A visible bundled Chromium
window verified all six live dev-server pages with enabled approval controls,
without submitting reviews. The public deployment serves the matching current
manifest.

## Gameplay promotion and player selection

Human checkpoint, 2026-10-03: all six characters were approved with vertical
sprite offset 5, sorting/collider offsets 0, depth 6, physical height 24, speed
20 and 4 fps. Ground width is 10 except Bear at 14. The committed promotion
snapshot records each original approved candidate/source/settings fingerprint
and decision time, without copying private review history. Source-byte tests
pin the exact PNGs. Future changed art/settings need a new gameplay identity.

The subsequent traffic/roof-support change updated shared physics source hashed
by Character lab, reopening its test identities. The saved human approvals and
matching source pixels/settings remain intact. Promotion uses those exact saved
values; it does not claim approval of the newer lab controller or rewrite reviews.

**Edit → Entities** includes all six with thumbnails and ordinary directional
wandering. They use the approved collider and animation settings. Existing
factory-based persistence restores these versioned entity types without a save
format migration. Interactions/following remain a separate future slice.

**Main menu → Character** offers animated directional previews for Classic
Player, the 20 existing people and six approved upright characters. Selection
saves to the active browser profile's optional `playerModel` field, then applies
through an acknowledged server request. Failed requests restore the previous
saved preference. Old profiles and unknown stored values fall back to Classic
Player. Profiles are local to the browser, not cross-device accounts.

Player appearance is cosmetic: player identity, collider, physical height,
weight, speed, sprint, jump, riding and controller remain the same. Sprite sheet,
dimensions, frame count and approved vertical alignment come from the model.
Player animation timing stays with the player controller. NPC geometry/speed
never become player physics.

The session retains appearance through lobby/world/interior transitions; the
profile supplies it again on reconnect. `SpriteState.model` carries the selected
appearance in baselines and deltas, including reset to classic. Its binary flag
uses one optional model-index byte; the player model list is append-only.
Entity wire indices still follow sorted registry keys: update host/server and
clients together when deploying this registry expansion.

## Gameplay validation checkpoint

On 2026-10-03, typechecks and production build passed, all 1,302 unit tests
passed and all 279 browser tests passed. Lint retains only the existing 123
warnings and 32 informational diagnostics. Source/settings fingerprint tests
pin all six approvals. Model tests cover all 27 choices through binary baselines,
live deltas, reset to classic and prediction, while preserving player physics.
Server tests cover peer visibility, realm travel and invalid-model rejection.
Browser tests place all six through the real Entities palette, save/reopen the
Worker world, move the selected player, restore its profile choice, animate and
scroll the phone picker, and isolate a second profile. Desktop/phone captures
were visually inspected. The regenerated manifest verified all 186 character
and vehicle identities in normal Chromium; no existing candidate fingerprint
changed during gameplay integration.

## Next work

Playtest all six in a real world and try model switching with co-op players.
Then consider befriend/follow/stay interactions and model-specific abilities
only if explicitly desired; appearance currently has no gameplay advantage.
