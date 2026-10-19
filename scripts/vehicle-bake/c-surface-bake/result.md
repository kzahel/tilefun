# C surface-bake / red coupe

Completed and frozen: **v3**, red coupe only. Exact GLB SHA-256:
`6472c1747744b3051bdf58d0f5b1f39e8ebd2cb86538fab89b4c1150255eac19`.
V1 and v2 remain retained drafts. No production approval, registration or broader
vehicle-family work is implied. Do not overwrite v3; use a new revision.

The route is a real high-to-low surface transfer. It rasterizes the low mesh UVs,
casts normal rays into the retained high source owner triangles, and barycentrically
samples high-surface semantic paint. It does not project finished screen drawings
onto the low mesh or redraw interior pixels after rendering.

The source finish is authored: discrete red ramps, dark glass aperture borders,
blue bands, widened source-curve hood/door seams, and three simplified slats are
paint on high surfaces before transfer. Raw transfer, source ownership, ambiguity,
fallback, and exact-palette cleanup are retained separately in each source bundle.

Final asset: `public/demos/vehicle-bake/c-surface-bake/v3/model.glb`.
Editable packed source: `art-source/vehicle-bake/c-surface-bake/v3/car.blend`.
The same source bundle contains frozen recipe scripts, high-source surface paint,
raw/clean atlas, ownership/uncertainty images, actual high/low/GLB 512px captures,
shared clearance and byte-identical replay receipts. `FROZEN.json` pins every file.
The public candidate includes report.json, atlas.png, eight Blender low renders,
eight actual GLB renders, comparison.png, high-to-low.png, transfer-evidence.png,
native and 4x sheets, intermediate/roll sheet, and turntable.gif.

Actual export: **2,597 triangles, 6,425 vertices, five meshes/primitives/draws,
one material, one opaque 512x512 nearest-sampled atlas**. GLB is 246,904 bytes;
standalone atlas is 18,865 bytes. Uniform world scale is `80/4.6`. All four wheel
assemblies use the required independent Steer > Roll > TireHub hierarchy, world
wheel radius 5.913043478260871, roll axis [0,0,-1] and steer axis [0,1,0].
Only front steer flags are enabled; steering remains neutral and unqualified.

Blender 5.2's emission export initially produced PBR+emissive despite the material
name. The recipe now explicitly preserves its embedded atlas as baseColorTexture,
sets white base color, removes emissive texture/factor, and declares actual
KHR_materials_unlit. The actual final GLB JSON and no-light full Chromium Three.js
render both confirm a single nearest-textured MeshBasicMaterial. This correction
is part of the frozen recipe, not a viewer workaround.

The source master starts at 71,390 triangles. Simple subdivision increases the
painted high source to 356,414 triangles without smoothing its shape. This is
necessary because original high vertex spacing across the broad hood is too
coarse to carry narrow painted seams: v1 showed broken hood dots. The low body
retains the source's coherent coachwork and open wheel pockets; glass/roof/trim
are reduced source surfaces. New economical wheel shells receive genuine high
tire, spoke, rim and hub paint through the same surface transfer. High meshes
remain in the editable source only and are absent from the GLB.

The bake covers 148,860 atlas texels (56.7856% occupancy): 148,711 normal-ray hits,
149 nearest-surface fallbacks, zero unknowns. There are 14,344 conservative
opposing-ray ambiguity flags. These flag distinct triangle hits whose distances
differ by more than 0.025 source units; they do **not** claim conflicting target
colors. Owner restriction excludes unrelated high geometry. Closest accepted
high surface wins; unresolved alternatives remain purple in uncertainty.png.
Palette cleanup changes 22,100 covered texels to exact palette colors, then adds
four rounds of atlas padding. These operations are explicit in transfer.json.
The unoccupied 113,284 texels are padding/background, not failed visible coverage.

Every high semantic color is authored, including hidden/underside paint. The ray
hit rate measures geometric transfer coverage; it does not measure automatic
recovery of finished target pixels. No target-image projection/fusion occurs,
so there is no hidden target-view conflict resolution. Chosen target sprites
are retained reference hashes and visual comparisons. This is a genuine
surface bake of deliberately reauthored source style, rather than a raw PBR
shading bake. Interior pixels are never redrawn on the 128px output. The only
render finishing is nearest reduction, fixed (0,+28) translation, binary alpha
and an alpha-only exterior boundary.

Coordinator's unchanged `scripts/vehicle-bake/clearance.py` passes v3 and rejects
the deliberate colliding-body control. Minimum full-cylinder gaps in exported
world units are FL 1.083951, FR 1.094661, RL 0.652259 and RR 0.639431. V1/v2
failed at the source rear buttress trim. A more precise tire-shoulder envelope
could pass those drafts, but that is not used as acceptance: v3 raises only the
trailing low buttress vertices below source z=0.71 to that height (at most about
0.083 units), then rebakes. The shared conservative verifier remains unchanged.

Own visual inspection covers all eight Blender/actual-GLB headings at native
and 4x, front/rear views, 22.5/67.5/112.5/157.5-degree headings, and four 90-degree
wheel-roll states. The actual painted high source owners were rendered in eight
matching views too. I inspected the coupe silhouette, window borders/bands,
hood/door marks, lamps, three continuous source slats, wheels and obvious UV
artifacts. The coordinator separately reports 16 authoring and 16 game-heading
actual GLB captures plus independent cylinder proof. A fresh background Blender
replay from the frozen recipe scripts produced **byte-identical GLB and atlas**;
it reads retained 141 inputs and does not read ignored data.

Limits remain: target view-relative reflections and richer red clusters are
approximated by fixed source paint; coordinator comparison finds route A closer
to the chosen target. Thin ink/slats still alias or merge at some intermediate
native headings. Fallback/ambiguity are recorded rather than silently called
observed paint. Exported vertex overhead is high because of UV/flat-normal splits.
The pipeline is replayable for this coupe, but does not establish geometry,
semantic roles or style quality for another vehicle family.

Replay from repository root, with a new revision name:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python art-source/vehicle-bake/c-surface-bake/v3/recipe-scripts/build.py -- --revision NEW_REV
node scripts/vehicle-bake/c-surface-bake/capture.mjs NEW_REV
python scripts/vehicle-bake/c-surface-bake/finish.py NEW_REV
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/c-surface-bake/inspect_source.py -- NEW_REV
```

Shared harness issues: none remain blocking. Coordinator owns registration/docs,
shared game review and choosing the winning red-car route. Next logical step is
owner comparison of the frozen red-car candidates before any family expansion.
No broad npm checks, shared-file edits, commits, branches or subagents were used.
