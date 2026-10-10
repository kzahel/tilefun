# 104 — Top windshield stroke at native scale

Status: delivered diagnostic correction; human review remains open.
Owner: [3D assets](../topics/3d-assets.md). Date: 2026-10-10.

The owner correctly reports that 103's top windshield outline is missing in the
side view. Atlas coverage alone was insufficient validation: the 0.8-world-unit
top frame projects to less than a pixel across the matched side camera and can
fall between native pixel centers. The top stroke needs a native-render check.

`ink_windshield_top.py` is a separate correction after 091. A total top width of
1.85 world units extends dark navy slightly into the glass, changing only 640
top glass-edge texels per variant. The other frame bands, remaining glass paint,
other islands, atlas alpha, mesh vertices/faces/UVs and rigid wheel hierarchy
remain unchanged. The inset is authored paint, not newly observed coverage.
`compact-windshield-top-ink.json` captures the width and original ink landmark.

The native probe projects the full aperture width at the top band, then checks
every pixel along that segment in all four matched cameras on both colours.
Per colour, east/west improve from 1/12 navy pixels to 12/12; north 2/18 → 18/18;
south 1/18 → 18/18. RGB tolerance is one byte for renderer conversion. This
checks the actual native Blender renders rather than counting atlas paint.
All eight whole-car alpha masks remain byte-identical. Other camera scales or
near-edge-on angles can still change apparent line thickness.

[Gallery](../../public/demos/authored-car/windshield-top.html) retains matched
source/previous/corrected close-ups, both 4×2 sheets, diagonal mesh renders, GLBs
and the native probe. [Editable sources](../../art-source/vehicles/compact-car/blender-v7/README.md)
retain both packed variants and top-stroke parameters. Workshop registers excluded
diagnostic `projection:authored-compact-car-v7` in `authored-car-092`, pinning 26
artifacts. V1–v6 registered artwork and source Blend hashes remain unchanged.
No engine, collider, gameplay promotion or human approval changes.

Local evidence: `data/authored-assets/092-top-ink/` contains frozen source
workspaces, new atlases/renders, top-edge probe, pixel and Blender source audits,
real-GLB/gallery browser checks and repository logs. Blender audits retain
55 meshes/842 triangles, all UVs/transforms and packed draft/new active atlas.
Browser checks use bundled full Chromium and close their servers/browser.
The green top-stroke replay is byte-identical. Eleven Python checks pass and the
new helper compiles. Typecheck and lint pass with existing 118 warnings/34 infos;
WSL Git whitespace validation passes. V7 artifact/source/current replay hashes
match, and the full unit suite reports 2,102 passed, 10 skipped and the same five
existing Windows symlink/SIGKILL failures, plus static-file setup/teardown errors
after its symlink is denied. No new failures/timeouts occurred. Catalog generation
reports 245 sheets/1,098 source uses. Manifest generation verifies 768 identities
in normal Chromium at retina scale, with 20 diagnostic/compiler exclusions.
Production build and all three tools-index Playwright checks pass with isolated
auth/data and the bundled browser. V7's registered fingerprint matches its
retained record. No engine/gameplay rendering path changed.

Next: compare top border weight with the source at native scale, then continue
the remaining pillar/shape and wheel-clearance work. Future ink changes must
check native edge visibility as well as atlas coverage.
