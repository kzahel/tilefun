# Wildlife art and ecology

Topic: wildlife
Status: all 22 existing-sheet species and four new pet variants have durable provisional gameplay; the four exact pet drafts await human review. Other art expansion stays stopped.
Updated: 2026-10-10.

## Common pets: bounded resumption

On 2026-10-10 the owner requested recording familiar-animal/variation ideas,
proceeding with cats and dogs, and committing incrementally. [084](../tactical/084-common-pets-and-variations.md)
owns ginger tabby, black cat, golden retriever and pointed-ear shepherd drafts,
corrected source-driven body/hip motion, exact pending Workshop review and
reuse of existing pet gameplay. This supersedes the older no-variant rule only
for this named batch. The generic 196-entry campaign remains disabled, and its
sheep/pig repair gate is not cleared by pet work. Existing frozen revisions,
receipts and human review decisions remain unchanged.

All four new exact drafts are registered in `wildlife-v2-common-pets-084`, with
editable sources, motion audits and native playback. Fresh settlement greens
choose seeded coats independently of their stable cat/dog family IDs. Rural
habitat ownership and all original art remain intact; older saved chunks are
not backfilled. **Edit → Entities** creates durable individuals of each new pet.
The four new Worker inspection cases use real settlement populations and share
game AI, collision, support, saved phases and harmless reactions. Native gait
speed follows each new sheet's authored stride; art is still pending human review.
084 is complete and retains source/capture and validation evidence. Its full
browser run passes 499 cases, including all wildlife/settlement checks, with
four unchanged phone-review/GPU diagnostic failures and one optional capture
skip. All animal units, typechecks, lint, build, inventory/parity checks and
six-phase streaming readiness pass. The full Windows unit run has five unrelated
symlink/process-kill harness failures; 084 records their exact limits.

