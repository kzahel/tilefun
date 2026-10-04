# Rabbit supervised pilot-v1

Final authored identity: `rabbit-pilot-v1-drawing-04`. Draft only; coordinator
review and all human approvals are pending. This isolated rabbit source uses
the accepted campaign camera and no prior animal drawings, downloaded models
or generated images. The approved Explorer/cat/bear and exact Modern Exteriors
roof/tree/four cars were opened as art/projection references. Accepted fox
machinery supplied only the preview/capture plumbing and exact scene crop layout.

`build.py` owns a dedicated factory-startup scene. It creates 24 mesh objects:
large rump, smaller chest, rigid compact skull/muzzle/nose/eyes, two distinct long
ears with hinges, small round tail, and four articulated upper/lower leg/foot
chains. Geometry is embedded in the saved `rabbit.blend`, with unit object scale
and no scale keys. Hind segments are 0.40/0.42 world units; fore segments are
0.24/0.28, with long hind-foot versus tiny forepaw geometry. Analytical two-link
IK controls rigid object joints. There is no skin/armature runtime export.

The camera reads `art-source/wildlife-v2/camera.json`: orthographic, 40° ABOVE
GROUND (50° polar angle from vertical), location (0,-7.660444431,6.427876097),
target origin, yaw down/up/left/right 180/0/100/260. Canvas32, orthoScale3.2,
shiftY0.25, density10px/world unit, ground anchor(16,24). The fixed contract is
an artistic fit to painted reference art, not a vendor camera measurement.
Visible idle heights are down13, up16, left13, right13. No sprite is resized.

The builder saves independent keyed pose sources and exports actual projected
mesh convex hulls, bounds, depth ranges, vertex counts, landmarks, ear tips and
checked joint/contact positions for 60 samples. Full mesh vertices/topology live
once in `.blend`; compact guide JSON deliberately does not repeat them. The
guide renders use Workbench at192px, with projection coordinates expressed at
native32px. They are anatomical guides, not the final raster art.

The hop is a stylized rabbit half-bound: gather, hind push, lift, apex, leading
fore reach/contact, second fore landing, paired hind landing, settle. Head and
body mesh volumes never scale. Torso pitches rigidly; the skull retains absolute
orientation while its position follows the torso. Actual landing indices are
fore(-1)4, fore(+1)5, paired hind6; samples2/3 have no ground contact. Planted
ankles stay fixed in place, and the ground root stays at origin. Timing is a
deliberate eight-pose1-second loop, not a measured rabbit stride. The qualitative
coordination follows [Carneiro et al.2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7993613/).
The action has six samples: rest, partial ear splay, full splay held twice,
partial return, rest. Three native pixel configurations are intentional holds.

`masters.json` supplies eight palette colors and deliberate letter patterns.
`finish.py` places them at integer positions from independent guides, draws
joint-connected legs and layers far limbs, torso, near limbs, rear tail and
face/back skull correctly. Full skull/marking masters stay unchanged. Ear
listening uses the same ear letters, warped by rigid projected guide-tip changes.
Broad shading replaces guide facets. Profile ear positions are deliberately
separated/shortened by about1–2 pixels for the13px silhouette; facial clusters
are slightly enlarged for readability. These are authored choices, not claims
that metadata or generic rendered ellipsoids establish finished art quality.

Run from the repository root in PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/rabbit/pilot-v1/build.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/rabbit/pilot-v1/finish.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup art-source/wildlife-v2/rabbit/pilot-v1/rabbit.blend --python-exit-code 1 --python art-source/wildlife-v2/rabbit/pilot-v1/audit.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/rabbit/pilot-v1/verify.py --replay
node art-source/wildlife-v2/rabbit/pilot-v1/capture.mjs
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/rabbit/pilot-v1/verify.py --browser
```

Builder regeneration overwrites this unreviewed local source identity; after
review, changed pixels/source require a new revision directory. Do not use it
to rewrite a reviewed revision. Finishing needs only Pillow and retained masters
and guides. Browser capture uses bundled full Chromium, an ephemeral localhost
static server and a clean ephemeral browser context; it closes both afterward.
The four-second playback includes idle, two full hops, listening and idle return.

One concrete visual review is in the public `review-observations.md`. Current
file hashes are in `checksums.sha256`; actual command/exit logs, launch/rollout
identity, rejected drawings and browser samples are under ignored
`data/wildlife-campaign-v2/manual-rabbit-01`. Root owns topic/Workshop integration.
