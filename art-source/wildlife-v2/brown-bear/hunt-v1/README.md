# Brown bear hunt-v1

Editable Blender meshes, fixed wildlife projection, IK-posed grounded feet and
explicit integer palette masters. A broad brown bear with independent enlarged torso/shoulder/pelvis/neck volumes, wider hips, thick lower limbs, larger paws, rounded low ears, a deeper muzzle and a one-segment stub tail. Its stride is .84 units, and front foot landings occur at poses 4/10 instead of the cats' 3/9. Body rise is .17 units peak-to-peak, with real pitch and limb compensation.

This is a new predator-132 source based on the reusable quadruped camera/IK and
integer finishing method of tiger/pilot-v1, with species-owned geometry and face
masters. It does not replace any historical source or imply human approval.
Runtime clips reuse the walk/sniff/display as documented in the public notes.

Registered artifacts are immutable. Replay in a fresh ignored workspace:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/brown-bear/hunt-v1/build.py -- --workspace data/predators-132/brown-bear-fresh
python art-source/wildlife-v2/brown-bear/hunt-v1/finish.py --workspace data/predators-132/brown-bear-fresh
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background data/predators-132/brown-bear-fresh/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/brown-bear/hunt-v1/audit.py -- --workspace data/predators-132/brown-bear-fresh
node art-source/wildlife-v2/brown-bear/hunt-v1/capture.mjs
node scripts/wildlife/check-predators.mjs
```

Use the installed Blender executable for your platform. The captured toolchain
was Blender 5.2.2 / Python 3.13 / Pillow. Normal game builds consume committed
exports. Source projection and final paint are intentionally separate. Palette
letters in masters.json retain every finished pixel. Audit checks the saved
scene independently of the builder's guides, including mesh geometry, bone
lengths, ground contacts, camera and weight transfer.

See public/demos/wildlife-v2/brown-bear/hunt-v1/review-observations.md for evidence
and limitations. Human art approval remains pending.
