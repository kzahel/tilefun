# Mallard drake, draft-v1

Standalone fresh Blender and palette-letter workflow. Production-agent inspection
is a draft gate, with coordinator and human review pending.

`build.py` constructs and keys 23 meshes, two fixed-length leg chains and two
shoulder/elbow feather fans. It reads the fixed wildlife-v2 camera but no animal
drawings. `mallard-duck.blend` retains geometry; compact `projected-guides.json`
exports actual projected hulls, bounds, contacts, wing pivots and rigid landmarks.
`audit.py` opens the saved blend in a fresh Blender process and checks geometry,
topology, scales, fixed root/head, limb and wing links and media contacts.

`author_masters.py` authors deliberate palette-letter body/head masters.
`finish.py` composes them at integer positions and finishes webbed feet, tail,
hinged bill and articulated wing fans with authored clusters from actual guides.
Rear heads hide front eyes/bill. Integer neck bridges and frozen closed bills are
intentional pixel stylization. Unchanged skulls and bodies are never rescaled.

Camera: 40 degrees above ground (50 from vertical), ten world pixels per unit,
48px square canvas, ortho4.8, shift10/48, anchor24,34. Profile idle heights13/14px;
down15/up16 reflect different projections. Only enlarged previews are resampled,
using nearest neighbor. Export alpha is binary.

Eight-pose waddle alternates sides four poses apart, with stance, passing and
lift. Eight-pose swim alternates submerged power/recovery paddles without ground
contact. Eight-pose flap rotates rigid shoulder and elbow fans through downstroke
and folding recovery, with tucked feet. Six-pose quack hinges the lower bill and
shivers the curled tail around a fixed skull. No audio is generated.

Repeatable commands from repository root:

```powershell
& $env:BLENDER_BIN --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/mallard-duck/draft-v1/build.py
& $env:BLENDER_BIN --background --factory-startup art-source/wildlife-v2/mallard-duck/draft-v1/mallard-duck.blend --python-exit-code 1 --python art-source/wildlife-v2/mallard-duck/draft-v1/audit.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/mallard-duck/draft-v1/author_masters.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/mallard-duck/draft-v1/finish.py
node art-source/wildlife-v2/mallard-duck/draft-v1/capture.mjs
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/mallard-duck/draft-v1/verify.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/mallard-duck/draft-v1/review_panels.py
```

Do not replay into this registered identity after registration. New pixels need
a new revision. Capture uses bundled full Chromium, isolated HTTP serving, native
and4x CSS playback, and closes its owned browser/server.

Primary reference grounding:

- [Cornell identification](https://www.allaboutbirds.org/guide/Mallard/id): drake
  green head, yellow bill, collar, chestnut breast, gray mantle, blue speculum.
- [Biewener lab mallard land/swim research](https://biewenerlab.oeb.harvard.edu/publications/dynamics-mallard-anas-platyrynchos-gastrocnemius-function-during-swimming)
  grounds distinct leg use on land and water.
- [Surface/diving duck swimming research](https://pmc.ncbi.nlm.nih.gov/articles/PMC12079667/)
  grounds alternating surface paddles. This is a stylized in-place surface cycle.
- [Duck walking research](https://pmc.ncbi.nlm.nih.gov/articles/PMC2978950/)
  grounds alternating walking support; the authored wing schedule is a simplified
  articulated flap, not a measured aerodynamic reproduction.

Exact observations, rejected captures, computed footfall and limitations are in
the public revision's `review-observations.md`, `source-audit.json` and
`output-audit.json`. Command/exit evidence and chronological inspection panels
are under ignored `data/wildlife-campaign-v2/background-01-worker`.
