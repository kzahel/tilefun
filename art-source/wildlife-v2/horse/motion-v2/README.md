# Horse motion repair v2

Owner accepted the horse motion study v3 and said “Complete both. Commit” on
2026-10-18. This revision finishes and activates only horse/giraffe motion.
Other historical species holds remain unchanged. The source prototype's chat
acceptance is recorded separately from pending human review of finished pixels.

`build.py` reads the immutable draft-v1 scene, retains the torso/head/neck/tail
geometry and appearance, and rebuilds four independent fixed-length leg chains.
Upper articulation sits inside the shoulder/haunch. Fore carpus and hind hock
have different poles and loaded flexion. Body rise/pitch/sway drives actual
anchors; head follow is subtle. Anatomical frames and compatible quaternions
avoid the source prototype's Euler wrap. A 32-pose walk is sampled alongside
one idle and eight existing tail-flick poses in four directions (164 total).

`finish.py` retains the original palette-letter coat and face masters, including
the bay coat, blaze and dark mane.
Each rigid painted body/head plane is reprojected through its evaluated Blender
basis, with integer nearest-neighbor palette finishing. This is camera projection
of rigid parts, with no model scaling. Legs, ears and tail use separate evaluated
source positions; grounded feet do not receive the body's motion. The original
native canvas, ground anchor, camera, physical body and movement speed remain.

Normal builds use the committed sheet. To reproduce before registration, run:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python-exit-code 1 --python art-source/wildlife-v2/horse/motion-v2/build.py
python art-source/wildlife-v2/horse/motion-v2/finish.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python-exit-code 1 --python art-source/wildlife-v2/horse/motion-v2/audit.py
node scripts/wildlife/capture-long-legged.mjs horse
```

After registration, use an isolated reproduction checkout without the receipt;
build/finish refuse registered banks. Source audit checks evaluated mesh endpoints,
constant geometry/scale/length, contacts, matching travel, support, loop closure
and 65 continuous samples per facing. Pixel audit checks palette, binary alpha,
padding, finished torso excursion and travel speed. Browser capture uses only
bundled full Chromium, exact crop checks and temporary isolated HTTP serving.
Changed pixels need a new revision; historical drafts/studies stay immutable.
