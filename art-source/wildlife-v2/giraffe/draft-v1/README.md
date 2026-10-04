# Giraffe fresh source

Standalone local blender-game-assets and blender-animation workflows. No downloaded
model, image generation, v1 art or previous animal construction was used.

`build.py` produces the isolated editable giraffe.blend, 35 rigid anatomical
meshes, keyed three-link legs/tail/ears, 100 actual compact projected pose guides
and 100 renders. Camera comes unchanged from ../../camera.json. Canvas144,
ortho14.4, shiftY48/144, fixed ground anchor72,120; no pixel sprite scaling.
`audit.py` loads that saved source in a fresh process to check geometry/topology
hashes, scales, actual bounds, contacts, limb lengths and computed footfall order.

`author_masters.py` records deliberate integer polygon contours and broad patch
clusters as readable palette-letter masters. `finish.py` reads those letters
and independent guide positions to compose the sheet, contact/strips/GIFs and
actual vendor scenery beside approved Explorer. Limbs and tail are authored
integer ribbons; ears use guide hulls with deliberate palette/inner finishing,
frozen as full patches when orientation is unchanged. This is authored pixel art,
not palette sampling of the model render. Guide geometry establishes provenance,
not quality. The full geometry stays in the .blend; guide records retain only
actual hulls/bounds/depths/counts and landmarks/contact positions.

Use Blender5.2.2 CLI with factory startup and --python-exit-code1. The finisher,
review panels and verifier use workspace-local data/wildlife-tools/python/python.exe.
`capture.mjs` owns an isolated ephemeral HTTP server and bundled normal Chromium,
records two sequences at each CSS scale and closes both in finally.
`verify.py` checks deterministic finishing, decoded alpha/palette/padding/GIF
duration, stable walk-head interiors and actual Chromium scene pixel parity.
See public review-observations.md and local background-01-worker command logs
for precise visual findings, rejected iterations and execution evidence.

Full articulated Blender source is retained for sprite editing. No deforming
engine skeleton/GLB, gameplay integration, promotion or publication is supplied.
