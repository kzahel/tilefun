# Classic motorcycle Person7 fit

Separate source prototype; complete and immutable after proof retention/sealing. Original classic motorcycle, Bear variant and Person7 remain immutable. No production or human approval is implied.

This bike-only GLB has 2434 triangles, three draw meshes and one opaque nearest/unlit 512 atlas. The editable packed master has 55 named semantic components; the packed low has three runtime meshes. The unchanged Person7 is a separate 1984-triangle/one-mesh/256-atlas component, SHA256 `7b9396dfdff8dc8bca9a3d368ac253b2a0ae36e51b8669a254e535b8ff2e4c99`. No combined GLB is exported.

Person7 uses its own unchanged measured profile and one source mount `[0,0,1.0805]`. Blender forward is minus X/up Z. Convert a source mount to glTF Y-up using `S*[x,z,-y]`, where `S=80/4.6`. The rider GLB already carries its export scale; never apply a second avatar scale. Both assets share one yaw, projection, raster clock and real depth target.

All original saddle, tank, engine, frame, forks, swingarm, fender and wheel components are exactly unchanged. The six changed components are the connected riser/crossbar, two grip solids and two pegs. Grips/pegs follow the profile plus one mount; dimensions and local contact exception bounds are explicit configuration. The base bike is re-exported into this owned variant; no binary preservation of the base GLB is claimed.

`build.py` is a new parameterized fork retained here. It accepts `--config PATH --variant-id ID [--scratch]`; the config supplies `id`, the pinned rider/profile, one mount and mechanical control parameters. Its geometry helper uses no identity-specific limb offsets. Example from the repository root:

```
BLENDER --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/classic-motorcycle-person7-fit/build.py -- --config scripts/vehicle-bake/classic-motorcycle-person7-fit/family.json --variant-id classic-motorcycle-person7-fit --scratch
```

For another authorized avatar, change the config's id/profile/model pins, root/mesh names, semantic pelvis/palm/sole owners, measured mount, grip half-length/radius, peg dimensions, optional saddle dimensions and finite contact bounds. Do not alter the avatar scale/anatomy or assume the previous rider's contact bounds. Rerun the actual unchanged-bike attempt, contact/part diagnostics, negative/reset controls, full cylinders, all native views and exact replay. The isolated parameter API fixture tests alternate config/id and a single changed grip parameter; it is not another avatar/family rollout.

Fresh construction requires exactly four own files (`build.py`, `geometry.py`, `family.json`, `raw-audit.py`), stable `catalog-cycle.py` and the unchanged Person7 measured profile. Masters, ignored data and rider GLB are not construction inputs. The recipe declares the actual config path even when a caller supplies a differently named config. Diagnostics declare and retain their separate readonly inputs.

Actual unchanged-bike failure includes best upright translation, actual saddle-contact mount and best proper-rigid fit, evaluated against real GLB surfaces/volumes. The qualified variant uses only narrow corresponding pelvis/saddle, palm/grip and boot/peg pairs. Artifacts remain raw source diagnostics until parent shared motorcycle-loader qualification. No normal/AI/fallback/all-avatar/steering/suspension/rider animation claim.
