# Fire truck wheel alignment

Status: corrected v2 retained for owner inspection; v1 remains immutable.
Updated: 2026-10-11.
Owner: [vehicle model porting](../topics/vehicle-model-porting.md).

The owner identified wheels outside the stowed fire truck's painted wells.
V1's front axle projects about 14 pixels beyond the observed wheel center;
its full-width floor crosses the tires and clips their upper halves. Wheel
tread UVs also sample fender/body pixels. A wheel hierarchy and whole-body IoU
did not catch these defects.

V2 moves front/rear axles to -35.5/+40.5 world pixels and uses radius-10.5
circular grounded tires. The side openings and fender lips use the same axles.
Four real floor openings clear the tires; cap UVs own measured wheel paint,
while tread/hidden caps use explicit palette fill. Diagnostic cameras stay
unchanged. Body detail, roof, ladder and lights retain exact component records.

The reusable refinement starts from tracked v1 and `fire-wheel-fit.json`.
Each outer cap center must project within two native pixels of its measured
east/west source center. Actual GLB verification checks those centers plus
floor/tire intersection, alongside roll/ground/ladder/light contracts.
Steering and raised-ladder clearance remain unqualified.

Retain a new exact v2 GLB, packed scene/atlas, source/recipe/projection records
and 4×2/contour/novel-angle/flash review. Register a new excluded inspection;
preserve all earlier candidates and bundle bytes. Game integration is pending.

The [v2 source bundle](../../art-source/vehicle-models/fire-truck-ladder-1/v2/)
and [4×2](../../public/assets/models/vehicles/review/fire-truck-ladder-1-v2/comparison.png)
retain exact final bytes. Geometry is 49 meshes/1,280 triangles. All four actual
GLB cap centers are 1.3714 native pixels from observed source centers (zero
horizontal error). Rest/roll floor clearance passes; deliberately displacing
the front axle or restoring a solid floor is rejected by the same probe.
All eight retained rigs preserve independent motion, grounding and fixed body;
the fire ladder remains independent and its two light lenses alternate with an
exact off reset. The 23 Python authoring/retention tests pass.

Validation: typechecks, lint, normal build and six relevant Playwright cases
(five retained review revisions plus standalone Workshop) pass. Catalog/manifest
generation verifies 766 candidates. Root unit run: 2,469 pass, five fail and ten
skip; the existing Windows symlink/SIGKILL tests and static-files suite setup
still fail, with no vehicle-related failures. No shared game rendering or
simulation changed; the prior full gameplay-suite limitations remain in 117.

An index-only checkout verifies all eight catalog bundles and packed Blender
scenes, runs all eight real GLB rigs, and builds normally without scratch assets.
V2's four native/four novel PNGs replay byte-for-byte; its refinement reproduces
seven mesh/atlas/rig/paint/fit/audit records byte-for-byte from tracked inputs.
All seven earlier bundle records/dependencies/assets and all 765 earlier candidate
objects remain exact. The installed authoring skill matches the project copy.

Next: owner inspection of wheel placement, then qualify steering/raised ladder
clearance and remaining roof paint before engine integration.
