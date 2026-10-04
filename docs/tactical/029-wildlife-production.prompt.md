Produce Tilefun wildlife drafts using the fresh wildlife-v2 workflow. Read
AGENTS.md, docs/topics/wildlife.md, docs/topics/art-review.md,
docs/blender-pixel-characters.md and docs/tactical/029-wildlife-fresh-production.md.
Use the local blender-game-assets and blender-animation skills as standalone
asset workflows. Use gpt-6.1-sol with high reasoning effort; the launcher pins
these values. Never silently fall back to another model or effort.

QUALITY IS THE DELIVERABLE. Produce fewer credible animals if needed. Unique
frames, metadata, test passes and plausible prose do not establish good art.
Do not expand beyond the assigned manual animal or unlocked family task.

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
Ground unfamiliar anatomy/gaits in primary references before rigging. Record
the actual computed footfall/contact sequence and check it against the intended
species gait; phase-offset signs can reverse a seemingly correct schedule.
Inspect front and rear feet/appendages as well as the face: front toenail/toe
clusters do not belong on a rear-facing heel. Do not reuse a front master blindly.

REVIEW: produce an all-frame contact sheet, chronological strips for each full
cycle, native and enlarged looping previews, and actual Modern Exteriors scene
comparisons beside approved Explorer. Review every facing, two complete loops,
actions and return to idle. Compare adjacent poses for head/marking flicker,
body pumping, leg sliding, detached limbs and near/far swaps. Actually open and
inspect the images and sample continuous cycles. Record precise observations,
reject failed iterations, fix them and repeat. Do not substitute assertions,
guides authored from the same mistaken pixels, hashes or test results for seeing.

GATES: supervised pilot sessions stop after their assigned animal for coordinator
review. Background mode requires coordinator-reviewed pilot artifacts and starts
the fresh roster from those newly produced pilots, with zero v1 completions.
The family gate is keyed by roster family, body plan, media and gait set; a fox
walk or rabbit hop does not unlock unrelated animal families.
For each new locomotion family, produce/review a prototype before siblings. A
failed style/camera/motion gate blocks that family. Do not persist a flawed
shared template across dozens of species. Two saved Needs changes reports pause
the batch until the owner says ready. Owner feedback is not an agent approval.

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
