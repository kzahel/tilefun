# Ice cream shop van v1

This original owns its body stations, pastel palette, two independent side UV charts,
wide Boolean-cut serving aperture, five actual inner surface owners, counter ledge,
short opaque striped awning, opposite cone emblem and r0.46 four-wheel envelope.
The serving side is -Y in Blender. Front is -X; ground is Z=0. Export scale is 80/4.6.

The local constructor began with copied delivery-van construction utilities and
wheel/fender primitives. Those definitions are retained inside this family's own
`build.py`; there is no import, source read, geometry dependency or replay fallback
to delivery-van files. The immutable reference constructor was
`scripts/vehicle-bake/delivery-van/build.py`, SHA-256
`e0923c6dc4d730ab34b9b726bfa6162b2b732966c8d13ef889225036cab0678f`.
`evidence/replay-verification.json` lists the exact retained model inputs and
shared QA helpers. The actual fresh isolated model replay needs only the six
listed retained constructor/config files and shared `catalog.py`.

`master.blend` keeps 55 named semantic components, including distinct backwall,
counter-floor, ceiling and two jamb owners. `car.blend` keeps the joined static body
plus four Steer > Roll > wheel meshes. Both pack the actual atlas and an explicitly
unused palette-planning image. This economical component master uses runtime
topology; it does not claim a separate high-poly transfer workflow.

The nominal 4.9 x 2.1 x 2.35 source dimensions describe the body family. Mirrors,
the short fixed awning and rim/fender geometry contribute to measured actual bounds.
All fixed triangles participate in whole-body neutral-roll clearance. Nonzero
steering, suspension, equipment animation and a visible driver remain unqualified.

The parent owns independent QA, review freeze, registry updates, runtime activation,
documentation and global validation. This handoff is agent QA and claims no formal
human approval. Completed v1 source bytes are immutable; further changes need a new
revision.
