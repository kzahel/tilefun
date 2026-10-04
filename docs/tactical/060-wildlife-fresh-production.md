# Fresh wildlife production with supervised projection pilots

Status: source checkpoint committed; new-animal production canceled. Only existing
frozen-torso repairs remain, starting with sheep/pig and coordinator motion review.
Owner: [Wildlife](../topics/wildlife.md).

## Authorized sequence

1. Preserve old campaign on `backup/wildlife-low-20261004` (059124d); return main
   to its clean original baseline. Archive ignored run state separately.
2. Improve the Blender workflow and production prompt. Explicitly pin
   `gpt-6.1-sol` and `model_reasoning_effort=high`, retaining session metadata.
3. Supervise separate manual fox, elephant and rabbit production sessions,
   inspect results, revise failed attempts and record concrete visual evidence.
4. After coordinator visual acceptance, launch bounded background production
   from the fresh queue with no inherited animal completion records.

The owner specifically authorized this sequence, including background continuation;
do not add an approval question before launching reviewed draft production.
Coordinator acceptance is not a human Workshop approval. No publish/push or
gameplay promotion is authorized. Work on main; no extra worktree is needed.

## Gates and records

New sources: `art-source/wildlife-v2/`. New preview namespace:
`public/demos/wildlife-v2/`. Local sessions/checkpoints:
`data/wildlife-campaign-v2/`. Old art/author scripts are absent from main and
must not be read from the backup branch or local archive by production sessions.
Roster names/target scales may be reimported as reference data, never old pixels.

Require species-specific retained Blender model/pose guides, explicit fixed
camera calibration, authored palette-letter masters, deterministic exports,
all four facings, idle/locomotion/action, native/enlarged continuous preview,
in-scene native-scale review and immutable iteration identities.

Validate camera/scale invariants, head master identity where pose is unchanged,
rear/near/far orientation, contact/lift schedules, alpha/palette, padding and
decoded output bytes. Visual acceptance names actual observed strengths and
remaining limitations; a generic "inspected" log or unique-frame count is not
a visual-quality receipt. Family expansion requires an accepted prototype.

Required project checks remain typecheck, unit tests and lint; review/render
integration also requires catalog then manifest, build and bundled Chromium
tests. Keep pre-existing platform failures explicit. No tests run against the
primary installed browser. Future checkpoint sections record actual work only.

## Manual 01: fresh fox pilot, 2026-10-04

Produced fox only in `art-source/wildlife-v2/fox/pilot-v1` and
`public/demos/wildlife-v2/fox/pilot-v1`. Current authored pixel identity is
`fox-pilot-v1-drawing-03`; internal rejected drawing-01/02 snapshots remain in
the bundle. No old wildlife sources, approvals, promotion, app integration,
Workshop registration, commits or pushes were used/made. The local launcher and
current rollout both report gpt-6.1-sol/high; exact thread/rollout/commands and
exit evidence are in ignored `data/wildlife-campaign-v2/manual-fox-01`.

The retained builder creates the isolated editable species-specific Blender
source, keyed rigid limb/tail/ear articulation, real projected mesh vertices,
topology, contacts and 68 guide poses. Camera studies retain 30/40/50 degrees
ABOVE GROUND and exact vendor scene comparisons. Initial fit: 40 degrees,
orthographic width 4.8, target origin, shift Y 7/48, 10 px/world unit, 48×48
canvas, ground anchor (24,31), yaws down/up/left/right 180/0/100/260. This camera
is proposed, not yet accepted for the campaign.

Palette-letter masters plus Pillow produce idle, eight-pose walk and eight-pose
tail flick, transparent sheet/metadata, all-frame contact sheet, per-facing
chronological strips, native/enlarged GIFs and exact Modern Exteriors comparisons
beside approved Explorer. Native idle bounds are profile 14px, down 20px and up
25px; no direction is resized to equalize bounds. Independent head silhouettes
come from bpy-projected mesh faces. Fresh saved-source audit passed fixed mesh
geometry, no scale keys, fixed root/head/body, and actual moving paw/tail objects.
Repeated finishing reproduced all 18 PNG/GIF products byte-for-byte.
GIF timing was corrected after full decode exposed 125ms truncation to 120ms.
Motion identity `fox-pilot-v1-motion-02` uses alternating 120/130ms samples;
all four decoded GIFs last exactly 4,000ms. Original timing files are retained.

