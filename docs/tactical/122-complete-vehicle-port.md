# Complete vehicle port

Status: Active; owner authorized autonomous completion, commits and pushes per vehicle/batch.
Date: 2026-10-11.
Owner: [vehicle model porting](../topics/vehicle-model-porting.md).

Complete every source set's authored model, retained editable dependencies,
engine registration and reviewable 4×2. Start from the accepted source grouping
in [121](121-vehicle-source-families.md). Preserve prior revisions and source
sprites. Exact human art review/production promotion remains separate; do not
synthesize approval or stop ordinary authoring/integration to request it.

## Execution order

1. Finish compact 3/5/6 and integrate all six compact colors.
2. Fit the additional sedan body; retain and integrate all seven colors with
   explicit two-pixel paint exceptions and dark-sedan registration handling.
3. Fit the bus body, preserve asymmetric doors and mirror variants; all six.
4. Fit each of the three large-car families, then their 7/7/6 source paints.
5. Orange garbage, raised fire ladder and remaining existing-asset integrations;
   six-wheel, equipment and light contracts stay explicit.
6. Complete cross-vehicle frame/culling/lifecycle and game/lab qualification,
   tracked-file-only verification, queue reconciliation and final remote sync.

Each checkpoint retains exact GLBs, packed Blender scenes/atlases, own unused
projections, frozen reference crops, source cameras, rig/equipment/light records,
provenance and pinned comparisons. Run native contour/window/wheel-well checks,
actual GLB motion/effect probes and fresh tracked-only replay. Use ordinary
committed assets in normal builds. Scratch work stays under ignored `data/`.
Before each push, commit the bounded batch, fetch/rebase remote changes and
resolve conflicts preserving unrelated work and immutable evidence.

## Checkpoints

- Source family audit pushed as `6667b41f`, rebased over remote firetruck gameplay.
- Compact family: exact compact 3/5/6 v1 bundles retained; all six own assets
  integrated through the shared registry. Validation and baseline failure triage complete; pushed as `1967356f`.

### Compact family evidence

The strict transfer gate confirms all four source crops, physical metadata and
reversible global palette mappings. New cyan/orange/silver assets preserve the
blue template's geometry, UVs, complete window borders and four-wheel hierarchy:
55 meshes / 842 triangles each. Exact comparison snapshots and own source drafts
are retained with each bundle; previous revisions and all source sprites remain
unchanged. The registry provides per-type assets and culling/target bounds to the
shared pose and GPU paths. New colors load lazily with sprites during loading or
failure. Green/red now use their own retained models instead of the blue override.

Verification from `data/authored-assets/full-vehicle-port/compact-tracked-001/`,
created with Git `checkout-index` and no ignored asset inputs:

- All twelve retained revisions pass file, template, crop and embedded-atlas hashes.
- Blender read-only audits confirm exact packed atlases and packed reference
  images in every scene. All six compacts have the same geometry/UV/hierarchy hash
  `a12fbd284a033c3b544a4f9ec878c2be7118a879b74b1187347bd5c8d15c1439`.
- Every new recipe reproduces all eight pinned native/novel render hashes exactly.
- Actual GLB rigs pass independent wheel motion, signed radius-driven roll,
  ground contacts, fixed body/centers and front-only steering flags. Existing
  fire/garbage wheel-well/floor and negative probes continue passing.
- Actual shared GPU backend draws all eight registered own assets. Each compact
  has 2,182 visible native target pixels; pose/light reset restores byte-exact
  baseline pixels. Cold loads, disabled/unknown models fall back, simulation
  state remains unchanged and all resources dispose. The same probe passes in
  the tracked-only checkout.
- Gameplay browser checks load every compact through Traffic and preserve a
  working scene/sprite fallback after aborting compact-6's GLB. Nine immutable
  vehicle reviews open on desktop and phone.
- Python authoring tests: 33 pass. Typecheck, lint and build pass. Lint retains
  119 existing warnings / 34 infos. Unit suite: 2,507 pass, 10 skipped;
  five Windows symlink/SIGKILL cases and their fixture teardown fail, plus one
  loaded-suite timeout. Isolated Workshop/resolver/frame rerun: 29 pass.
- Art catalog and Workshop manifest regenerated; 770 exact candidates / 22
  exclusions verify in normal Chromium. Earlier 767 candidate records are
  unchanged; only three new retained comparisons and the input digest are added.

