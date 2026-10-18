# Predators and prehistoric creatures

Topic: wildlife
Status: tiger pilot delivered for pending human review; remaining sequence proposed only.
Updated: 2026-10-18.

The owner asked to consider lions, panthers, tigers, bears and possibly T. rex
as the next Blender creature work. This document scopes that discussion. It
does not reopen the historical 196-entry campaign, change repair-scope.json,
clear existing motion holds or imply human approval of any artwork.

Owner follow-up, 2026-10-18: “ok do tiger then.” Proceed with the first natural
tiger art pilot under tiger-batch.json. This explicitly supersedes repair-only
exclusions for tiger alone, using the elephant-style Blender/pixel workflow.
Keep historical sheep/pig gates active; independently satisfy the visible
body-motion contract on this new source. Do not start other animals or gameplay
integration under this authorization.

## Proposed outcome

Create a small, recognizable cast of imposing natural quadrupeds, followed by
an optional prehistoric pilot. Recommend tiger first, then black panther, lion,
brown bear, and finally T. rex. Deliver one inspected animal before starting
its successors. Each needs its own silhouette, proportions and motion decisions.

Planning assumptions pending owner preference: use the elephant-style Blender
pose → projected guides → authored pixel sprites workflow; keep initial sandbox
behavior harmless. Animated runtime 3D, chase play and combat are separate scope
decisions. Preserve editable sources so future export work remains possible,
without claiming the current object-keyed wildlife scenes are engine-ready rigs.

| Order | Creature | Main visual/motion problem | Initial clips proposed |
| --- | --- | --- | --- |
| 1 | Tiger | Long feline body, broad paws, moving shoulder/pelvis, stable stripes and readable face in four facings | Idle, walk, look/sniff, short jaw-open display |
| 2 | Black panther | Dark silhouette and near/far limb separation against actual grass, trees and roads; its own lean proportions | Idle, walk, low stalk, head turn |
| 3 | Male lion | Mane volume, muzzle and ears; mane must preserve the visible weight transfer of the walk | Idle, walk, head turn, roar display |
| 4 | Brown bear | Broad weight-bearing paws, deep torso and shoulders, short tail and distinct rear anatomy | Idle, heavy walk, sniff, brief rise/display if it reads well |
| 5, optional | T. rex | Horizontal body balanced by tail, large head/jaw, small arms, two-leg contacts and turning clearance | Idle, walk, look, roar display |

Use a melanistic leopard as the proposed meaning of “black panther”; confirm
before anatomy work. A lioness, other bear species and additional coats are later
choices. T. rex is the extinct-animal bridge into a fantasy collection; actual
fantasy species such as dragons remain a later discussion. A visible roar clip
does not include new audio work by default.

## What we can reuse

- Fixed wildlife camera, world-pixel density, ground anchors, direction conventions,
  palette-master finishing, deterministic sheet composition and review playback.
- Constant-length limb solving from moving hips and native body-motion audits
  developed for the common pets in [084](084-common-pets-and-variations.md).
- Source retention and exact pending-review delivery, including the small animation
  artifacts needed for review from a fresh checkout, as used by that pet batch.

The [elephant source](../../art-source/wildlife-v2/elephant/pilot-v2/README.md)
documents the existing object-keyed Blender workflow. It is a projection and
authoring precedent, not a feline anatomy or runtime skinning template. The
vehicle-authoring skill likewise supplies no animal geometry template.

The local mclone Asset Lab currently has lion/tiger/bear figure definitions and
a broad animal checklist. Use those for roster and structural reference only:
the inspected current tiger and bear definitions are box-based TypeScript DSL
figures, not drop-in Tilefun Blender sources or approved pixel masters.

Tilefun's existing Tiger and Brown Bear **characters** are upright character
assets. They do not fill this natural-quadruped wildlife role. The older natural
brown-bear attempt is blocked for flattened profile volume, narrow angled legs
and weak rear anatomy/action readability; inspect that evidence before making a
fresh bear prototype. Do not count it as a finished master or overwrite it.

## Delivery sequence and gates

