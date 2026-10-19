# 04-simple-painted — execution record

Status: complete, 2026-10-19. Final pixels frozen for coordinator registration.

Read AGENTS.md, art-review and 3d-assets topics, the common sports-car output
contract and character finishing reference. This is an original offline candidate;
the coordinator owns registration, documentation and shared validation.

Plan: a tapered sectional body, actual open curved wheel wells, swept glazed
canopy and four independent wheel assemblies. Use source-sampled palette roles,
flat unlit paint and geometric internal ink, then one common native finishing
pass. Background Blender only, four render threads, bounded CPU samples.

Delivered **Rosso Sprint**: 1,710 evaluated/exported triangles, five meshes
(974-triangle static body plus four 184-triangle wheels), 1,398 vertices.
The self-contained GLB is 106,100 bytes, with 15 unlit materials and 30 material
primitives. Paint uses 16 shared RGB roles, all sampled exactly from the four
existing compact-4 references; no downloaded model, texture atlas or supplemental
palette colors. Static components remain editable mesh faces with role materials;
four wheel objects have local-Y axle origins, radius/contact metadata and a common
root. Width including tire sides is 2.002; roof height is 1.05; small lamp overlays
extend the nominal 4.6 body length to 4.618.

Output bundle: `public/demos/vehicle-style-study/04-simple-painted/` contains
eight untouched 512px raw RGBA renders, eight final 128px binary-alpha sprites,
1024x128 sheet, labelled comparison, eight-view GIF, GLB and complete report.
Editable scene: `data/vehicle-style-study/04-simple-painted/sports-coupe.blend`.
The data directory also retains raw/GIF contact sheets, geometry, scene validation,
visual inspection record and CLI logs. `build.py`, `finish.py`, and
`verify_scene.py` in this script directory replay the complete pipeline.

Construction/refinement: the initial 1,894-triangle draft exceeded the target;
twelve-segment tires reduced it. Broken subpixel hood/door seams were replaced
with surface-following strips, then hood width increased for native readability.
Final geometry is 1,710 triangles. Background Cycles CPU with **8 samples / 4
threads** supplies light-invariant RGB surface paint; no GPU rendering or live
Blender was used. All eight renders complete in a few seconds on this workstation.

Validation passed: fixed camera/elevation/scale and projected origin (64,92),
eight unique views, transparent margins, binary alpha, one shared palette,
raw/final/sheet dimensions, encoded GIF eight unique frames at 250 ms, actual
GLB mesh/triangle counts, unlit extensions and four named wheel nodes. Reopened
the saved .blend and independently rolled each wheel by 37 degrees: every target
wheel's 128 vertices moved while the body and other wheels stayed fixed. All four
rest tires touch Z=0. Clipping every body triangle against each tire's lateral
slab proves a conservative full-cylinder radial clearance of **0.04760** model
units, covering every neutral roll orientation.

Genuine visual inspection: viewed all raw directions in raw-contact.png, all
final directions at native size in sheet.png and enlarged nearest in comparison,
and every decoded GIF frame in gif-decoded-contact.png. No continuous animation
playback was inspected. The GIF has an explicit fixed origin crosshair guide;
the final PNGs do not. Openings/contact and near/far wheel occlusion look coherent;
no clipping, glass spill or obvious floating components were seen. No authored
per-view pixel clusters or corrective per-view shifts were used.

Findings: low-poly volume, flat paint and continuous glass ink produce a coherent
cheap baseline. Wide shoulders and the long low nose read well. Fine handles,
vents and five-spoke rims simplify at native size; hood ink still stair-steps.
The original source red palette reads pink-magenta and highlight bands look
graphic. Painted highlights rotate with the model. Steering/suspension, physical
collision, performance and human acceptance remain open. Thirty material
primitives mean low triangle count alone does not prove low runtime draw cost.
The GLB includes internal trim but requires its own silhouette-ink presentation.

Reproduce from repo root in PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-style-study/04-simple-painted/build.py
python scripts/vehicle-style-study/04-simple-painted/finish.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-style-study/04-simple-painted/verify_scene.py
# After genuinely inspecting the refreshed images, update inspection.json first.
python scripts/vehicle-style-study/04-simple-painted/finish.py --verified
```

No broad npm checks, shared docs, inventories, registrations, other routes,
existing assets, Git branches/commits or global settings were touched. Next:
coordinator freezes this exact output and compares the four experiment routes.