Actual reference/camera/strip/scene images were opened. Full Chromium playback
was sampled for 8.548 seconds, covering four walk loops and two actions/returns
to idle. Concrete strengths, rejected drawings and remaining risks are in
the pilot's `review-observations.md`: profile identity is stronger than front/
rear; the rear tail hides hind-leg motion; torso weight transfer is restrained;
walk-to-action paws reset abruptly; tail rounding changes thickness. This is
draft-integrity plus observations, not artistic gate acceptance or human approval.

Validation: earlier typecheck/build and final lint/catalog/manifest passed. Manifest verified
222 identities in normal Chromium and rendered 549 existing candidates. Unit
suite failed: 1,355 passed, five failed, ten skipped; four files affected by
Windows symlink EPERM and the child-process SIGKILL expectation. Full browser
suite completed with 226 passed, 61 failed and one skipped. Fifty-two failures
report denied screenshot writes under `C:\tmp`; remaining assertions/timeouts
are retained without claiming a proven baseline cause. A final normal-Chromium
district check also failed: its page reported a registered-render mismatch and
never set `data-review-ready`. No tests or permission settings were weakened.
The final manifest/build were refreshed after freezing authored outputs.
The 02:09 UTC handoff rerun then failed typecheck and build on a newly edited
`src/art/WildlifeReview.test.ts:26` (TS2532: object possibly undefined). This manual
fox session did not edit that integration test. Current repository checks are
therefore not all green; both exact handoff logs are retained for the coordinator.
Exact failed diagnostics remain intact. WSL Git returned E_ACCESSDENIED, so final
Git status/diff inspection is left to the coordinator. No Windows Git was used.

Next: coordinator opens `/tilefun/demos/wildlife-v2/fox/pilot-v1/`, reviews native
and enlarged loops and the camera scenes, and either requests a new fox revision
or accepts this prototype for the subsequent supervised pilot work. No background
or sibling production was started.

## Coordinator follow-up and manual 02

The coordinator rejected v1's narrow front/rear face. Manual 02 changed rigid
skull/cheek/ear placement, then rejected two internal finishing attempts before
the final `fox-pilot-v2-drawing-03`. The coordinator opened its four strips,
native/enlarged exact-vendor scene and chronological actual browser samples.
Front/rear now have separate ear tips, wider readable head and correct face/back
distinction. Walk/action preserve complete head templates; action is a tail
flick. This is a draft production reference, not human approval. Rear foot
occlusion, restrained body transfer and abrupt idle paw resets remain explicit.
V1's 160 retained files were verified unchanged.

Fixed camera contract: `art-source/wildlife-v2/camera.json`; coordinator receipt
in ignored `data/wildlife-campaign-v2/progress.json`. Registry includes exact
v1 and revised v2 candidates in supervised batch 01, both human-unchecked.
The actual manual 02 rollout confirms Sol 6.1/high, CLI 0.160.0 and thread
`01a104af-470f-7601-9e6c-2dd203c972e9`. Source audit, deterministic finishing
and 17.278-second actual Chromium capture pass. Coordinator fixed the introduced
campaign formatting and earlier test TS2532 diagnostics; current typecheck/lint
pass. Focused feedback/projection and service tests pass (4 and 15 checks),
plus eight queue gate tests. Broad suite failures recorded above remain failures.

Next: separate supervised elephant/rabbit sessions using the same camera and
species-specific guides; personally inspect before opening the background gate.

## Manual 02: fresh fox front/rear revision, 2026-10-04

Coordinator rejected pilot-v1 front/rear readability. The supervised revision
preserved all 160 v1 source/public files and produced only fox pilot-v2, exact
pixel identity `fox-pilot-v2-drawing-03`. Both launch and actual rollout metadata
confirm gpt-6.1-sol/high. Commands, exit codes, thread/rollout, rejected iteration
state and atomic handoff are under ignored `manual-fox-02`.

Edited rigid anatomy first: skull lateral diameter 0.50 to 0.78, fuller cheeks,
separated ear hinges at +/-0.40 with tips +/-0.46 and fuller tail volumes. Body,
head anchor/height/depth, limbs, eight-pose contact schedule and fresh 40-degree
camera are retained. Complete front/rear masters are now 11px wide against a
7px torso; front has distinct eyes and cream cheeks, rear has a rounded orange
skull without front features. Profiles stay 14px tall. Two internal pixel
iterations were rejected and retained before the final drawing.

