# Pointed-ear shepherd draft-v1

Authorized by tactical 084. Natural quadruped draft; human approval pending.
The retained animal.blend is editable, with source-driven torso weight transfer,
moving-hip limb solves, world-grounded soles and stabilized fixed-volume skull.
masters.json is the authored four-facing idle/walk/action pixel source.
provenance.json identifies the retained base anatomy and motion contract.

Rebuild (never overwrite this identity after review registration):

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/pets/build.py -- dog-shepherd
python art-source/wildlife-v2/pets/finish.py dog-shepherd
blender --background --factory-startup art-source/wildlife-v2/dog-shepherd/draft-v1/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/pets/audit.py -- dog-shepherd
```

The builder regenerates ignored evaluated guides; --render-guides also exports
Blender studies. Shared scripts read the immutable original anatomy but never
write those sources or old receipts. New breeds/coats remain explicitly bounded
by pet-batch.json. Native pixels, pending review artifacts and exact source
hashes are retained; large QA panels/captures stay in ignored local evidence.

Animation timing: idle/action 160ms, walk 80ms; physical preview travel is
6px per walk cycle. Gameplay flee doubles speed
and halves walk timing without inventing a new gait. Original pets stay unchanged.