- Full Chromium suite: 555 pass / 1 skipped / 6 fail. Single-worker rerun clears
  PWA, pinch and underground timing failures. The remaining phone building-review,
  hotel-sign review and Canvas car-driving failures reproduce unchanged on original
  `6667b41f` sources in a scratch baseline build. Their outcomes are recorded in
  `data/authored-assets/compact-browser-suite.log`, `compact-browser-rerun.log`
  and `compact-baseline-browser.log`. No introduced browser failure remains.
  The verified tracked-only scratch checkout was subsequently reused for that
  original-HEAD baseline; retained captures and QA reports remain unchanged.

Inherited compact steering/floor clearance remains unqualified; runtime steering
stays neutral. Source-camera contradictions and exact art review remain open.
Retention/integration are diagnostic delivery, not production art promotion.

Current exact counts and each vehicle's next action live in the owning topic.

### Additional sedan checkpoint

Seven v1 models are retained and integrated through their own registry
entries, radius 80 and authored width. Cabin side slopes and separate UV owners
remove hidden side-glass loss from end views. All seven own source refs are
sampled, including small paint exceptions; normalized four-view alpha is exact
within the fitted family, with each crop's origin delta recorded. The dark
variant has distinct registration. Each has 32 meshes / 1,096 triangles and four
radius-six wheels. Rest/roll floor clearance and source well fit pass the real
GLB probe, including displaced-axle and solid-floor negative checks. Source
projection/roof highlights remain imperfect; nonzero steering stays unqualified.

All seven native 4×2 and novel-angle strips inspected. New retained recipes are
self-contained and final bundles verify with all earlier bytes unchanged. The
actual GPU probe passes all fifteen registered own assets; every sedan draws
3,125 visible native target pixels, resets byte-exactly, preserves simulation and
disposes its resources. All seven gameplay selections and dark failed-load sprite
fallback pass. Workshop verifies 777 candidates / 29 exclusions, adding only the
seven exact sedan identities. Typecheck/lint/build and 33 Python tests pass;
culling expectations now reflect larger sedan bounds, and 68 focused rendering
tests pass. A Git index checkout at
`data/authored-assets/full-vehicle-port/sedan-tracked-001/` verifies all nineteen
bundles, packed scenes and actual GLB rigs, and passes the fifteen-asset GPU probe.
All seven recipes reproduce their eight pinned native/novel hashes (56 exact
frames). The six ordinary color scenes share geometry/UV/hierarchy hash
`d2a3383ebc3552e1f57f4d401e54d0c6a9e7ba7c7744979611cc8a382fd11ca4`;
dark's explicit UV registration has hash
`dea5915338f71884fafe9501317894c2758a63c96c7c922e8bef0219b949d0df`.

Full Chromium: 557 pass / 1 skipped / 13 fail. Rerun clears the seven new review
checks after correcting test display-name casing, and the three existing timing
cases. The same two phone-layout and Canvas driving failures remain from the
original-HEAD baseline above. No introduced failure remains. Full unit rerun:
2,507 pass / 10 skipped; five Windows symlink/SIGKILL failures and one persistence
timeout. The isolated persistence file passes all four tests. Validation logs
are `data/authored-assets/sedan-*.log`; original retained pixels are unchanged.
The batch rebased over remote `323823ab`; regenerated combined-source manifest,
typecheck/build and all 20 vehicle browser checks pass. Pushed as `bbf54c62`.

### Bus checkpoint

Six v1 buses are retained with independent long-body geometry, owned asymmetric
door/window paint and geometric glazing borders. Each has 39 meshes / 1,112
triangles, four radius-eight wheel rigs and explicit A/B mirror differences. All
native 4×2 and novel-angle strips inspected. Side axle error is zero east / one
pixel west. Actual GLB rest/roll main-floor checks pass, including displaced-axle
and solid-floor negative probes. Two separately declared sloped floor ends clear
actual exported tire/hub rotation spheres by at least 5.86058 model units. Nine
roll/steer probe poses leave them fixed; moving a floor end into a wheel is rejected
and exact transforms restore. Whole-body nonzero steering is unqualified, so
gameplay keeps steering neutral. Source roof vent depths and opposing mirrors
cannot both match exactly and remain in the retained paint/config records.

