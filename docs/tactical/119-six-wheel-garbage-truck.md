# Six-wheel garbage truck

Status: exact green v1 retained for owner inspection; no game integration.
Updated: 2026-10-11.
Owner: [vehicle model porting](../topics/vehicle-model-porting.md).

The owner requested another vehicle that exercises edge cases. The green garbage
truck adds a tandem rear axle, partly occluded wheels, independently owned side
controls, a tapered rear loader with a real recessed mouth/diagonal braces and
one amber warning beacon. Orange remains queued until family eligibility passes.

Use a new family constructor/configuration rather than inherit fire-truck or
compact geometry. Six measured cap centers, per-axle dimensions and floor
openings govern wheel placement; caps own wheel paint and tread uses explicit
palette fill. All tires remain grounded circles with independent roll pivots.
The loader has a separate hinge; a working pivot does not qualify its clearance.

The asset probes must read the declared wheel set instead of assume four wheels,
verify independent motion on every axle and reject missing extra axles. A single
beacon must be tested against its declared bright/dim pattern instead of assuming
two alternating groups. Reuse isolated lens material gain; fixed base/body paint
remain untagged. The asset carries warning semantics but does not add game sirens.

Opposite source views repeat the beacon on the same screen side. A fixed physical
lamp reverses screen position; retain this contradiction explicitly. Source roof
depth also differs across views: cabin/container/loader roof paint is rectified
to its observed region, preventing the mouth or container paint on the cab roof.
Keep native contours, actual GLB rig/light proofs and novel-angle inspection.

Retain the exact final GLB, packed Blender/atlas/draft sources, source crops,
portable recipe, measured configuration and excluded 4×2 review. Preserve every
earlier bundle and review candidate.

The [source bundle](../../art-source/vehicle-models/garbage-truck-green/v1/)
and [4×2](../../public/assets/models/vehicles/review/garbage-truck-green-v1/comparison.png)
contain the exact final checkpoint: 52 meshes/1,476 triangles, six wheel assemblies,
one loader hinge and one amber lens. All six actual GLB cap centers differ by
less than .005 native pixels from recorded source centers. Floor/center negative
probes reject a solid floor and displaced front axle; all-wheel forward/reverse,
grounding, independent motion, front-only steering and loader isolation pass.
Warning gain is 1/4/1/off=1; off reset is exact and body/housing paint stays fixed.
The 26 Python tests include missing middle-axle, incorrect steering and warning
semantics regressions. All nine catalog assets verify.

Native silhouette IoU is .911 east/west, .871 rear and .933 front, including
painted shadows; it does not qualify internal paint or physical proportions.
Rear-facing roof coverage and wheel sizes remain explicit fidelity limitations.
The reusable retention command copies exact checkpoint bytes, formats before
capture hashing and appends the new record without altering earlier bytes.

Validation: typechecks, lint, normal build, catalog/manifest generation and seven
relevant Playwright cases pass (six exact review revisions plus standalone
Workshop). The manifest verifies 767 candidates. Root units: 2,468 pass, six fail,
ten skip; the additional Workshop-service timeout passes all 13 isolated cases.
The remaining five failures are existing Windows symlink/SIGKILL checks, with
the existing static-files suite setup failure. No shared game renderer or
simulation changed; prior broad gameplay-suite limits remain in 117.

An index-only checkout verifies nine byte-pinned bundles and packed Blender
scenes, runs all nine actual GLB rigs and the single-beacon light probe, and builds
normally without scratch assets. The retained truck reproduces all eight native/
novel PNGs byte-for-byte; its constructor reproduces seven mesh/atlas/rig/paint/
config/light/center records exactly. All construction/retention provenance matches
tracked files. All eight earlier bundle/dependency records and files, plus all
766 earlier candidate objects, remain unchanged. The installed skill matches the
project copy. Scratch models/renders/probe logs stay ignored.

Next: owner review, qualify loader/steering clearance, then test orange template
eligibility or a long bus with asymmetric doors. Engine integration remains pending.
