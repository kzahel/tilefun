# Retained vehicle models

These are the exact final assets from the Blender authoring work. They are tracked
deliverables; older intermediate models and scratch galleries remain ignored.

The [vehicle porting checklist](../../docs/topics/vehicle-model-porting.md) tracks
all 45 source sets, their model/engine status and the next authoring work.

| Vehicle | Blender/texture/source bundle | Self-contained runtime GLB |
| --- | --- | --- |
| Blue `compact-1` | [v7](compact-1/v7/) | [compact-1-v7.glb](../../public/assets/models/vehicles/compact-1-v7.glb) |
| Green `compact-2` | [v7](compact-2/v7/) | [compact-2-v7.glb](../../public/assets/models/vehicles/compact-2-v7.glb) |
| Red `compact-4` | [v1](compact-4/v1/) | [compact-4-v1.glb](../../public/assets/models/vehicles/compact-4-v1.glb) |
| Ambulance | [v1](ambulance/v1/) | [ambulance-v1.glb](../../public/assets/models/vehicles/ambulance-v1.glb) |
| Ambulance beacon refinement | [v2](ambulance/v2/) | [ambulance-v2.glb](../../public/assets/models/vehicles/ambulance-v2.glb) |
| Police car | [v1](police-car/v1/) | [police-car-v1.glb](../../public/assets/models/vehicles/police-car-v1.glb) |
| Fire truck, stowed ladder | [v1](fire-truck-ladder-1/v1/) | [fire-truck-ladder-1-v1.glb](../../public/assets/models/vehicles/fire-truck-ladder-1-v1.glb) |
| Fire truck wheel alignment | [v2](fire-truck-ladder-1/v2/) | [fire-truck-ladder-1-v2.glb](../../public/assets/models/vehicles/fire-truck-ladder-1-v2.glb) |

Each source bundle contains the original packed `.blend`, exact cleaned atlas,
frozen directional crops, portable evaluation recipe, windshield geometry and
rig metadata. Blue/green include the captured top-ink configuration; red also
retains its raw projection, uncertainty mask/record and palette-transfer record.
The `.blend`, atlas, GLB, crop and captured geometry/configuration bytes were
copied unchanged after checking the original inspection receipts. Recipe wrappers
only update paths to tracked, portable dependencies. `catalog.json` records SHA-256
pins, capture identities and the expected native/novel rendered-image hashes.

The compacts have 55 meshes/842 triangles; ambulance v1 has 54 meshes/1,024
triangles and its own body/roof geometry, source-owned side graphics and paint
ownership records. All have four separate steer/roll tire+hub assemblies.
Ambulance v2 has 56 meshes/1,388 triangles, six tagged light lenses and six fixed
bases. Its source `lights.json` and the [light contract](../../docs/tactical/116-ambulance-beacons-and-light-tags.md)
preserve phases and behavior; the game switch/asset integration remain pending.
Police v1 and fire-truck v1 each have two tagged lenses with fixed bases and
their own `lights.json`. Police uses a new sedan mesh; fire uses separate cab,
pump and compartment geometry plus a `Ladder_Hinge` with child rails/rungs.
Hinge motion is independently verified; raised-pose/clearance qualification is
pending. Both retain their own raw UV projection and source-ownership decisions.
The [review collection](../../public/assets/models/vehicles/review/index.html)
links their exact 4×2 sheets, novel angles, contours and real GLB flashing previews.
Fire v2 has 49 meshes/1,280 triangles, measured wheel-center landmarks, floor
openings and cleaned wheel-local UVs. Its rig records the two-pixel placement
tolerance; actual GLB verification checks center fit and floor/tire intersections,
including negative regression probes. Cameras, fixed roof/details/ladder/lights
are preserved. Steering clearance remains pending; see tactical 118.
Units are world pixels, Blender up is +Z and forward is -X, with
tire contacts on Z=0. GLBs use Blender's +Y-up export conversion. The GLB embeds
the cleaned atlas; Blender scenes pack their textures, including retained unused
projection images. Inherited draft paint does not establish observation coverage.

