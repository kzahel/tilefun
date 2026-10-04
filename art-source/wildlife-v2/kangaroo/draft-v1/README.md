# Male red kangaroo fresh draft

Actual gpt-6.1-sol/high, background-01-worker, thread
01a10511-b3f4-7bc3-b82a-6f836ba8056e. Draft authoring only; human approval pending.
Own fresh Osphranter rufus anatomy, not a rabbit/fox gait or recolored master.

Fixed wildlife-v2 camera40 degrees ABOVE GROUND (50 from vertical), orthographic,
10 pixels/world unit, yaws down180/up0/left100/right260.96 square canvas,
ground anchor48,68, ortho9.6, shiftY20/96. Native profiles43px versus provisional
roster36px; down43/up58 include projected long feet/tail and are not rescaled.
Original Explorer remains24 visible pixels and vendor roof/tree/cars are actual
committed Modern Exteriors crops. Camera/density were not changed for this animal.

Primary sources: [Australian Museum red kangaroo](https://australian.museum/learn/animals/mammals/red-kangaroo/)
for male russet coat, pale underside, dark/pale cheek stripe and elongated tail;
[Thornton et al.2025](https://doi.org/10.7554/eLife.96437.2)
for distinct hip/knee/ankle/MTP hopping mechanics in red/grey kangaroos;
[Australian Museum eastern grey](https://australian.museum/learn/animals/mammals/eastern-grey-kangaroo/)
for shared large hindlimbs/feet and balancing tail. Indexed primary research
text was available, but eLife full page/PDF and PMC hit challenge/403; no claim
of seeing full research figures or reproducing individual captured trajectories.
Museum photo links also failed to open. No downloaded model/imagegen substitution.

69 complete meshes,76 poses, one idle,10-pose synchronous hind hop and8-pose
independent ear listening. Actual support2,2,2,0,0,0,0,0,0,2: hind push2,
six flight/gather/reach poses3-8, simultaneous landing9. Forepaws never support
ground. Fixed femur .85/tibia1.10, forearm .48/.45, five .55-unit tail links,
real enlarged fourth toe/smaller fifth/two syndactylous toes. Heel and fourth toe
both actually touch at planted poses. Preview travel1.50 units/cycle compensates
backward planted-foot motion. Root and exported sheet remain in place; travel
is a separate demonstration whose displacement resets at loop boundary.

Torso/skull geometry and full marking templates remain rigid; ears articulate
from fixed pivots and the balancing tail has actual retained joint spheres.
No per-frame body/head scaling, shape keys or resampled pixel artwork. Palette
letter torso/head/hand masters and broad integer limb/foot/ear/tail composition
follow independent projected guides. Head width is deliberately about one pixel
broader for muzzle/eye readability. Stable relative anchor rounding avoids
subpixel flicker; profile lighting is mirrored. Near forearm legitimately masks
some chest pixels, so whole-body pixel identity is not claimed.

Reproduce: isolated Blender5.2.2 CLI with `--python-exit-code 1 --python build.py`;
workspace Python/Pillow `author-masters.py`, `finish.py`; fresh Blender process
`audit-source.py`; Node `capture.mjs`; Python `audit-output.py`, `review-panels.py`.
Use environment BLENDER_BIN. Live unsaved Blender work remains untouched; owned
bundled full Chromium is closed by the capture finally block. Actual commands,
exit codes, logs and normal rollout remain in the ignored session folder.

Source audit608 fixed limbs,380 fixed tail links,76 rigid heads,208 actual
heel/fourth-toe contacts passes, along with local mesh/topology/scale/projection
checks. Initial Euler audit API error was fixed and rerun; diagnostics retained.
Rig01 inward ears/tail penetration and unreachable landing target were corrected
without changing limb lengths. Drawing01 flat rear tail/heel separation and
front one-eye error retained. Drawing02 fixes them. A further captured tail-tip
rounding gap was rejected/retained; final finisher connects independent projected
tail joint centers. Integrity results do not establish visual approval.

Limits: profile43 versus36 proposal; tiny toes/claws/fingers and overlapping far
ear/feet, especially narrow front/rear views. Vertical in-place hop has no body
pitching or force/tendon simulation, speed variation, pentapedal slow walk or
blended stopping. Listening action is quiet at native scale. No female pouch,
joey, feeding or kick behavior; no claim these unlock other body/gait families.