New independently exported guides come from a fresh process loading the saved
`.blend`: per-mesh projected convex hulls, bounds, depth ranges, vertex counts,
landmarks and actual checked contacts/tail joints, plus all 68 guide renders.
Full geometry, static hashes/topology audit and source remain editable. The
compact guide schema is documented in the source README; current JSON is
about 0.94MB versus the fresh v1's 14.9MB. Pixel finishing is authored letters
and integer Pillow composition, without guide-color sampling or sprite scaling.

Actual references, guide renders, all-frame sheet, all facing strips, native/
enlarged scenery and exact v1/v2 comparisons were opened. Chromium sampled 173
real playback frames over 17.278 seconds: native and 4x each cover four walk
loops, two tail actions and idle returns. All captured scene bytes match the
authored composition. Observed ear/eye/skull stability and remaining rear-foot
occlusion, restrained weight transfer, abrupt paw stop resets and coarse action
tail contours are explicit in the new `review-observations.md`.

Saved-source audit, deterministic finishing/playback checks, full GIF decoding,
typecheck and fox-only lint passed. The full lint run failed on formatting in
coordinator-owned `scripts/wildlife/campaign.mjs`; exact evidence remains in the
session logs and that file was not edited. As assigned, this revision did not
repeat full unit/browser suites, regenerate inherited inventories, run final
integration checks or register a Workshop entry. The root coordinator owns
those checks/registration. No approvals, gameplay integration, publication,
commits, pushes or sibling/background animals were produced.

Next: coordinator inspect `/tilefun/demos/wildlife-v2/fox/pilot-v2/` against the
retained v1 and accept/reject the exact revision. **Quality gate remains closed;
human review is pending.** Stop after this fox-only handoff.

## Coordinator state after manual 02 handoff

The coordinator accepted the exact revised fox as a draft production reference;
its receipt/source/output hashes are in fresh progress state. Human approval is
pending. Historical handoff statements above describe the gate before this
coordinator review, rather than current authority. The separate elephant session
started at 02:41 UTC with Sol 6.1/high verified from its actual rollout metadata.
The fresh gate still requires reviewed elephant and rabbit receipts.

Catalog/manifest and build now pass (551 candidates, 224 normal-Chromium identity
checks). Two focused new browser checks pass: exact native scene/contact bytes
and zero-event candidate visibility in full Chromium, plus disabled feedback
when registered playback source changes. Their first attempt had a test-loader
JSON import-attribute error before any tests ran; replacing it with a typed JSON
file read fixed the loader and the actual two cases passed. Logs retain both
attempts. Earlier broad suites remain failed as recorded, without weakened tests.

## Coordinator gate and bounded restart, 2026-10-04

Supervised elephant 01 ended at 03:16 UTC. Its saved-volume/contact audit
corrected a reversed diagonal schedule to the primary-research lateral order
hind-left, fore-left, hind-right, fore-right. Coordinator then rejected front
toenail clusters on rear heels. The separate high-effort elephant 02 session
ended at 03:29 UTC, preserving pilot-v1 and producing pilot-v2: 170 changed
pixels across 21 rear frames, unchanged alpha/bounds and byte-identical Blender
geometry. Coordinator opened the revised all-facing scene and actual chronological
walk/action captures, accepting it as a draft reference with angular bends,
occluded far feet, tiny front eyes and abrupt stopping still recorded.

Rabbit 01 ran 03:31–03:58 UTC with actual Sol 6.1/high metadata, thread
`01a104f7-3bf0-7362-86f5-7595c4577423`. Drawing-04 follows rejected weak ear
silhouettes, action folding and false listening ear-length growth. Coordinator
opened final guides/contact/scene and chronological playback: 13px profiles,
fixed skull volume, eight-pose hop, fore landings 4/5, paired hind landing 6,
airborne 2/3, and a simple same-master listening action. Final Chromium capture
has 172 samples over 17.293s; source/contact/head/replay audits pass. Front/rear
motion, far-foot occlusion, coarse ears and stopping remain draft limitations.

The three exact coordinator receipts in fresh progress state pin fox/pilot-v2,
elephant/pilot-v2 and rabbit/pilot-v1. Camera/source/output changes invalidate
the launch gate. All human review remains pending. Four historical/corrected
fox/elephant candidates are in supervised batch 01; rabbit is in batch 02.
Only accepted receipt paths seed production. New previews are verified locally;
there was no deployment or gameplay promotion.

