# Panther hunt-v1

Editable Blender meshes, fixed wildlife projection, IK-posed grounded feet and
explicit integer palette masters. A lean unstriped melanistic big cat: narrower torso, shoulders and pelvis; smaller cheek/skull volumes and ears; an eight-segment curved tail. The charcoal/slate palette keeps the back, belly and near/far legs readable; amber eye pixels survive the front and side views.

This is a new predator-132 source based on the reusable quadruped camera/IK and
integer finishing method of tiger/pilot-v1, with species-owned geometry and face
masters. It does not replace any historical source or imply human approval.
Runtime clips reuse the walk/sniff/display as documented in the public notes.

Registered artifacts are immutable. Replay in a fresh ignored workspace:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/panther/hunt-v1/build.py -- --workspace data/predators-132/panther-fresh
python art-source/wildlife-v2/panther/hunt-v1/finish.py --workspace data/predators-132/panther-fresh
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background data/predators-132/panther-fresh/source/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/panther/hunt-v1/audit.py -- --workspace data/predators-132/panther-fresh
node art-source/wildlife-v2/panther/hunt-v1/capture.mjs
node scripts/wildlife/check-predators.mjs
```

Use the installed Blender executable for your platform. The captured toolchain
was Blender 5.2.2 / Python 3.13 / Pillow. Normal game builds consume committed
exports. Source projection and final paint are intentionally separate. Palette
letters in masters.json retain every finished pixel. Audit checks the saved
scene independently of the builder's guides, including mesh geometry, bone
lengths, ground contacts, camera and weight transfer.

See public/demos/wildlife-v2/panther/hunt-v1/review-observations.md for evidence
and limitations. Human art approval remains pending.
