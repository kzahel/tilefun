# Wildlife 3D campaign progress

[Plan](../255-wildlife-3d-model-campaign.md) · [Roster](roster.md) ·
[Local comparison gallery](../../../data/wildlife-3d-campaign/index.html) ·
[Download the gallery and models](../../../data/wildlife-3d-campaign/tilefun-animals.zip)

## Roster evidence

The run began on 2026-11-19. All 219 identities have a retained animated Blender
candidate, GLB, cardinal and close-up stills, action stills, and a side-by-side
video. Every identity has a first comparison. Opus requested changes to all 218
first candidates with a verified review. Those entries each have a second
candidate. The existing rigid-part rabbit model was used for its first
comparison. The rabbit's second candidate has an editable armature.

Exact inputs and outputs live in
`data/wildlife-3d-campaign/<runtime-type>/v1` or `v2`. Each local review record
retains hashes, admission and conversation evidence. The gallery displays both
sets of findings without exposing routing metadata, and links the latest
source, GLB and video. Local checks opened all 437 comparison packets,
recomputed the submitted evidence hashes, verified the exported clips and
checked the MP4 video streams. Keep the local run state out of Git.

As of 2026-11-20, Opus has completed 429 reviews in the requested Work pool.
The latest disposition is:

| Animals | Disposition |
| --- | --- |
| 211 | Both reviews requested changes. Keep the second candidate and its findings open at the two-version cap. |
| 7 | Second candidate and evidence complete. The final review is waiting for the Yep Anywhere provider host. |
| 1 | Virginia opossum has its first candidate. The first review is waiting for the provider host. |
| 0 | An independent review met the bar. |

The final review is pending for crocodile, griffin, porcupine, spotted hyena,
T. rex, wild turkey and zebra. The local API's receipt reconciliation and
provider-host logs show connection refusal before those requests reached a
reviewer. The host's recovery procedure can interrupt other sessions. Check the
recorded receipts and the project catalog again after recovery before replaying
any request. If the opossum's first reviewer asks for a revision, it has one
candidate pass left.

The tuxedo cat's revised pounce cleared the motion concern. Opus still flagged
its square side-profile muzzle, ear silhouette and white foot separation at
native scale. The gallery preserves that verdict beside the revised cat and
the owner-liked first pass. Exact assets still need owner disposition before
any roster rollout.

## Shared game and Workshop checks

- The [full-roster runtime check](../../../scripts/wildlife/verify-3d-campaign-runtime.mjs)
  loaded all 219 registered GLBs through the game’s wildlife mesh loader in
  Chromium. It drew 3,069 samples across 1,023 runtime clip mappings with the
  oblique game projection, checked that disabling each mesh passed control to
  the sprite path, and verified that two cats kept independent pounce poses.
  A card moved along the camera ray covered the cat only when in front of it.
  The [runtime report](../../../data/wildlife-3d-campaign/runtime-pilot/all-animals.json)
  lists each tested identity and its clip count.
- The skinned cat ran in the real Workshop landscape lab. The **3D animals**
  switch restored the reference sprite and turned the mesh back on. An
  intercepted GLB 404 drew the same reference sprite. A normal launch made
  no cat GLB request. Evidence is in
  [runtime-pilot](../../../data/wildlife-3d-campaign/runtime-pilot/).
- The mixed-species game fixture placed 25 animals in a local Worker world.
  It displayed 21 meshes in the enabled lane and zero in the sprite lane.
  Apple M4 Pro, Metal-backed Chromium, 1280×800, 1×, four seconds per run:

  | Lane | Frame p50 / p95 | Render p50 / p95 | GPU p50 / p95 | Draw calls per frame | Missed frames |
  | --- | --- | --- | --- | --- | --- |
  | Models | 16.7 / 16.8 ms | 2.3 / 2.6 ms | 0.59 / 0.62 ms | 26.9 | 0 / 240 |
  | Sprites | 16.7 / 16.8 ms | 0.8 / 1.0 ms | 0.42 / 0.46 ms | 6.0 | 0 / 240 |

  This measures a short desktop preview in the actual game renderer. Phone
  and Steam Deck timings and per-species in-game contact and occlusion
  qualification remain open.
- Earlier comparison packets used the same oblique slope with the camera's
  north axis reversed inside the offline capture. Cardinal labels and the
  broad silhouettes are comparable. Asymmetric details can differ from the
  actual game camera. The latest model for each of the 219 animals was
  recaptured with the corrected transform, retaining the same GLB bytes and
  version. The gallery uses those stills and videos and links the exact
  evidence sent to Opus.

## Reproduction

- The [cat builder](../../../art-source/experiments/cat/build.py) keeps the
  tuxedo cat original. The campaign captures it against the active
  `finish-v1` bank.
- The [wildlife builder](../../../art-source/experiments/wildlife/build.py)
  saves an editable `.blend`, animated GLB and geometry report. Run it in
  Blender with `-- <species-module> <candidate-output-dir> [variant]`.
  Second passes may reopen the first blend with
  [revise.py](../../../art-source/experiments/wildlife/revise.py) and a local
  revision brief, or use targeted edits in the original species builder.
- The [shared capture](../../../scripts/wildlife/capture-3d-candidate.mjs)
  resolves the runtime sprite and named clips, checks the GLB mappings and
  renders the comparison. Use `node --import tsx` and pass the candidate
  config followed by its output directory.
- The [review command](../../../scripts/wildlife/review-3d-candidate.py)
  accepts `submit`, `status` and `refresh`. It resolves the authorized Work
  pool, stores a stable request ID and follows the receipt to its conversation.
  The [report command](../../../scripts/wildlife/report-3d-campaign.py)
  reads only local evidence. Run with `--gallery` to update the comparison page.
- Reproduce the [Workshop check](../../../scripts/wildlife/verify-skinned-3d-candidate.mjs)
  and the full-roster runtime check with `node --import tsx`. Use
  [benchmark-render.mjs](../../../scripts/benchmark-render.mjs) with
  `--wildlife-campaign --scenes=wildlife --zooms=1 --seconds=4` and query
  `wildlife3dDrafts=1&wildlife3d=1` or `wildlife3dDrafts=1&wildlife3d=0`.