1. **Choose the bounded pilot.** Settle sprite/runtime-3D output and gameplay tone.
   Before production, record the named authorized IDs and how this batch relates
   to the existing sheep/pig correction gate in the wildlife topic. A request to
   plan does not release that gate. Keep the generic campaign disabled.
2. **Tiger silhouette study.** Build a species-specific editable Blender source.
   Inspect neutral and key support poses in all four facings, beside Explorer,
   elephant and scenery at unchanged world-pixel density. Choose dimensions from
   this comparison; enlarge transparent cells for tails rather than scaling art
   to fit. Establish body, paw, head and tail readability before detailed paint.
3. **Tiger motion proof.** Author moving shoulders/pelvis, grounded stance feet,
   constant-length limbs and stable skull/torso volumes. Inspect full loops at
   native size and enlarged, both in place and at matching travel speed. Reject
   frozen torsos, foot sliding, whole-sprite bouncing and popping markings. Pick
   sample counts/timing from observed motion rather than a frame-count quota.
4. **Finish and review one animal.** Author restrained pixel masters against the
   guides. Check front/rear anatomy, limb occlusion, fixed markings and action
   transitions. Save exact source/output hashes and concrete visual observations;
   retain rejected iterations separately. Register a fresh pending Workshop
   candidate. Agent integrity checks and human art approval remain distinct.
5. **Extend the big-cat family.** Reuse proven controls and finishing tools for
   panther and lion, while fitting their own geometry and action poses. Panther
   needs dark-background checks; lion needs mane/shoulder occlusion checks. These
   are independent candidates, not automatic tiger recolors or shared approvals.
6. **Build the bear family pilot.** Rework its volume, paws, gait and rear view
   from the failed attempt's evidence. Pass the same complete native-motion
   inspection before considering polar/black bears or additional actions.
7. **Optional T. rex pilot.** Establish its own balanced biped source, tail/jaw
   controls and contact timing. Review tail overlap, front/rear leg separation
   and a complete walk before adding a run or other dinosaurs. Verify current
   primary anatomy/locomotion references during authoring; the clip proposal here
   is an art direction, not a biomechanics specification.
8. **Integrate as a separate slice.** Begin with manual editor placement and a
   shared game/Worker lab scene. Define physical footprint, support height,
   travel/animation timing, persistence and reaction behavior explicitly. Keep
   long visual tails separate from the support footprint. Choose natural spawn
   habitats/densities after playtesting; initially keep T. rex manually placed.

## Retained deliverables and validation

Each delivered creature needs an exact editable .blend, construction/export and
audit scripts, camera/scale records, pixel masters, native sheet, explicit clip
timing/anchors, portable replay instructions and all small exact review assets.
Normal builds consume committed outputs and never launch Blender. Preserve old
sources, frozen revisions and review decisions. Document inferred anatomy and
any limitations of projection, finishing or future GLB export.

Check saved scenes independently for fixed volumes/limb lengths, evaluated
landmarks and contact phases. Inspect actual chronological browser playback in
all facings, native/enlarged and in scenery. Numerical checks cannot pass the
visual gate on their own. Register every new exact candidate in Workshop; changed
pixels require fresh review. Follow the existing feedback/pause rules.

For implementation, run typecheck, units and lint; rendering/integration also
requires build and bundled Playwright Chromium. Update art catalog and Workshop
manifest after render/recipe/input changes. Runtime execution changes additionally
require streaming readiness and shared game/lab validation. Persist checkpoints
before refreshing the wildlife production table.

## Planning checkpoint

2026-10-18: inspected wildlife topic/contracts, elephant source documentation,
pet delivery, blocked bear evidence and local mclone references. Trusted Workshop
inbox reports a current manifest and zero pending requests/fixes; art notes has
zero pending notes. These reads confer no approval. No animal source, asset,
receipt, campaign scope, behavior or review identity changed.

Documentation validation: typecheck, lint (existing warnings/infos) and Git
whitespace checks pass. Full Windows units: 2,609 passed, 15 failed, 10 skipped
across 264 files. Failures include filesystem/symlink/process-death checks and
five-second runtime/generation/benchmark timeouts; no tested implementation was
changed by this documentation proposal. Logs remain in ignored
`data/predator-plan-{typecheck,lint,tests}.log`. The production-table refresh
succeeds with the same historical counts: 11 draft ready, 11 motion review,
eight blocked and 166 out of scope; no queued production.

