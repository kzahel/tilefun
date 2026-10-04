Repair existing Tilefun frozen-torso walks using the wildlife-v2 workflow. Read
AGENTS.md, docs/topics/wildlife.md, docs/topics/art-review.md,
docs/blender-pixel-characters.md and docs/tactical/060-wildlife-fresh-production.md.
Use the local blender-game-assets and blender-animation skills as standalone
asset workflows. Use gpt-6.1-sol with high reasoning effort; the launcher pins
these values. Never silently fall back to another model or effort.

CURRENT OWNER SCOPE OVERRIDES THE ORIGINAL WHOLE-ROSTER PLAN: repair existing
animals with frozen walking torsos ONLY. No new animals, variants, breeds, ages,
humanoid forms or locomotion families. Read art-source/wildlife-v2/repair-scope.json
and select only explicitly assigned existing repair candidates. Inspect first;
change pixels only when body motion is frozen or disappears at native resolution.
Keep already convincing motion unchanged. Preserve design, scale, camera, palette
and existing action states; adjust limbs/head follow only as required by the body
motion repair. Do not resume the original species queue after repair gates pass.

QUALITY IS THE DELIVERABLE. Produce fewer credible animals if needed. Unique
frames, metadata, test passes and plausible prose do not establish good art.
Do not expand beyond the assigned existing animal's frozen-torso repair.

FRESH START: do not read the backup branch, wildlife-archive, old wildlife-v1
art, recipes, completion receipts or screenshots. Existing approved character
art, Modern Exteriors and the mclone species checklist are valid references.
Do not contaminate the fresh run with old animal drawings or generic recolors.
For continuation, use only the coordinator-accepted pilot paths in progress.json;
rejected fresh revisions and internal failed drawings are evidence, not templates.

PROJECTION: three-quarter top-down RPG artwork on a square grid. Fixed elevated
orthographic camera, visible upper surfaces, body foreshortening, distinguishable
near/far feet and correct rear anatomy in EVERY direction. Sideways movement
does not imply a flat side elevation. Inspect Modern Exteriors roofs, trees and
four-direction cars, plus approved Explorer/cat/bear before modeling. Calibrate
camera elevation with scene comparisons, retain all settings, then reuse the
accepted camera across animals. Define angle ABOVE GROUND explicitly; do not
confuse it with polar angle from vertical. Slight side-view yaw is allowed if
consistent with the approved character reference. Do not claim a mathematically
exact vendor camera angle from painted art.
After calibration, art-source/wildlife-v2/camera.json is the fixed contract;
do not repeat angle selection or change it for each species.

SOURCES: retain a species-appropriate editable Blender source, repeatable bpy
builder, independently projected guide positions/volume/contacts and guide
renders. Use Blender CLI in an isolated scene; preserve any live unsaved work.
Author deliberate palette-letter pixel masters and Pillow integer composition
from the guides, as with the successful characters. The final sheet must be
authored pixel art; a palette-quantized generic ellipsoid render alone is not
a finished character. No image-generation substitution or downloaded models.
Export compact actual projected hulls/bounds/landmarks/contacts for each pose.
Serialize large guide JSON compactly (no indentation); keep readable camera
and inspection summaries separately. Pixel masters/metadata can stay readable.
Retain full mesh geometry in the .blend and audit its hashes/scale in a fresh
Blender process; avoid repeating thousands of mesh vertices in every guide pose.
Drawings must visibly follow those independent volume/contact guides. Record
intentional pixel stylization rather than claiming guide metadata proves the art.

ANATOMY: recognizable natural species, readable stylized heads, stable body and
head volume, clear ears/muzzle/trunk/tail/feet, restrained broad shading. Do not
scale body/head geometry per frame. Keep full head and marking templates stable
in walking poses when orientation is unchanged. For head pitching/turns, derive
changes from rigid fixed-volume guides and explicitly review foreshortening;
do not shrink/morph a head to create an action. Prefer credible ear/tail action
or trunk articulation over a poorly drawn ground-sniff clip. Rear views must
hide front eyes/muzzles appropriately. Animal foot depths must follow the
projected ground plane, not share one baseline just because that is easy.

SCALE: identical world-pixel density beside Explorer (~24px visible). Reference
profile idle heights: fox14, rabbit13, elephant51, giraffe75. These are projected
profile targets, not requirements to squash all facings to equal bounds. Larger
animals get larger canvases with real authored detail; no resampling/stretching.
Use constant ground anchor, sufficient padding, binary alpha, shared palette
and nearest-neighbor preview. All moving contacts relate to that fixed anchor.

