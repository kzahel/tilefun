# Pickup pipeline review

Status: delivered for appearance review, 2026-10-19.
Owner: [Original vehicles](../topics/original-vehicles.md).

The owner accepted the school bus and explicitly requested proceeding directly
with the pickup. The bus integration was committed/pushed as `baa84509` before
this candidate was registered. This checkpoint retains one original teal classic
regular-cab pickup, with framed blue glass, characteristic pixel outlines,
substantial fenders and a real recessed open cargo bed. It remains outside the
runtime catalog pending owner appearance feedback.

## Exact revision and route

GLB SHA-256:
`4eb8b56c808c4ca807ef120caa786ecd29f256b3f43b40d04661cb8573b3b9d7`.
Atlas SHA-256:
`4e306a982593c52551996acca8affa4001c4f2ad2e2b5ad78912235ac26a0102`.
The actual export has **2,984 triangles**, 5,722 UV-split vertices, five meshes/
primitives, one opaque 512² unlit atlas and 207,472 GLB bytes. Four wheels roll
independently with an 8px world radius; fixed body/fenders and cargo bed remain
static. The 51-component editable master uses economical runtime topology and
direct semantic surface paint, rather than a high-to-low transfer claim.

The family has independent geometry and explicit paint owners for the hood,
continuous cab skin/glass, floor, inner walls, rear wheelhouses, cab rear and
tailgate. It does not stretch the Beetle or bus template. Retained final scenes,
atlas/planning paint, portable constructor/configs and source-only replay are under
`art-source/vehicle-bake/pickup/v1/` and `scripts/vehicle-bake/pickup/`. Drafts,
replays, browser/session state and logs remain ignored under `data/vehicle-bake/`.
Normal builds consume retained public assets without Blender.

## Actual-export qualification

YA Codex Sol 6.1/high/bypass workers handle construction and independent QA; the
coordinator inspected all 32 study/game headings separately. Actual GLB neutral-roll
clearance passes at minimum 1.5333348208 world pixels, with a deliberately colliding
body rejected and baseline restored. The family's declared crown region has 25/25
supporting samples per wheel plus controls. These metrics do not replace visual
inspection: near wheels remain seated in real open arches and far crowns stay
beneath integrated fenders in both camera sets and signed phases.

The cargo tub has real depth. Independent rays onto imported fixed-body triangles
reach twelve floor samples at source Z.710 below rail Z1.2775, a .5675-source-unit/
9.86956-world-pixel recess; inner walls, bulkhead and tailgate are also verified.
Both rear obliques show the open floor/ribs and inner walls without a solid upper
deck. Front, side and rear cab glazing remains continuous on actual skin faces.

Source-only replay from retained inputs reproduces byte-identical GLB/atlas;
packed master/low scenes, actual unlit material and embedded atlas verify. The
final 32 study/game frames match the coordinator-inspected draft RGBA pixels exactly.
Independent QA covers signed wheel phases, forward/reverse quarter turns, fixed
pivots/body and absolute reset, two wireframes and camera clipping. Steering,
suspension and opening tailgate remain unqualified and inactive.

Native 224px/radius 112 preserves the existing world-pixel density and unchanged game
projection. Study remains 50° with ground (112,140); game ground is (112,112).
Desktop 1200×1050/mobile 390×844 controls and network-free file:// standalone checks
pass. Native 224px fits; 2×/3× enlargement scrolls inside the card without page overflow.
The actual study/game GIFs each contain 16 headings at 160ms per frame. QA's combined
ledger preserves 3,076 prior source/review/render-tool files byte-for-byte, including
the earlier 2,849-file frozen ledger; both previous root candidate objects remain
unchanged. The root collection contains exactly Beetle, bus and pickup snapshots.

## Review and validation

Exact identity: `projection:original-vehicle-pickup-v1`.
Review: `public/demos/original-vehicles/pickup-v1/index.html`.
Standalone: `data/vehicle-bake/pickup-review.html`.
140 public files and 64 copied public source inputs are pinned. Fresh-clone offline
regeneration uses the frozen-only command in the [family harness](../../scripts/vehicle-bake/family-README.md).
No Blender, ignored baseline or art regeneration is required to view it.

Full Chromium collection navigation passes on desktop/mobile at native 128/224px
sizing with no page errors. All 1,550 candidate identities verify in normal Chromium
at retina scale, and production build, full typechecks and lint pass (119 existing
warnings/35 infos). The lower-concurrency full unit run passes 4,967 tests, with five
known Windows symlink/process-signal failures and ten static-server skips. The
combined production bus/Beetle run passes 14 browser cases; pickup's own full-Chromium
actual-export, mobile/offline and source-replay checks are recorded above.

The staged snapshot verifies 658 retained source/review/runtime hashes, preserves
all 1,549 previous Workshop records and adds only the exact pickup identity. Its
Workshop source digest matches the staged Git blobs across 2,611 input references.
The runtime catalog remains exactly coupe, Beetle and school bus; no pickup model
is copied to the normal runtime directory. Fresh-clone frozen-only regeneration
and corrupted-viewer rejection both pass, preserving the existing offline page.
The retained captured HTML's extra EOF blank line is left byte-exact with its
frozen hash; no completed review file is reformatted to satisfy whitespace style.
The next step is owner appearance review; do not infer approval from these QA
findings or add pickup spawning/road traffic before that decision.