## Tiger delivery checkpoint

The authorized first pilot now has its own 46-mesh editable source, stable coat
markings, 12-sample moving-body walk, idle, eight sniff poses and eight jaw-display
poses in four directions. Source/masters and small exact review artifacts live
in `art-source/wildlife-v2/tiger/pilot-v1/` and the corresponding public folder.
The frozen receipt, observations and safe replay commands are retained there.
Large panels/browser captures and rejected early leg/tail/sniff studies stay in
ignored `data/tiger-131/`.

Fresh-process saved-scene audit: 116 poses, 1,392 constant-length link checks,
432 grounded stance contacts and 160 matching-travel checks. Body projected
rise/fall is 1.455–1.595px across facings, with distinct fore/hind-quarter motion.
Independent scratch rebuild reproduces nine public sprite/metadata/player
artifacts byte-for-byte. Actual bundled full-Chromium playback observes all 29
chronological states at native and 4× scales with no errors and 232 exact
facing-crop comparisons. Opened every clip panel, actual browser scenery/travel
captures and Explorer/tiger/elephant comparison; numerical integrity remains
separate from those visual observations and from pending human approval.

Early iterations corrected excessively bent leg links, a thin straight tail and
an imperceptible sniff. Remaining limits: compact friendly face, some merging
tail bands/far paws, subtle rear jaw display, and simplified face pitch during
sniff. No runtime GLB, gameplay, sound or additional predator is delivered.

The tiger has a separate pending `wildlife-v2-tiger-131` Workshop batch. Existing
registry records, historical receipts and human decisions stay unchanged; the
old campaign remains stopped. `check-tiger.mjs` verifies the exact new receipt,
including explicit scenery dependencies; the historical namespace guard remains
unchanged. The production table tracks the new tiger separately from historical
counts and the four pets.

Delivery validation so far: typechecks, lint, catalog, production build, all 19
historical wildlife gate tests, four exact pet receipts and the tiger receipt
pass. Manifest generation verifies all 812 identities in full Chromium at retina
scale; all 811 pre-existing candidate fingerprints remain exact. Registry updates
preserve the original 31 objects and byte prefix; only the new tiger is appended.
The Windows unit run with two workers passes 2,617 tests, skips ten and fails
seven: five existing filesystem/symlink/process-death cases plus the unchanged
TrainCall and frog MallardResidency timeouts. Full browser results follow below.
Logs are retained in ignored `data/tiger-131/`. Read-only live verification returns
HTML for the new sprite JSON path, so this checkout's tiger is not yet available
at the shared origin; local registration is not deployment.

Final validation: both unit timeouts pass on an unchanged, one-worker focused
rerun (two passed, 28 unrelated cases skipped). The complete browser run finishes
with **610 passed, 23 failed, one skipped** in 39.7 minutes. All wildlife gameplay,
the five portable pet/tiger pending-review/player cases, full-Chromium exact
wildlife previews and changed/missing-evidence rejection checks pass. Failures
are in unchanged phone layouts/editor selections, train riding and controls,
interior/remote gameplay, renderer switching, terrain pacing and development
reload cases; the full log retains their actual assertions and timeouts. They
were not converted into art approvals or hidden by changing tolerances.

Final tiger and four-pet receipts verify, the 812-candidate manifest remains
current, and Workshop reports one unchecked tiger and zero pending requests/fixes.
Browser validation used bundled Playwright Chromium. Full Playwright and capture
processes have finished. Historical
production counts/holds and the pending human review state remain unchanged.

Commit packaging checkpoint: the gallery's default ignore rule requires explicit
tiger exceptions. All 14 small public review files are now retained; all 30 exact
receipt dependencies are present in the Git index and match their saved hashes.
Manifest freshness and staged whitespace checks pass without changing art bytes.

Next: owner review of the tiger's native silhouette and walk before another
species or gameplay slice. The live origin must serve these exact files before
sharing its new review link; a local candidate does not deploy itself.
