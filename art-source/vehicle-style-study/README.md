# Original sports-car experiment sources

Four independent, offline authoring studies from [tactical 141](../../docs/tactical/141-sports-car-style-experiments.md).
These editable Blender scenes are original authored sources, not runtime models
or approved art. Each exact scene is retained by `scripts/vehicle-style-study/assemble.py`;
the gallery manifest pins its SHA-256. That assembler refuses to replace a
different retained scene. Make a new revision for subsequent authoring.

Builders and finishers live under `scripts/vehicle-style-study/ROUTE/`.
Review pixels, raw renders, reports and turntables are retained under
`public/demos/vehicle-style-study/ROUTE/`. Normal builds consume those files;
Blender rendering is an explicit offline operation.

The comparison can also be packaged as a standalone HTML file by running
`python scripts/vehicle-style-study/assemble.py` after all routes finish.
It writes `data/vehicle-style-study/standalone.html`, embedding its images and
reports for viewing without a server. This generated convenience file is local;
all inputs and the exact gallery assets are retained separately.