MOTION: four facings down/up/left/right, idle, species-specific locomotion and
one characteristic action. Establish contact, passing and lift/apex before
secondary motion. Heavy walks transfer weight; rabbit hops include gathered
hind legs, flight and landing; birds bend wings coherently. Use enough poses
to read the action (typically 4-8), not a forced universal four-frame template.
Root stays in place; preview travel is separate. Keep credible planted contacts,
constant limb lengths, occlusion order, volume and transitions. Appendage swings
and translated/bobbing stills alone are not locomotion.
FIXED ROOT IS NOT A FIXED TORSO. Keep the ground anchor, camera, export cell and
mesh dimensions fixed; animate the body's rigid translation and rotation above
that anchor. A stationary body with cycling legs is a failed walking quadruped.
Do not reset BODY.location/rotation to an identical pose throughout the walk.
Build the body rise/fall and shoulder/pelvis weight transfer FIRST, phase them
with support changes, then solve the legs from the transformed hips. Head/neck
follow or stabilize that movement coherently; unchanged head volume/patterns
do not require an unchanged absolute screen position. Secondary ear/tail motion
cannot substitute for movement of the main body mass.
For sheep/pig-sized pixel walkers, start by testing 1-2 NATIVE pixels of visible
peak-to-peak body rise/fall, plus restrained species-appropriate pitch/roll.
This is a readability target to inspect, not a universal biological amplitude
or a quota to impose on insects, swimmers or heavy animals. Keep each animal's
motion restrained and species-specific. The final torso must visibly carry
weight; subpixel Blender movement that rounds to one frozen pixel pose fails.
Never add bob by shifting the entire finished sprite: that also lifts planted
feet. Do not fake it with body/head scaling, palette flicker or changing shading.
Re-solve constant-length limbs from the animated shoulders/hips to the intended
contact trajectories; stance feet remain on the ground. In-place stance feet
retreat at the virtual travel speed, so a matching travel preview plants them
in world space. Review that preview for sliding, float, knee pops and teleporting.
Export body/shoulder/pelvis/head transforms and landmarks from evaluated Blender
world matrices at EVERY pose, not projected rest-coordinate constants. Finish
from those pose landmarks, not idle torso/head anchors reused for the full clip.
Ground unfamiliar anatomy/gaits in primary references before rigging. Record
the actual computed footfall/contact sequence and check it against the intended
species gait; phase-offset signs can reverse a seemingly correct schedule.
Inspect front and rear feet/appendages as well as the face: front toenail/toe
clusters do not belong on a rear-facing heel. Do not reuse a front master blindly.

REVIEW: produce an all-frame contact sheet, chronological strips for each full
cycle, native and enlarged looping previews, and actual Modern Exteriors scene
comparisons beside approved Explorer. Review every facing, two complete loops,
actions and return to idle. Compare adjacent poses for head/marking flicker,
unintended volume changes, leg sliding, detached limbs and near/far swaps.
BODY-MOTION REVIEW: in every walking facing, record the low/high body poses,
native pixel displacement, visible shoulder/pelvis support transfer and the
footfall phase they correspond to. Inspect a torso/shoulder/pelvis/head landmark
overlay and actual native/4x continuous in-place AND travel playback. Report
measured 3D/projected ranges AND final integer drawing positions: frame hashes
can differ solely because feet move, and nonzero guide ranges can round away.
Head/marking patch tests must compare after aligning their rigid translations;
do not turn those checks into a requirement to freeze the animal in screen space.
Reject a frozen torso, movement only in appendages, arbitrary unphased bob or a
sprite-wide bouncing postprocess. Mechanical motion measurements supplement
visual inspection; they never establish convincing weight transfer by themselves.
Actually open and
inspect the images and sample continuous cycles. Record precise observations,
reject failed iterations, fix them and repeat. Do not substitute assertions,
guides authored from the same mistaken pixels, hashes or test results for seeing.

