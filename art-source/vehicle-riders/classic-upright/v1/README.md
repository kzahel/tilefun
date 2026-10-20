# Classic upright source pilot

Original static compact cream cat for the default `player` appearance. This is
one source prerequisite, not normal avatar/motorcycle availability, actual-bike
fit, all-27 coverage, AI occupancy or occupied fallback. Human approval is false.

The constructor reads exactly `build.py`, `rider.json`, `identity.json` and
`classic-upright-v1.json` from its own directory. Identity provenance pins the
unchanged original standing PNG separately. Geometry uses an original broad
head, solid pointed ears, tiny torso and fixed short paw chains. Palette paint
uses seven original colors on real skin; no transferred exterior sprite contour,
standing billboard or framebuffer redraw. `master.blend` retains named semantic
parts; `low.blend` joins them into one mesh. Both pack their atlas. No automatic
high-to-low transfer or skeletal animation is claimed.

Generic mesh/IK/triangle canonicalization mechanics were copied from the retained
Bear pilot; fixture, actual GLB diagnostics and viewer mechanics were adapted
from Person7. Their anatomy and all earlier bytes remain unchanged. These copies
are now owned helpers. No prior rider GLB or ignored master is a constructor input.
Explorer is a read-only common-world-ruler diagnostic, not a template to resize.

For an independent retained-input replay:

```sh
python scripts/vehicle-bake/source-replay.py art-source/vehicle-riders/classic-upright/v1/evidence/replay-verification.json --qa data/vehicle-riders/classic-upright/parent-replay --blender BLENDER --deadline UTC_ISO
```

The own `replay.py --blender BLENDER` also proves a fresh repository with just
four constructor files and generated root scaffolding. `build.py -- --scratch`
under Blender writes replay outputs under ignored data. Do not rerun normal
construction/finalization over a complete source revision.

`fixture.py` generates five synthetic patches under ignored data. `prove.py`
checks the actual imported GLB against them, actual bone end rings, bounded local
anatomical joins, closed palms/soles and finite straddle opening. Missing-face,
nonlocal palm/head collision, collapsed legs and displaced/reset negatives are
retained. These prove no actual frame, wheel, mount, pose animation or other body.

`build-view.mjs` builds only an ignored raw-GLTF source viewer. `capture.mjs`
qualifies 16 study + 16 game headings, wireframes, fixture/ruler controls and
mobile/network-free pixels. It uses the unchanged fixed projection and an owned
violet outline adapter derived from the vehicle outline, not CarMeshAsset or the
production vehicle outline. `identity-inspect.py` uses original standing pixels,
actual PNG captures, decoded GLB geometry/UVs and one common ruler; no view is
individually fitted. Source depth/joints are inferred from2D. Parent actual-bike
fitting and current shared-engine/authority/identity/fallback gates remain separate.

The retained `offline.html` is self-contained. Once `finalize.py` seals this
revision, source/public/helpers and retained-file pins are immutable.
