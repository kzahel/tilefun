# Deer motion repair v2

Second batch of the owner-authorized eight-hour full-roster run, tactical 140.
Retains the original doe coat and white tail flag, native 48px cell,
(24,36) ground anchor and shared camera. No historical bank is overwritten.

`build.py` reads the immutable original Blender scene and moves the torso around
its center. Buried shoulder/hip points carry four-link leg solving; fore carpus
and hind hock use different poles/flexion. Cloven primary digits are actual
separated source mesh components.
Every segment has constant geometry/length. The existing tail flag action remains.
The 32-pose, 960ms walk matches 18px/s game movement; flee halves pose duration.
Idle and action retain their original 100ms pose timing. Source uses 100fps with
three timeline frames per walk pose, so its physical cycle also equals 960ms.

`finish.py` retains palette-letter body/face/hoof masters. Rigid painted parts
are reprojected through evaluated Blender bases. Separate joints/ears/tail drive
other parts; feet do not inherit the body's bob. Binary alpha, fixed palette,
padding and at least 1px native torso-paint excursion are required. The separate
saved-scene audit checks geometry, links, contact, matching travel, support,
loop closure and 65 continuous samples per facing.

Before registration, from the repository root:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python-exit-code 1 --python art-source/wildlife-v2/deer/motion-v2/build.py
python art-source/wildlife-v2/deer/motion-v2/finish.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python-exit-code 1 --python art-source/wildlife-v2/deer/motion-v2/audit.py
node scripts/wildlife/capture-motion-v2.mjs deer motion-v2
```

Normal builds use committed assets. Registered banks are immutable; reproduce
in an isolated checkout without the receipt. New pixels keep their own pending
human review identity. The agent's mechanical/visual checks are not human votes.
