# T. rex fierce-v1

Own editable biped anatomy for the five-creature authorization in tactical 137.
Human review is pending. The fixed wildlife camera is 40 degrees above ground,
10 native pixels per Blender unit. A 160px canvas and (80,120) ground anchor leave
room for the long balancing tail; the animal is never resized to fit its cell.

The saved scene retains 62 rigid meshes: broad skull and snout, hinged lower jaw,
teeth, eyes, tiny two-finger arms, chest/pelvis, two moving-hip three-link hind
legs, planted feet/toes, dorsal ridges and ten tail segments. Body rise, pitch and
head follow drive actual source poses; the leg solve compensates planted feet.
Walk travel is 14.4px per 1.2-second cycle. Charge travel is 43.2px per cycle,
timed for 88px/s. One idle, twelve walk, eight feed, eight display/roar, eight
charge and four crouched-rest poses make 164 four-facing source/drawing poses.

Integer projected silhouettes, broad palette bands and nine retained colors
produce the native frames. `masters.json` records every final pixel as palette
letters. No color quantization, whole-frame bounce or resized animal is used.
The saved-source audit independently checks mesh identity, fixed link lengths,
planted ground contacts/travel, camera projection and native body/head motion.

Registered revisions are immutable. Reproduce in a fresh ignored workspace:

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/t-rex/fierce-v1/build.py -- --workspace data/fierce-137/t-rex-replay
python art-source/wildlife-v2/t-rex/fierce-v1/finish.py --workspace data/fierce-137/t-rex-replay
blender --background data/fierce-137/t-rex-replay/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/t-rex/fierce-v1/audit.py -- --workspace data/fierce-137/t-rex-replay
node art-source/wildlife-v2/t-rex/fierce-v1/capture.mjs
node scripts/wildlife/check-fierce.mjs
```

The captured toolchain is Blender 5.2.2 LTS, Python and Pillow. Normal builds use
committed exports. The source is editable rigid-volume animation, not a runtime
skinned model. Public observations record native inspection and limits; source
integrity, gameplay readiness and human art approval are distinct.