The [ideas backlog](../ideas.md#living-world-and-inhabitants) records common birds,
garden insects (especially bees), small animals, farm/pond additions and further
coat/breed/age variations. These are suggestions, not authorized production.

## Autonomous completion of existing gameplay roster

On 2026-10-09 the owner authorized integrating all 17 remaining existing drafts,
autonomously, with a written tracker and incremental commits. [082](../tactical/082-complete-provisional-wildlife.md)
owns slices A–E and per-species completion/evidence. This continues provisional
gameplay with unchanged art: fox; cat/dog and five pasture animals; elephant,
giraffe, kangaroo, cobra and ants; fish, penguin, seal and ray; final habitat and
regression pass. Five existing implementations stay intact. Durable seeded
individuals, suitable accessible homes, varied native cycles, shared game/lab
behavior, manual creation, harmless reactions and no automatic bounce remain the
contract. Art production/approval holds are separate and unchanged.

All 17 remaining species are integrated and committed: fox; cat, dog, cow, sheep,
horse, pig and goat; elephant, giraffe, kangaroo, king cobra and ant; pond fish,
penguin, harbor seal and manta ray. Together with duck, frog, rabbit, robin and
deer this completes the **22-species existing-sheet roster**. Zero animals remain
in this authorized scope. Shared profiles preserve species-specific bodies,
speeds, spacing, grouping, native walk/hop/swim/action clips and saved phases.
Kangaroo has physical timed push/flight/landing; penguins/seals change gait at
resolved shores; fish/rays follow full-body water/depth constraints. Existing
five gameplay implementations remain intact.

Regional homes reserve appropriate dry clearings, ponds and rare broad water
refuges with accessible sandy shores, outside infrastructure and protected dry
homes. Four production seeds admit every added dry species plus water refuges;
planner caches remain bounded. Species need exploration: this does not promise
every animal beside every starting area. Saved chunks are not backfilled.
**Edit → Entities** exposes all species for durable manual creation. Individuals
seed once, retain activity/RNG/motion across return/reload and remain deleted when
removed; no automatic respawn or offscreen catch-up. Approach, landing and balls
cause bounded harmless escape/recovery. Player standing never receives a bounce.

[Inspect the water refuge](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-manta-ray&landscape=thicket#/tool/world-geometry)
at seed 2026, -656,-2997;
[inspect kangaroos](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-kangaroo&landscape=thicket#/tool/world-geometry)
at -21,-22. These are shared in-memory production Worker scenes with native
framing, Pause, Save / reload and contact controls. 082 lists all species arrivals,
captures, incremental commits and detailed validation.

Final evidence: **2,031 units**, typechecks, lint, inventories/build and six-phase
streaming readiness pass. All 70 added-profile/scene-switch browser checks pass.
Complete browser suite: **476/479** (18.4m), with all wildlife regressions passing.
Failures are the two known archived fox-preview reviews and intermittent Canvas
train roof-support loss after reopening; the unchanged isolated complete train
journey passes in 1.5m. GPU journey and phone ride pass. The train topic retains
this unresolved intermittent evidence. The earlier close-camera duck recovery
probe was strengthened to require the same present, grounded, recovered duck;
both renderers pass. No duck physics changed. All 27 exact wildlife review
objects, frozen pixels, receipts and approval events remain unchanged.
At 082 completion the production-table helper lacked ignored campaign state.
084 now has the retained local progress state and refreshes the table while
preserving historical art counts/holds and tracking the four pets separately.
Next gameplay work is density/habitat/activity playtesting, separate from
existing art motion holds.

## Settlement pets and farm residents

[083](../tactical/083-farms-town-pets-and-larger-cities.md) adds one seeded cat and
one dog per settlement green, alongside small mixed cow/sheep/goat/pig pastures
at admitted farmsteads. They reuse the delivered native profiles, shared AI,
records and harmless reactions. A saved optional `habitatBounds` rectangle in
world pixels constrains the complete physical footprint along routine and escape
paths, keeping pets in pedestrian-safe yards/greens away from road traffic.
Initial positions avoid existing green furniture and each other. Manual animals
keep their own ordinary homes; generation does not add respawns or catch-up.
Deletion and exact individual phase/RNG survive reload. New profiles explicitly
start at ground height zero, including individuals frozen outside active support.
The village/city pet scenes and farm scene use production regional populations.
083 is complete: final full units and native animal/settlement gameplay checks
pass, including bounded homes, motion/contact, saved phase and deletion. Its
completion record retains the two known immutable art-preview failures and the
missing ignored campaign-progress file that prevents production-table refresh.
Art motion holds remain unchanged.

## Provisional woodland deer

The owner accepted the robin grove and authorized deer on 2026-10-09.
[081](../tactical/081-durable-woodland-deer.md) implements the unchanged adult doe
`draft-v1` drawing-03 / walk-tailflag-01: native 48px cells, anchor 24,36, idle,
12-frame walk and eight-frame ear/tail alert action at 100ms. A provisional brisk
escape reuses the same grounded walk at 50ms with twice the movement speed
(36px/s versus 18px/s). There is no invented gallop, airborne gait or new art.
Art remains pending human review, separate from gameplay availability.

Two or three seeded individuals share a glade/herd identity, with separate saved
per-member RNG, targets, timers and activity. They pause, walk and play quiet
alert cycles, loosely favor company and share nearby herd alarms. Generated homes
have a 112px radius, with target margins for normal separation. Approach within
38px, landing contact or balls produce one alert, a 48–80px bounded grounded
escape toward accessible cover, then three seconds of recovery. Repeated hits
never restart it. A mid-walk alarm preserves the committed walk before fleeing;
closed habitat settles in place. Paths reject water, collision, abrupt height
changes, occupied landings and escapes toward the threat. Normal collision owns
actual XY, and edited obstacles stop the animal at its real resolved position.
There is no forced arrival teleport or upward player impulse.

Wider glades reserve scattered-tree clearance while preserving solid forests,
pond banks, roads/rail and rabbit homes. Same-seed stable world/glade/member IDs
seed only new eligible chunks; ordinary records retain moved/manual individuals
and deletion across visits/reloads. No timers replace populations, no offscreen
time catch-up and no backfill of already seeded saved chunks. **Edit → Entities →
Deer** creates a saved individual; manual deer have their own home and no implicit
herd assignment. Native timed walk/flee frame phase is saved and replicated.

[Inspect the deer glade](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-deer&landscape=thicket#/tool/world-geometry):
in-memory production Worker at seed 2026, -164,-460 tiles, beside deer-glade:-3:-8.
Pause, Save / reload scene and **Hop onto deer** use common game/lab behavior.
Headless checks cover habitat/seams, group alarm/cohesion, dry grounded movement,
mid-walk hydration/binary phase, closed/edited paths, balls and ordinary standing
in authority/prediction (with/without player input). All 1,808 units, typechecks,
lint and build pass. All 22 focused wildlife browser checks pass, also passing
inside the full **406/409** run (13.5m). Two known archived-preview art failures
remain. Canvas train riding loses roof support on the onward post-reopen leg
(expected 44px, received 43.583168px); its isolated complete-journey rerun passes
in 1.5m. GPU and phone train checks pass in the full run. No train behavior or
assertion changed; the train topic retains this intermittent evidence. Isolated
streaming readiness passes all six phases with zero final missing/incomplete/stale
caches, errors and failures (functional Canvas evidence). 081 records details. Catalog: 220 sheets / 1,065 source uses; manifest:
657 verified candidates, all 27 exact wildlife review records unchanged. No new
art production or approval is implied. The art table's ignored campaign state
remains absent; checkpoint and completion refresh attempts preserve the last
validated table.

## Provisional woodland robins

The owner authorized the next robin slice on 2026-10-09, including tree perching.
[080](../tactical/080-durable-woodland-robins.md) owns implementation and validation.
Unchanged draft-v2 drawing-03/motion-02 supplies native 32px idle/hop/flap/song
cycles (anchor 16,25; 120ms frames). This remains unapproved provisional gameplay.
Sparse individuals seed once beside eligible existing oaks with dry clear ground,
world/tree/member IDs, independent RNG and 112px home ranges. No timed replacement,
catch-up or backfill of previously seeded chunks; manual **Edit → Entities → Robin**
creates an ordinary saved individual. Deletions remain tombstoned.

The routine alternates grounded hops, quiet rests, short flights to tree crowns,
perched rests/songs and flights back down. Actual oak/palm crown walls supply
perches (32px/48px tops), including manually placed trees; moved/deleted trees
immediately change eligible perches and normal support tracking. No decorative
branch points or scenery-only collision is introduced. The normal shared depth
ordering keeps elevated birds visible above their tree. Native hops have a 0.24s
stationary push, 5px physical arc and landing/settle; flights take 1.6s with a
44px arc and looping native flap frames. Both use ordinary collision-resolved XY,
not teleports, and restore elevation/timeline/frame phase on hydration.

Approach, landing contact and balls queue one bounded escape followed by 2.5s
recovery. An alarm during motion preserves its trajectory before escape; repeated
hits do not restart it. Clear routes reject water, solid paths, occupied landings
and targets toward the threat; enclosed birds recover in place. Player landing
is ordinary support without an upward impulse; Jump remains explicit. The main
game plays a quiet provisional spatial three-note chirp on songs/startles.
Interactive labs intentionally remain silent.

[Inspect the robin grove](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-robins&landscape=thicket#/tool/world-geometry):
production seed 2026 at -163,-519 tiles, in-memory Worker world, with Pause,
Save / reload scene and **Hop onto robin**. Shared headless crown support, tree
edits, physical trajectories, binary phases, player contact with/without input,
no-bounce prediction and durable residency checks pass. All 1,795 unit tests,
typechecks, lint and build pass. All 18 focused wildlife browser checks pass,
including Canvas/GPU robin flight/perching, pause/reload, contact, ordinary balls
and manual creation/deletion. The full browser run passes **403/405** (13.5m):
all 18 wildlife checks and both complete city-train journeys pass; only the two
previous archived-preview review failures remain. The earlier intermittent train
failure did not recur in either renderer. Isolated streaming readiness passes all
six phases with zero final missing/incomplete/stale caches, errors and failures;
functional Canvas readiness evidence only. 080 retains the detailed evidence. Catalog contains 219 sheets / 1,064 source uses; manifest verifies 653
candidates, with all 27 exact wildlife review candidates unchanged. Art production
is still repair-only; the production-table helper lacks ignored campaign state,
so preserve the validated table rather than fabricate receipts.

## Wildlife support: no automatic player bounce

On 2026-10-09 the owner explicitly rejected trampoline behavior on every animal.
Wildlife bodies are ordinary solid support: landing completes at the body top,
clears player jump velocity and reports contact to authority AI. Standing never
adds a jump impulse. Players jump through the normal Jump input; an escaping
animal can move out from under them, causing an ordinary fall.
This supersedes the bounce introduced in 077–079, without changing animal startle,
ball ricochets, physical hops/flights, durable identity or population policy.
The rule is shared by prediction, input-driven authority and missing-input gravity.

Automatic landing impulses and their species constants are removed for
ducks, frogs and rabbits. Focused headless checks pass, including sustained idle
standing, explicit Jump, body blocking and contact/startle with and without input.
Canvas/GPU labs record maximum player vertical velocity after their controlled
landing to verify that an animal escape never relaunches the player.
Typechecks, lint, build, all 1,784 unit tests and all 14 focused wildlife browser
checks pass. The full browser run passes **398/401** (12.6 minutes), including all
14 wildlife checks and affected game/lab movement checks. Two previously recorded
archived-art review failures remain. The Canvas train journey lost roof support
on the onward leg after reopening; its isolated full-journey rerun passes, while
the full run's GPU train journey also passes. Both results are recorded in the
[train topic](trains.md#current-regression-evidence); no train test or physics was
changed. Isolated streaming readiness passes: cold, standing, walk, sprint,
reverse and zoom-out finish with zero missing/incomplete/stale caches. This is
functional Canvas/headless evidence, not a GPU frame-pacing claim. All 27 exact
wildlife review candidates remain unchanged. Art-table refresh was attempted after
persisted checkpoints and completion, but still lacks the ignored campaign state;
the last validated art table is preserved.

Local evidence: [unit log](/tmp/tilefun-wildlife-standing-unit.log),
[focused browser checks](/tmp/tilefun-wildlife-standing-browser-focused.log),
[full browser log](/tmp/tilefun-wildlife-standing-browser-full.log),
[streaming report](/tmp/tilefun-wildlife-standing-streaming/report.json).

## Provisional gameplay: durable pond ducks

On 2026-10-09 the owner requested populating wild areas with existing imperfect
assets, habitat support and baseline AI rather than waiting for perfect art.
They selected a first deep animal slice and prefer seeded initial populations
that persist, with manual creation instead of periodic replacement spawning.
This supersedes the previous prohibition on provisional gameplay integration;
it does not resume new-animal art production or invent human approvals.

[Tactical 076](../tactical/076-durable-pond-wildlife.md) implements the mallard
first: unchanged drawing-02 with idle, waddle, swim, flap and quack clips, open
pond banks, small seeded flocks, bounded home-area behavior and ordinary actor
persistence. The existing World geometry pond scene runs the same production
Worker behavior. Gameplay availability is provisional, distinct from the art
production receipts/table and Workshop approval states.

The duck-only delivery in 077 passed typecheck, lint, build, 1,760 unit tests, all six wildlife
Canvas/GPU/game browser checks and isolated streaming readiness. The full browser
run passed 389/393: two missing archived art-preview failures remain; a Canvas
train boarding check passes in isolation, and an initially single-shot duck test
now accounts for intentional throw spread and passes with a short aimed volley.
See 076 for initial integration history and 077 for current interaction evidence.

Generated ducks are seeded deterministically from world seed and pond identity,
with stable per-member IDs and owner chunks. On first residency they become
ordinary saved actors. Movement, home, destination, behavior timer and per-duck
random state persist; leaving an area freezes distant animals without elapsed-time
catch-up. Deleted individuals remain deleted. There is no replacement timer,
breeding or automatic population replenishment. Editor-created ducks persist too.
Ghost/baddie spawning remains its separate system. Same-seed reproducibility is
for the current generator, not historical landscape compatibility.
Previously seeded saved chunks are not backfilled; manual placement supplies ducks
there while new pond chunks receive their initial flock.

The owner subsequently requested physical/playful interactions. [077](../tactical/077-duck-contact-and-startle-flight.md)
supersedes 076's non-solid bodies: ducks now block body movement and support the player
when landed upon. The owner later removed the original automatic landing bounce.
The same landing rule runs in prediction and authority, including missing-input gravity. Landing or a ball hit starts a quack,
then a short bounded escape flight using unchanged flap frames. The duck settles
for two seconds before returning to its pond routine; repeated hits do not restart
the escape. If no clear destination exists, it quacks and settles in place.

The destination, flight timeline, elevation and identity survive save/reload and
residency. Normal collision still owns movement; landing uses the actual resolved
position rather than teleporting through a new obstacle. The ordinary game plays
a provisional synthesized quack on the replicated alarm transition. The pond lab's
**Hop onto duck** control uses the existing authority teleport/fall command and the
same production physics. Flight frame phase remains transient. The original ball
scare cancellation gap is resolved; launched balls also ignore their thrower's
collider until they clear it, avoiding an immediate self-hit at chest height.

Art checkpoint refresh was attempted, but this checkout lacks the ignored
`data/wildlife-campaign-v2/progress.json`. Preserve the last validated production
table rather than fabricate receipts; gameplay work/evidence belongs in 076/077.

For the whole-roster completion table and local animation links, see the generated
[production status table](../wildlife-status.md). Agents persist fresh progress
then regenerate it with `node scripts/wildlife/status.mjs` after task selection,
meaningful checkpoints, completion, blocking or receipt revision, and before final
handoff. Checkpoint helpers can call its exported `writeStatus()` automatically.
Rows come from validated receipt hashes; do not hand-edit them or infer readiness
from an attempt's existence. Its timestamp is explicit; reopen it to load updates.
The ignored background checkpoint remains the detailed live execution record.

The owner requested a fresh start after the stopped overnight campaign produced
flat animal views and shrinking head animation. The entire previous tracked
campaign is preserved on `backup/wildlife-low-20261004`, commit
`059124d0666139d52792f55657972d7d6b4fe64e`. Its ignored checkpoints/logs are
archived locally. They are historical evidence, not inputs to this campaign.

Use gpt-6.1-sol with high reasoning effort, explicitly pinned for every session.
The original owner authorization for whole-roster production is superseded by
repair-only scope below. This authorizes corrections, not human art approval,
publication or gameplay promotion. See [060](../tactical/060-wildlife-fresh-production.md).

## Provisional gameplay: pond frogs

The owner selected frogs next and requested implementation on 2026-10-09.
[Tactical 078](../tactical/078-durable-pond-frogs.md) records the slice and validation:
unchanged existing draft, seed-determined small bank populations, physical hops,
swimming, rest/blink cycles, spatial croaks and player/ball escape reactions.
They share the duck persistence policy (including no timed respawns), open-bank
habitat and editor creation. Their smaller body uses shared predicted landing
support. The in-memory pond lab adds **Pond · frogs & shallows** and **Hop onto frog**.
The slice passes 1,771 units, typecheck, lint, build, all ten frog/duck browser checks
and isolated streaming readiness. The full browser suite passes 395/397, with the
two previously recorded missing archived fox-preview failures. Gameplay evidence
is in 078; all 27 exact wildlife review candidates remain unchanged. No art approval
or new art production is implied. The rabbit follow-up is recorded below.

## Provisional gameplay: meadow rabbits

The owner accepted the next rabbit slice on 2026-10-09. [079](../tactical/079-durable-meadow-rabbits.md)
implements the unchanged existing pilot with physical native hops, quiet action
cycles, player/ball reactions, woodland-facing grassy glades and durable groups.
The same no-respawn/manual-creation policy applies: 2–3 seed-determined individuals
per admitted dry glade, no timer or distant catch-up, durable moved/manual/deleted
actors and saved physical hop phases. Rabbits reject water and obstacles, escape
away from threats toward accessible cover, and recover before returning to their
routine. Mid-hop alarms finish the original hop before an escape.

[Inspect the rabbit meadow](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-rabbits&landscape=thicket#/tool/world-geometry)
uses the same production Worker; **Hop onto rabbit** demonstrates shared body
contact and grounded support. Older saved chunks use **Edit → Entities → Rabbit**.
Typechecks, lint, build, all 1,784 units, all 14 wildlife browser checks and isolated
streaming readiness pass. Full browser suite: 398/401; two existing archived-art
failures and a GPU train roof-reopen failure that passes an isolated full-journey
rerun. See 079 for evidence and limits. All 27 exact wildlife review records remain
unchanged; art production and approval remain separate. Art-table refresh still
lacks the ignored campaign state. Next: owner rabbit playtest, then robins.

## Historical repair-only scope (bounded pets supersede it above)

The owner canceled new-animal work. The [repair scope](../../art-source/wildlife-v2/repair-scope.json)
freezes the22 already-produced draft IDs and lists11 existing walking quadrupeds
for inspection. The196-species roster remains historical backlog, not an active
production target. Unfinished entries are out of scope; partial/blocked attempts
remain evidence, without authorizing completion or unrelated fixes.

Order: sheep/pig corrections first, then inspect the other existing walkers.
Change art only where torso motion is frozen or disappears at native resolution.
Preserve appearance, scale, camera, palette and action states; change hips/limbs,
head follow and finishing only where necessary for the motion repair. Already
convincing motion stays byte-for-byte unchanged. Use new revisions for corrected
pixels. No new species, variants, companions or animation states.

The generic production queue/launcher stays disabled even after motion gates
pass, and registration rejects animals outside the repair list. `campaign.mjs
--repairs` lists existing unresolved candidates; it cannot select unproduced IDs.
Passing a sheep/pig gate authorizes only bounded existing-animal repairs, never
roster expansion. No worker is currently running; do not revive the old broad
background brief or the06:00 deadline as an authorization to produce new animals.

For an existing walk that passes inspection without changes, the coordinator
can record a separate `body-motion-audits.json` entry with observer=coordinator,
result=already-compliant, exact revision, receipt/contract hashes and concrete
weightTransfer observations. This clears its repair hold without modifying its
old receipt or art. Changed/corrected art still needs new revision receipts and
review. Agents may not claim these coordinator audits or alter the frozen scope.

Scope verification: nineteen queue/gate tests pass, including new-species
selection after all motion gates pass, candidates without existing receipts,
and unchanged-art coordinator audits versus worker/wrong-hash claims. Live
`--next` returns null and registration rejects an unproduced probe before any
artifact write. The table shows166 unfinished entries out of scope, zero queued
and11 unresolved repair candidates. Typecheck/changed-file lint pass; full suites
retain the documented five Windows unit failures and two immutable HTML encoding
errors. No animal art changed and no repair worker was launched by this plan edit.

## Art and projection contract

Tilefun uses a square-grid 2D renderer with three-quarter top-down artwork.
There is no perspective transformation in the normal 2D camera: elevation,
top surfaces, foreshortening and near/far limb separation belong in the art.
Match the actual Modern Exteriors atlas and the approved Explorer/cat/bear.
An animal facing left still shows its upper body and near/far legs; it is not
a flat side elevation. This is not a diamond-grid isometric scene.

Calibrate a fixed orthographic Blender camera against the actual scenery before
settling its elevation. Record angle above the ground, target, scale, aspect,
four model yaw angles and ground anchor. Use that same calibrated projection
for the campaign. Retain species-specific editable 3D pose sources and projected
guides; integer drawings do not substitute for independent anatomical guides.

Use authored palette-letter pixel masters and deterministic Pillow composition.
Blender supplies volume, contacts and pose projection; deliberate pixel drawings
supply the final aesthetic. Maintain natural silhouettes, restrained palettes,
large readable heads where appropriate, binary alpha and identical world-pixel
density. Fox/rabbit profile scale starts at 14/13 visible pixels; elephant/giraffe
at 51/75. Different facings can have different projected bounds without changing
world scale. Never resize a sprite to fill a cell or force equal facing bounds.

Keep head/body scale fixed in the 3D source. Preserve full head/marking drawings
during translation-only walk poses. Actual head turns or pitching require fixed
volume geometry and reviewed replacement drawings; smaller head templates are
not a substitute for motion. Simpler credible actions are preferable to a
complex action with weak anatomy. Ground contact, gait timing, rear anatomy,
occlusion and continuous transitions require visual checks, not frame counts.

## Owner body-motion correction, 2026-10-04

The owner rejected the stationary torsos in sheep/pig and reported the same bad
walk trend across animals. Coordinator review had missed this while checking
stable volume and contacts. Sheep/pig builders explicitly set BODY.location to
zero every pose; deer/horse/goat do the same. All their projected body landmarks
are constant per facing. Cow only authors0.025-world-unit lateral sway, projecting
to at most0.3165px of vertical range in profiles, which may vanish in finishing.
Opened exact native sheep/pig all-frame sheets and inspected their source; no
old art, source or receipt was rewritten to manufacture a fix.

Fixed ground anchor/root motion and constant mesh volume DO NOT require a
stationary torso. The revised workflow requires species-appropriate rigid body
rise/fall and shoulder/pelvis transfer tied to support changes, head/neck follow
or stabilization, and constant-length leg solves from moving hips. Final native
integer drawings must retain that movement. Small sheep/pig walkers should test
1-2px peak-to-peak rise/fall as a readability starting point; it is not a universal
biological amplitude. Do not bounce the whole sprite, scale volumes, animate
shading or use moving appendages as a substitute. Export pose landmarks from
evaluated world matrices and inspect all facings in continuous native/enlarged
in-place AND matching travel playback, with grounded/sliding-contact checks.

The [tracked body-motion contract](../../art-source/wildlife-v2/body-motion-contract.json)
owns the affected exact revisions and correction prototype IDs. All11 completed
walking quadrupeds are now motion-review-required, including the old walking
pilots, without claiming that every one has the identical defect.22 retained
completed draft receipts become11 still ready plus11 needing motion re-review;
eight earlier quality failures remain blocked. The interrupted ladybug task is
paused. Receipt fields, artifact hashes, registered identities and human review
decisions remain unchanged. The generated table reflects these separate holds.

Stopped the verified background02 launcher and its16 descendants after preserving
the owner-stop record; its watchdog then exited. The interrupted lock and original
checkpoint remain evidence. Active-session metadata records the stop; no worker
or automatic continuation is running. The former06:00 Berlin deadline is
historical; it no longer authorizes broad production or bypassing repair-only scope.

`campaign.mjs` rejects background launch under an active local production hold.
The tracked contract ALSO requires a new coordinator body-motion gate, even if
the local hold is missing. It pins the contract and new sheep/piglet receipt
hashes, rejects old revisions/worker-as-coordinator claims, and requires concrete
weightTransfer observations. Future walking receipts must name this contract and
include native body-motion observations. Old held revisions cannot unlock their
families or count as ready. Mechanical fields are gate prerequisites, not visual
approval or proof of animation quality.

Next: author corrected sheep then pig in new revisions, inspect body/hip/foot
landmarks plus full native/4x in-place/travel playback, and record actual
coordinator observations. Only after those prototypes pass can the coordinator
write the pinned gate and release the repair hold for explicitly assigned
existing walkers. Re-audit/correct only existing frozen torsos. The production agent cannot
clear the hold, create the coordinator gate or retrofit old receipts. Broad
background production remains stopped; this prompt change is not an art fix.

Source audit, owner stop, old progress/checkpoint snapshots and inbox/art-note
reads are retained under ignored coordinator-review/background-02-worker. No
formal Needs changes votes/notes existed at this checkpoint; the owner's direct
chat rejection is the authority for this hold, not an invented Workshop event.
Primary biomechanical context: [Griffin et al.2004](https://pubmed.ncbi.nlm.nih.gov/15339951/)
models distinct fore/hind-quarter movement and phase coordination; it does not
provide the pixel amplitude target, which is an explicit art/readability choice.

Verification: sixteen wildlife queue/gate tests pass, including holds without
local state, changed prototype bytes, old revisions, absent observations and
future walking receipts. Typecheck, changed-file lint and Git whitespace checks
pass. Full unit run retains1357 passes/five Windows platform failures/ten skips;
full lint retains only the two preserved fish/robin-v1 invalid-UTF8 errors.
All22 completed receipts are unchanged and all2516 referenced artifact hashes
still match. Status refresh reports11 ready,11 motion-review-required,eight
blocked,one paused,165 queued; live launch assertion rejects both missing motion
gate and active hold. Detailed motion-* logs are under coordinator-review.

## Production gate

Coordinator manually produces and visually reviews fox, elephant and rabbit
with fixed-camera guides, all facings and full motion/action cycles. Inspect
native-size and enlarged art in actual Modern Exteriors scenery beside Explorer.
Record rejected iterations and fixes honestly. Only after those pilots pass
coordinator review can background draft authoring begin. This is an agent
production gate; exact human approval remains pending for every new candidate.

Background work starts a new task/checkpoint namespace and never loads the
previous campaign's pixels, recipes, completion records or claimed inspections.
Use the mclone checklist for roster breadth only. Scope remains 194 natural
animals plus two upright companions; no fantasy, breeds/ages or ecology simulation.
Every new locomotion family needs its own inspected prototype before expansion.
Mechanical validation establishes integrity, not artistic quality.

Existing approved gameplay art/settings and promoted banks remain immutable.
Register new exact candidates in the Workshop, obey saved feedback and pause
rules, and retain source, hashes, camera evidence and actual visual observations.

## Current reviewed drafts and execution

Coordinator accepted `fox-pilot-v2-drawing-03` as a draft production reference
following rejection of v1 and two internal v2 finishing attempts. The revised
rigid skull/cheeks/ear spread produce an 11px front/rear head beside a 7px torso,
separated ears, front eyes/tapered cream muzzle and rear cap without front facial
features. Profiles stay 14px tall. Full head patches remain identical throughout
walk/tail-action poses. Rear-foot occlusion, restrained body transfer, basic idle
paw resets and coarse extreme tail contours remain explicit limitations. Human
approval is pending. V1 is historical rejected art and cannot seed continuation.

The coordinator-selected orthographic contract is
`art-source/wildlife-v2/camera.json`: 40 degrees above ground, 10 world pixels
per unit, direction yaws 180/0/100/260. Exact coordinator receipt and hashes are
in ignored `data/wildlife-campaign-v2/progress.json`. Elephant `pilot-v2` is also
coordinator-accepted as a draft reference. Rabbit `pilot-v1`, drawing-04, passed
coordinator scene/guide/playback inspection after three rejected drawing attempts;
its final supervised handoff is frozen. All three exact coordinator receipts and
the camera are pinned in the fresh pilot gate; unchanged hashes are required for
background launch. The prototype key includes
roster family, body plan, media and gait set, so unrelated animals cannot inherit a
fox or rabbit quality gate.

Fresh Workshop candidates pin sheet, native scene/contact, GIF and playback
source bytes, and remain human-unchecked. Both fox and elephant initial/corrected revisions are registered in supervised
batch 01; initial revisions are clearly labeled and excluded from production seeds. Only registered wildlife affects
manifest freshness; unrelated drafting cannot invalidate frozen candidates.
These new review pages have been verified locally; no deployment was performed.

Source cleanup preserves all22 retained drafts and27 registered review revisions.
Git retains editable sources, cut/timing definitions, player source and small native
sheet/scene/contact PNGs. Generated animation, guides and diagnostics remain in a
verified separate archive; its checksum and restoration command are recorded in
the [source bank](../../art-source/wildlife-v2/README.md). Manifest builds require
only committed native render inputs; browser review and server feedback submission
still verify every original artifact pin. Missing/changed animation evidence blocks
feedback, including when the broader development manifest is advisory. Review
renderer edits mint fresh pending fingerprints and confer no approvals. New-animal
production remains disabled; this cleanup makes no art corrections.

Cleanup/rebase verification, 2026-10-04: typecheck, lint,19 queue tests, all three
wildlife browser checks and builds pass. The cache-free staged checkout rebuilds
the identical585-candidate manifest, with every identity matching full Chromium;
all357 retained source/render hashes and4465 archived artifacts verify. Full unit
results are1493 passes/five Windows symlink/process failures/ten skips. Full browser
results are332 passes/four failures/one skip; the two mobile-layout and two GPU
failures also reproduce in an unchanged origin/main snapshot on this machine.
The wildlife tactical is now060 to resolve its numbering collision with upstream.
Source and review cleanup does not fix the11 held walks or resume production.

Actual manual 02 rollout confirms Sol 6.1/high, CLI 0.160.0 and thread
`01a104af-470f-7601-9e6c-2dd203c972e9`; its source audit, deterministic finishing
and 17.278-second full Chromium capture pass. Typecheck/lint, focused feedback/
projection/service tests, eight queue tests, catalog/manifest and build pass.
Final integrated inventory counts are recorded in tactical 060 after all pilots
are registered.
Two new browser checks pass: zero-event registration/exact native preview pixels
in full Chromium, and disabling review when pinned playback bytes change.

The broad unit/browser suites remain failed: Windows symlink EPERM/SIGKILL
expectations, denied C:/tmp screenshot writes and remaining rendering/phone
assertions are retained with exact diagnostics in tactical 060. Introduced test
loader/type/formatting issues were corrected and checked again; no test or
permission rule was weakened. See [060](../tactical/060-wildlife-fresh-production.md)
for session history and the exact retained review observations for art evidence.

The corrected elephant preserves fixed 40-degree geometry/density, 51/52px
profiles, a twelve-pose 2.4s walk and articulated trunk/tail action. Its actual
landing table is hind-left, fore-left, hind-right, fore-right at poses 0/3/6/9;
[primary locomotion research](https://pubmed.ncbi.nlm.nih.gov/16985198/) supports
that lateral sequence. Coordinator inspection rejected front toenail clusters
on rear heels; v2 changes 170 pixels across 21 rear frames to gray heel pads,
with geometry/camera/contacts/motion/head/body/trunk and other facings unchanged.
Actual Chromium cycles at native/4x scale were opened, and source/finishing/diff
audits pass. Angular bends, hidden far feet, tiny front eyes and abrupt stopping
remain explicit draft limits. All human approvals remain pending.

Large retained guide JSON is still parsed/checked by Biome, with a 32MiB limit
scoped to wildlife JSON rather than disabling its checks. Future guide exports
use compact serialization. The bounded watchdog now records Windows' actual
wake-request result in ignored power.json; the rabbit session request was
accepted, and display sleep remains available. No persistent power/global
configuration was changed.

The rabbit uses a 32px canvas, 13px profiles and a dedicated fixed-volume model.
The eight-pose hop has gather/push/flight/fore/hind/settle phases, staggered fore
landings at 4/5, paired hind landing at 6 and two fully airborne poses. The final
ear-listening action uses the same letter masters, corrected after browser review
exposed false ear-length growth. Coordinator opened all facings, actual volume
guides, scenery and chronological frames from the final 17.293-second Chromium
capture. Source/contact/head/replay audits pass. Front/rear articulation is
subtler than profiles; far feet overlap, ear movement is coarse and stopping is
basic. These remain draft limits, with human review pending.

Rabbit is registered in supervised batch 02; batch 01 retains both initial and
corrected fox/elephant revisions. Only the three accepted receipt identities
can seed production. At launch the queue has 3 valid fresh drafts out of 196 and
selects giraffe next. Final catalog/manifest/build pass: 554 candidates and 227
normal-Chromium identity checks. Both targeted wildlife browser tests pass with
all five registered supervised revisions. The final unit run has 1,357 passing,
five failing and ten skipped tests, retaining Windows symlink/signal failures.

Bounded background continuation started at 04:00 UTC on 2026-10-04, with a hard
deadline of 12:00 UTC (14:00 Berlin). Actual rollout metadata confirms
`gpt-6.1-sol`/`high`, `codex_exec`, CLI 0.160.0 and thread
`01a10511-b3f4-7bc3-b82a-6f836ba8056e`. Local activity is under
`data/wildlife-campaign-v2/background-01-worker/`; the outer watchdog/power
evidence is under `background-01/`. Windows accepted the bounded wake request.
Serial authoring must retain honest checkpoints and inspect every species before
counting it. Three drafts are accepted for production, not human-approved;
193 roster entries remain at launch. No completion guarantee for one session.

Background checkpoint, 2026-10-04 04:54 UTC: giraffe/draft-v1 and
mallard-duck/draft-v1 are registered pending drafts in background batch 001.
Their exact validated receipts increase fresh draft integrity to 5/196, including
the three frozen pilots. These are production-agent visual gates, not coordinator
or human approvals. Giraffe profiles are 75px with a dedicated sixteen-pose lateral
walk; mallard profiles are 13/14px with separate eight-pose waddle/swim/flap clips.
Opened all facings, native/enlarged vendor scenes and chronological full Chromium
cycles. Giraffe inspection corrected neck/leg proportions and an ear-patch flicker;
mallard inspection corrected hanging folded wings, floating webs, a dark far-wing
blob and a rear neck gap. Exact evidence and limitations live in each revision's
`review-observations.md` and ignored session captures. Angular giraffe limbs,
occlusion, small duck contacts and missing water/transition context remain explicit.
Camera and pilot bytes remain unchanged. Catalog/manifest/build pass with 556
candidates and 229 Chromium identities; typecheck/lint pass after formatting new
playback sources. Broad final suites remain to run at handoff.

Next: continue the queue serially with independent family prototypes, while
checking saved owner feedback before each new batch.

At 05:14 UTC robin/draft-v1 (drawing03, motion02) becomes the third pending
background batch001 draft, for6/196 fresh integrity receipts. Its dedicated
three-segment legs gather/tuck through airborne hop2/3/4 and paired landing5;
small shoulder/elbow fans fold through an eight-pose flight cycle. Inspection
corrected a merged eye, hidden rear tail action and false pale rear collar.
All92 poses and actual native/4x chronological cycles were opened;184 source
contacts/wing links,92 whole-head checks and290 browser parity samples pass.
Tiny toes/eyes, a coarse front far-tail stalk, angular wings and abrupt clip
transitions remain limits in its exact review observations. Catalog151,
manifest557 candidates/230 Chromium identities and build pass. Queue selects
the independent pond-fish aquatic prototype next. Fresh inbox/art notes still
report zero pending requests or notes; no human approval is recorded.

At 05:46 UTC the first background batch holds four species: giraffe, mallard,
robin and pond goldfish. Fish profiles are10px, with a dedicated posterior-body/
vertical fork-tail wave and revised rigid cheek-hinge gape. Opened all60 poses,
native/enlarged pond/vendor scenes and both complete Chromium cycles per facing.
Fresh source120 axial/1080 underwater bounds checks and248 browser comparisons
pass. Small front/rear edge-on tail, subpixel operculum and absent water effects
remain explicit in its observations. Total fresh species integrity is7/196.

Batch-boundary lint exposed Windows-encoded middle dots in robin/fish preview
HTML. Frozen draft-v1 files and receipts remain intact; draft-v2 corrects UTF-8
and source routing with identical PNG/GIF/Blender bytes. Both exact revisions
are registered pending in batch002; receipt history preserves draft-v1. Fresh
source/replay/Chromium checks pass on each new route. Catalog154 sheets,
manifest560 candidates/233 identities and build pass; typecheck passes. Lint
exits0 but still reports the two retained immutable draft-v1 UTF-8 diagnostics,
alongside existing warnings. This is a retained limitation, not a clean lint claim.
Inbox/art notes report no requests/notes. Next independent prototype is monarch
butterfly, including reduced forelegs and coordinated fore/hindwing articulation.

At 06:03 UTC butterfly/draft-v1 fails the production-agent visual gate and is
blocked, unregistered, with no ready receipt. All92 poses and actual two complete
Chromium sequences per facing at native/4x were opened. Down walk remains nearly
stationary and closed front/rear wings read as dark fork shapes with weak body/
antenna distinction. Fixed source limbs/wing panels,92 stable head checks and336
browser comparisons pass but do not establish good art. The oversized/dense first
finish and current exact failure findings are retained. Butterfly siblings stay
locked; continue only to another eligible prototype.

At 06:22 UTC ant/draft-v1 (drawing03) is the third pending background002 identity;
fresh species integrity is8/196 including frozen pilots. Its dedicated37-mesh/
60-pose red wood-ant source keeps six fixed-length limb chains, alternating
tripods with actual landings0/4 and double support0/1/4/5. Opened all final poses,
native/enlarged vendor scenes and actual two-cycle crawl/scan/idle playback per
facing at native/4x. Rounded head, warm dark gaster and beneath-body joint finishing
correct earlier flat/faint art.1080 segments/312 contacts,60 full-head/120 body
checks and218 actual Chromium pixel comparisons pass. Small limbs overlap and
profile7px exceeds provisional5; exact limitations remain pending human review.
Catalog155 sheets, manifest561 candidates/234 identities and build pass. Blocked
butterfly's130 source/output evidence files are hashed without a ready receipt.
Next independent queue prototype is king cobra, using its own serpentine anatomy.

At 06:42 UTC king-cobra/draft-v1 drawing02 closes background002 with four exact
pending identities. Fresh species integrity9/196 includes the frozen pilots.
Its40-mesh/60-pose source uses15 fixed .24-unit tapered links, a raised fixed hood
and skull, eight posterior travelling-wave poses and tongue/tail action. Opened
all native/enlarged poses/scenes and actual28-state sequences per facing/scale.
900 fixed-length/1800 sliding-belly checks,60 head checks,86-file replay and243
Chromium pixel comparisons pass. Profile18/17px, angular one-pixel tail and alert
fixed forebody remain limits. Initial clipped64px canvas and rear-static action
were rejected/fixed before registration; full96px canvas retains10px/world unit.
Catalog156, manifest562/235, build and typecheck pass. Batch lint exposes missing
button types in frozen ant/draft-v1 and unregistered blocked butterfly preview;
corrected ant revision is needed without changing its pinned original bytes.
Frozen robin/fish v1 UTF8 diagnostics remain retained. Frog is next prototype
after this packaging correction; no human feedback requests or approvals.

At 07:07 UTC ant/draft-v2 corrects preview button types with all79 copied
PNG/GIF/Blender files unchanged; frozen v1 is retained. Fresh source/replay and217
Chromium checks pass. Blocked butterfly's unregistered HTML receives the same
packaging correction, with original page/hash manifest retained and current130
evidence files rehashed; its visual family gate stays blocked. Lint diagnostics
in immutable ant/robin/fish originals remain retained failures.

Frog/draft-v1 geometry02/drawing02 is the second background003 identity and brings
fresh species integrity to10/196. Dedicated45-mesh92-pose brown common frog has
fixed fore/hind segments, actual hop supports4,4,2,0,0,2,4,4 with fore-first
landing, paired aquatic kick and rigid-eye blink. Opened every pose, native/4x
vendor/water scene and actual44-state two-hop/two-swim/action/idle timelines.
920 segment/192 planted toe/128 aquatic foot checks,68 stable full-head/body
patch comparisons and336 browser pixel checks pass. Near-leg overpainting was
retained/rejected before final finishing. Native profile11 versus10 proposal,
thin toes, vertical in-place hop and abrupt media switch remain pending-review
limitations; exact134-file source/output receipt is frozen, not human approved.
Catalog158, manifest564/237 and build pass. Next independent prototype is gorilla.

At07:45 UTC gorilla/draft-v1 is blocked after final geometry04/drawing03 visual
inspection. Opened all92 poses, native/4x vendor scenes and all40 actual browser
states per facing/scale,348 readbacks over13.524/13.503s. Source736 limb/1472
digit/240 contact checks and52 head/body patch comparisons pass; those integrity
results do not overcome a pack-like profile back, rigid hunched chest rise and
face-adjacent palm action with weak rear reading. Three rejected construction/
display revisions and current134-file evidence are retained without registration
or ready receipt; primate/hand-walk siblings remain gated. Kangaroo is the next
independent prototype. Draft-ready species count stays10/196 including pilots.
At08:09 UTC kangaroo/draft-v1 is the third background003 pending identity,
118 exact pinned files; ready species11/196 includes frozen pilots. Fresh69-mesh
76-pose red kangaroo has ten synchronous hind-hop poses and independent ears.
Actual support2,2,2,0,0,0,0,0,0,2, paired landing9, fixed608 limb/380 tail checks
and208 actual heel/fourth-toe contacts pass. All76 heads stay stable;298 browser
comparisons cover11.553/11.551s at native/4x. Opened all34 chronological states
per facing/scale, actual vendor/Explorer comparisons and separate travel frames.
Retained failed rig/flat heel/front-eye/tail-gap iterations; final joint-center
composition fixes distal fragments. Profile43 versus36 proposal, quiet ear action,
vertical in-place hop and mirrored shading remain explicit owner-review limits.
Catalog159, manifest565/238 and build pass. Crab is next independent prototype.

08:33 UTC: crab/draft-v1 failed native anatomy/action clarity and is blocked,
112 hashed evidence files, no registration/receipt/family unlock. Fresh56 meshes,
68 poses,1632 fixed leg links and480 actual pointed-toe contacts pass; source
tetrapod supports8,8,4,4,8,8,4,4 and planted preview compensation are computed.
Opened all68 poses and all30 chronological actual Chromium states for each
facing at1x/4x (266 samples,10.328/10.305s), committed scenery/Explorer and
actual guides. Initial18px profile was oversized; fresh half-initial-world-size
geometry and reauthored9px profiles fixed scale, not the visual gate. Front
pincers collapse into cream brackets, rear action barely reads and profile
claws/legs merge into buglike fringes. Octopus is next queued prototype; ready
species stay11/196, including frozen pilots. No human approvals.

08:50 UTC: octopus/draft-v1 blocked,110 hashed retained evidence files. Fresh
247 meshes68 poses,4352 arm links6528 actual sucker center/normal checks and
16796 floating water bounds pass;24 output replay and1064 actual browser pixel
comparisons pass. Opened all68 poses/current guides and all30 chronological
states for each facing/1x/4x (266 samples10.311/10.303s). Rejected identical
rosette01 and thick leaf-lobe02; final thin open arms still read spiderlike,
distal diagonals fragment, small crown and hidden collar stroke fail natural
silhouette/jet propulsion. No receipt/registration/soft-aquatic sibling unlock.
Penguin is next independent ground-bird ground/water walk/swim prototype.

09:28 UTC: penguin/draft-v1 registered as fourth background003 identity,146
pinned files; nine new species this worker,12/196 including frozen pilots.
Fresh30 meshes100 poses, rigid emperor head/gold marks, eight-pose waddle,
hind-ground-contact weight transfer, articulated underwater flippers and stretch.
Actual support2,2,2,1,2,2,2,1;8 torso-over-single-support placements,400 leg600
flipper links128 actual floor webs pass. Opened all100 final poses and all46
chronological browser states per facing/native4x,400 frames15.531/15.500s;
3999 visible head-template pixels and28-file replay pass,176 rear-swim lower-head
pixels legitimately occluded. Rejected rectangular underside, wrongly signed
weight shift and invisible profile stretch, retaining exact failed evidence.
Profile22 vs26 proposal, quiet profile stretch, stylized swimming skull counter-
pitch and abrupt media transitions remain review limits. No human approvals.
Harbor seal is next independent flippered haul/swim prototype.

Background003 inventory/check boundary: catalog160; first manifest navigation
timed out and dependent build correctly failed freshness. Exact failure logs
retained; bundled-browser retry rendered566 candidates/239 parity identities and
build passed. Typecheck passes; lint retains two invalid-UTF8 errors in immutable
robin/fish v1 and existing warnings. Formatting corrected only unregistered
blocked crab/octopus pages/capture scripts, original bytes retained;112/110
blocked files rehashed without changing pixels or their visual gates.

10:01 UTC: harbor-seal/draft-v1 registered pending background004 first identity,
138 pinned files; ten new species this worker,13/196 including frozen pilots.
Fresh25 raw meshes22 visible,92 poses; fixed276 spine368 fore-link checks,
24 planted-tip travel compensation checks,38520 actual floor vertices pass.
Continuous dual-quaternion torso replaces rejected beads; measured skin volume
range0.505% is explicit, head92 orientations/4508 full-template pixels stable.
Computed haul support3,3,1,1,1,1,1,3 has sliding body support and pulling tips
locked7/0/1. Opened all92 poses and all44 actual state/facing/native4x timelines,
383 frames14.822/14.874s plus decoded travel;28-file replay1532 browser checks.
Rejected rear-static action, washed-out head/inward spot normals and first
sliding-contact capture retained/fixed. Profiles15 vs23 proposal, quiet stretch,
idealized low-speed haul and abrupt media remain limits; no human approval.

Harbor-seal inventory boundary: catalog161, manifest567/240 full-Chromium parity
identities, build pass. Manta ray selected next eligible swimmer, but receives
its own giant-manta disc/pectoral oscillatory prototype rather than a fish repaint.

Background01 continuation10:38Z: manta-ray/draft-v1 registered pending in004,
127 pinned files;24 full meshes84 poses1260 links, base/tip stroke apices3/4.
All poses and38 actual state/facing/native4x timelines opened,335 captures
13.002/13.014s,25-file replay1340 browser checks. Fixed disc/head4263 pixels;
profile41 vs24 proposal and angular two-panel fins/quiet cephalic action are limits.
Catalog162, manifest/build refreshed successfully. Eleven new species ready,
14/196 including unchanged pilots, no human approval.
Jellyfish/draft-v1 failed independent style/motion gate: opaque front badge,
rear saucer, stiff short oral/marginal fringe and weak front feeding action.
Retained77-mesh64-pose source,3328 links, all64 poses/all29 actual states opened;
259 captures10.010/10.078s,24-file replay1036 readbacks pass integrity only.
Blocked/unregistered; no soft-aquatic pulse family expansion. Five failed
prototypes remain evidence rather than templates.

11:26Z background01 authoring close: cat/draft-v1 (125 pinned files) and
dog/draft-v1 (141) complete pending batch004 with seal and manta. Thirteen new
species this session;16/196 including unchanged coordinator pilots, five blocked,
175 queued, no in-progress task. Next eligible red-squirrel is not selected:
remaining time reserved for validation/handoff. No human approvals or publication.

Cat: fresh35 meshes84 poses,12-pose lateral walk and eight ear/tail poses;
HL0 FL3 HR6 FR9,1428 links304 contacts160 travel checks. All84 poses/all38
real browser states in every facing/native4x opened,336 captures13.068/13.034s,
2688 full head-template pixels,23-file replay. Profile15 vs13 proposal; quiet
ear action/tiny partly hidden paws remain limitations. Rejected paw-over-face,
paw-on-rear-back and short-ear finishing stages retained before final pinning.
Dog: fresh36 meshes100 poses,16-pose lateral walk plus eight wag poses;
HL0 FL4 HR8 FR12,1800 links352 contacts208 travel checks. All100 poses and46
actual browser states/facing/native4x opened,413 captures16.008/16.033s,
1652 pixel checks and23-file replay. Profile17 exact proposal/down26/up23;
walking head pattern3760 pixels stays fixed, action near-ear cheek occlusion
is explicit. Hidden pendent ear and lost white tail tip iterations rejected
and fixed. Angular saddle, restrained ear follow, tiny paws/white tip and partly
occluded rear wag remain limits. Generic canine timing is not measured beagle gait.

Read-only handoff integrity:16 receiptErrors-valid receipts,2295 receipt/blocked
artifact hashes checked, zero mismatches. Catalog164/manifest570 candidates,
243 full-Chromium parity identities and build pass. Final typecheck passes;
unit suite1357 passed/five failed/ten skipped (Windows symlink EPERM and process
SIGKILL expectation), lint two immutable robin/fish-v1 invalid-UTF8 errors,
124 warnings34 infos. Exact worker logs retained in ignored session folder.
Windows tool process creation failed with1909 from11:28 to11:41, then recovered;
no settings/permissions changed. Full bundled-Chromium project suite and final
manifest retry/handoff results are retained there when complete.

11:49Z final background01 handoff saved atomically with checkpoint/heartbeat and
regenerated status. Explicit bundled manifest retry passes570 candidates/243
full-Chromium parity identities; subsequent build passes. Full Chromium project
run preserves all290 reporter outcomes:227 pass,62 fail,one skip; both wildlife
review tests pass. Exact62 failure contexts retained:52 Windows C:/tmp screenshot
EPERM, five readiness timeouts and five other assertions (phone width, PWA
incognito and streaming travel). Non-platform failures remain unresolved.
After all outcomes, teardown stopped producing output at11:34:57; interrupted
only run-owned exec session93419 at11:44, returned exit1, port4174 no longer
listening. Process command-line query denied; no broad process killing or claim
that every system Chrome exited. Per-animal captures close their owned browsers.
Detailed final.md, outcome/context hashes and command logs remain under ignored
data/wildlife-campaign-v2/background-01-worker. No further animal selection.
Next: coordinator/human review exact pending drafts, then fresh red-squirrel
prototype with its own family/body-plan/gait gate; five failed families stay blocked.

## Owner deadline correction and background02, 2026-10-04

The owner clarified continuation should run through 06:00 Europe/Berlin on
2026-10-05, not the coordinator's earlier eight-hour assumption. Launcher now
accepts an absolute DeadlineUtc, rejects past/offset-free/conflicting values
before session creation, and passes one identical UTC instant to worker prompt,
worker metadata and watchdog. Owner stop is 2026-10-05T04:00:00Z; selection
cutoff is03:30Z only to reserve final validation/handoff time.

Background02 launched12:48:15Z, launcherPID27312/watchdogPID39536. Actual normal
rollout confirms Sol6.1/high, codex_exec CLI0.160.0, thread
01a106f5-371a-77a2-891d-27de9440901a. All three deadline channels match; Windows
accepted the bounded wake request. Resumed at red-squirrel from16 ready/five
blocked/175 queued; new session checkpoint records actual selection and guide
modeling, not another reset. Old exact receipts/candidates remain frozen and
failed families remain blocked. Current metadata/commands/checkpoint are under
ignored background-02-worker; outer watchdog/power evidence under background-02.

Active-session metadata now routes the generated table to this continuation's
checkpoint instead of the prior finished run. Three deadline rejection probes,
eight queue tests and status/hash/link smoke pass; typecheck passes. Full unit
rerun retains1357 passes/five failures/ten skipped; lint retains only the two
preserved robin/fish-v1 invalid UTF-8 diagnostics. Inbox/art notes report no
pending fixes/notes and no wildlife review approvals/changes. Logs are under
ignored coordinator-review/deadline-* and continuation-*.

## Version-control direction: source and small runtime assets

The fresh source/native-sheet checkpoint is separate from the still-uncommitted
review integration on main; the stopped campaign's backup is on
backup/wildlife-low-20261004. Production workers author drafts and
leave Git to the coordinator. Commit proposed workflow/tooling/docs separately
from frozen ready animal batches; a Git checkpoint is not human art approval.
Do not stage an animal while its source/drawing revision is still changing.

2026-10-04 measured nonignored working-tree snapshot: approximately305MB raw,
126MB estimated new compressed/deduplicated Git blobs before pack deltas. Omitting
Blender saves only5.3MB raw (about4.6MB Git). All authoring sources, code/docs,
registered exact review deliverables and review notes are about96MB raw/25MB
estimated Git; remaining public inspection caches can be separately archived.
Large guide PNGs/GIFs dominate compressed storage; .blend scenes are small and
valuable editable sources. JSON projects are bulky raw but compress well.

The owner refined the goal to required sources and sheet-cut definitions, with
generated GIFs and similar previews outside Git. Recommended commit contents:

| Keep in Git | Reason |
| --- | --- |
| Camera, species roster, authoring/export/finishing/audit scripts and source notes | Reproducible projection, anatomy, drawing and motion decisions |
| Final revision's editable .blend and authored masters.json | Blender owns geometry/keyed poses; palette-letter masters own the final pixel style |
| Sprite definitions and explicit animation timing | Cell dimensions, direction rows, frame rectangles, ground anchor, clip order/count, durations and in-place motion are essential behavior |
| Final native sheet.png | Recommended small generated runtime exception: normal builds use committed assets without Blender/Pillow |
| Exact revision identities, checksums and review observations | Preserve what was inspected without interpreting a draft checkpoint as approval |

Exclude generated preview/scene/travel GIFs, native/enlarged comparison panels,
guide renders, contact sheets, browser captures, repeated public guide JSON and
failed/superseded render trees from routine animal commits. Do not use a blanket
PNG ignore: final runtime sheets and existing committed game assets still belong
in Git. Failed/reviewed evidence is preserved separately, not discarded.

Read-only measurement of the 16 draft-ready receipt revisions, excluding blocked,
in-progress and superseded revisions (decimal MB; animal-specific files only):

| Set | Current raw / estimated compressed blobs | Mean extrapolation to 200 |
| --- | --- | --- |
| Sources, definitions, checksums and small player source files | 9.71 / 3.21 MB | 121 / 40 MB |
| Above plus final runtime PNG sheets (recommended) | 9.89 / 3.36 MB | 124 / 42 MB |
| Above plus current projected-guide JSON cache | 39.59 / 8.37 MB | 495 / 105 MB |

The 16 editable Blender scenes total2.72MB; all final sheet PNGs total0.185MB.
Shared tooling/docs add a fixed overhead. Estimates use unique zlib-compressed
Git blobs before pack deltas, not exact clone sizes; the 16-species mean is not
a promise for the remaining roster, and subsequent revisions add history.
The earlier305MB measurement included duplicated public/source guides, failed
attempts and inspection caches; it is not the cost of16 final animals.

Authoring dependency: fox/rabbit/elephant and most current finishers place
compact pixel parts using projected-guides.json. That file can be regenerated
from Blender, but a source-only clone needs a tested guide-export/finish command
and pinned toolchain first. Cat/dog/harbor-seal/manta-ray masters already contain
complete final frames. A scratch replay of all360 frames rebuilt those four
sheet PNGs byte-for-byte with the current Pillow installation; no registered
files were overwritten. This does not yet prove every animal or every GIF can
be reproduced byte-for-byte on another toolchain.

Definition gap: cat/dog/seal/manta timing is currently encoded in playback.js
(160ms per frame), not in sprite.json. Keep those small player source files in
the first source checkpoint; future revisions should carry explicit frame
durations in their sprite definition. Keep current registered descriptor bytes
unchanged. An eventual compact runtime descriptor can omit 3D contact/hull audit
data, while retaining rectangles, anchors, clips, timing and identity; that is a
new descriptor/review identity, not an in-place rewrite of existing candidates.

Commit sequence: shared source/tooling, this policy and the first immutable ready
animal source batch, then the runtime/review integration after its generated
evidence dependencies are portable. Only final draft-ready revisions enter the
animal source set; pending human review stays explicit. Working and blocked
animals remain outside these batches. Required current source files include
the saved scene, masters, all revision scripts/README/checksums, and existing
sprite.json/playback.js/index.html; add sheet.png for the recommended runtime set.

Before applying excludes to the review integration, retain an immutable
checksum-addressed archive and test restoration. Existing receipts AND Workshop
candidate registries pin GIFs and comparison PNGs. An ignored local folder alone
is not a durable backup, and a fresh clone must not silently advertise missing
review evidence. Preserve current pins; archive/restore exact old evidence, and
use a revised portable evidence contract for future candidates. No old candidate
may be weakened merely to reduce Git size. No ignore/LFS/archive migration or
fresh commit was applied during this measurement; the overnight worker remains
unchanged. The concrete read-only file inventory and scratch replay evidence are
under ignored coordinator-review/source-set-size.json and source-rebuild/.
Exact proposed staging inventories are source-only.paths.txt (207 files) and
source-and-runtime.paths.txt (223 files), including shared camera/roster; these
are inventories, not staged changes. Read-only validation: typecheck and Git
whitespace check pass; unit suite retains1357 passes/five platform failures/ten
skips. Full lint reports four errors in preserved/current background artifact
files, including red-squirrel's unformatted player. No pinned/blocked evidence
was edited to clear those diagnostics. Logs are coordinator-review/storage-*.

Owner authorized the source commit after reviewing this plan. The first source
checkpoint contains the measured16 final revisions, camera/roster, native
sheets, existing descriptors/player sources, workflow tools and documentation.
No blocked, working or superseded animal revision is included. Byte-preserving
Git attributes protect hash-addressed wildlife files across platform checkouts.
The [source bank README](../../art-source/wildlife-v2/README.md) explains the
generated-guide dependency and incomplete preview-page dependencies on a plain
clone. [Dated checkpoint](../../art-source/wildlife-v2/source-checkpoint-20261004.json)
records223 exact source/runtime file hashes and the external archive checksum.

Before staging, preserved3528 stable source/evidence files (including blocked
and superseded attempts) in a checksum-addressed163MB local ZIP outside the
repository. Verified every archived file and restored a GIF, projected guide
JSON and native sheet to scratch with matching hashes. The archive contains
receipt/registry snapshots and its own complete file manifest, but no tools,
credentials or session histories. This is persistent local preservation, not a
remote backup. No live output was removed or repinned; the worker continues.
Commit verification covers241 staged files/10.25MB raw, with all223 inventoried
animal/shared source and native-runtime blobs matching their SHA-256 records.
No generated GIF, projected-guide JSON, guide-render tree, blocked/current animal
or review-integration code is staged. Typecheck, eight queue tests, staged-file
Biome checks and staged Git whitespace checks pass; two Biome infos only.
Full-suite platform/retained-artifact failures above remain separate unresolved
diagnostics. No human approval, gameplay promotion, push or deployment occurs.

Background02 continuation began 12:48 UTC on 2026-10-04, with actual rollout
Sol6.1/high/thread01a106f5-371a-77a2-891d-27de9440901a verified. Owner deadline is
04:00 UTC on 2026-10-05; new-task cutoff03:30 UTC. New session helpers and logs
are under ignored background-02-worker; active-session pointer remains unchanged.
At13:12 UTC red-squirrel/draft-v1 is blocked, unregistered, with116 hashed fresh
source/output files. Opened all76 poses and actual338 Chromium samples/two full
sequences per scale. Rear paws remain lost and right plume reads shallow despite
608 limb/380 tail/228 planted-floor checks, stable head and finishing replay.
Exact rejected attempts and final observations remain evidence, not masters.
Ready16/blocked6; no prior receipt/pilot bytes changed. Brown bear is next separate
prototype. Production quality remains distinct from pending human review.

At13:59 UTC this continuation registered `deer/draft-v1` (adult white-tailed
doe) pending in `wildlife-v2-background-005`:125 exact source/output hashes,
30 retained meshes,84 poses, full head/ear replay and360 actual Chromium samples
over two complete sequences at each scale. Native heights front27/rear38/profile31
at the fixed40-degree-above-ground camera and10px/unit. Actual contralateral
walk landings and all facing/action/idle transitions were inspected; detailed
limits include tiny hoof clefts and a foreshortened rear flag. Brown bear's fresh
prototype is instead blocked with141 evidence hashes: flattened profile body,
narrow angled legs and weak rear anatomy/rake failed visual inspection despite
passing integrity checks. Neither failed bear nor squirrel is a master. Counts
are17 ready/seven blocked/172 queued, with all prior receipts preserved. Session
commands, captures and exact observations route through background-02-worker;
inventory/build refresh follows this registration before serial continuation.

At14:25 UTC `cow/draft-v1` joins batch005 pending, with141 exact hashes. Its
fresh48-mesh/100-pose Holstein source uses three fixed leg segments and paired
hoof toes; actual hind/front tracking residual is0.000000033 world units, with
the preceding forefoot lifted and three supports at every walk sample. Opened
all facing cycles, stable complete head/coat patches,601 actual Chromium samples
and twelve forced reset-clock regressions. The negative-frame reset failure and
earlier geometry/drawings remain rejected evidence. Native profile25/front29/
rear33px at10px/unit; small teats/hooves and front/profile tail occlusion are
recorded limitations. Ready18/blocked7; batch005 currently contains doe and cow.
Catalog/manifest/build refresh and serial queue continuation retain exact prior
bytes and receipts. All human review remains pending.

At14:47 UTC `sheep/draft-v1` joins pending batch005 as its third member with141
exact source/output hashes. Fresh44-mesh/100-pose Suffolk ewe source and authored
fleece/black-face masters retain fixed camera/density; native profile18/front20/
rear21px. Short profile muzzle and weak ear motion were rejected and retained;
revised rigid ears now visibly lift/widen without skull resizing. Opened every
facing, two walks/action/idle return at native/enlarged sizes beside vendor scenery
and Explorer;603 actual Chromium samples/19.784s cover both48-state sequences
per scale. Fresh source/replay/contact audits passed; three supports, fixed links
and ~0.00000006 world-unit hind/front tracking residual. Quiet native ear action
and tiny hoof/eye detail remain limitations. Ready19/blocked7; human review pending.
Receipt validation initially rejected a session-data artifact path; it was removed
from the allowed source/output map and separately hashed as evidence before the
validated receipt was persisted. Catalog/manifest/build refresh precedes horse.

At15:07 UTC `horse/draft-v1` fills pending batch005 (doe/cow/sheep/horse),141
exact hashes. Fresh47-mesh/100-pose bay horse has four fixed leg links including
pasterns, solid hooves, own raised neck/long face/mane/blaze and five-link tail.
Black-only rear neck and profile shoulder seam were rejected and corrected in
drawing02. Opened every facing at native/enlarged scale through two walks/action/
idle return;604 actual Chromium samples/19.792s and12 reset probes pass. Actual
footfalls HL0 FL4 HR8 FR12 alternate3,3,2,2 supports; no flight, tracking residual
0.000000013 world units. Profile37/front38/rear49px at10px/unit; upright rear neck,
steady head without natural nod and quieter profile tail are recorded limitations.
Catalog168 sheets/manifest574 candidates/247 identities and build/typecheck pass.
Queue tests8/8 pass; global lint currently4 errors, exact diagnostics retained.
Ready20/blocked7/queued169; next is piglet. All human review remains pending.

Batch005 validation at15:15 UTC: wildlife feedback unit2/2 and Workshop Chromium
2/2 pass. Browser output was buffered during preview teardown; test-port4174
PID3220/start15:09:58UTC was identified, taskkill was denied, native Stop-Process
succeeded and the runner returned exit0. Logs retain the5.6m teardown delay.
Current-session squirrel JS formatting was fixed with original bytes retained,
blocked evidence hashes refreshed and status regenerated; art/geometry unchanged.
Remaining global lint errors are prior registered ant button types and fish/robin
HTML UTF-8 failures, preserved exact bytes. Batch006 inbox/art notes have no
pending feedback. Piglet selected15:14; ready20/blocked7/in-progress1/queued168.

At15:44 UTC `piglet/draft-v1` is the first exact pending draft in batch006,
125 source/output hashes. Fresh44-mesh/84-pose domestic pig has own low barrel,
rigid broad snout, fleshy triangulated ears, paired bearing toes/elevated dewclaws
and editable mesh curl. Two finishing attempts were retained as evidence:
incorrect near-ear occlusion/thick closed curl, then needle-like profile ears.
Drawing03 fills independent ear hulls. Opened every facing native/enlarged through
two12-pose walks/eight ear-curl poses/idle return;500 actual Chromium samples over
16.559s,12 reset probes pass. HL0 FL3 HR6 FR9 alternates3,3,2 support without flight;
hind undertracks0.45units. Profile18/front23/rear24px at10px/unit; tiny curl,
subtle profile action and covered far roots are recorded limits. Source audit
and explicit replay pass. Initial Windows quoting broke registration and caused
premature receipt persistence; corrected structured registration succeeded,
exact receipt/registered hashes revalidated before selecting anything else.
Concurrent initial manifest/build failed changed-input/stale-inventory checks;
after registration catalog169 and manifest575 candidates/248 identities pass.
Ready21/blocked7/queued168; next eligible is goat. All human review pending.

At15:59 UTC `goat/draft-v1` is pending batch006 animal2,140 exact hashes.
Own43-mesh/100-pose horned tawny buck retains curved horns/beard/raised neck,
cloven toes/mobile ears/upright tail. Rejected bright horn bars and overlong tail
were corrected in drawing02/geometry02; no per-frame scaling. Opened every facing
native/enlarged through two16-pose walks/eight ear-tail poses/idle return:
600 actual Chromium samples/19.776s and12 reset probes pass. HL0 FL4 HR8 FR12,
supports3,3,3,2/no flight and0.02000005unit hind track; fixed segments/actual toe
floors and deterministic replay pass. Profile/front23px, rear28px at10px/unit;
simple narrow rear neck and quiet profile action documented. Catalog170,
manifest576 candidates/249 identities and build pass. Session receipt helper now
requires exact registered hashes and batchsize<=4 before persistence; quoted
commands use structured files. Ready22/blocked7/queued167, human review pending.

At16:35 UTC `chicken/draft-v1` is blocked,124 evidence hashes, no registration.
Fresh47-mesh/84-pose ground-bird prototype geometry04/drawing03 passed actual
toe-floor/fixed wing/head-volume and deterministic replay audits.503 actual
Chromium samples/16.583s cover two walks/action/idle at native/integer4x in every
facing, all opened. Front dark tail post/indistinct face and bare rear neck still
fail the visual gate despite connected wing action and alternating contacts.
Retained three rejected revisions include the corrected0.008unit toe-floor gap.
Native profile15/front16/rear17px; primary anatomy text available, direct image
downloads blocked WinError10013. Full findings in its review-observations.md;
ground-bird siblings stay gated. Ready22/blocked8/queued166, no human feedback.
