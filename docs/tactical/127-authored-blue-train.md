# Authored blue train prototype

Status: Complete prototype and owner-authorized v3 game activation; exact v1/v3 sources and review snapshots retained.
Date: 2026-10-12.
Owner: [trains](../topics/trains.md), [3D assets](../topics/3d-assets.md).

The owner requested the live blue train after the completed road-vehicle bank.
Build its rear, middle and front carriages as editable Blender/UV meshes with
independent wheels, retained source dependencies and a 4×2 comparison. Preserve
the approved native train sprites, current authority, spacing, collision/support
and service motion. The train topic's exact moving-art review gate still applies;
this task produces a reviewable prototype before live activation.

## Checks

- [x] Freeze all six blue source pieces and record directional carriage identity.
- [x] Author train-specific body, roof, glazing, skirt, bogie, wheel and coupler components.
- [x] Inspect each carriage's four matched views, contours and novel angles.
- [x] Check actual exports, all wheels, body clearance and material/resource isolation.
- [x] Exercise existing service curves, joins and reversal without changing simulation.
- [x] Retain exact GLBs, packed Blender/texture bundles, recipes and dependencies.
- [x] Register immutable comparison/motion review evidence; validate tracked-only replay.
- [x] Update topic/workflow evidence, commit and push the review-ready prototype.

Horizontal pieces are 136/160/160 pixels; vertical Back/Middle/Front are
109/112/143 pixels long. Native curve spacing already varies with tangent to
accommodate those drawings. A fixed rigid 3D body cannot reproduce all those
lengths exactly. Record contour/join limits explicitly; never hide them with
heading-dependent gameplay lenses or by changing live collision/spacing.


## Prototype evidence

Rear/middle/front v1 retain 36/40/42 meshes and 1,558/1,560/1,570 triangles,
with eight radius-five wheels each. Wheels parent to named fixed bogies; couplers
and bellows are separate connected components. Actual engine wheel probes pass
signed forward/reverse travel, absolute reset, fixed pivots/body/equipment and
disposal for all 24 wheels. Exported whole-body tire/hub cylinder gaps are at
least .999998 model units; deliberate body-triangle collisions reject and restore.

The full-consist 4×2 composes each physical carriage's declared source cameras;
it is not fixed-camera gameplay parity. Per-carriage silhouette IoU ranges
.929–.995 (source shadows included). Native and mesh motion captures share actual
production ScenarioSession loop/corridor poses and the fixed GPU projection.
All four loop directions, actual positive/negative travel, independent tangents
and exact mid-bend reload pass. Rest-coupler endpoint separation reaches 49.552
model units on native spacing. This is an explicit moving-art limitation, not
qualified connected articulation. The visual roof is 40 model units versus the
unchanged 44-unit native support; mesh-aligned roof riding needs qualification
before live activation.

Only explicit authored-train inspection fixtures select these assets. Main-game
and default Canvas/GPU train paths retain sprites and do not request train GLBs.
Prototype failed-load and disabled paths preserve native carriage crops. A single
constant lateral reflection registers source-side paint before yaw; reversal
uses the increasing track tangent rather than velocity orientation. No heading
camera, authoritative spacing or train geometry change is introduced.

The retained catalog verifies three portable GLBs with byte-exact embedded
atlases, 19 replay/source dependency pins and connected eight-wheel bogie rigs.
The packed Blender audit finds exact clean atlas and own unused draft images in
all three scenes. Fresh Git-index checkout
`data/authored-assets/train-blue-tracked-001/` passes the same bundle, packed-source,
whole-body and actual-engine checks. Every retained native/novel render reproduces
exactly there: **24/24 PNG hashes**, with no ignored template or scratch input.

Initial focused units: 42 pass; all 35 Python tests pass. Typecheck, lint and build
pass; Workshop verifies 808 candidates / 60 exclusions, including the new exact
blue-train model/motion inspection candidate. Full units: 2,555 pass / 10 skipped /
five known Windows symlink/process-death failures; the static-files suite also
reports symlink setup/cleanup hook errors. Targeted browser run passes 13 of 14
checks, including default preservation, own GPU loading, failed-load fallback,
Canvas/GPU curves/reload and city roof riding. Its new comparison-link test used
an unsupported batch route; it is corrected to the existing exact-review route.
The broad stable browser run covers that correction and remaining regressions.


## Support and straight rail refinement