The registry integrates all six own GLBs with radius 112 in game/lab mesh mode.
Actual GPU draw/reset/disposal and simulation-isolation checks pass all 21
registered vehicles; each bus draws 8,565 native target pixels. All 25 retained
bundles verify; 33 Python tests and 74 focused rendering/culling/frame tests pass.
Typecheck passes. Git index checkout `data/authored-assets/full-vehicle-port/bus-tracked-001/`
passes all 25 exact bundles, packed Blender sources, actual wheel/floor and
additional-floor probes, and the 21-asset GPU probe. Six recipes reproduce all
48 native/novel pinned hashes exactly. Workshop verifies 783 candidates / 35
exclusions; earlier 777 candidate records are unchanged. Typecheck/build/lint
pass with 119 existing warnings / 34 infos. Full unit run: 2,515 pass / 10 skipped;
five existing Windows symlink/SIGKILL cases and one loaded-suite Workshop timeout
fail. Isolated Workshop file passes all 13 tests.

Full Chromium: 571 pass / 1 skipped / 7 fail. Rerun clears Canvas driving, pinch
and PWA timing. Two phone review-layout failures remain from the earlier baseline.
Plain GPU driving's zero-movement failure also reproduces on pre-bus `bbf54c62`
in a fresh archive checkout at `bus-baseline-001/`. The allcars driving test now
checks the driver's own ready asset and cached instance travel, instead of the
blue shared wheel object which is no longer its model. Its stable-build rerun passes. An intermediate concurrent root build invalidated
one load result; it is excluded from qualification. No introduced browser failure
remains.
Logs are `data/authored-assets/bus-*.log`; current counts and every vehicle's
next action live in the owning topic.


### Large-car checkpoint

Twenty v1 large cars are retained in three independent A/B/C bodies, with their
own frozen references, clean UV atlas, unused draft/coverage and packed editable
Blender scene. Each has 34 meshes, four radius-six wheel assemblies and two
separately declared tapered floors; A/C have 1,100 triangles and B has 1,096.
All native 4×2 and novel-angle strips inspected. Owned bounded roof/glass/deck
UV regions and separate geometric borders avoid cross-surface window paint.
Localized stripes, skylight and palette exceptions remain source-owned.
Opposing roof highlights and incompatible end-camera depths remain review limits.

A full-body check discovered hood/cabin/wheel crossings in the initial scratch
fits, despite passing main-floor checks. Those fits were never retained. The
final belt/decks/cabin bases are raised to 13, retaining the lower end bumper
height. Actual GLB triangle clipping against exported tire/hub cylinders proves
positive whole-body clearance through every neutral roll angle for all twenty.
Minimum tire gaps are 0.47996 for A/C and 0.28318 for B. Deliberately lowered hood,
displaced axle and solid floor are rejected, with exact reset. Wheel centers fit
native side landmarks within 1.5e-7 pixels. Separate tapered floors clear rotation
spheres by at least 2.39999 A, 0.39999 B and 1.39999 C model units. Nonzero steering
remains unqualified; runtime steering stays neutral.

The own-asset registry uses radius 80 and authored width for all twenty. Actual
shared GPU checks pass all 41 integrations: visible native pixels are 3,407 for A,
2,672 B and 3,055 C, with byte-exact absolute reset,
simulation isolation, lazy-load fallback and resource disposal. All 45 retained
bundles verify; 33 Python tests, typecheck/lint and 78 focused pose/culling/frame
tests pass. Initial full unit run had twenty newly stale culling expectations,
corrected for the larger enclosing mesh radius, plus the five known Windows
symlink/SIGKILL failures. Earlier assets and exact review identities are preserved.
Git index checkout `data/authored-assets/full-vehicle-port/large-tracked-001/`
verifies all 45 retained bundles and 42 constructor/config receipts, audits every
packed Blender atlas/reference, and passes the 41-asset actual GPU probe. All
twenty recipes reproduce their eight native/novel hashes exactly (160 frames).
Workshop verifies 803 candidates / 55 exclusions; all 783 earlier candidate
records and all 25 earlier retained catalog entries are unchanged. Full unit
rerun: 2,519 pass / 10 skipped; five known Windows symlink/SIGKILL cases and a
loaded Workshop timeout remain. Isolated Workshop file passes all 13 tests.
Full Chromium: 595 pass / 1 skipped / 7 fail. Stable rerun clears pinch, reload
and tap/fullscreen timing cases; the two known phone-layout cases and Canvas/plain
GPU driving failures remain from earlier baselines. The PWA static-assets test
was scanning large local authoring trees through an unnecessary HMR watcher;
disabling that watcher clears both launcher tests (2 pass). All twenty gameplay
selections, own GPU loading and failed-load sprite fallback pass. No introduced
browser failure remains. Logs are `data/authored-assets/large-*.log`.


