# Pond goldfish draft-v2

Fresh single-tailed common goldfish, Carassius auratus. Production-agent draft
inspection only; coordinator and human review pending. Orange is the domestic
pond form, not a claim that wild goldfish are orange.

The isolated Blender builder creates 18 retained meshes and 60 poses. Fixed
anterior body and skull lead two rigid posterior pivots and a vertical forked
caudal fan. Paired pectoral/pelvic fins, long dorsal fin, anal fin, eyes,
opercula and a hinged lower lip retain their own geometry. No mesh scale keys
or head/body volume changes occur. Compact projected guides include actual
mesh hulls/bounds, fin outlines including the caudal fork concavity, axial
links, eye/lip landmarks and underwater bounds. Full vertices stay in fish.blend.

Fixed camera: 40 degrees above ground, 50 from vertical, 10 world pixels/unit;
48px canvas, ortho4.8, shift10/48, fixed ground anchor24,34. Profile visible idle
height10px; down/up16px preserve projected length and the edge-on vertical tail.
Fish floats above ground inside a water volume with surfaceZ1.2. There are no
ground contacts. Root and anterior body stay fixed for in-place swim playback.

Eight swim poses use posterior phase offsets: spine1 7*sin(p), spine2
13*sin(p-1/8), caudal17*sin(p-1/4), with p measured in cycles. Actual evaluated
angles/tail positions are in source-audit.json. Six action poses hinge the lower
lip and flare paired fins; the jaw pivot is inside the cheek, not at the lip.
Operculum motion is subpixel and is not claimed as a visible pixel action.

Palette-letter gold/ochre/cream head and anterior-body masters are deliberately
authored and stay stable through swimming. Pillow draws guided posterior/fin
clusters with restrained bands and fork rays. The tiny eye/rim and cream ventral
mouth are stylized. Action jaw pixels legitimately overlap the lower cheek;
the unchanged cap/eye patch and fresh fixed-volume source are separately audited.
The rear master hides front eyes and mouth. Mirrored profile light is intentional.
This is authored pixel finishing, not a quantized Blender render.

Grounding: [Smithsonian goldfish species account](https://invasions.si.edu/nemesis/species_summary/163350)
supports the stout short-headed form, long dorsal fin, forked tail, ventral
mouth and absent barbels. [Primary goldfish swimming study](https://www.mdpi.com/2410-3888/9/9/365)
grounds posterior-body/caudal propulsion; chosen angles are stylized, not measured
kinematics. The valid mclone checklist row was read without using its model.

Replay from repository root: isolated background Blender build.py; fresh Blender
opening fish.blend with audit.py; workspace Python author_masters.py then finish.py;
bundled full Chromium capture.mjs; Python verify.py and review_panels.py. Command
and exit logs are under ignored background-01-worker state. Registered revision
files are immutable: replay into a new revision after review, not this identity.

Revision2 corrects preview HTML to explicit UTF-8. Revision1 is retained frozen.
All copied PNG/GIF and editable Blender bytes are identical; sources and metadata
route to the new identity. Fresh source/replay/Chromium checks are repeated below.
