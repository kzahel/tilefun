# 103 — Dark windshield frame

Status: delivered diagnostic; human review remains open.
Owner: [3D assets](../topics/3d-assets.md). Date: 2026-10-10.

The owner requests the nice dark outline used by the other windows on 102's
front windshield. This slice adds a continuous navy band in its existing frame,
outside the glass aperture, on both compact colours. It introduces no geometry,
glass paint, outer silhouette, wheel transform or engine changes.

`ink_windshield.py` is a separate cleanup step after 090. It samples original
east pixel (11,55), yielding opaque (58,58,80), and measures the aperture margins
against the actual windshield width/height. `compact-windshield-ink.json` sets
the 0.85-world-unit band. Square joins connect all four sides/corners. Width stays
fixed on the model across cameras; this interior border is atlas paint and is
included in the GLB. The outer silhouette still requires the separate render pass.
Raw projection coverage and authored/observed distinctions remain unchanged.

Only 1,570 texels differ per palette variant, all opaque navy in the frame island.
Every glass texel, other island and atlas alpha byte is identical to v5. All
eight native source-camera alpha masks are identical. Blender comparison verifies
every mesh vertex, face, UV, parent, local transform and rig node unchanged,
with 55 meshes/842 triangles and packed draft/correct ink atlas in each source.

[Gallery](../../public/demos/authored-car/windshield-ink.html) retains matched
source/previous/inked crops, both 4×2 sheets, diagonal renders and GLBs.
[Editable sources](../../art-source/vehicles/compact-car/blender-v6/README.md)
contain both variants and captured ink parameters. Workshop registers excluded
diagnostic `projection:authored-compact-car-v6` in `authored-car-091`, pinning 25
artifacts. V1–v5 registered artifact/source Blend hashes remain unchanged.
Normal builds consume retained assets; chat feedback does not promote them.

Local evidence: `data/authored-assets/091-windshield-ink/` contains exact source
workspaces, ink atlases, actual Blender runs, pixel/source audits and browser/
repository logs. Bundled Chromium imports both GLBs and checks the gallery at
desktop/phone widths, fixed body/centers, signed wheel rotation, independent roll
and front-only steering. Its server/browser are closed afterward.

The green paint-step replay is byte-identical. Eleven Python checks pass and the
new helper compiles. Typecheck and lint pass (existing 118 warnings/34 infos),
and WSL Git whitespace validation passes. The full unit suite with two workers
reports 2,102 passed, 10 skipped and the same five Windows symlink/SIGKILL failures
recorded in 089/090, plus static-file setup/teardown errors after its symlink is
denied. No timeout regressions occurred. Catalog generation reports 245 sheets/
1,098 source uses; manifest generation verifies 767 identities in normal Chromium
at retina scale, with 19 diagnostic/compiler exclusions. V6's registered
fingerprint matches its retained record. Production build and all three
tools-index Playwright checks pass with isolated auth/data and the bundled
browser. No game/engine rendering code changed.

Next: review border weight at native scale, then resume pillar/shape and
wheel-clearance fitting from 090/089.