The final audit found that v1's inferred ±16 wheel centers did not match the
production pixel rails at ±10, and its 40-unit visual roof did not meet native
44-unit support. Retained v2 raises only upper body vertices by four units and
moves wheel pivots to the straight track gauge. Source paint, atlas bytes, UVs,
wheel radii, floor, bogies, couplers and simulation stay unchanged. Recorded
source cameras refit the taller body; side silhouette scores slightly improve.
V1 remains archived byte-exact. New versioned refinement/retention/probe scripts
pin the old scenes and retain v2 independently. Native engine contract source
hashes are captured as evidence, rather than freezing mutable gameplay code.

All 24 actual engine wheel centers meet straight ±10 rails and ground contact;
the actual exported roof plane is exactly 44. Independent forward/reverse roll,
absolute reset, fixed body/equipment, all-direction loop, positive/negative
corridor travel, disposal and mid-bend reload pass for v2. Whole-body neutral
roll cylinders still have at least one unit clearance. Coupler/curved bogie
articulation remains unqualified; native spacing is deliberately unchanged.

The stable full browser run completes 626 tests: 618 pass, one skipped, seven
fail. All six new train checks pass, and all existing curve/city riding and own
road-model checks pass. Four known phone-layout/Canvas/plain-GPU driving failures
remain, alongside two loaded dev-reload timeouts. The new train tool exposed one
fixed-count Tools index assertion (26 versus the new 27 tools); update the count
and explicitly check the new destination. The final v2/baseline rerun follows.


## Final source packaging

The packed-source audit caught a Blender reload trap in the unpublished v2
package: an already packed unused draft kept its v1 bytes after `reload()`.
Geometry, UVs, cleaned atlas and rendered pixels were unaffected. Preserve the
failed package/receipt under ignored `data/authored-assets/train-blue-failed-v2-package-001/`;
it is scratch, never a committed retained revision or approved review snapshot.
Archived v1 source/review bytes remain exact. The corrected package is **v3**.

`pack_train_draft.py` verifies the old image is unused, loads the new draft as a
fresh image and checks the actual packed PNG bytes before saving. Final retention
uses the same roof/gauge refinement geometry, fresh packed sources and real v3
engine/clearance receipts. All six archived-v1/current-v3 source scenes now pass
exact cleaned atlas, own draft, UV/geometry and bogie hierarchy audits. Current
inspection registrations and review discovery select v3; two exact candidates
retain v1/v3 evidence. The final manifest has 809 candidates / 61 exclusions.


## Final validation and handoff

The final v3 source package passes all six retained Blender audits, all 35 Python
tests, typecheck, lint and 42 focused rendering/rail units. All 49 road bundles
still verify unchanged; actual shared GPU regression passes all 45 road assets.
Fresh Git-index checkout `data/authored-assets/train-blue-tracked-002/` verifies
all six v1/v3 train bundles, their pinned dependencies and packed atlas/draft
bytes. Its actual engine probe passes roof 44, straight gauge 20, all 24 wheels,
loop/reversal/reload and disposal. All 24 latest native/novel PNGs reproduce
exactly from those tracked v3 scenes; scratch inputs are unnecessary.

The bounded final browser rerun passes 12 of 15 cases: all six v3 review/default/
loading/fallback checks, the new Tools destination, both dev-reload cases and
both GPU driving variants. The two known phone review layouts and Canvas tap
fixture remain. Main train art and physics are unchanged. The new/changed train
checks have no remaining failure. Baseline validation logs stay ignored under
`data/authored-assets/train-blue-*.log`.

Workshop discovery adds exact archived-v1/current-v3 train candidates. Earlier
retained vehicle identities and promoted sprite banks stay exact; the broad
source contract conservatively renews 152 nature, twelve geometry and six
character recipe fingerprints because they hash shared collector/presentation
source. No approvals are inferred or copied to changed identities.

Next: inspect the retained 4×2 and real fixed-camera loop/reversal comparisons.
Coupling and curved bogie articulation remain at their rest poses and need a
qualified follow-up before live activation; do not silently alter native spacing
or collision/support to disguise projection differences. Only blue was requested;
the other four train families remain queued in the train topic.


Remote synchronization rebases the completed prototype over `3f27d6dd` (flat-tap
fixture isolation only; no asset/runtime conflict). The combined production
build passes and all four main-game car boarding/tap/save/exit variants pass on
the stable single-worker rerun, clearing the transient driving failures. The two
known phone art-review layout failures remain outside this train change, as do
Windows symlink/process-death unit limitations. Retained train/road hashes still
verify after rebase. Final tree/remote equality is checked after push.


## Owner review and game activation

