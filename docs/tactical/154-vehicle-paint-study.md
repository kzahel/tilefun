# 154 — Vehicle paint study

Owner request, 2026-10-20: proceed with the proposed six-color Beetle,
four-scheme pickup and four-scheme sports-coupe experiment; commit and show results.

Scope: reusable palette/mask authoring, actual exported-model comparisons,
editable packed sources and frozen review registration. Runtime scheme selection,
traffic weights, persistence, replication and sprite fallback integration follow
appearance review. No normal vehicle definition or renderer is changed.

## Delivered

- Fourteen schemes, seven shared six-step paint ramps, explicit original paint
  and protected roles; unknown/ambiguous colors reject.
- Pickup cream roofs use the existing roof chart. Sports-coupe twin stripes
  use physical body coordinates rasterized onto its UVs, respecting ink/vents.
- Original geometry, indices, normals, UVs, materials, hierarchy, wheel pivots
  and radii stay byte-exact. The GLB redirects its one image to a new embedded
  atlas; the original binary prefix is preserved.
- All fourteen packed Blender sources retain exact inherited mesh/UV/hierarchy/
  transforms/object properties and the exact new packed PNG.
- Comparison gallery, individual live shared-loader reviews, all-heading sheets
  and an ignored self-contained offline capture gallery.
- [Reusable instructions](../vehicle-paint-variants.md) and versioned configuration
  in `scripts/vehicle-bake/paint-variants-v1.json`.

## Evidence

The initial forest deep shade fell below the existing outline shader's linear
RGB threshold. The paint was corrected, navy was checked against the same rule,
and all fourteen models were recaptured. The shader remains unchanged.

The source generator passes six safety controls. A fresh ignored replay exported
only from the receipt's declared Git-staged inputs reproduces all fourteen final
GLBs exactly, without ignored authoring dependencies. Fourteen source-scene audits pass. Actual full
Chromium captures compare 672 scheme frames against 144 fresh base frames:
16 headings plus eight signed wheel phases, in each of two cameras. All alpha
and non-paint pixels remain exact; independent forward/reverse/reset wheels pass.
Gallery controls pass for all schemes, cameras, three integer scales and three
backgrounds at desktop/phone sizes, including network-free offline operation.

Frozen source/dependency identities are in
`art-source/vehicle-bake/paint-study/v1/retained.json`. Fourteen new exact review
entries are registered in the original-vehicles collection; all 43 previous
entries retain their exact byte prefix and all 1,810 prior Workshop candidate
records remain unchanged. The new Workshop inventory contains 1,824 identities,
verified in full Chromium at retina scale. Agent inspection is not human approval.

Repository checks: all three typechecks pass; lint has no errors (120 existing
warnings and 37 infos); art catalog, Workshop manifest and production build pass.
Four focused full-Chromium Playwright cases pass: desktop/phone paint selection
and actual native sizing, plus existing coupe game/lab driving with mesh and
failed-mesh fallback. The full bounded Windows unit run reports 6,007 passes,
five known platform failures and ten skips (6,022 tests in 334 files, 495s).
The failures are three FsSecurity symlink-privilege cases, one privateDataPlugin
symlink case and the SQLite SIGKILL case; staticFiles setup/cleanup fails from
the same missing symlink privilege and its ten tests skip. No simulation,
renderer or normal runtime vehicle catalog source changed.
`git diff --check` flags the inherited final blank line in fourteen frozen
per-scheme HTML pages; their exact registered bytes are preserved.

The earlier twelve vehicle ideas are also retained in this checkpoint's queue
update: 33 integrated, seven deferred bikes and twelve ideas, 52 total entries.

## Next

Owner appearance review, then persistent paint selection, traffic choices and
matching sprite fallbacks through the shared game/lab paths.
