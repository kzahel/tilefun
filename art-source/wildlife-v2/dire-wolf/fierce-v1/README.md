# Dire wolf fierce-v1

Own editable canid source under the five-creature authorization in tactical 137.
Human art review is pending. Fixed 40-degree camera, 10 native pixels per Blender
unit, 96px canvas and (48,72) ground anchor. No scaling to fit cells.

The 55 meshes include separate skull and elongated muzzle, pointed ears, shaggy
neck/shoulder ruff, chest, pelvis, four three-link legs, planted paws and eight
rigid tail segments. Body rise, pitch, head follow and moving-hip foot stance
compensation produce the source motion without changing limb lengths.
One idle, twelve walk, eight feed, eight head-raised howl, eight charge and four
rest poses produce 164 four-facing source poses. Walk stride is 14.4 native pixels
per 1.2 seconds; charge is 25.2 pixels, timed for 64px/s. Native palette masters
retain every final pixel. There is no den accessory for this species.

Reproduce in a new ignored workspace, since registered revisions are immutable:

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/dire-wolf/fierce-v1/build.py -- --workspace data/fierce-137/dire-wolf-replay
python art-source/wildlife-v2/dire-wolf/fierce-v1/finish.py --workspace data/fierce-137/dire-wolf-replay
blender --background data/fierce-137/dire-wolf-replay/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/dire-wolf/fierce-v1/audit.py -- --workspace data/fierce-137/dire-wolf-replay
node art-source/wildlife-v2/dire-wolf/fierce-v1/capture.mjs
node scripts/wildlife/check-fierce.mjs
```

Blender 5.2.2 LTS, Python/Pillow. Normal builds use the committed exports.
