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
  integrated through the shared registry. Validation and baseline failure triage complete; remote checkpoint follows.

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
