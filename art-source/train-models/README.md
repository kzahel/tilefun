# Retained train models

Blue v3 is the current inspection prototype with three independent carriage GLBs and
packed Blender/texture bundles. The live game continues using its native train
sprites. [Train topic](../../docs/topics/trains.md) owns the moving-art review gate;
[127](../../docs/tactical/127-authored-blue-train.md) records this prototype.

Commit the exact finished GLBs under `public/assets/models/trains/`, every packed
`.blend`, clean atlas, own unused projection/coverage, frozen reference, source
camera recipe, mesh/rig/paint contract and validation receipt under this directory,
and every pinned constructor/configuration dependency in the catalog. Scripts
alone cannot replace the final scenes. Normal builds consume committed assets;
working fits, raw renders and scratch probes stay in ignored `data/authored-assets/`.

`catalog.json` pins all source/export/review bytes and required source inputs.
`verify_train_bundles.py` checks embedded textures, all eight wheels per carriage,
actual declared axle positions and wheel-to-bogie hierarchy. Run the packed-source
Blender audit, shared-engine motion probe and exact retained-recipe replay from a
tracked-only checkout. Preserve all existing revisions: new pixels or geometry
need a new source/export/review revision, including new versioned constructors
when an earlier retained catalog pins their source bytes.

Blue v1 retains static bogies/couplers and eight inferred wheels beneath each
opaque native skirt. Neutral wheel rotation clears the entire fixed body; bogie
yaw and coupler animation remain unqualified. Native side/end drawings have
incompatible lengths. Per-carriage matched cameras support source inspection;
actual fixed gameplay projection and unchanged service spacing are shown in the
retained loop/reversal GIFs. Do not change live train spacing/support or add
heading-dependent gameplay lenses to hide those gaps/overlaps.

Original art: Modern Exteriors by LimeZu. See [credits](../../public/assets/SOURCES.md).

V1 remains archived. V3 preserves its paint/UVs while raising the roof to native
44-unit support and moving inferred wheels to the straight ±10 rail gauge.
Interactive fixtures use current v3; old comparisons/GIFs remain exact historical
evidence. Bogie yaw and coupling on curves remain at rest and unqualified.
