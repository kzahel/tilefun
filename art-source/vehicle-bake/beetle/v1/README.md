Editable Beetle-style classic rounded compact, v1, awaiting owner review.

`master.blend` retains individually named semantic coachwork/fender/trim/wheel
components at their correct source positions. `car.blend` retains the consolidated
low-poly static body and four independent wheel rigs. Both have packed atlas and
unused palette planning draft, a fixed study camera and zero ground plane contact.
The component master uses the same economical authored topology; it is not a
separate high-detail/decimation source.

`build.py` and `family.json` are self-contained family geometry/semantic UV paint
inputs. Run with Blender background/four threads and `-- --scratch` to replay into
ignored scratch without touching this retained candidate. No coupe meshes,
projection data, camera fitting or ignored files are source dependencies. Shared
Blender glTF exporter, actual-GLB catalog audit, cylinder clearance, coverage and
engine components are reused from the repository.

`paint-ownership.json` records surface ownership and uncertainty. Continuous cabin
UVs own glass and internal frames on the actual body triangles; separate fenders,
trim and wheels use padded palette-role swatches. No image-space repaint or
view-dependent texture is used. `evidence/` pins actual export verification.
Public final report and native/game sheets are in
`public/demos/vehicle-bake/beetle/v1/`; author findings are in
`scripts/vehicle-bake/beetle/result.md`.
