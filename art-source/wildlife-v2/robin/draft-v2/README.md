# European robin draft-v2

Fresh standalone Blender source and authored palette-letter pixel finish.
Production-agent draft gate only; coordinator and human review pending.

`build.py` creates 30 meshes: round olive body, orange breast/face, cream belly,
rigid skull, pointed hinged bill, short tail, three fixed segments per leg,
three grasping forward toes plus hallux and separate shoulder/elbow feather fans.
It reads the fixed camera contract but no animal drawing. `robin.blend` retains
all geometry; compact `projected-guides.json` contains actual hulls/bounds, wing
pivots, bill/tail tips, contacts and mesh hashes without repeated full vertices.
`audit.py` opens the saved source in a fresh Blender process and verifies scale,
geometry, contacts, segment endpoints, rigid fan links and actual footfall.

`author_masters.py` writes robin-specific palette-letter body/head patches.
`finish.py` composes those integer patches with deliberate guided toe, feather,
tail and bill clusters. Opposite profiles intentionally mirror baked lighting.
The eye row omits a dark outer face edge for legibility; rear body uses olive
upper shading rather than a false pale collar. Near rear tail draws over the
body. These are explicit stylizations, not claims that hulls prove good art.

Projection: fixed 40 degrees above ground, 50 degrees from vertical, 10 world
pixels/unit, canvas32, ortho3.2, shift9/32, anchor16,25. Idle visible bounds:
down10/up9/left10/right9 pixels. Different rounding and projected toe depths are
preserved. Native exports are never resampled; previews enlarge by integers.

Hop: eight poses, gather/push/rise/apex/descend/paired landing/absorb/recover.
Computed flight poses2/3/4, both feet land5. Feet tuck closer to belly at apex
and extend before landing, using fixed .12/.15/.13-unit limb segments. Flap:
eight articulated shoulder/elbow poses with folding recovery and tucked feet.
Action: six bill-hinge/tail-cock poses around a rigid skull, without audio.
Root stays in place. Travel, takeoff, landing-from-flight and stopping transitions
are not authored.

Primary grounding: [Cornell eBird robin](https://ebird.org/species/eurrob1/IS)
describes ground hops, wing flicks and tail cocking;
[RSPB robin](https://www.rspb.org.uk/birds-and-wildlife/robin) grounds the orange
breast, brown back and song. The paired schedule and flap angles are stylized,
not measured robin kinematics. The valid mclone checklist's songbird row was read,
without reusing its model or unrelated historical wildlife.

From repository root, run build.py with isolated Blender background/factory
startup, then load robin.blend in fresh background Blender with audit.py. Run
author_masters.py, finish.py, capture.mjs, verify.py and review_panels.py using the
workspace Python and bundled full Chromium. Command/exit logs are in ignored
`data/wildlife-campaign-v2/background-01-worker/logs/`. Do not replay into a pinned
registered revision; new pixels require a new identity.

Revision2 corrects preview HTML to explicit UTF-8. Revision1 is retained frozen.
All copied PNG/GIF and editable Blender bytes are identical; sources and metadata
route to the new identity. Fresh source/replay/Chromium checks are repeated below.
