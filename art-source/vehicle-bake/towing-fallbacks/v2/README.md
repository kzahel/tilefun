# Towing cardinal fallbacks v2

Exact native-pixel captures of all 26 qualified passenger models (40 original/
paint combinations) with the front axle lifted, plus stowed/deployed tow-truck v2.
`frames.json` preserves cardinal order and ground-center anchors. Car frames are
160px; truck frames are 224px so the deployed cradle fits every heading.
The unpublished 192px capture clipped the down-facing lift and stays ignored.

`recipe.json` pins input/output hashes. `inputs/` retains mutable construction
dependencies at their original relative paths; immutable public model/paint inputs
already live at their declared paths. Do not format or overwrite frozen inputs.
Replay with `node scripts/vehicle-bake/replay-towing-fallbacks.mjs` from the root.
This bank supplies gameplay fallbacks, not a synthesized human appearance approval.
