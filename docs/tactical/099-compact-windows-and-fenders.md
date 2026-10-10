# 099 — Continuous compact windows and raised fenders

Owner: [3D assets](../topics/3d-assets.md). Started: 2026-10-10.
Status: Bounded correction delivered for inspection; family fidelity remains open.

The owner identified broken side-window paint and missing raised wheel-arch
geometry in the reusable 098 source-transfer comparison. The window drawing
crossed the join between the existing cabin and body meshes; top/front source
views could also overwrite side-window paint. The wheels protruded outside the
flat body sides without a covering arch lip.

## Delivered correction

The shared compact-family recipe adds four continuous, symmetric window/frame
panels, each with its own UV island and side-view source owner. Four real curved
fender lips add a beveled outer band and wheel-well edge; their width tapers back
into the body at the arch ends. The 47 original meshes retain every vertex;
only their UV placement changes into a larger atlas. The resulting template has
55 meshes, 834 triangles and one packed 1024-square atlas. Four tires remain
grounded. This is a visual shell correction, not a new physical proxy contract.

`refine_compact.py` and `compact-refinement.json` record family geometry
parameters. `clean_compact.py` transfers each original side-window/frame crop
and paints the fender bands using that variant's source palette. Fenders need
authored paint because raw projection copied unrelated glass/headlight pixels
onto curved surfaces. These paint decisions remain explicit and unreviewed.
The generic baker's `projection.sourceViews` constrains allowed source views by
UV region/object, without altering visibility checks or upgrading unknown masks.

The same template, camera presets and cleanup commands process compact-1 and
compact-2. This proves palette-variant reuse; other vehicle families still need
their own geometry fitting and palette landmarks. Normal builds use retained
outputs. No original sprite, collision metadata or approval record changes.

## Retained evidence and limits

- [Refined gallery](../../public/demos/authored-car/refined.html): both 4×2
  original/render sheets, four novel mesh angles and separate raw/clean atlases.
- [Editable sources](../../art-source/vehicles/compact-car/blender-v2/README.md):
  both packed Blender files and the exact captured family configuration.
- [Reusable commands](../../scripts/authored-assets/README.md): initialize new
  workspaces from `compact-refined-setup.json`, project, clean and evaluate.
- Local `data/authored-assets/087-refinement/`: retained first attempts, corrected
  tapered template, frozen source workspaces, raw drafts and final `clean-001`
  runs for both `compact-1-v2` and `compact-2-v2`.
- Local `data/authored-assets/087-validation/`: Blender/browser audits and logs.

Workshop registers the new excluded diagnostic `projection:authored-compact-car-v2`
in `authored-car-087`; the original 097 identity and all 48 artifact hashes plus
its Blender source remain unchanged. The old gallery links to the new revision
without replacing its images. No human approval is inferred.

The raised arches and continuous window/frame panels are visible in the new
side comparisons. Compact-1 silhouette overlap is about 0.826 on both side views
and 0.923/0.921 on longitudinal views, including painted source shadows. Whole
image RGB error is about 26/26/21/18; fender cleanup improves coherence without
uniformly improving these diagnostics. Windshield/hood/roof distortion, source
camera contradictions and fine outlines remain. These are not acceptance scores.

## Validation

Eight Python unit checks and four real Blender projection fixtures pass, including
exact visible source bytes, occlusion rejection, ambiguous UVs and source ownership.
Independent saved-scene audits verify both exports' 55 meshes / 834 triangles,
finite UVs, four grounded tires, packed 1024-square draft/clean textures and the
47 unchanged original meshes. The original registered source/artifact hashes pass.
Typecheck, lint and production build pass; art catalog retains 245 sheets / 1,098
source uses. Workshop verifies all 763 candidate identities in normal Chromium
at retina scale. Three tools-index browser checks pass. Bundled full Chromium
loads the new gallery at desktop/phone sizes without overflow or broken images
and renders both actual GLBs with 55 textured meshes, 834 triangles, four tires
and the expected Y-up bounds. Its isolated server and browsers close afterward.
The documented new-workspace project/cleanup commands replay compact-2 with
pixel-identical final atlas output. New registered artifact hashes and the
manifest identity pass.

The full unit run reports 2,102 passed, ten skipped and five existing Windows
symlink/process-kill failures in `FsSecurity`, `SqliteRecordStore` and
`privateDataPlugin`, plus the existing `staticFiles` setup/teardown failure around
its skipped cases. These match the prior run's platform limitations; no new
diagnostics are introduced. The offline constructor/baker/render exports have
their own real Blender and browser checks; game rendering behavior is unchanged.

## Next fidelity gate

Fit the windshield/hood/roof geometry and UV landmarks against all four views,
then examine the same template at novel angles and on compact-2. Keep corrections
in new revisions. A structurally different vehicle remains the next reuse test;
broad vehicle/other-asset production awaits a fidelity-qualified family template.