### Final service checkpoint

Orange garbage v1 and raised fire v1 complete all 45 source sets. Orange owns its
paint and side origins (east +4 / west −4); strict alpha registration accepts only
the declared 34-pixel west front-cab exception. Six radii-specific wheels, loader
hinge and amber lens are independent. Raised fire has an extended ladder baked
18 degrees into hinge children, owned raised-source UVs and corrected wheel wells.
Both native 4×2 and novel angles inspected; incompatible roof/camera projections
remain explicit. Equipment stays at its qualified rest pose.

The full-body audit exposed floor intersections in current ambulance v2/police v1.
New v3/v2 clip only the original level floor around actual tires plus .75 margin,
preserving original perimeter and barycentric UVs. All other visible geometry,
atlas, refs and wheel centers are unchanged. Older revisions stay byte-exact.
The four new bundles pin actual-GLB whole-body clearance and intentional body
triangle collision rejection with exact restore. Minimum tire gaps: orange
.9035455, raised .466089, ambulance .608347, police .484894 model units. The general
latest-bank cylinder proof uses declared roll children (compact tire names differ)
and passes **all 45 latest GLBs / 184 wheels**, with 45 deliberate-collision
negative checks. It proves every neutral roll angle, not nonzero steering.

`CarMeshAsset` now validates/discovers every exported roll node and applies its own
radius/axis/rest quaternion. The real-engine before probe caught stationary ML;
after the fix all 45 models / 184 wheels pass forward/reverse/absolute-zero reset,
with fixed body/equipment/pivots. Malformed extra wheel/duplicate regressions pass.
The registry integrates the four remaining source types and selects ambulance v3;
eager loading also reads registry paths. Actual shared GPU probes pass all 45 own
assets with visible pixels, absolute travel/light reset, simulation isolation,
lazy/disabled/unknown fallback and disposal. All 49 bundles, packed Blender images,
actual rigs and source hashes verify. Ordinary rig probes report legacy floors
unqualified separately; the stronger latest-bank cylinder proof supplies that
qualification.

Driver-only persistent controls support ambulance/police/both fire types with
0–5 siren state, and both garbage trucks with silent 0/1 beacons. Style commands
on warning trucks do nothing; wrong drivers/editor mode cannot change state.
Touch/keyboard, binary replicas, save/reload, audio exclusion and colored sprite
fallback share the game/lab paths. Raised-source explicit lab save/restore is
allowed while automatic traffic continues admitting the existing 44 types.

Initial focused suite passes 122 tests and typecheck. Full unit suite: 2,541 pass /
10 skipped / 6 fail (five known Windows symlink/SIGKILL failures plus loaded-suite
Workshop timeout). The isolated Workshop/traffic/resource files pass all 33 tests.
Git index checkout `data/authored-assets/full-vehicle-port/service-tracked-001/`
verifies all 49 exact bundles, packed Blender images, 367 constructor/retainer
hashes and 42 named configuration hashes. Actual rigs, 45-asset shared GPU,
184-wheel engine motion, and 45 latest whole-body cylinder proofs pass from that
checkout. Four final recipes reproduce all 32 native/novel frame hashes exactly.
Named-lens off/A/B/reset probes pass all six light-bearing latest GLBs there.

Workshop verifies 807 candidates / 59 exclusions in normal Chromium at retina
scale. All 45 earlier retained catalog entries and dependency pins are unchanged.
646 earlier candidate records remain exact; 152 nature and five world-geometry
recipe identities deliberately refresh because they include raw collector/traffic
source bytes. Retained art identities and promoted sprite banks remain unchanged;
no human approval is inferred. The static capture server now limits dependency
scanning to its entry HTML and disables HMR watching; ignored authoring trees
cannot stall captures or introduce unrelated HTML import scan errors.

Python's expected inventory still listed only the pre-large 25 revisions;
it is reconciled to all 49. All 33 Python tests pass after that reconciliation. Stable-browser outcomes follow.
