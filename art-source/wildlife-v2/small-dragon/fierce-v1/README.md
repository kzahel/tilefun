# Small dragon fierce-v1

Own editable winged quadruped for the five-creature authorization in tactical
137. Human review is pending. Fixed 40-degree camera, 10 native pixels per Blender
unit, 128px canvas and (64,96) ground anchor; no resizing to fit its cell.

The 71-mesh source includes a horned skull, snout, hinged jaw/teeth, four moving-hip
three-link legs, planted feet, chest/pelvis, ten-segment tail, hinged bat-wing
membranes/fingers and three keyed breath puffs. All animal volumes and limb
lengths stay fixed. Smoke visibility is separately keyed and audited. Body rise,
pitch, head follow and stance compensation drive the actual source motion.

One idle, twelve walk, eight feed, eight smoky display, eight charge, four
crouched-rest and eight wingbeat poses give 196 four-facing source/drawing poses.
Walk travel is 12px per 1.2-second cycle; charge travel is 21px, timed for 58px/s.
The ten-color native palette masters retain every final pixel. Sleep lowers the
body/head, folds the wings back and curves the tail. Flight poses are retained
for the shared aerial behavior; this release's hunting is grounded.

`den.json` is a separate authored integer-vector recipe for the small chest,
coins and gems. The finisher reproduces its native `den.png` and includes it in
the review scenery. It is a code-authored accessory, not part of the Blender
body/limb audit. In gameplay it is an ordinary durable, independently placeable
prop. The source/body and accessory are both pinned by the pending receipt.

Registered revisions are immutable. Replay in a fresh ignored workspace:

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/small-dragon/fierce-v1/build.py -- --workspace data/fierce-137/small-dragon-replay
python art-source/wildlife-v2/small-dragon/fierce-v1/finish.py --workspace data/fierce-137/small-dragon-replay
blender --background data/fierce-137/small-dragon-replay/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/small-dragon/fierce-v1/audit.py -- --workspace data/fierce-137/small-dragon-replay
node art-source/wildlife-v2/small-dragon/fierce-v1/capture.mjs
node scripts/wildlife/check-fierce.mjs
```

Captured with Blender 5.2.2 LTS, Python and Pillow. Builds use committed exports.
This is rigid-volume pixel authoring, not a runtime skinned model. Source
integrity, gameplay readiness and human art approval remain separate.