Final integrated validation: typecheck/lint pass; eight queue tests pass; catalog
and manifest pass with 554 candidates and 227 normal-Chromium identity checks;
build passes; both focused wildlife browser checks pass across all five
supervised identities (4.3s). Full unit suite: 1,357 passed, five failed, ten
skipped, with retained Windows symlink EPERM/process-signal diagnostics. Earlier
broad browser/render failures remain as documented above. Root logs are in
ignored `data/wildlife-campaign-v2/coordinator-review/*-final.log`.

Actual eight-hour background restart launched at 04:00:08 UTC, deadline
12:00:08 UTC (14:00 Berlin), launcher PID 28728 and watchdog PID 34968. Fresh
gate permits continuation with 3/196 accepted drafts and giraffe next. Actual
normal rollout confirms `gpt-6.1-sol`, `high`, originator `codex_exec`, CLI
0.160.0, thread `01a10511-b3f4-7bc3-b82a-6f836ba8056e`. Read live worker
checkpoint/events/metadata under `data/wildlife-campaign-v2/background-01-worker`;
outer launcher/watchdog/power evidence is under `background-01`. Windows
accepted the bounded wake request; no persistent power/global settings changed.
Serial authoring reserves the final 30 minutes for handoff and must record
actual inspected drafts, blockers and remaining work, without promising all
193 remaining roster entries within this session.

Next: inspect first background family drafts and owner feedback before extending
the bounded campaign. No new owner confirmation was requested: continuation was
explicitly authorized in the task.

## Background worker checkpoint, 2026-10-04 04:54 UTC

Two newly authored identities are registered pending in
`wildlife-v2-background-001`: giraffe/draft-v1 and mallard-duck/draft-v1. No pilot
source/receipt bytes were changed. Actual worker remains Sol 6.1/high, serial and
without child agents. Fresh queue receipts now cover 5/196 including the pilots.

Giraffe has a fresh 35-mesh Blender source, 100 poses, 75px profiles, a sixteen-pose
lateral walk (computed HL0/FL2/HR8/FR10) and fixed skull/coat masters. Inspection
rejected compressed neck/overbent proportions and one-pixel profile ear flicker,
then opened all revised poses, guide/scene comparisons and two complete playback
sequences at native/4x scale. Fresh source audit checks 400 contacts; 376 actual
Chromium samples pass output parity over 19.066/19.040s. Angular resting limbs,
occluded shafts, mirrored lighting and abrupt stopping remain draft limitations.

Mallard has a fresh 23-mesh source, 124 poses, 13/14px profiles and dedicated
waddle/swim/flap/quack clips. Fresh source audit checks 248 contacts and 248 fixed
wing links; actual waddle landings alternate at0/4. Revised wings fold against
the body, webs actually ground, both flight fans have feather shading and the
rear neck connects through the complete cycle. Opened every pose and chronological
native/4x full Chromium samples covering two complete cycles per gait, action and
idle return. Final capture has403 samples over19.870/19.809s; finishing replay,
124 whole-head checks and output parity pass. Narrow front/rear art, roughly
one-pixel foot/bill motion, angular feathers, absent pond/wake and abrupt media
switches remain explicit. Rejected captures are retained as evidence, not masters.

Exact sources are under `art-source/wildlife-v2/{giraffe,mallard-duck}/draft-v1`;
outputs and precise observations are under corresponding
`public/demos/wildlife-v2/` paths. Validated artifact hashes, actual command/exit
logs and opened chronological panels are under ignored
`data/wildlife-campaign-v2/background-01-worker/`. Both revisions are immutable
after registration and remain pending human review.

Typecheck passes. Lint initially failed formatting in new mallard playback and
capture sources; corrected and passed with existing warnings retained. Catalog
150 sheets and manifest556 candidates/229 Chromium identities pass. A build ran
before manifest generation had finished and correctly failed freshness; the
sequential build after completed manifest passes. Broad unit/browser suites are
reserved for final handoff, without weakening platform failures.

At 05:14 UTC, robin/draft-v1 is registered as background001's third exact pending
identity. Its own30-mesh round songbird model and92 guide poses retain three fixed
leg segments and paired hop landing5 with flight2/3/4. Drawing03/motion02 follows
opened failures: too-extended hop feet, eye merging into outline, rear tail hidden
by draw order and a false pale rear collar. Exact rejected face/rear/collar sheets,
masters/finisher and actual browser captures remain under ignored worker state.
Opened native/enlarged scenes, all poses and first-sequence chronological states
for every facing at native/4x CSS, covering two hops/two flaps/action/idle return.
Fresh source audit184 contacts/184 wing links, whole-head92 checks, deterministic
replay and290 actual Chromium output comparisons pass (11.265/11.248s captures).
Small face/toes, coarse front tail and rear art, angular fans and abrupt media
switches remain explicit limits. No coordinator/human approval is implied.
Catalog151 sheets, manifest557 candidates/230 identities and build pass. Fresh
queue has6/196 valid drafts including frozen pilots and selects pond fish next.
Inbox/art notes read again: zero pending requests/notes and all eight registered
supervised/background candidates remain unchecked.