GATES: repair sessions stop after their assigned existing animal for coordinator
review. The original broad-production launch/queue is disabled under the current
owner scope, even after corrected motion prototypes pass. Do not open a new
family/species task or treat a corrected sheep/pig as permission to expand the
roster. Two saved Needs changes reports pause the batch until the owner says
ready. Owner feedback is not an agent approval.
Read data/wildlife-campaign-v2/production-hold.json when present. An active owner
motion hold forbids background production and template expansion. Preserve all
old receipt/artifact bytes. Only explicitly assigned correction prototypes may
run during that hold, using new revisions. Do not clear the hold, replace its
reasons with your own approval, or use an old pilot's gait to bypass it.
After the owner's rigid-torso rejection, correction order is sheep then pig,
with coordinator review of each new revision's complete native/4x loops before
repairing other existing frozen walkers. The coordinator must audit those walkers against
the revised body-motion contract; earlier draft-ready receipts do not certify it.
Assigned corrections may start from that animal's own frozen scene/drawings in
a new revision. Do not treat the rejected walk as an accepted gait or propagate
it to another animal; repair the rig/finishing motion and review the new pixels.

OUTPUT: write editable sources in art-source/wildlife-v2 and transparent sheet,
sprite metadata, contact sheet, preview GIF, in-scene previews, projected guides,
validation and review observations in public/demos/wildlife-v2/ANIMAL/REVISION.
Never overwrite a previously reviewed revision; new pixels get a new identity.
Register exact pending Workshop candidates in batches of at most four animals.
No human approval events, gameplay promotion, publication, commits or pushes.

STATE: store session/checkpoint/logs under ignored data/wildlife-campaign-v2.
Record actual model/effort/thread/rollout and commands/exit codes. Report native
scale, camera settings, gait/contact design, inspection evidence and limitations.
Atomic progress writes; hash required outputs. Completion means draft-integrity
plus explicit visual observations, never human approval. Keep owning docs current.
For every new walking-quadruped receipt, set motionContract to the identity in
art-source/wildlife-v2/body-motion-contract.json and add an explicit
visualReview.checks.weightTransfer observation describing the inspected native
body range/support phases and continuous in-place/travel loops. Do not insert
those fields into old receipts to retroactively claim a review. The separate
data/wildlife-campaign-v2/body-motion-gate.json is coordinator-owned: it pins new
sheep/piglet coordinator receipts and contract bytes; production agents never
create or clear it. Background launch cannot bypass it by deleting a local hold.
Already-compliant existing walks need no pixel change or new revision. The
coordinator may record a separate body-motion-audits.json entry pinning the old
receipt and motion-contract SHA-256, exact revision, observer=coordinator,
result=already-compliant and concrete weightTransfer observations. Production
agents must not create these entries or retrofit old receipts. Passing this audit
removes that repair candidate, not the ban on new animals.
After persisting task selection, meaningful checkpoints, completion, blocking or
receipt revision, regenerate docs/wildlife-status.md with
`node scripts/wildlife/status.mjs`; also refresh before final handoff. A checkpoint
helper may call its exported writeStatus() automatically instead. Verify the
table timestamp/counts. Do not hand-edit generated rows or count blocked attempts
as ready. Updating only the private checkpoint is not a complete status handoff.

TOOLS: workspace-local Python/Pillow is data/wildlife-tools/python/python.exe.
Use npm.cmd/npx.cmd on Windows, with bundled Playwright browsers at
data/wildlife-tools/browsers. Blender 5.2.2 is installed; determine its executable
or use BLENDER_BIN. Probe background bpy and a representative render before long
work. If an execution restriction blocks Blender, report the exact command so
the coordinator can execute the builder; do not replace Blender with fake guides.
Git on Windows is only through WSL; if child cannot use WSL, leave Git to the
coordinator. Do not alter global config, permissions, hooks or approval policies.
Inspect images directly and query only needed camera/pose/landmark fields from
large JSON sources. Do not dump full guide meshes, sprite JSON or base64 images
to tool output. Keep diagnostics and handoff concise; preserve detailed evidence
in artifacts. Repeat verification only after changes invalidate earlier results.

BUDGET: obey the supplied deadline, reserve 30 minutes for validation/handoff,
stop selecting tasks at the cutoff and stop early if only gated/blocked work
remains. No busy waiting to consume the budget. Read Workshop inbox/art notes.
An explicitly supplied absolute deadline controls the whole session; do not
replace it with an eight-hour example duration or a completed batch count.
Required checks: typecheck, unit tests, lint; for review/render changes catalog,
manifest, build and bundled Chromium tests with isolated data/auth. Retain exact
failure evidence; do not weaken tests or claim failed suites passed.
