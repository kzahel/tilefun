# Tiger pilot v1

Natural quadruped tiger authorized by the owner on 2026-10-18 in tactical 131.
Human art review is pending. This is a Blender/pixel art pilot; gameplay and a
runtime skinned model are separate work.

`animal.blend` is the exact editable 46-mesh source, with keyed body, moving-hip
limb solves, level paws, stabilized skull, tail and jaw controls. Mesh volumes
and limb lengths stay fixed. `masters.json` retains the final palette-letter
drawings. `finish.py` owns the authored skull drawings, broad coat bands and
mesh-attached projected stripe curves; it does not quantize Blender render colors.

The shared 40-degree-above-ground orthographic camera stays at 10px/world unit.
The 96px canvas uses scale 9.6, shift Y 0.25 and anchor (48,72), without resampling
the animal. Idle visible heights are profile 24px, front 36px and rear 39px,
including the low tail. Individual facing bounds are intentionally different.

The walk has 12 samples at 100ms each and 0.96 world units / 9.6px travel per
cycle. Lateral footfall order is HL, FL, HR, FR, with 75% stance. Hips move with
body rise (0.19-unit peak-to-peak) and 1.8-degree pitch; limb solving cancels the
matching travel at each grounded stance target. One idle pose, eight sniff poses
and eight jaw-display poses give 116 four-facing source/drawing poses. Sniff
lowers the rigid head; the rear jaw is naturally occluded during the display.
This is stylized motion, not a claim of measured tiger biomechanics.

## Safe replay

Registered source and pixels are immutable. Builders refuse to overwrite a
registered default source. Replay into a new ignored workspace from the repo root:

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/tiger/pilot-v1/build.py -- --workspace data/tiger-131/NEW_REPLAY
python art-source/wildlife-v2/tiger/pilot-v1/finish.py --workspace data/tiger-131/NEW_REPLAY
blender --background data/tiger-131/NEW_REPLAY/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/tiger/pilot-v1/audit.py -- --workspace data/tiger-131/NEW_REPLAY
```

Toolchain checked here: Blender 5.2.2 LTS, Python 3.13/Pillow. Dependencies are
the tracked wildlife camera, Modern Exteriors atlas, Explorer sheet and elephant
v2 sheet/descriptor for the unchanged-density scale comparison. Normal builds
use retained outputs and never run Blender. The scratch guide JSON is regenerated
from the builder; no ignored input is needed for replay. The `.blend` binary is
retained exactly; replay equivalence is asserted on pixels/metadata, not Blender
save bytes.

`node art-source/wildlife-v2/tiger/pilot-v1/capture.mjs` serves public files on an
ephemeral loopback port and uses bundled full Chromium. It checks every actual
chronological crop at native/4× scale, records scene/travel captures, then closes
the browser and server. Large QA captures stay in ignored `data/tiger-131/`.
The native review PNGs/GIFs, player, audit, observations and exact receipt remain
portable. `finalize.py` refuses an existing registered identity and never submits
human feedback.
