# 173 — Single-car transporter

Status: implemented and validated locally. Appearance and loading feel await owner inspection.
Owner: [vehicles](../topics/vehicles.md); workflow: [transporter](../vehicle-transporter.md).

The owner explicitly chose a car transporter and authorized the single-car
flatbed scope after investigating existing world ramps. Deliver a new normal
vehicle using retained style, a real loading ramp, secure/release controls,
coupled motion and saves, with controller/touch/keyboard access. Do not replace
the existing Flatbed or Tow truck, fabricate human approvals, or introduce a
private lab simulation. Multi-deck carriers and general trailer physics are later.

## Delivered

- New 2,822-triangle original with six draw groups and one palette atlas;
  packed Blender source and exact runtime outputs retained independently of old art.
- Measured deck/ramp geometry and axle-derived support/pitch through shared driving.
  Aligned cars enter from behind and reverse off after release. The ramp has
  instantaneous stowed/deployed endpoints; the truck cannot drive with it deployed.
- Shared B/Q/touch Actions, A confirm/B back, with the existing Y/E primary boarding.
  Released deck cars take priority beside the truck's rear half; the cab remains
  reachable at the front. Occupancy, clear deployment space and full deck fit gate actions.
- Atomic carrier/load contacts and roof-passenger checks; loaded tires do not roll.
  Existing car paints/identities stay exact. Reciprocal durable records resolve
  either arrival order; nullable uint32 replica fields use frame tag 0x09.
- One shared GPU depth group and real cardinal ramp captures for Canvas/pending/
  failed-mesh fallback. Upright slope fallback and conservative upright collision
  envelopes remain explicit limits; no full suspension or shared-world-depth claim.
- Workshop fixture, exact candidate registration, ordinary editor/traffic catalog
  and main-game request/persistence qualification. No human approval is synthesized.

## Evidence

Ignored logs and captures live under `data/vehicle-bake/transporter-*` and
`data/3d-investigation/car-transporter/`. Thirty-one native scenario cases cover the
cycle, prediction without replica mutation, drive/stow/occupied-load locks,
deployment obstruction, loaded-car overhead contact, pending links in both chunk
orders, uint32 nullable wire clearing and all 26 eligible models with paint saves.
Decoded GLB checks cover ramp endpoints/reset, four independently rolling tires,
fixed chassis and complete sprite-frame bounds. Whole-wheel-cylinder clearance
and the deliberate intersecting-body control pass. Fresh capture replay reproduces
all 34 retained PNGs exactly from fourteen declared inputs.

The focused browser cases exercise the real Worker playground and the normal
GameClient/editor/server request/save path, including sprite/backend replacement,
failed GLB and 390px touch controls. Final source hashes match the qualified
production build after these checks.

Qualification on 2026-10-21:

- Full production browser suite: **832/832 passed**. After the final layer and
  wheel-phase corrections, the rebuilt normal-game, Worker playground and native
  standalone review boundaries passed **3/3** again.
- Final focused native checks: **107/107 passed**, covering transporter scenarios,
  wheel pose, towing, generated crossings, garage geometry and the decoded rig.
  Bridge/garage cars at unrelated heights cannot become cargo; secured wheels
  retain their phase and resume after release.
- Broad native run: 6,650 cases, 6,634 passed, six failed and ten skipped. The
  introduced original-vehicle coverage expectation was fixed and the affected
  378 checks passed. Five Windows symlink/SQLite process-death failures and
  static-file symlink setup/cleanup errors remain; the broad native run is not green.
- All three typecheck targets, lint, production build and test inventory passed.
  Lint retains 121 warnings and 42 informational diagnostics. Inventory: 832
  browser, one Node integration, three HTTP and six capture cases.
- Final catalog: 716 sheets / 1,398 source uses. Workshop manifest: 1,965
  identities / 136 exclusions. Unpublished v1 runtime prototypes were moved out
  of public inputs before these final inventories and build.
- Streaming readiness: six final samples, no errors or assertion failures.
- Fresh retained v2 replay reproduces constructor model/atlas and all 34 PNGs
  exactly. No existing retained asset bank was regenerated.

Final inspection gallery: `data/3d-investigation/car-transporter/index.html`, with
production browser captures and their hash receipt in `snapshot.json`. Deployment
and human appearance approval remain outside this local validation record.

## Next

Owner playtest of deck alignment, loading pitch and endpoint appearance, then
decide whether deployment animation or multiple loading positions is worthwhile.