At 05:46 UTC, fish/draft-v1 completes background001's fourth pending identity.
Its own18-mesh single-tailed goldfish source retains fixed anterior/head volume,
two posterior links and a vertical concave fork-tail fan. All60 poses and actual
native/4x chronological swim/action/idle states were opened.120 axial links,
1080 underwater bounds, deterministic finishing,27 full-head/33 cap checks and
248 actual Chromium readbacks pass. Two invisible native jaw hinges were rejected;
the final rigid cheek hinge makes a small gape without skull scaling. Coarse
edge-on rear/front tail and absent refraction/wake/travel remain limitations.

Lint then exposed invalid UTF-8 middle dots in robin/fish draft-v1 preview HTML.
Those pinned source/output bytes remain frozen. Each gets an encoding-only
draft-v2 with identical art and Blender bytes; source paths/metadata route to its
new identity. Fresh source/replay/Chromium checks pass, and both are pending
in background002. Original receipts are retained in progress receiptHistory.
Latest species count stays7/196. Catalog154, manifest560/233 identity checks,
build and typecheck pass. Lint exits0 with two retained old-revision internal
UTF-8 diagnostics plus existing warnings; do not describe it as clean. No human
approval or pause feedback exists at the last inbox/notes read. Butterfly is
selected next with primary Monarch Watch anatomy and flutter research grounding.

06:03 UTC: monarch butterfly prototype blocked after actual visual review.
Current source41 meshes/92 poses, fixed head/limbs, actual footfall0/2/4/6,
1104 segment/224 contact checks and336 actual browser readbacks pass integrity.
All poses and native/4x chronological two-walk/two-flutter/action/idle sequences
were opened. The down walk reads stationary and front/rear closed wings read as
dark forks; source articulation and unique frames do not rescue it. Exact findings
are in butterfly/draft-v1/review-observations.md; oversized14px/dense-pattern
iteration and correction evidence remain ignored. Current profiles9px are authored
at physical size0.65 without per-frame scale or image resizing. No registration,
ready receipt, sibling expansion or approval follows this failed family gate.

06:22 UTC: ant/draft-v1 drawing03 registered pending, background002 third identity.
Fresh source37 meshes/60 poses has six fixed-length limb chains and actual
tripod landings0/4, double support0/1/4/5, no whole-animal flight. All final poses
and actual native/4x chronological two-crawl/scan/idle states were opened.
First flat/faint finish and browser capture are retained; final head width matches
projected skull, warm gaster retains its upper curve and body surfaces hide joint
overlap. Source1080 segments/312 contacts,60 full-head/120 body marking checks,
finishing replay and218 actual browser comparisons pass. Verifier indentation
briefly counted one head per facing; corrected and all60 checked before receipt.
Native profile7 versus5 proposal, tiny far limbs and abrupt stopping remain honest
limits. Catalog155, manifest561/234 and build pass. Total8/196 species integrity,
with butterfly blocked and130 evidence files hashed. King cobra is selected next.

06:42 UTC: king-cobra/draft-v1 geometry03/drawing02 registered as fourth
background002 identity,99 pinned files.9/196 species draft integrity, no human
approval.40 meshes/60 poses: fixed raised hood/skull,15 tapered .24-unit links,
eight posterior bend poses and tongue/tail curl. Opened all final poses/vendor
scenes and actual28-state native/4x timelines (two slither cycles/action/idle).
900 links/1800 belly minima,60 head templates,86 replay files and243 browser
comparisons pass. Profile18/17 and front23/rear41 preserve projected lengths.
Idealized raised defensive slither, thin tail and abrupt stopping remain limits.
Catalog156, manifest562/235, build/typecheck pass. Lint fails missing button
types in ant's frozen v1 preview and blocked butterfly's unregistered page;
correct those in new ant identity/unregistered butterfly packaging without
altering pinned originals or weakening diagnostics. Frog is next queue prototype.

