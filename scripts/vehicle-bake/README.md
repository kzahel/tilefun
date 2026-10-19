# Red coupe: low-poly transfer experiment contract

Owner: [142](../../docs/tactical/142-red-car-low-poly-pipeline.md).
This document preserves the red-coupe pilot contract. The user prefers 141 route 3's
pixel art, especially outlines. Current family authorization and gameplay state
live in [original vehicles](../../docs/topics/original-vehicles.md). For the accepted
Beetle/school bus and the pickup review, use the reusable [family harness](family-README.md)
and [pipeline guide](../../docs/vehicle-authoring-pipeline.md); the coupe dimensions
and component ownership below are specific to that historical pilot.

## Immutable source

- `art-source/vehicle-style-study/03-guide-pixel-finish/sports-coupe.blend`
- `art-source/vehicle-style-study/03-guide-pixel-finish/evidence/` contains the
  scene metadata, semantic masks/anchors and inspection receipts.
- `public/demos/vehicle-style-study/03-guide-pixel-finish/view-0.png` … `view-7.png`
  are the chosen 128px finished target drawings.
- `scripts/vehicle-style-study/03-guide-pixel-finish/` documents source geometry
  and exact finishing decisions. Do not overwrite any 141 files or source bytes.

## Ownership and scope

Each agent owns only `scripts/vehicle-bake/ROUTE/`, `data/vehicle-bake/ROUTE/`,
`art-source/vehicle-bake/ROUTE/`, `public/demos/vehicle-bake/ROUTE/`.
Coordinator owns shared files, engine probes, inventories, docs and registration.
Do not commit, create branches/worktrees, run broad npm checks, spawn nested agents,
change global settings, modify the live Blender scene or start other vehicles.
Use background Blender CLI with 4 CPU threads, fresh files and bounded rendering.
Blender: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.

## Shared acceptance contract

1. Match route 3's body silhouette/proportions and wheel centers. Preserve curved
   hood, swept cabin and actual open wheel wells. Budget includes every tire,
   hub, trim, hidden surface and triangulated export. Initial target ~2k triangles;
   allowed useful range 1200–3000. Prefer one body + four wheel meshes, a single
   opaque palette-coloured unlit atlas and <=5 material draw primitives. Compact
   atlas 512x512 maximum; count UV splits/exported vertices and texture bytes too.
2. Transfer/re-author the chosen final paint into a **single view-independent UV
   atlas**. Prioritize continuous dark glass frames, panel seams, solid intakes,
   simple deck louvers, clean source-palette glass/reflection bands and red ramps.
   Use actual source semantic surface ownership and/or visibility-tested projection.
   Keep raw projection, rejected/unknown/conflicting texels and cleanup explicit.
   Exterior silhouette ink must not become a baked stripe around one view's body.
   No screenshot planes, runtime 2D patches, direction-switched textures, dynamic
   relighting/PBR or high-poly children disguised in the export.
3. Preserve four independent wheel assemblies with names
   `Wheel_FL_Steer > Wheel_FL_Roll > tire/hub` and FR/RL/RR likewise. Front is -X
   in Blender, +Z up. Roll local axis is Blender Y, glTF -Z; steer is Blender Z,
   glTF +Y. On each Roll export extras `wheel_radius` (in exported world units),
   `roll_axis_gltf:[0,0,-1]`. Steering nodes carry `steering_enabled` (front only),
   `steer_axis_gltf:[0,1,0]`. Keep wheel texture off the static body. Neutral roll
   must not clip body/floor; steering is held neutral and not qualified by this.
4. Source model dimensions stay 4.6 long / ~1.9 wide / ~1.05 high. Export GLB with
   uniform world scale `80/4.6` so car is ~80 logical pixels long. A uniform export
   root scale is fine; metadata wheel_radius MUST include this factor. Do not add
   1.3 lateral widening or game-specific height correction. glTF +Y up as usual.
   Coordinator uses `CarMeshAsset(scene,1,{batch:true})`, existing shared pixel
   outline and a fixed camera. Do not modify shared engine code to fit a candidate.
5. Blender comparison renders use the identical 141 camera: square 512px RGBA,
   orthographic scale 7.2 at 50 degrees above ground, target origin, model yaw
   [0,45,...315]. Finish to 128px by nearest sampling + constant (0,+28)
   translation. If source is saved scaled, scale camera/ortho accordingly.
   An alpha-only one-pixel inward boundary pass is fine for Blender comparison;
   interior paint MUST come from the exported textured mesh, not a screen redraw.
6. Check native, 4x, front/rear and diagonals; correct obvious silhouette/glass/UV
   errors before completing. Save method, surface ownership, uncertainty, actual
   export stats, and all limitations. Evidence must describe what was actually
   checked. Coordinator will independently inspect the real GLB in full Chromium.

## Required delivery

For a candidate folder `public/demos/vehicle-bake/ROUTE/v1/`:

- `model.glb`: actual embedded-atlas export, KHR_materials_unlit, complete wheel rig.
- `atlas.png`, `view-0.png` … `view-7.png` (128x128 mesh-rendered final pixels).
- `comparison.png`, `turntable.gif`, `report.json` and optional wireframe sheet.
- `report.json`: `status:complete` only after inspection, route/method, exact
  triangle count, mesh/material/primitive/vertex counts, atlas size, GLB bytes,
  wheel radii/centers, source hashes, own source/recipe paths, transfer limitations,
  actual validation and replay commands. Include `exportWorldScale:80/4.6`.
- Editable self-contained `art-source/vehicle-bake/ROUTE/v1/car.blend`, atlas,
  recipe/config and uncertainty/paint-ownership evidence; do not depend on ignored
  data for replay. Scripts may rebuild using immutable retained 141 inputs.
- `scripts/vehicle-bake/ROUTE/result.md` with progress and final findings.

Inspect actual exported GLB metadata and triangles, not just modifier/source counts.
Additional budget revisions use new candidate dirs (e.g. `budget-low`, `budget-high`)
and the same report shape. Do not overwrite a retained completed revision.
