# Classic/default player v3 motorcycle fit — source pilot

Exact separate Classic v3 rider, one translation-only mount `[.10,0,1.0605]`
source. No profile, anatomy, scale or pose changes. The retained unchanged-bike
failure tests best upright translation, proper rigid least-squares fit and actual
saddle-contact placement against decoded GLB surfaces. None qualifies a fit.

The variant preserves 49 original semantic components exactly in master
coordinates, topology and UV, including every saddle piece, tank, engine, frame,
fork, wheel/radius and fender. Six existing components change: riser, bar, two
grips and two pegs. Four swept riser sections and two crankcase-to-peg brackets
are added. A right fork-crown stem passes outside the tank shoulder and below the
collar, meeting the bar inboard of the paw. Actual decoded surface connections
and tank nonintersection are measured separately. Displacing the stem into the
tank is rejected, then reset. Base atlas bytes remain exact. Own geometry was
reexported; base GLB buffers are not claimed unchanged.

Bike: 2,602 triangles / 4,798 UV vertices / three draws / one opaque 512 nearest
unlit atlas. Immutable rider: 1,766 triangles / one draw / own opaque 256 atlas.
Separate source composition: 4,368 triangles / four draws / two atlases in one
depth target. Editable packed master and low are bike sources; exact rider
master/low are retained separately under `inputs`. Parent owns final composition.

Evidence covers actual five contacts and narrowly named saddle/paw/sole pairs,
closed palms/boots, self/straddle controls, both full neutral wheel cylinders and
collision/reset controls, tank-displaced rider controls, crown 25 each plus
controls, 192 raw frames, 96 native wires, signed roll/pivots/reset, 32 fixed-density
padding comparisons, exact 192×224 occupied-pixel placement and desktop/mobile/
offline checks. Native wire lines become dense at this scale; editable topology
and decoded UV audits provide separate evidence.

Construction requires only six declared files: own `build.py`, `geometry.py`,
`family.json`, `raw-audit.py`, stable `catalog-cycle.py` and the exact measured
Classic contact profile. Run:

```sh
BLENDER --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/classic-motorcycle-player-fit/build.py -- --scratch
```

The builder accepts explicit `--config` and `--variant-id`; an ignored control
changes grip length and verifies a changed GLB with the same atlas. This does not
authorize other riders. `evidence/replay-verification.json` also works with the
generic `source-replay.py`. Fresh construction reads no master, rider GLB or
ignored input; fit diagnostics pin those separately.

The public counterpart's `offline-raw.html` embeds exact bike/rider bytes and
uses unchanged shared projection and 58/58/80 outline. It raw-loads GLTF;
CarMeshAsset qualification remains pending parent. Classic's violet source-view
adapter is separate and unchanged. Source completion is not human approval,
normal availability, AI, fallback, all-27 or standing parity. Empty-bike and
rider-hidden masks do not qualify normal occupancy. ±0.2 steering frames prove
raw pivot/angle/reset only; operating fork/control/rider animation and nonzero
steering clearance are unqualified. Final helpers and source bytes are immutable.