These remain authored diagnostic assets. Retention does not promote gameplay
art or grant a new human approval. Internal window ink is atlas paint; the outer
pixel outline requires a renderer pass. The optional game/lab mesh mode now loads
the blue GLB with native silhouette ink and cosmetic wheel roll; see
[108](../../docs/tactical/108-authored-blue-car-gameplay.md). Green/red integration
and wheel steering clearance remain open. The ambulance's exact
[4×2 review sheet](../../public/assets/models/vehicles/review/ambulance-v1/comparison.png)
and [additional angles](../../public/assets/models/vehicles/review/ambulance-v1/orbit.png)
are retained review snapshots, registered as an excluded Workshop inspection.
Its north-owned roof paint, rear-facing cab/nose and rear fittings need owner
judgment; [115](../../docs/tactical/115-authored-ambulance.md) records the slice.

From the repository root:

```text
python scripts/authored-assets/verify_bundles.py
node scripts/authored-assets/verify_wheel_rig.mjs data/authored-assets/NEW_RIG_CHECK --bundles
python scripts/authored-assets/author_variant.py --vehicle compact-4 --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_VARIANT
python scripts/authored-assets/pipeline.py evaluate --recipe art-source/vehicle-models/compact-4/v1/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_RED_INSPECTION
```

The default palette replay depends entirely on tracked files. Replaying is optional
for consuming the exact finished assets; normal builds do not run Blender. Write
new work into fresh ignored workspaces. Do not overwrite these final revisions.
The older construction examples in the authoring workflow document historical
intermediate scenes; they are not required to consume or replay these bundles.

## Next vehicle: what to commit and why

Every finished vehicle includes its exact final asset bundle by default. Do not
wait for a separate request to retain it. Generated final deliverables belong in
Git because the game and the next author need them; exploratory renders, demos,
intermediate exports and caches stay ignored. A deliberately throwaway experiment
can remain local when the owner requests that scope.

| Commit | Location | Why |
| --- | --- | --- |
| Exact final self-contained GLB | `public/assets/models/vehicles/<vehicle>-<revision>.glb` | A fresh checkout has the finished runtime asset without Blender or regeneration. |
| Packed final `.blend` and exact cleaned texture atlas | `art-source/vehicle-models/<vehicle>/<revision>/` | Preserve editable geometry, UVs, materials and wheel hierarchy; scripts and a GLB alone cannot recover the finished authoring state. |
| Frozen source crops and portable recipe | The same source bundle | Preserve the reference pixels, camera matching and paint/UV decisions needed to inspect or repeat the result. |
| Rig/window/light records, projection draft and uncertainty records, palette or cleanup configuration used for this vehicle | The same source bundle, as applicable | Preserve animation axes, lens tags/groups/phases and pulse patterns; distinguish observed paint from authored or inherited surfaces. Retain the inputs needed to revise the final result. |
| Every required template, source texture, configuration and reusable helper | Tracked source/script directories; reference shared files rather than duplicating them | The recipe must not rely on an ignored scene, scratch gallery or a file available only on the author's machine. |
| Catalog entry with exact hashes, provenance, source credits and current documentation | `catalog.json`, asset credits and the owning topic | Identify the exact delivered revision, verify its dependencies and explain its readiness and remaining work. |

Before calling the vehicle delivered:

1. Copy the final checkpoint bytes into a new tracked revision. Do not re-export
   merely to commit, or overwrite an earlier retained revision.
2. Make recipe paths repository-relative and account for every dependency in the
   catalog. Preserve byte hashes across checkout using the existing Git attributes
   and formatter exclusions; extend those guards for new pinned locations.
3. Verify from a tracked-file-only checkout: hashes and recipe inputs resolve,
   Blender textures are packed, GLB textures are embedded, and the exported wheel
   hierarchy, axes and ground contacts work. Record native sprite/render comparisons
   and novel-angle checks. Adapt verification expectations for a new vehicle family.
   Also compare wheel centers to painted source wells, inspect fender boundaries
   and floor/body intersections, and verify tread does not sample body paint.
4. Confirm normal builds consume the committed GLB without running Blender or
   restoring scratch files. Keep inspection sheets, turntables and workspaces local
   unless an exact review snapshot is required by the review contract.
5. Update the catalog, owning topic and any changed authoring instructions. Follow
   project validation and preserve the distinction between retaining a finished
   diagnostic asset and obtaining production review approval.

Original vehicle art is Modern Exteriors by LimeZu. See
[asset credits](../../public/assets/SOURCES.md), the
[authoring workflow](../../scripts/authored-assets/README.md) and
[retention record](../../docs/tactical/106-retained-vehicle-model-bundles.md).
