# Griffin fierce-v1

Own editable eagle/lion anatomy under tactical 137's five-creature authorization.
Pending human art review. Fixed 40-degree camera, 10 native pixels per Blender
unit, 128px canvas and (64,96) ground anchor. Native pixels are never resized to fit.

The 83 meshes include a hooked eagle beak, white head/neck, feathered articulated
wings, lion chest/pelvis, front talons, rear paws, four fixed three-link legs and
seven tail segments. Body rise and pitch move hips while stance compensation
keeps planted feet fixed. Head follow and independent wing beats remain source
geometry. One idle, twelve walk, eight feed, eight display, eight charge, four
rest and eight flight poses produce 196 four-facing source poses. Walk stride
is 14.4px per 1.2 seconds; charge stride is 25.2px, timed for 80px/s. Native palette
masters retain every final pixel. The integer-vector den.json rock recipe
produces the independent 64x56 perch accessory. It is not Blender body geometry.

Registered sources and exports are immutable. Replay in an ignored workspace:

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/griffin/fierce-v1/build.py -- --workspace data/fierce-137/griffin-replay
python art-source/wildlife-v2/griffin/fierce-v1/finish.py --workspace data/fierce-137/griffin-replay
blender --background data/fierce-137/griffin-replay/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/griffin/fierce-v1/audit.py -- --workspace data/fierce-137/griffin-replay
node art-source/wildlife-v2/griffin/fierce-v1/capture.mjs
node scripts/wildlife/check-fierce.mjs
```

Blender 5.2.2 LTS, Python/Pillow. Builds consume committed exports only.
