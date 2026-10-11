# Police car and fire truck authoring

Status: exact police/stowed fire bundles retained; awaiting owner inspection,
engine integration and clearance qualification.
Updated: 2026-10-11.
Owner: [vehicle model porting](../topics/vehicle-model-porting.md).

The owner requested more siren-capable vehicles, particularly police and fire.
The bank contains ambulance, police and one fire truck represented by stowed and
raised ladder sets. Green/orange garbage trucks have amber warning beacons;
those are warning-light candidates rather than emergency siren vehicles.

This slice authors police-car and fire-truck-ladder-1 with independent geometry,
source-owned UVs, separately rotating wheels and tagged light lenses. Fire's
ladder is a separate hinged component; the raised source pose remains queued
for its own fit and clearance qualification. Asset lights reuse 116's helper;
game control, siren audio and per-asset integration remain separate work.

Do not inherit compact geometry/cameras on the strength of a shared palette.
Freeze source crops, preserve projected draft/uncertainty and retain the exact
finished GLBs, packed scenes, atlases and replay dependencies. Show sprite-above/
model-below 4×2 sheets, contours, novel angles and actual GLB flash previews.

Source contradiction: police sprites keep blue left/red right in both head-on
views. A fixed physical bar reverses order. Retain north/east ownership and
record the south/west differences explicitly rather than switching textures by view.

## Retained result

The new family constructor/configuration and component builder preserve explicit
UV owners per face, separate ink/glass apertures, centered wheel rigs and fixed
light housings. Chamfered police end geometry, mirrors and a cleaned roof-bar
footprint replace the initial square ends/duplicate lamp paint. Fire's separate
rails/rungs own the ladder paint; its hidden roof footprint is an inferred fill.
Each scene packs its exact cleaned atlas and its own unused projection draft.

| Model | Geometry | Wheels | Lights | Equipment |
| --- | --- | --- | --- | --- |
| Police v1 | 37 meshes, 1,248 triangles | 4 radius-4.4 tire/hub rigs | 2 red/blue tagged lenses, alternating phases | Fixed bar and bases |
| Fire stowed v1 | 49 meshes, 1,260 triangles | 4 radius-9 tire/hub rigs | 2 blue tagged lenses, alternating phases | Separate `Ladder_Hinge` with child rails/rungs |

Exact exports and packed sources are in
[`art-source/vehicle-models/`](../../art-source/vehicle-models/README.md), pinned
by the bundle catalog. The [review collection](../../public/assets/models/vehicles/review/index.html)
links 4×2 comparisons (sprites above/render below), novel angles, native contours
and real GLB flashing GIFs. Workshop registers two new excluded inspections:
`projection:authored-police-car-v1` and
`projection:authored-fire-truck-ladder-1-v1`. All 763 prior candidate records
and the five prior retained bundle records remain unchanged.

## Fit limits and next work

Native contour IoU, east/west/rear/front, includes painted sprite shadows:
police 0.863/0.915/0.894/0.876; fire 0.859/0.858/0.922/0.926. This is occupancy
evidence, not owner approval or an internal-window/fender fidelity score.
Police hood/cab shape, wheel footprint and light-bar paint remain approximate;
physical lamp ordering reverses south/west. Fire's north-owned cab roof puts
panels differently in the front view; ladder length/height and wheel footprints
remain approximate. Source paint on unseen surfaces is explicitly inferred.

The actual GLBs verify independent forward/reverse wheel roll, radius/sign,
ground contact, front steering only and fixed body/fenders. Fire's declared
glTF hinge axis/pivot/hierarchy are checked; rotating it moves only ladder
geometry. Steering and raised-ladder clearance remain unqualified. Two-lens
off/A/B tests verify the light contract, unchanged fixed paint, distinct rendered
states and an exact off reset. The shared helper's code stays unchanged.

The next family step is fitting the raised ladder source pose and qualifying
its equipment clearance. Game asset selection/light state and optional siren
audio remain separate integration work; these source bundles do not add controls.

## Validation

Typecheck, lint and production build pass. The authoring suite passes all 23
tests, including mutated light phase and ladder-axis rejection. Actual Chromium
GLB probes pass for all seven retained rigs and both new two-lens patterns.
Tracked-file-only extraction has no ignored templates or scratch galleries;
both new recipes reproduce all eight native/novel image hashes exactly. All
seven Blender scenes audit with packed file images, exact atlas bytes and rigs.
Constructor/configuration and shared light-helper/pattern hashes match the
extracted checkout. Its production build passes, and all four retained emergency
review pages pass desktop/phone opening, image loading, overflow and model
download checks. The standalone Workshop test passes there too (5/5 isolated
browser tests). Normal dependencies are installed separately; no generated
model dependency or demo bundle is required.

Formatting new review JSON after the first inventory render made its input
receipt stale. Refreshing the inventory preserves all candidate identities and
restores the final build/fresh-checkout checks. The full run's standalone timeout
passes on the isolated fresh-checkout retry after that refresh.

The Windows unit suite reports 2,468 passing, six failing and ten skipped;
the extra Workshop-service timeout passes on isolated retry (13/13). The five
remaining failures match the earlier Windows symlink/SIGKILL limitations;
the static-files suite also retains its existing setup failure.
The full run's two fish readiness failures pass as separate Canvas/GPU tests
on a single worker in the fresh checkout (2/2); no wildlife files are changed.
Full Chromium suite: 540 passed, ten failed, one skipped (551 tests, 25.1 min).
All four retained emergency-review cases pass. Standalone, both fish, both
Canvas tap-movement and the Canvas garage failures pass isolated retries (six
of ten). Two pre-existing phone-review layout failures remain; both plain
Canvas/GPU car-driving distance checks also fail on the single-worker retry.
The same car-driving assertions failed in 116's full run; its earlier isolated
Canvas retry passed while GPU remained failing. Game/simulation code and the
existing blue model are unchanged in this slice. These repository failures do
not qualify driving/clearance for the new assets; that work remains pending.
