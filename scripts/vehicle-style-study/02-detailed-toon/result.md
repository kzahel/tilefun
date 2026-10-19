# 02 — detailed toon sports coupe

Status: complete (2026-10-19). Independent original-car experiment; no approval or
production replacement is implied. This route writes only its owned directories.

Read AGENTS.md, art-review and 3d-assets topics, common study README and character
pixel pipeline. Contract: fixed 50-degree orthographic camera/7.2 scale, eight
45-degree model rotations, 512px transparent render, 128px reduction, constant
(0,+28) registration, binary alpha, shared palette and restrained one-pixel ink.

Construction: dense curved body loft with boolean wheel openings; continuous
swept glass cabin with material roof, separately editable trim/pillars, curved
intake/lamp/splitter details; four independent axle frames with rounded tire
profiles, split alloy spokes, rotors/calipers and rims. Toon bands are authored
as constant ramps in Eevee before any pixel reduction. No downloaded model.

Delivered: all eight 512px raw renders and eight 128px final palette/ink views,
1024x128 sheet, labelled source/process/native/4x comparison, 512px nearest GIF,
editable scene, constructors and report. Data retains reduced and palette-only
intermediates, geometry counts, reference palette provenance, raw/GIF contact
sheets, saved-scene validation and exact inspection hashes. Coordinator owns
shared docs, registration and checks. No shared files or other routes edited.

Actual complexity: **113,888 evaluated triangles / 184 evaluated meshes** (145
native mesh objects plus 39 converted trim curves). The continuous body alone
has 29,360 triangles; cabin has 13,568; four fender sheets have 7,680 combined.
Overall bounds are 4.600 x 1.986 x 1.048 units including mirrors/exhaust/trim.
The contract camera is untouched; a single uniform authoring scale includes all
extremities in the required 4.6 length. Four independently parented wheels have
explicit centres, Y axles and actual tire bottoms at ground Z=0.

The final shared palette has 14 entries and uses 13 across the eight views.
Thirteen entries are exact sampled source colours (including warmer rare reds);
the one supplement is named trim/ink RGB (32,29,43). Six material roles each
have 3 or 4 constant lighting bands before pixel reduction. No per-view clusters
or painting were authored; all features originate in geometry and toon roles.

Inspection: viewed the final raw contact sheet across all eight rotations, the
native sheet, all labelled native/4x comparison panels, representative 512px raw
renders and decoded GIF contact sheet. Repaired initially unsupported fender
lips by adding connecting curved sheet metal; switched pink-biased paint bands
to warmer existing-reference red samples. Final silhouette, glass borders,
near/far wheel visibility and lamp placement are coherent at native size.
Fine spokes/drilled rotors/calipers/door lines partly merge or vanish. The
rear glass forms large dark shade clusters as fixed lighting rotates relative
to the car, and occasional isolated rim/trim highlights remain. High detail
can yield readable sprites with pre-raster bands, but is not an efficient or
automatic way to author deliberate native pixel clusters. No ground shadow;
wheel steering/roll clearance is unqualified. GIF was inspected as decoded
frames and duration metadata, not real-time playback.

Validation passed: reopening the .blend read-only independently recounts the
geometry, verifies six constant toon ramps, camera/4-thread Eevee settings,
4.6 length, projected ground anchor (64,92), and four tire ground contacts.
Pillow checks every required artifact, canvas sizes, binary alpha, fixed palette,
sprite padding/no clipping, eight GIF frames at 350ms and exact decoded opaque
RGB/alpha parity. Broad npm checks intentionally left to coordinator as requested.

Final PNG/GIF hashes are frozen in report.json and data/inspection.json. Do not
rerender these for registration; use the current exact files. Next logical step:
coordinator freezes and compares all four routes for human style review.

Replay from repository root (PowerShell; offline source generation only):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python scripts/vehicle-style-study/02-detailed-toon/build.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python scripts/vehicle-style-study/02-detailed-toon/verify_scene.py
python scripts/vehicle-style-study/02-detailed-toon/finish.py
```

Replay requires Blender 5.2 and Python/Pillow, and reads only the four original
compact-4 reference PNGs. Saved inspection hashes reject changed render pixels;
any intentional rerender needs a new genuine visual inspection record.
