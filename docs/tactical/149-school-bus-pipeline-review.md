# School bus pipeline review

Status: exact candidate delivered for owner appearance review, 2026-10-19.
Owner: [Original vehicles](../topics/original-vehicles.md).

After accepting the Beetle, the owner requested its commit/gameplay delivery and
then the next vehicle. [148](148-beetle-gameplay.md) is committed and pushed as
`7b5e1851`; this checkpoint authors the next queued yellow school bus. Gameplay
activation of the bus follows a separate appearance decision.

Two YA Codex Sol 6.1/high/bypass workers split family geometry/UV authoring and
independent actual-export QA/review tooling. A long rounded body, short hood,
repeated framed blue windows, dark stripes, asymmetric passenger door and real
open wheel arches should read as a school bus at native game pixels. Aim for
2,500–4,000 exported triangles, one compact opaque unlit atlas and five draw
groups (body plus four independent wheel assemblies).

The bus needs more transparent capture area than a car. Extend the reusable
preview to 224px with a 112-world-pixel game projection radius, preserving one
world pixel per image pixel and a centered ground origin. Expand the study
viewport proportionally while keeping its pixel density, fixed elevation and
28px vertical registration. Do not shrink the model or fit a heading-dependent
camera. Previous frozen pages stay byte-identical; new tools must reproduce the
Beetle's 128px pixels and centered game crops under the larger viewport.

Retain own family config, semantic UV ownership, packed editable scenes, exact
model/atlas, source-only replay and final proof receipts. Inspect 16 headings in
both cameras plus signed wheel phases, own whole-body clearance/negative control,
ground contact and explicit crown support. Continuous frames and side-owned door
paint must survive every angle. Final preview includes native/enlarged captures,
turntables and a self-contained offline page. Drafts and caches remain ignored.

## Evidence and next step

Final GLB SHA-256:
`4b71cb259c5226af9657fe624585354ad66c41b3b66c5a2a2cf25ba61d3df42f`.
Actual export: 2,564 triangles, 4,986 UV-split vertices, five mesh/primitives, one
opaque unlit 512² atlas and 182,232 GLB bytes. Actual imported bounds are
121.2174×42.7826×43.1304 world pixels, including mirrors. No model shrinking,
height fitting or per-heading camera changes are used.

The original family has separate body/hood charts, rounded roof, repeated framed
blue windows, dark rub rails, a passenger-side folding door and opposite driver
pane/static folded plate. Paint is directly authored semantic UV surface paint;
the 40-component editable master uses economical topology. This is not an
automatic high-to-low transfer claim. Both packed scenes, atlas/planning paint,
source/config/replay and explicit hidden-surface ownership are retained under
`art-source/vehicle-bake/school-bus/v1/` and `scripts/vehicle-bake/school-bus/`.

All neutral roll angles clear the actual fixed-body triangles by at least
1.44850 world units; the deliberate collision control is rejected and the
baseline restored. Own declared crown support passes 25/25 samples for each
wheel with positive/negative controls. Coordinator and independent QA inspect
all 32 study/game headings plus signed phases separately: coherent shape and
glass/stripes, door asymmetry, seated near wheels and covered far tire crowns.
All 50 final captured frames match the inspected draft pixels exactly. Source-only
replay produces byte-identical GLB/atlas; packed textures, actual unlit material
and ground contact verify. All 2,849 previous frozen files remain unchanged.

The reusable viewer/capture/assembly now accepts a larger native viewport while
preserving fixed projection and pixel density. All 32 frozen Beetle frames remain
byte-identical through default 128 rendering, and all 32 centered crops from its
224 render match, including the outline. Bus 224-versus-128 game crop interiors
match at all 16 headings, excluding only the one-pixel clipping boundary of the
too-small viewport. Native cards remain 128/224 CSS pixels; enlarged views scroll
inside their cards on a 390px phone layout.

The frozen review is `public/demos/original-vehicles/school-bus-v1/index.html`;
the network-free standalone is `data/vehicle-bake/school-bus-review.html`.
132 public files and 129 embedded assets are pinned. The exact review identity
is `projection:original-vehicle-school-bus-v1`; the existing Beetle candidate
object remains unchanged. The collection page at
`public/demos/original-vehicles/index.html` opens both snapshots at native scale.

The new safe `family-package.py CONFIG offline` command rebuilds only the ignored
standalone HTML from frozen committed public files, after verifying all pins.
Fresh-clone use needs no ignored baseline, Blender, art regeneration or refreeze;
corrupted frozen JS is rejected before writing the offline destination. See the
[harness guide](../../scripts/vehicle-bake/family-README.md).

Typechecks, lint, actual full-Chromium desktop/mobile/offline checks, pixel
regressions and two-candidate collection navigation pass. Workshop generation
verifies 1,424 exact identities at retina scale. Final build/unit/browser results
follow below. The bus is an appearance candidate only; gameplay activation and
the next pickup family follow owner feedback.

Production build passes. The complete unit run passes 4,544 tests with the five
known Windows symlink/process-signal failures and ten static-server skips.
Seven Beetle game/lab cases pass again, including normal/failed model paths,
mobile driving/reload and rolling turns. The broader focused Workshop run passes
twelve cases and reports three failures while the separate primate work changes
the live source digest: standalone correctly reports a stale manifest, and two
feedback/pin scenarios fail in that mixed live-source window. This is not a clean
full-Workshop pass. The bus's independent actual-export/mobile/offline proofs and
two-candidate gallery check pass against the exact retained files.

The generic runtime consumer now accepts the bus's explicit retained-input hash
map. Its original Beetle entry point is kept byte-identical because the accepted
runtime receipt pins that exporter. A versioned v2 entry point verifies both
receipt layouts and rejects a missing role or corrupted builder hash. Five Python
regressions and two isolated real export runs pass: Beetle GLB/sprite/provenance
are byte-identical through the legacy route; bus GLB and 224px fallback packing
pass through v2 with measured 122×43×44 bounds. These bus runtime outputs are only
under ignored data, and the normal catalog remains the two accepted originals.

The delivery snapshot is checked independently of concurrent working edits:
all 427 staged source/review/runtime dependency hashes pass, HEAD's 1,423 review
records remain identical and only the school-bus identity is added. Recomputing
the Workshop input digest from Git blobs matches both HEAD and the staged
manifest exactly (2,389 staged input references). The staged snapshot is current;
the live working tree intentionally includes separate uncommitted primate work.
The fail-fast full-browser attempt stops on that animal-browser registry/build
mismatch (140 expected/138 present), with one interrupted and 1,146 unrun cases.
No clean whole-suite browser result is claimed. Bus/Beetle asset, rendering,
pixel-regression, navigation and versioned export checks remain separate passes.
Extracting the four declared bus recipe files plus AGENTS/catalog from staged
blobs also reproduces the exact GLB and atlas in a clean scratch root. No ignored
authoring input is needed.
