# Yellow school bus / v1

Original conventional school bus, prepared for owner appearance review only.
No bus catalog/spawning/traffic entry is enabled. `master.blend` contains 40 named
editable semantic component meshes at economical runtime topology; `car.blend`
contains the consolidated body and four independent wheels. Both scenes pack the
512×512 atlas and unused palette-planning image. This is direct semantic UV
painting, not high-to-low texture transfer or source-sprite reconstruction.

The independent long-body section and hood geometry, local side/floor wheel
pockets, substantial fender shells, exact wheel radii and asymmetric side charts
are declared in `family.json` / `build.py`. Passenger +Y has a folding door behind
the front axle; driver -Y has a driver window and static folded red stop plate.
No logos/text or animated marker, steering, suspension or door features.

Source uses -X forward, +Z up and ground z=0. Export scale is 80/4.6. Wheel radius
is .47 source units / 8.173913043478262 world units. Each hierarchy is
`Wheel_{FL,FR,RL,RR}_Steer > *_Roll > *_tire_hub`, glTF roll axis [0,0,-1].

Replay from the repository root, using Blender 5.2 with four threads:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python art-source/vehicle-bake/school-bus/v1/build.py -- --scratch
```

This writes only ignored `data/vehicle-bake/school-bus/replay/{source,public}`.
It consumes the retained builder, family config, coverage region and author review
coordination config plus Blender's exporter and shared `catalog.audit_glb`;
it does not read ignored drafts or prior vehicle geometry. Exact model/atlas
replay is recorded under `evidence/`. Completed public revisions refuse overwrite.
The public author bundle is `public/demos/vehicle-bake/school-bus/v1/`.

`capture.mjs` stages author diagnostics only under ignored bus scratch and invokes
shared family build/capture tools with bundled full Playwright Chromium. The
224px viewport extends transparent canvas only: source scale, 50-degree study
lens and native pixel density remain unchanged; study ground is (112,140), game
(112,112). `sheets.py` only lays out actual captured PNGs at integer nearest scale.
The QA-owned final review uses `scripts/vehicle-bake/family-school-bus.json`;
this bundle's `review.json` records author coordination, not a second frozen review.

Evidence separately records whole-body all-neutral-roll clearance with collision
negative control, declared crown support (25 samples per wheel), packed sources,
actual GLB bounds, 32 heading captures, signed phases and independent/reset rig
checks. Source uncertainty is explicit in `paint-ownership.json`. Coverage samples
are not a universal occlusion proof; study/game views were inspected separately.
Nonzero steering, suspension, physical gameplay handling and owner art approval
remain unqualified. Previous completed vehicles are preserved byte for byte.
