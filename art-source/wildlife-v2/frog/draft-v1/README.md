# Brown common frog draft-v1

Fresh Rana temporaria design and standalone Blender/Pillow authoring. Fixed
40-degree camera above ground,10 world pixels/unit,48 square canvas, anchor24,34,
ortho4.8 and shift10/48. Native idle profile11px/down11/up12; provisional10px
target is not a squash requirement. Natural brown spots, temporal mask, cream
jaw, golden iris and horizontal pupil clusters. No image generation/downloaded
models or recolored animal templates.

45 meshes,92 poses. Full torso/skull/snout/eye geometry stays fixed in frog.blend;
only rigid body vertical motion, fixed-length IK and eye-bulb translation animate.
Four fore toes and five hind toes plus real web panels are saved. Forelimbs have
.25/.25 segments; hindlimbs .35/.37 and sqrt(.20^2+.02^2) tarsus. Eight hop poses
have actual support counts4,4,2,0,0,2,4,4: hind-only push2, flight3/4, fore-first
landing5, hind landing6. Swimming has synchronous posterior foot extension and
recovery with tucked forefeet, fixed .80 water plane and submerged distal feet.
No ground footfalls in swim. Eye action retracts rigid globes .12 into unchanged
skull with closed-lid palette clusters; action0/5 match idle.

`build.py` uses an isolated factory scene; `audit-source.py` opens the saved .blend
in a fresh Blender process. Both use `--python-exit-code 1`. `finish.py` reads
compact actual projected hulls/joints/contacts, stable palette-letter masters,
and integer limb/web composition, never render colors. Head/body relative
anchors are deliberately held stable under subpixel translation; this may differ
from a separately rounded guide by less than one pixel and is recorded stylization.
`audit-output.py` checks decoded palette/alpha/padding,68 full-head/body locomotion
patches, deterministic replay and exact real Chromium pixels. `capture.mjs`
uses bundled full Chromium, two complete6.16s sequences per native/4x setting,
and closes owned browser/server. `review-panels.py` retains all chronological states.

Primary grounding: [Froglife common frog](https://www.froglife.org/info-advice/amphibians-and-reptiles/common-frog-2/)
for brown/olive skin, back spots, temporal mask and horizontal pupil. [Nauwelaerts
and Aerts2006](https://journals.biologists.com/jeb/article/209/1/66/33403/Take-off-and-landing-forces-in-jumping-frogs)
studied propulsion/flight/forelimb landing/recovery in Rana esculenta. [Swimming
anurans2010](https://journals.biologists.com/jeb/article/213/4/621/10128/Kinematics-and-hydrodynamics-analysis-of-swimming)
describes kick/glide and species differences. [Levine et al2004](https://journals.biologists.com/jeb/article/207/8/1361/15071/Contribution-of-eye-retraction-to-swallowing)
measured rigid eye retraction during swallowing in Rana pipiens. These ground
the broad anatomy/mechanics; our blink has no prey and is not a measured common-
frog feeding sequence. No vendor camera angle inferred mathematically.

Rejected development: variable shadowing in initial toe construction shifted
one hip and was caught by unreachable IK. Fore landing/swim extension targets
were corrected with the same segment lengths. Toe radii initially penetrated
ground by .007 units; raised toe centers and slimmer distal tarsus correct actual
minimum without changing lengths. Fore swimming feet initially sat above water;
tucked beneath fixed plane. Drawing01 let near-leg strokes cross the back; exact
sheet/masters/finisher and first browser capture retained in ignored campaign
evidence. Drawing02 places roots under fixed body surfaces, preserving marking
patches while keeping bent limbs visible beyond the silhouette.

See public review-observations.md for actual visual evidence and limits. All
source/output bytes become immutable on exact pending registration. Neither
production-agent integrity nor visual draft judgment is human approval.