07:07 UTC: ant/draft-v2 preview button correction registered as first
background003 identity;79 PNG/GIF/Blender copies remain byte-identical to frozen
v1. Source1080 segments312 contacts and217 revised browser comparisons pass.
Initial replay newline normalization differed from the Windows writer; after
normal finishing regeneration, unchanged art and repeated replay pass. Blocked
butterfly HTML corrected without art changes; original page/hash manifest saved,
130 current evidence files rehashed. Frozen old ant/robin/fish lint failures remain.

Frog/draft-v1 geometry02/drawing02 is second background003 identity,134 pinned
files,10/196 species integrity.45 meshes92 poses; fixed fore/hind segments and
actual hop support4,4,2,0,0,2,4,4 (hind push2, fore landing5, hind landing6),
paired aquatic kick, rigid eye retraction without head scaling. Opened all poses,
vendor/water comparisons and native/4x44-state actual two-hop/two-swim/blink/idle
timelines.920 segment192 planted toe128 aquatic foot checks,68 full head/body
mark checks and336 Chromium comparisons pass. First leg overpainting retained;
final roots beneath stable back surface. Profile11 vs10, one-pixel toes, vertical
in-place hop and abrupt media switch remain limits. Catalog158, manifest564/237,
build pass. Gorilla is the next dedicated primate/hand-walk prototype.

07:45 UTC: gorilla/draft-v1 geometry04/drawing03 blocked on observed art quality.
All92 poses, actual vendor/Explorer native/4x scenes and all40 captured cycle
states per facing/scale opened;348 samples span13.524/13.503s.736 fixed limb,
1472 digit,240 planted mesh checks and52 stable head/body patches pass. Profile
back remains slab-like; rigid rise/face-adjacent taps and weak rear display fail
the characteristic-action gate. Rejected construction01/chest01/transition02 and
current134-file source/output hash evidence retained. No registration or ready
receipt; no primate siblings unlocked. Kangaroo next independent queue prototype;
ready species remains10/196, including frozen pilots.

## Agent-maintained status table, 2026-10-04

Owner requested that agents update the overall table themselves. Project
AGENTS.md, the production prompt, wildlife topic and future background brief
now require regeneration after persisted task/checkpoint/ready/blocked/receipt
updates and before handoff. The generator is committed-source eligible at
`scripts/wildlife/status.mjs`; generated rows remain derived from fresh progress
and validated receipt hashes, with atomic document replacement.

The active background session's ignored state.mjs checkpoint helper imports
`writeStatus()` and calls it after its existing atomic progress/heartbeat/
checkpoint writes. Future checkpoints therefore refresh the table without a
restart. The former local refresh command remains a compatibility wrapper.
Observed the active agent's natural kangaroo continuous-review checkpoint at
08:04:04.321 UTC regenerate the table at08:04:04.439 UTC, confirming the live
automatic path rather than only a manual generator invocation.

Smoke verification passed all196 rows, readiness/blocked counts, every linked
document/preview and unchanged progress bytes. Generator lint, helper syntax
and project typechecks pass. Full unit rerun:1,357 passed,5 failed,10 skipped,
retaining Windows symlink/process-signal failures. Full lint retains two UTF-8
diagnostics in preserved fish/robin draft-v1 preview HTML; the new generator has
no diagnostics. Exact checks/logs are in ignored coordinator-review/status-*.
08:09 UTC: kangaroo/draft-v1 registered as third background003 identity,118
pinned source/output files, species integrity11/196. Own69 meshes76 poses,
ten-pose paired hind hop, eight-pose ear listening; actual support2,2,2,0,0,0,0,
0,0,2 and landing9.608 limb380 tail208 heel/fourth-toe source checks,76 full-head
patches and298 real Chromium comparisons pass. Opened all34 state/facing/scale
timelines and vendor/Explorer/travel views. Rig01, finishing01 and captured
tail-gap02 retained/rejected; final tail uses actual projected joint centers.
Profile43 versus36 proposal and quiet action/vertical in-place hop remain limits.
Catalog159, manifest565/238, build pass. Crab next independent aquatic many-leg
sideways-scuttle prototype. No human approval/promotion or gorilla-family unlock.

08:33 UTC: crab/draft-v1 blocked after actual native/enlarged all-frame and
continuous browser review,112 hashed evidence files. Retained oversized rig01;
rig02 bakes a smaller initial size once, fresh shell masters, stable volume and
camera. Source56 meshes68 poses,1632 links480 contacts; output replay26 files,
266 browser frames10.328/10.305s and1064 captured sprite comparisons pass.
Visual gate fails collapsed front pincers, barely readable rear action and
buglike profile fringes. No ready receipt/registration/crab sibling unlock.
Octopus selected fresh soft-aquatic jet-swim prototype; species count11/196.

