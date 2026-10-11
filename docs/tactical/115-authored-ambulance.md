# Authored ambulance for sprite/render review

Status: Authored v1 delivered for owner inspection; gameplay integration and
production art approval remain pending.
Updated: 2026-10-11.
Topic: [vehicle model porting](../topics/vehicle-model-porting.md).

## Scope

Author an ambulance-specific Blender mesh from the four frozen `ambulance` views
in the approved vehicle bank. Preserve source pixels and physics. Use one coherent
mesh/atlas, independently rotating wheels, owned window regions and native-pixel
ink. Present sprites above the corresponding renders in four columns.

Retain the exact final GLB, packed Blender/texture source, references, portable
recipe and required dependencies in tracked directories. Inspection iterations
stay in fresh ignored workspaces. This slice prepares a reviewable authored
diagnostic; gameplay integration and production approval remain separate.

## Delivery checkpoints

- [x] Read review inbox/source notes: zero pending requests or notes.
- [x] Freeze all four source views and inspect cab, box, roof and wheel landmarks.
- [x] Fit the new family geometry and camera registration.
- [x] Own side graphics/windows and author unseen paint explicitly.
- [x] Inspect native 4×2, contour differences and novel angles.
- [x] Verify actual exported GLB, wheel hierarchy and packed Blender textures.
- [x] Retain exact assets/dependencies; tracked-file-only validation recorded below.
- [x] Prepare the exact 4×2 for presentation and update the tracker.

## Observations

The approved side crops are 128×79 and front/rear crops 48×112. East and west
graphics differ (the west side includes a phone symbol). Blue bars span the box
roof; cab glass and lower side windows need separate ownership. Roof panel paint
differs across directions, so directional observations cannot all be treated as
one identical recovered texture. Raised equipment and hidden paint require
explicit authoring rather than a compact recolor.

## Delivered checkpoint

[`ambulance/v1`](../../art-source/vehicle-models/ambulance/v1/) retains the packed
scene, cleaned atlas, references, portable recipe, family configuration, rig,
paint ownership, source-only projection/coverage and captured audits.
[`ambulance-v1.glb`](../../public/assets/models/vehicles/ambulance-v1.glb) is the
exact evaluated self-contained runtime export. The model has 54 meshes and
1,024 triangles, four radius-8 tire/hub assemblies and explicit steer/roll
parents. Forward is -X, up +Z, units are world pixels and tires rest at Z=0.
Visual roof equipment reaches Z=52; the approved source's physical height remains
40. Retention changes neither the immutable sprite bank nor collision/support.

The [4×2](../../public/assets/models/vehicles/review/ambulance-v1/comparison.png),
[novel angles](../../public/assets/models/vehicles/review/ambulance-v1/orbit.png)
and [contour sheet](../../public/assets/models/vehicles/review/ambulance-v1/silhouette.png)
are retained exact review snapshots. A static inspection page and excluded
`projection:authored-ambulance-v1` Workshop identity make this zero-event work
discoverable. The compiler verifies the served GLB and PNG hashes against the
capture receipt. Chat review and diagnostic registration do not imply production
approval. No human feedback or approval has been synthesized.

## Fitting and validation

Five fresh offline workspaces preserve the fitting attempts. Roof/cab/nose,
body width registration, wheel contacts, rear step and source-owned asymmetric
graphics were inspected using actual Blender meshes. Final contour IoU is
0.918 east/west, 0.930 north/rear and 0.914 south/front; mean contour distances
are 1.49, 1.49, 1.02 and 1.28 native pixels. These include sprite shadows and do
not establish internal-detail fidelity or human acceptance.

The ambulance exposed raw-render clipping before the camera affine transform.
`raw_frame_size` now overscans only when geometry exceeds the original frame,
preserving samples per world pixel. A meaningful regression checks the tall mesh's
pre-transform extent. Re-rendering blue compact-1 still matches all eight existing
native/novel hashes; the retained ambulance source also matches its eight captures.

The shared bundle/Blender/browser verification now reads each model's audited
geometry and wheel radii instead of assuming every vehicle is the compact.
All four retained scenes have packed textures with exact cleaned-atlas bytes.
The actual ambulance GLB loads/renders in full Playwright Chromium; rest grounding,
forward/reverse quarter turns, independent motion, static body/centers and front-only
steering pass. This verifies the rig, not steering/fender clearance.

An index-only checkout contains no ignored authoring templates or demos. From
that checkout, the bundle verifier and 21 Python tests pass; the retained ambulance
reproduces all eight native/novel render hashes, and all four packed Blender scenes
and exported wheel rigs pass their audits. Built GLBs match retained bytes.

Typecheck, lint and production build pass. The art catalog remains unchanged;
the Workshop manifest adds one excluded inspection identity and preserves all 761
previous candidate records. The new desktop/phone review test passes, as does the
tool-index destination test after updating its count for the new entry.

Before rebase, the full Windows unit run reports 2,406 passes, 11 failures and 10 skips. Six
Workshop service failures came from a manifest-generation race; after regeneration,
all 13 tests in that file pass. The remaining five failures concern Windows symlink
permissions and SIGKILL handling; the static-file suite also cannot create its
symlink fixture. These platform checks are outside this asset change.

Before rebase, the full Chromium suite finishes with 538 passes, one skip and nine failures.
The new ambulance review passes on desktop/phone, and the mesh/all-cars driving
variants pass. The tool-index failure was its previous 25-card count; the new
26-card assertion and served-destination checks pass. A single-worker rerun of
eight relevant cases yields six passes and two failures: fish escape, GPU input
recovery, canvas movement and preference reload pass on rerun, alongside ambulance
review and tools. GPU fullscreen-tap retention and plain-GPU car driving still
fail. Two standalone building/hotel phone-layout checks also fail with voting
controls at 853.8 pixels in an 844-pixel viewport. These unchanged game/building
checks need separate follow-up; this delivery does not claim a fully green suite.

Rebased onto the concurrent renderer/culling updates on remote `main`, preserving
their documentation and moving this record to 115. The refreshed manifest preserves
all 761 remote candidates and adds the same ambulance capture identity. Final
typecheck, lint, build, bundle verifier and 21 Python tests pass. Six final browser
checks pass: ambulance desktop/phone review, tool destinations, load smoke, default
GPU mesh host, live renderer selection and missing-model sprite fallback.

The final Windows unit run has 2,464 passes, six failures and 10 skips. Five failures
are the same symlink/SIGKILL platform checks; the other is a Workshop timeout under
the full run. All 13 Workshop service tests pass in isolation afterward. The full
24-minute browser suite was not repeated after rebase; the final renderer/review
checks above qualify the updated build without claiming the wider failures resolved.

The constructor source uses pinned LF checkout rules so its recorded provenance
hashes remain portable. Exact scene/atlas/GLB/review bytes remain protected by the
existing retained-bundle checkout rules. Exploration workspaces and test captures
remain ignored; only the finished bundle, review snapshots and required tooling
are tracked.

## Review and next work

Use the north-owned roof panel paint consistently; the source's front roof is
plainer. The rear-facing cab/nose shows different paint than the source's gray
far-end strip. Rear trim, bar weight and side/window boundaries still need the
owner's eye. Hidden paint and rectified beacon-strip transfers remain explicitly
inferred in ownership/coverage records. Steering clearance is unqualified.

Next: incorporate the owner's 4×2 feedback as a new retained revision, then fit a
per-asset shared engine adapter and game-camera registration. Do not mark the
ambulance integrated because the all-cars blue override can display its type.
