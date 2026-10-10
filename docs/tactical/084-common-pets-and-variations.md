# Common pets and variations

Topic: wildlife
Status: complete. Four exact drafts and provisional gameplay delivered; human art review pending.
Owner authorized cats/dogs and incremental commits on 2026-10-10.

## Outcome and scope

Four new natural quadruped drafts: ginger tabby, black cat, golden retriever,
and pointed-ear shepherd. Record the broader familiar-animal ideas in the backlog.
This explicit bounded authorization supersedes repair-only exclusions for these
four IDs; the generic wildlife campaign and other species remain stopped.

Existing art, review fingerprints, receipts and decisions remain immutable.
Use the calibrated wildlife camera, fixed world-pixel density, editable Blender
pose sources and authored pixel masters. Correct the stationary-body gait in the
new source before deriving coats. Solve constant-length limbs from moving hips
with grounded stance contacts; retain fixed skull/mesh volumes. Inspect all four
facings at native/enlarged scale, including continuous walk and travel playback.
No whole-sprite bouncing, frame scaling or invented approval.

New drafts enter exact-source Workshop review. Gameplay integration uses the
existing cat/dog behavior and persistence contracts only after the new art has
passed agent integrity/visual checks; human approval remains pending.

## Steps

- [x] Record expansion ideas and bounded owner authorization.
- [x] Build and inspect corrected cat/dog motion sources.
- [x] Author and inspect ginger tabby, black cat, golden retriever and shepherd.
- [x] Register exact review candidates and make new pets available in the world.
- [x] Refresh inventories, run required checks and retain evidence.

## Evidence

Initial source inspection: both original builders keep BODY fixed; cat/dog
walks animate limb targets and tail alone. Workshop inbox and art notes have
zero pending requests/notes. No human approvals are inferred from that absence.

The four new IDs are tracked separately from the historical 196-entry campaign.
Progress lives in the bounded pet source manifest; production-table checkpoints
must include it without changing historical receipts.

Four final saved sources pass fresh-process Blender audits: cats have 84 poses,
1,008 fixed-link checks and 304 ground contacts each; dogs have 100 poses,
1,200 link checks and 352 ground contacts each. Body projected vertical range is
0.958–1.021px for cats and 0.996–1.059px for dogs, with distinct shoulder/pelvis
transfer in every facing. Fixed head volume is stabilized against torso pitch;
soles remain level. First smaller movement and round shepherd-ear prototypes
were corrected before registration. Original art is untouched.

Opened all chronological native/enlarged walk/action panels and actual scenery
comparisons. Full bundled Chromium observed all 21/25 chronological poses at
both scales and verified 736 four-facing source crops, without browser errors.
Exact pending receipts include shared authoring scripts, editable scenes, pixel
masters, observations and public review inputs. `check-pets.mjs` verifies all
four. The old 19 campaign gate checks still pass; their global repair gate stays
closed. No human approval is implied.

The new pets use 80ms walking frames and matching 4px/6px native stride, with
double-speed 40ms provisional escapes. They have shorter steps than the original
cat/dog profiles; existing pets retain their original behavior/art. Coat choice
in settlement greens is seeded independently of family IDs and rural roster
selection. New profiles reuse saved fauna, safe-yard bounds and shared authority.
The four-case Worker lab uses real seeded settlement arrivals, without custom AI.

Focused new-profile authority checks: 36 pass, including durable removal/manual
identity, binary saved phase, safe generated homes, collisions and alarm recovery.
The edited-terrain test now waits the actual committed walk duration; the previous
fixed 200-tick wait was too short for the slower new gait.

Initial browser run exposed two test assumptions: increasingly sparse idle
polling could miss the 0.8s rest phase, and settlement checks filtered out named
coats. The checks now sample native rests every 30ms and classify the exact
profile's cat/dog family while still comparing each saved coat, position and phase.

## Integration completion

All 24 focused gameplay/settlement browser checks pass, including native
Canvas/GPU motion, manual creation/deletion, safe generated yards, harmless
contact and exact saved phases. The separate new-draft review check passes:
all four exact identities remain pending, native/enlarged playback and travel
work, and Pause retains the displayed pose.

Complete browser suite: **499 passed, four failed, one skipped** in 22.0 minutes
(`data/pets-084-browser-full.log`). All new and existing wildlife, settlement,
train-journey and gameplay checks pass. The skip is the optional interior atlas
grid capture. The four unrelated failures reproduce serially without competing
tests (`data/pets-084-browser-diagnostics.log`):

- Building-review phone navigation and hotel-review controls end at 853.796875px
  against an 844px viewport. Their page and tests are unchanged by this batch.
- The standalone GPU interior fixture has six mismatched pixels where zero are
  allowed; translucent indexed rectangles have channel error 2 against limit 1.
  Their unchanged renderer/fixtures do not load animal art. Tolerances remain
  unchanged, and the platform discrepancy remains unresolved.

Full-run error contexts are retained under
`data/wildlife-pets-084/regression-errors/`. Final trusted inbox confirms a
current manifest, four unchecked pet drafts and zero pending requests/fixes.

Typechecks and lint pass (lint retains existing warnings). The bounded full
unit run has 2,090 passes, five failures and ten skips across 219 files. Failures
are Windows filesystem symlink setup/containment checks and SQLite process-death
WAL recovery, in unchanged persistence/server tests; all animal units pass.
The static-files suite's symlink setup also fails before its ten skipped tests.
The WAL harness rejects Windows' process-exit signal after requesting SIGKILL;
it fails at the harness exit check before asserting recovered records.
The initial unbounded run competed with review rendering and hit timeouts;
the final run uses two workers. Logs: `data/pets-084-unit-bounded.log` and
`data/pets-084-final-lint.log` (ignored local evidence).

Catalog generation records 245 sheets and 1,086 source uses. Workshop generation
records 761 candidates and verifies headless-shell/full-Chromium retina parity.
All 27 pre-existing wildlife candidate objects remain byte-identical; the new
batch adds four draft reviews and sixteen native scenario views. Production
build passes after both inventories are refreshed.

`streaming:bench -- --assert-ready` passes all six phases (cold, standing, walk,
sprint, reverse and zoom-out), with no fixture errors/failures and zero missing,
incomplete or stale terrain at every final sample. Report:
`data/wildlife-pets-084/streaming/report.json`. Initial isolated Vite startup
scanned ignored archived HTML and timed out before game entry; the runner now
scans only index.html, retains startup diagnostics and uses WSL Git on Windows.
Its six matrix checks pass. This is integration readiness evidence, not a new
physical-device performance claim.

Incremental commits: `23bc88a` records authorization/ideas; `62ab869` delivers
editable art, exact reviews and pet gameplay; `376a8ab` fixes benchmark isolation.
The completion commit records final validation and refreshes the production table.
Next: human review of these four drafts, then decide a bounded birds/bees batch
from the recorded backlog. Other art production and historical motion holds stay
stopped.

Human review playback: [ginger tabby](https://tilefun.graehlarts.com/tilefun/demos/wildlife-v2/cat-ginger/draft-v1/),
[black cat](https://tilefun.graehlarts.com/tilefun/demos/wildlife-v2/cat-black/draft-v1/),
[golden retriever](https://tilefun.graehlarts.com/tilefun/demos/wildlife-v2/dog-golden/draft-v1/)
and [pointed-ear shepherd](https://tilefun.graehlarts.com/tilefun/demos/wildlife-v2/dog-shepherd/draft-v1/).
Approve/report through each exact pending Workshop candidate, not this execution record.