08:50 UTC: octopus visual gate failed;110 blocked hashes, no registered identity.
Fresh247 meshes68 poses,4352 fixed arm links6528 cup normal checks16796 water
checks;24-file replay and266 Chromium frames10.311/10.303s1064 pixel comparisons
pass. All30 actual state/facing/scale panels and sources/scenery opened. Retained
rosette01/leaf02; final thin arm spokes still spiderlike, tiny mantle and hidden
collar stroke make jet cycle mostly arm gathering. Exact idle-return source audit
failure fixed in builder by skipping second float32 normalization at amount0;
source rerun passes, output matches prior actual playback. Penguin selected next.

09:28 UTC: penguin/draft-v1 registered background003 fourth exact identity,
146 pinned files validated with receiptErrors zero; species readiness12/196
includes three frozen pilots and nine newly produced species. Source30 meshes,
100 poses,400 leg600 flipper links128 actual floor-web contacts and8 single-
support torso placements pass. Ground support2,2,2,1,2,2,2,1 is computed, not an
assumed schedule. Actual100 pose panels/all46 states per facing/native4x opened,
400 bundled Chromium frames15.531/15.500s plus decoded travel cycles.28-file
replay/1600 browser comparisons pass;176 rear-swim head pixels naturally hidden
behind torso are explicitly skipped. Rejected belly01/waddle02/profile-action03
retained and corrected before pinning.22px profile versus26 proposal, understated
profile stretch, stylized head counter-pitch and abrupt water transitions remain
limitations. Harbor seal next independent prototype; no coordinator/human approval.

Background003 validation boundary: catalog160, first manifest page navigation
timeout and resulting build freshness failure retained in background logs. Retry
with bundled browsers passes566 candidates/239 full-Chromium parity identities;
build/typecheck pass. Lint retains two immutable fish/robin-v1 UTF8 errors after
formatting unregistered blocked crab/octopus plumbing only, original files
retained and112/110 blocked evidence hashes refreshed. No human feedback requests.

10:01 UTC: harbor-seal/draft-v1 pending004 first identity,138 exact pinned files;
species readiness13/196 includes pilots and ten new species. Fresh25 raw meshes,
22 visible92 poses, continuous preserve-volume skin measured0.505% range;276
spine368 fore links24 actual planted-tip compensation38520 floor checks pass.
Haul support3,3,1,1,1,1,1,3; phase7/0/1 pulls now use fixed.45/.50 fore IK.
All92 poses and all44 real state/facing/scale timelines opened,383 samples
14.822/14.874s;4508 stable head pixels/28-file replay1532 browser checks pass.
Beads01/rear-static02/coat-head03/contact-slide04 retained as rejected evidence;
final pixel finishing visibly follows independent evaluated skin/paddle guides.
Profiles15 vs23 proposal, quiet resting stretch and abrupt media limits remain.
No human approval or unrelated family unlock.

Harbor-seal inventories/build: catalog161, manifest567/240 full-Chromium parity
identities and build pass. Next selected manta ray remains independently authored
and inspected despite the queue's generic fish/swimmer prototype routing.

10:38Z background01: manta-ray/draft-v1 exact pending batch004 registration,
127 hashes/receiptErrors zero,24 meshes84 poses1260 measured links, stable disc
and head; actual delayed tip apex4 follows base3. Inspected all84 poses and38
state/facing/native4x timelines,335 captures13.002/13.014s,1340 pixel checks and
25-file deterministic replay. Rejected handedness/seam-bar iterations retained;
angular two-panel fins, profile41 vs24 and quiet feeding lobes remain explicit.
Eleven new species ready14/196 with three frozen pilots; no human approvals.
Jellyfish/draft-v1 blocked after all64 poses and29 chronological states/scales
were actually opened: badge/saucer silhouette, stiff fringe, collapsed organs,
weak front action.77 meshes3328 fixed links/24-file replay1036 readbacks do not
override failure.259 full-Chromium samples10.010/10.078s retained. No registration,
receipt or sibling unlock; static-front01 and final failed sources kept as evidence.

