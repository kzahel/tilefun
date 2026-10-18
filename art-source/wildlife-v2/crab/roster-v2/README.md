# Fresh sideways crab prototype

Separate roster-v2 identity under tactical 140. The builder starts from an
empty Blender scene and reads no historical crab source or pixels. It models
a wide flattened carapace, raised black eyes, mouthparts, eight three-link
walking legs, two two-link claw arms, rigid palms and separately hinged digits.
The 32px cell keeps the shared 10px/world-unit camera and a (16,22) anchor.

Two interleaved sets of four legs carry the shell sideways along local +X.
A .66 stance fraction preserves four or eight contacts; feet are stationary
in the travel-compensated frame. The shell lifts and tilts above independent
foot contacts, with constant link lengths and local mesh volumes. Thirty-two
poses span 960ms and 6.4px at 6.6667px/s. An eight-pose action lifts/opens both
claws. No animated scaling or whole-image bob is used. All motion is keyed
in the saved Blender scene, including intermediate source poses.

Body paint is derived once from this species' rest volume guides, then follows
its actual rigid basis. The eight limbs and hinged claws follow projected
source joints and geometry. Export math/playback plumbing is reused from the
current authoring tools; no other animal's painted parts are reused.

Exact final pixels require source audit, explicit deterministic replay,
two-scale Chromium playback and shared game checks before registration.
Human art review remains pending; agent visual inspection is not approval.

The saved-scene audit checks 129 continuous walk samples/facing and 33 claw
samples/facing, 7,872 fixed walking links, 1,312 claw links, 1,952 contacts
and 1,344 planted travel pairs. Maximum interpolated endpoint separation is
.000406 world units (under .005 native px); maximum sample rotation is 3.98
degrees. All local meshes/scales remain constant and both loops close. Shell
paint moves 2px in each facing. Read-only Blender renders confirm the separate
eight-leg/ten-appendage anatomy; native/enlarged paint and chronological
playback were inspected. Claw detail remains small at this native scale.
Explicit replay reproduces all ten outputs byte-for-byte; two-scale Chromium
checks all 328 exact facing crops and playback controls.
