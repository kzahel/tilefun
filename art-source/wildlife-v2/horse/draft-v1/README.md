# Bay horse / fresh draft-v1

Standalone47-mesh editable horse.blend, repeatable build.py and own palette-letter
masters. Geometry01/drawing02. Fixed wildlife-v2 camera40 degrees ABOVE GROUND,
polar50 degrees; accepted facing yaws and10px/unit.80px canvas, ortho8, shift21/80,
constant ground anchor(40,61); visible idle profile37/front38/rear49px.
Own raised neck/long face/pointed ears, fixed mane/blaze, four fixed links including
pastern per leg, solid hooves and five-link hair tail. No scale keys or root travel.
16-pose four-beat lateral walk alternating2/3 supports;8-pose tail swish.

From repository root use complete workspace-relative paths. Blender5.2.2 isolated:
`-b --factory-startup --python-exit-code 1 --python build.py`.
Workspace Python/Pillow: author-masters.py then finish.py.
Fresh-process Blender: `-b horse.blend --python-exit-code 1 --python audit.py`.
Python verify.py --replay; node capture.mjs uses bundled full Chromium and closes
its browser/server; Python verify.py --browser. Compact independently projected
guides retain hulls/bounds/landmarks/contacts; complete geometry is in the blend.
Final art is deliberately authored masters plus integer Pillow composition.

Public outputs: public/demos/wildlife-v2/horse/draft-v1. Its review-observations.md
records specific visual findings, rejected evidence, source/contact/head audits,
actual browser capture and limitations. Draft only; human review pending.
