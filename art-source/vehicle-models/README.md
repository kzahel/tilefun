# Retained compact-car models

These are the exact final assets from the Blender authoring work. They are tracked
deliverables; older intermediate models and scratch galleries remain ignored.

| Vehicle | Blender/texture/source bundle | Self-contained runtime GLB |
| --- | --- | --- |
| Blue `compact-1` | [v7](compact-1/v7/) | [compact-1-v7.glb](../../public/assets/models/vehicles/compact-1-v7.glb) |
| Green `compact-2` | [v7](compact-2/v7/) | [compact-2-v7.glb](../../public/assets/models/vehicles/compact-2-v7.glb) |
| Red `compact-4` | [v1](compact-4/v1/) | [compact-4-v1.glb](../../public/assets/models/vehicles/compact-4-v1.glb) |

Each source bundle contains the original packed `.blend`, exact cleaned atlas,
frozen directional crops, portable evaluation recipe, windshield geometry and
rig metadata. Blue/green include the captured top-ink configuration; red also
retains its raw projection, uncertainty mask/record and palette-transfer record.
The `.blend`, atlas, GLB, crop and captured geometry/configuration bytes were
copied unchanged after checking the original inspection receipts. Recipe wrappers
only update paths to tracked, portable dependencies. `catalog.json` records SHA-256
pins, capture identities and the expected native/novel rendered-image hashes.

All models have 55 meshes, 842 triangles and four separate steer/roll tire+hub
assemblies. Units are world pixels, Blender up is +Z and forward is -X, with
tire contacts on Z=0. GLBs use Blender's +Y-up export conversion. The GLB embeds
the cleaned atlas; Blender scenes pack their textures, including retained unused
projection images. Inherited draft paint does not establish observation coverage.

These remain authored diagnostic assets. Retention does not promote gameplay
art or grant a new human approval. Internal window ink is atlas paint; the outer
pixel outline still requires a renderer pass. The game has not yet connected its
diagnostic `CarMeshAsset` to these GLBs. Wheel steering clearance remains open.

From the repository root:

```text
python scripts/authored-assets/verify_bundles.py
node scripts/authored-assets/verify_wheel_rig.mjs data/authored-assets/NEW_RIG_CHECK --bundles
python scripts/authored-assets/author_variant.py --vehicle compact-4 --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_VARIANT
python scripts/authored-assets/pipeline.py evaluate --recipe art-source/vehicle-models/compact-4/v1/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_RED_INSPECTION
```

The default palette replay depends entirely on tracked files. Replaying is optional
for consuming the exact finished assets; normal builds do not run Blender. Write
new work into fresh ignored workspaces. Do not overwrite these final revisions.
The older construction examples in the authoring workflow document historical
intermediate scenes; they are not required to consume or replay these bundles.

Original vehicle art is Modern Exteriors by LimeZu. See
[asset credits](../../public/assets/SOURCES.md), the
[authoring workflow](../../scripts/authored-assets/README.md) and
[retention record](../../docs/tactical/106-retained-vehicle-model-bundles.md).
