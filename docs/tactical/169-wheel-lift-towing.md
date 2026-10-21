# Wheel-lift towing

Owner authorized 2026-10-21. Implemented and validated.
New equipment poses await owner inspection.

Deliver one real tow relationship through normal game and embedded engine paths:
back the existing tow truck up to a stopped, unoccupied parked passenger car,
attach its front axle, drive with a raised nose and freely rolling rear wheels,
and release onto checked ground. A following rear axle supplies articulation;
bounded reverse steering stops at the jackknife limit. Both bodies, riders and
contacts commit atomically. Protect occupied cars and reject chains/heavy loads.

Retain an additive wheel-lift equipment revision without rewriting frozen v1
source/review pixels. Measure eligible passenger axles from committed models.
Save relationships by durable traffic identity, replicate runtime links, and
reconcile the same coupled drive step in prediction. Normal editor, traffic and
shared vehicle controls own availability; no lab-only towing controller.

## Delivered

The normal Tow truck (new placements, generated traffic and older records) now
uses v2 equipment. Attach/Release work from the stopped cab or beside the truck.
Twenty-six measured four-wheel models and all fourteen existing paint variants
qualify. Unoccupied parked ownership, distance, heading, clearance, save pressure
and pause checks remain authoritative. Loading lifts the front tires 12px;
rear-axle following articulates the real car through turns and reverse. Towing
cruises at 64px/s (102.4 with the normal boost), reverses at 32px/s and stops
at 70 degrees; the pair stops at blockers without pushing.
Release restores ordinary driving of the same vehicle and identity.

Fitted tire ellipses and unequal front/rear radii keep rear contacts grounded;
actual exported wheel vertices qualify this for every model. Authority and local
prediction use the same coupled step with private prediction copies. Both body
checks and moving passengers commit atomically. Saved reciprocal procedural
identities survive either chunk arrival order; absent partners pause the pair.
Deleting either body releases its partner. Nullable uint32 fields use frame 0x08;
older endpoint tags are rejected, while older save records remain compatible.

The first capture exposed the far axle cradle painting over the bonnet. Truck
and target now share a bounded GPU depth target, including paint readiness and
absolute per-draw reset. Display sampling pins the axle to the sampled hitch.
Cardinal captured fallbacks also keep the pair connected after quantization;
rear wheel phase remains static in sprite mode, as for normal sprite vehicles.
The existing whole-group limitation against external props remains. The thin
lift has no separate player support; target bodies/roof support stay conservative.

## Retained assets and replay

- Packed [tow v2](../../art-source/vehicle-bake/tow-truck/v2/): **3,466 triangles,
  seven meshes, one material/image, 236,536 bytes**. Only 72 triangles are added;
  the v1 body/UVs/atlas and four wheel rigs remain exact. Runtime GLB SHA256:
  `cf77b72b33eb76c7303f88641d5682e379485359dcaac0f113672069a32ae180`.
- Its constructor refuses retained outputs. A fresh workspace reconstructed
  from only its four staged input files reproduces exact GLB/atlas bytes.
  Packed Blender workspace metadata is not claimed byte-reproducible.
- [Fallback v2](../../art-source/vehicle-bake/towing-fallbacks/v2/) captures 40
  original/paint combinations plus two truck poses. Its 68 declared inputs
  include 27 retained mutable-source snapshots (574KB). Fresh input-only replay
  reproduces both PNGs and frame metadata exactly; no ignored art workspace is
  required. Normal builds consume committed runtime copies without Blender.
- The first 192px truck fallback clipped the deployed lift facing down. The
  unpublished v1 capture is kept only as an ignored intermediate. Final v2 uses
  224px truck frames; every alpha edge is clear. A native regression checks all
  frame edges and exact runtime PNG/metadata hashes.
- Current `geometry:wheel-lift-towing-v1` registers the exact shared-engine
  inspection. No v1 receipt/pixel bank or human approval is rewritten.

## Validation

- All three typecheck targets, lint and production build pass. Lint retains
  121 existing warnings / 42 infos and no errors.
- Full native run: **6,530 pass, 12 fail, 10 skip / 6,552 cases**. Five existing
  Windows symlink/process-death cases remain; static-file symlink setup/cleanup
  also reports errors. Seven cases hit their unchanged short deadlines while
  native workers and the manifest build competed. All **311 cases in those four
  files pass** in a serial rerun (203.90s); no deadline/assertion was weakened.
- Native coverage includes all four tow directions, real attach/drive/reverse/
  release, exact reload identities, owner/occupied/pause/distance guards,
  trailer-only obstruction, eviction/relink/deletion, prediction parity without
  replica mutation, uint32 high IDs, nullable hydration/collider reset, fitted
  wheel contacts across 26 models and actual rig/body/UV reset proof.
- Node comparator: one pass (403ms). Browser inventory: 829 browser / one Node /
  three HTTP / six capture cases; all 403 prior audit decisions remain complete.
- Focused full Chromium/Worker boundary: **six passes (43.1s)**, including normal
  Attach/Release, reload, Canvas/GPU switching and forced tow-model failure.
- Actual normal GameClient capture verifies both editor entries, ordinary
  placement and GameServer requests, driving, reopening the saved world and
  release at 390px touch width. Both captures report no page errors and the
  final source hashes match all 56 recorded files.
- Catalog: **706 sheets / 1,396 source uses**. Workshop verifies **1,932 candidate
  identities** in normal retina Chromium (135 explicit compiler exclusions).
- GPU-mesh streaming readiness passes with no fixture failures. This measures
  ordinary world readiness, not an occupied tow pair on a mobile device.
- The first broad browser run was stopped after 105 passing cases to correct
  fallback frame padding. Final v2 coverage spans all **829 unique cases**: 266
  completed cases retained, then 562 pass / one fail in the remaining 563. The
  lone GPU pinch-menu timeout passes unchanged in the final serial six-case
  rerun. No assertion, timeout or browser case was removed.
- Source freshness now includes the new page, candidate, control and retained
  recipe; the interactive fingerprint also includes shared scenario runtime.
  The final metadata build (13.10s) and 24 native guard/rig/towing checks pass.
  All six focused browser cases pass on that exact build, including standalone
  review voting. The broad gameplay run preceded this metadata-only change.
- Capture setup now chooses an empty loaded area rather than a fixed site that
  could be blocked by roaming actors, and waits for reciprocal restored IDs and
  visible controls after reload. Both are capture-fence corrections; normal
  vehicle ownership and placement guards are unchanged.

Ignored local review gallery:
`data/3d-investigation/towing-ready/index.html`. It includes attached/turning,
all backends, reload and normal desktop/phone controls. The reusable
[towing workflow](../vehicle-towing.md) owns commands, limits and authoring.
Next: rear-first dollies or qualified trailers, without widening this machinery
slice into general rigid-body simulation.
