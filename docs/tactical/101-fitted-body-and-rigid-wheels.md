# 101 — Fitted compact body and independent rigid wheels

Owner: [3D assets](../topics/3d-assets.md). Started: 2026-10-10.
Status: Body-fit/rig diagnostic delivered; cross-view fidelity and steering clearance open.

The owner found the 100 side silhouette insufficiently close, liked its outline
style and asked for independently rotating wheel components. Separate tire/hub
meshes already existed, but their origins were at the car's world origin, so
direct object rotation would orbit the car instead of turning about an axle.

## Shared family correction

`rig_compact.py` consumes an isolated copy of v3 and explicit
`compact-body-rig.json`. It lowers/slopes the nose, extends the rear roof edge,
raises the deck/cabin join, lowers the sill and adjusts axle spacing. It refits
the window-panel depth while retaining the same source window outlines. Topology
and UV layout remain, but vertex positions deliberately change. Cameras and
inward pixel ink stay fixed. The same template/project/cleanup/evaluation process
works on compact-1 and compact-2; other vehicle families are still unqualified.

Each car gets `CarRoot`, a static `Body` parent and four independent wheel chains:
`Wheel_{FL,FR,RL,RR}_Steer → Wheel_*_Roll → tire + hub`. Roll nodes are centered
at their axles; both meshes use coordinates relative to that center. Fenders and
windows belong to Body. These are rigid transforms, requiring no skinning or
deforming skeleton. Ten hierarchy nodes accompany 55 meshes / 834 triangles.
Radius stays 4.1 world pixels; all four tires remain grounded in the rest pose.

GLB export includes the hierarchy and explicit radius/axis extras. The separate
`wheel-rig.mjs` driver binds per-car nodes, supports independent/all-wheel roll
and front-only steering, and sets phase from **signed travelled path distance**,
not elapsed idle time or net position displacement. Forward is -X; roll angle is
`-distance/radius` about Blender +Y / exported local -Z. Front steering rotates
its parent about exported +Y. Stop/reverse/reset follow the supplied distance.
Steering pivots exist, but clearance/range inside the arch is not qualified.
No driving physics, collider change, runtime mesh promotion or game integration
is introduced. GLB has no baked animation clip; the driver performs rigid motion.

`paint_wheel_hubs.py` authors small three-spoke UV hubs from the original compact
gray palette so rotation is visible. This is an interpretation, not recovered
rotating artwork. Raw source coverage remains separate and is never upgraded.
`render_wheel_roll.py` verifies the static body vertices and fixed axle centers
while rendering 24 actual mesh phases; `wheel_roll_panels.py` applies native ink
and composes the loop. The preview intentionally leaves the car stationary.

## Fidelity evidence

Compact-1 east/west IoU improves from about 0.827 to 0.922/0.923. Missing pixels
fall from 276 to 122, excess from 44 to 20/19. North improves 0.936 → 0.956;
south changes 0.936 → 0.928, with more excess despite fewer missing pixels.
Source masks include painted shadows; fitting lower occupancy is not proof of
a recovered physical underbody. Native RGB error is about 24/24/18/13. Wheel,
shadow, longitudinal profile and texture disagreements remain visible. These
diagnostics and the agent's visual inspection do not constitute acceptance.

[Gallery](../../public/demos/authored-car/rigged.html) retains both 4×2 sheets,
body-fit silhouettes, fixed-body wheel GIF, extra mesh angles, exports and rig
metadata. [Editable sources](../../art-source/vehicles/compact-car/blender-v4/README.md)
contain both packed variants and captured family parameters. Workshop registers
excluded diagnostic `projection:authored-compact-car-v4` in `authored-car-089`,
pinning 35 artifacts including its procedural driver. Earlier registered artwork
and Blender sources remain byte-identical. Navigation is updated separately.
Normal builds use retained bytes and never regenerate this revision.

Local evidence: `data/authored-assets/089-wheel-rig/` holds the fitted template,
workspaces, drafts, `fitted-001`/`fitted-002` runs and 24-frame proof;
`data/authored-assets/089-validation/` holds audits, replay and repository checks.

## Validation

Both saved sources pass counts, finite UVs, packed 1024-square draft/clean
textures and four rest ground contacts. Bundled full Chromium imports both
actual GLBs and verifies the parent chain/tire+hub grouping, fixed body/centers,
correct quarter-turn radius/axis/sign, reverse, independent front-left roll,
front-only steering and repeated signed-distance poses. It renders both assets
and checks the gallery at desktop/phone widths, closing its servers/browsers.
Eleven existing Python checks pass, and the four new Python helpers compile.
Fresh green source projection/cleanup/evaluation reproduces the retained atlas
and comparison pixel-for-pixel. A fresh Blender wheel render reproduces all 24
frames pixel-for-pixel and the composed GIF byte-for-byte. All v1–v4 artifact
hashes and retained source Blend hashes pass; v4's captured configuration/current
replay code and Workshop candidate fingerprint also match (`replay.json`).

Repository typecheck, lint, production build and the three tools-index Playwright
checks pass. Art catalog and Workshop manifest generation complete; full Chromium
verifies 765 candidate identities, with 17 compiler exclusions. The unit suite
reports 2,102 passed, 10 skipped and five failures: three filesystem-security
symlink cases, the private-data symlink case, and the SQLite child-process
SIGKILL case. Windows denies the symlinks and does not report the expected
SIGKILL signal. Static-file suite setup/teardown additionally fails after its
symlink setup is denied. These are the existing Windows environment failures
recorded in the preceding revisions, not passing checks. WSL Git whitespace
validation passes. No engine/gameplay rendering path changed; targeted real-GLB
and gallery Chromium checks cover this diagnostic asset revision.

## Next fitting work

Fit wheel appearance/lower silhouette and longitudinal nose/rear shape without
losing the improved side contour. Test front steering against fender clearance;
then connect signed travel and steering from the shared vehicle presentation
state in a separately authorized engine integration. Preserve this rigid wheel
hierarchy when consolidating static body draw calls or authoring other families.
