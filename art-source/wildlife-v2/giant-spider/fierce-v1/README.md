# Giant spider fierce-v1

Own editable eight-leg source for tactical 137's five-creature authorization.
Human review is pending. Fixed 40-degree camera, 10 native pixels per Blender
unit, 96px canvas and (48,72) ground anchor. No resizing to fill a canvas.

The 52 meshes include abdomen, carapace, skull, six eyes, separate fangs/jaw and
eight independently keyed three-link legs. Alternating tetrapods support the
moving hips; opposite sides use opposite phases. Fixed link lengths, foot ground
contacts and stance/travel compensation are audited from the saved scene. Body
rise/pitch and head follow move the actual source geometry. The spider-specific
jaw hinge keeps feeding geometry above ground. One idle, twelve walk, eight feed,
eight warning, eight charge and four crouched-rest poses produce 164 four-facing
source poses. Walking stride is 8px per 1.2 seconds; charge is 14px, timed for
48px/s. Every final native palette pixel is retained in masters.json.

The separate den.json integer-vector recipe produces an 80x40 floor web. It is
an ordinary decoration, not Blender body geometry and not an invisible trap.
Registered source and exports are immutable. Replay in an ignored workspace:

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/giant-spider/fierce-v1/build.py -- --workspace data/fierce-137/giant-spider-replay
python art-source/wildlife-v2/giant-spider/fierce-v1/finish.py --workspace data/fierce-137/giant-spider-replay
blender --background data/fierce-137/giant-spider-replay/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/giant-spider/fierce-v1/audit.py -- --workspace data/fierce-137/giant-spider-replay
node art-source/wildlife-v2/giant-spider/fierce-v1/capture.mjs
node scripts/wildlife/check-fierce.mjs
```

Blender 5.2.2 LTS, Python/Pillow. Builds use committed exports only.