The owner opened the v3 authored loop on the LAN preview and said "seems fine".
After confirmation that it was lab-only, the owner instructed "Good proceed.
Commit and push when done" on 2026-10-12. This authorizes the exact reviewed v3
rear/middle/front carriages in game. Workshop verdict records stay untouched.
Acceptance identifies `projection:authored-blue-train-v3`, fingerprint
`cdbc3e28d32880ad678c51aeccfcae57c315d654e5f7caf951bfd29ffbaa07ac`,
and its retained source identity
`c590a7be6ecf32db36515e2f0010306b21c9c9743aa0f6f60fd9c52525bd5e23`.

Shared mesh selection now defaults to these three carriages in GameClient and
ScenarioPresentationHost. The authored fixture aliases remain available;
`nativeTrains` explicitly restores a native-art lab comparison. Canvas, GPU sprites,
loading and failed meshes keep native crops. Continuous path orientation and
signed wheel roll are unchanged. Physics, native spacing, 44px roof support,
body/UV/source bundles and frozen motion/comparison snapshots are untouched.
Rest bogies/couplers retain the reviewed gap/overlap limitation.
The six supported curve/straight carriage types use the model bank; legacy
`train-local-v1` single-body services keep their native whole-train sprite.

The inventory rebuild keeps all 809 candidates and both exact blue-train
fingerprints. Current v3 is no longer excluded after owner acceptance;
archived v1 stays excluded. The 170 nature/geometry/character fingerprints renew
conservatively because their contracts hash shared collector/presentation source.
Retained art banks, source bundles and approval snapshots are unchanged.

Validation on 2026-10-12: typechecks, lint (119 existing warnings / 34 infos),
production build and all six retained train bundle/dependency/embedded-atlas/rig
checks pass. The four focused presentation suites pass all 90 tests. Full units:
2,564 pass / 10 skip; five known Windows symlink/process-death failures plus
static-file symlink setup/cleanup errors remain. One Workshop API timeout clears
on its 13/13 isolated rerun.

Full Chromium: 623 pass / one skip / seven failures. All nine train activation
cases pass: actual default-game own GLBs, backend switching, native-art comparison,
loop/city/winding motion, retained exact review and failed-front fallback. The
additional GPU + meshes complete city journey passes boarding, bends, mid-bend
reopen, arrival and alighting. Existing train call/driving/grade/bridge checks pass.

The final single-worker selection passes 16 of 20, including all nine new train
cases, tools index, both walking backends, both dev reloads and both mesh-car
boarding variants. The two known phone review layouts and Canvas/GPU-sprite car
tap destinations remain. An isolated Vite harness serves all three changed
game presentation modules verbatim from pre-activation HEAD `4c01e42`; the same
car assertion (zero displacement versus >16px) fails with both Canvas and GPU
sprites there. Canvas also passes one baseline run, retaining its timing-sensitive
evidence. No train test or car assertion is weakened.

The final LAN build serves byte-exact v3 assets; actual shared GPU diagnostics
show all three carriages ready and moving without page errors. Other train
families, whole-train legacy sprites and unqualified articulation stay deferred.


Final synchronization rebases activation onto `ea71baca`, the road-vehicle
game-camera fit. Both collector imports and both topic records are retained;
review inventories are recompiled from the combined source. Train loading keeps
height scale 1 and its original shadow path; road height/contact/roof fitting
stays scoped to road definitions. No retained train bytes or physics change.

Combined validation passes typechecks, lint, 145 focused tests across the six
affected presentation/asset/roof suites, production build and all 12 focused
Chromium cases, including the full GPU + meshes city journey, main activation,
failed-load/native comparison, tools index and road-fit archive. All 811 current
candidate identities verify (62 compiler exclusions); both exact train identities
stay unchanged. The frozen actual-engine probe again passes all 24 independent
wheels, 44px roofs, 20px straight gauge, four loop headings, signed reversal,
mid-bend reload and disabled fallback/disposal. Its hard-coded
`liveTrainDefault` receipt label is historical inspection metadata; the new
main-game browser test verifies the actual active default. Broader-suite failure
evidence above is from before this final rebase, not a claimed new full rerun.

## Browser synchronization checkpoint (2026-10-18)

The default-game backend-switch check reproduced an intermittent identity failure
in the full suite and a focused repeat: it could capture the old world's carriages
while New World creation/join was still in flight. GPU readiness diagnostics can
also survive the join before the new realm's first entity snapshot arrives.
The check now waits for the world menu to close after joining and for all three
carriages before capturing identities. Exact asset, roof-height and identity
assertions across all three backends remain. No runtime or art changed.

The corrected default-game check passes ten consecutive single-worker full
Chromium runs; typechecks and lint pass. The original full local suite was
interrupted after this failure (71 passed) to isolate it; full CI remains the
combined-suite verification.