11:26Z background01 bounded authoring close: cat/draft-v1 and dog/draft-v1
registered exact pending004 third/fourth identities,125/141 source/output hashes.
Cat35 meshes84 poses,HL0 FL3 HR6 FR9; all84 poses/all38 real state/facing/scale
timelines opened,336 captures13.068/13.034s,2688 stable head-template pixels,
23-file replay1344 checks. Paw-over-face/back and short-ear iterations rejected;
15px profile vs13, quiet ear flick and tiny hidden paws remain limits.
Dog36 meshes100 poses,HL0 FL4 HR8 FR12; all100 poses/all46 actual states/scales
opened,413 samples16.008/16.033s,1652 checks23-file replay. Walking complete head
pattern3760 pixels fixed; action ear occludes1446 cheek-template pixels explicitly.
Fixed hidden floppy ear and outlined-away white tip. Profile17 exact/down26/up23;
angular saddle/quiet ear/rear wag occlusion and idealized generic canine gait
remain limits. Both decoded/travel cycles and vendor/Explorer scenes inspected.

Thirteen new species ready16/196 including three unchanged pilots, five blocked,
175 queued, none in progress. Next eligible red-squirrel remains unselected;
validation reserve precedes11:30 cutoff. Read-only handoff validates16 receipts
and2295 hashes with no mismatches. Catalog164,570 candidates243 parity identities,
build/typecheck pass. Final worker unit1357 pass/five fail/ten skipped: Windows
symlink EPERM and SIGKILL expectation. Lint retains two immutable v1 UTF8 errors,
124 warnings34 infos. New-process tool failure1909 from11:28 recovered11:41;
no configuration/permission changes. Full bundled Chromium suite/final retry
results belong in the ignored session handoff, with no altered assertions.

11:49Z handoff/checkpoint/heartbeat/progress status written atomically. Explicit
bundled manifest retry570/243 and subsequent build pass. Full Chromium observed
all290 outcomes:227 pass62 failone skip, both wildlife-review tests pass.62 exact
failure contexts preserved:52 Windows screenshot EPERM, five readiness timeouts,
five phone-width/PWA-incognito/streaming assertions, unresolved. Teardown stalled
after last outcome11:34:57; only run-owned session93419 interrupted11:44, exit1.
Port4174 closed; command-line process query denied, no broad cleanup claims.
See ignored background01 final.md, browser-observed-outcomes.json,
browser-failure-contexts.json and command logs for precise evidence/limits.
Ready16/blocked5/queued175, thirteen new species, no active task or new selection.
Next coordinator review and red-squirrel prototype; no publication or approvals.

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
125 source/output hashes. Own44-mesh/84-pose domestic pig, drawing03, retains
incorrect-ear/closed-curl and spike-ear rejected evidence. Every facing was
opened native/enlarged through two12-pose walks/eight ear-curl poses/idle return;
500 actual Chromium samples/16.559s and12 reset probes pass. HL0 FL3 HR6 FR9,
3,3,2 supports/no flight,0.45unit hind undertrack. Profile18/front23/rear24px;
small curl/subtle action/covered far roots documented. Fresh source and explicit
replay pass. Nested Windows quoting broke initial registration; receipt ran too
early. Structured registration then succeeded with unchanged pixels and hashes
revalidated before any new selection. Initial concurrent manifest/build rejected
changed inputs/stale inventory; corrected catalog169/manifest575/248 pass.
Ready21/blocked7/queued168, next goat; human review remains pending.

At15:59 UTC `goat/draft-v1` becomes batch006 animal2,140 pinned hashes.
43fresh meshes/100poses, geometry02 shorter upright tail and drawing02 muted
horn curves after retained failed comparisons. Every facing opened native/
enlarged through two16-pose walks/eight ear-tail/idle:600 actual Chromium samples
over19.776s,12reset probes/noerrors. HL0 FL4 HR8 FR12,3,3,3,2 supports/no flight,
0.02000005unit hind track. Source contacts/scales and explicit replay pass.
Profile/front23/rear28px; simple rear neck and quiet profile action documented.
Catalog170/manifest576/249/build pass. New session helper requires registration
hashes and batchsize<=4 before receipt persistence, and guards command argument
count; structured files avoid nested Windows quoting. Ready22/blocked7/queued167;
all human review pending.

Background02 at16:35 UTC blocks `chicken/draft-v1` after actual native/integer4x
playback inspection in all four facings:503 samples/16.583s, two full walks,
wing stretch and idle return.47mesh/84poses, geometry04/drawing03 passes source
and replay integrity, but front tail post/indistinct face and bare rear neck
fail art.124 blocked evidence hashes; three rejected revisions retained,
including corrected actual toe hull floor0.008 gap. No registration or family
unlock. Ready22/blocked8/queued166; continue only another unlocked prototype.
