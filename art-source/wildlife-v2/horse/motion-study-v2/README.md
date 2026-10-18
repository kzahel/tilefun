# Horse motion study v2

Pending clay prototype authorized by the owner on 2026-10-18, tactical 139.
This supersedes the first study's source interpolation: v1's exported poses
were valid, but its Euler keys could wrap between poses. V2 uses a consistent
anatomical frame and compatible quaternions; 65 continuous samples check endpoint
continuity and bounded rotation. V1 remains an immutable historical study.
It is not finished pixel art and is not connected to `Fauna.ts`. The registered
`horse/draft-v1` and every giraffe artifact remain unchanged.

The existing horse torso/head/neck/tail geometry provides a common comparison.
New upper limb articulation is buried in shoulder/haunch mass, with overlapping
joint volumes connecting fixed-length upper, radius/tibia, cannon and pastern
segments. Fore and hind chains use opposite joint poles. A composite lower-chain
solve prescribes small loaded carpal flexion and a distinct hind hock bend before
solving elbow/stifle position. Swing flexion increases smoothly. The torso rises,
pitches and sways; its evaluated transform carries the high joints. The head has
small counter-follow. All limbs keep their geometry and scale.

Gait reference: the lateral four-beat order follows the
[University of Kentucky Extension walk description](https://horses.extension.org/horse-walk/).
Vertical torso/head movement and fore/hind weight transfer are informed by
[Timing of Vertical Head, Withers and Pelvis Movements Relative to the Footfalls](https://pmc.ncbi.nlm.nih.gov/articles/PMC9657284/).
The study's amplitudes, stride and joint angles are authoring choices, not a fit
to measured horse motion or a biomechanical validation.

## Reproduction

From repository root, using Blender 5.2.2, Python/Pillow, Node and bundled
Playwright full Chromium:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python art-source/wildlife-v2/horse/motion-study-v2/build.py
python art-source/wildlife-v2/horse/motion-study-v2/assemble.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python art-source/wildlife-v2/horse/motion-study-v2/audit.py
node art-source/wildlife-v2/horse/motion-study-v2/capture.mjs
```

`assemble.py` uses Windows Segoe UI only for review labels. All animal pixels
come directly from Blender, with no retouch, sprite bob, resizing to fit or scale
animation. The four game views retain 80px cells, anchor (40,61), 10px/world-unit
and the shared 40-degree camera. The larger side view is labelled diagnostic.
The native travel player applies the corresponding projected root displacement;
the side travel frames are rendered with actual Blender root movement against a
fixed camera. Ground ticks stay fixed. Travel resets after two strides.

The GIFs use 100ms poses (half speed); the original 32-pose walk is 1.6 seconds.
The interactive player adds pause, next pose, scrubbing and 25/50/100% speed.
Optional MP4s are encoded from those exact GIFs with:

```powershell
ffmpeg -hide_banner -loglevel error -y -i public/demos/wildlife-v2/horse/motion-study-v2/side-slow.gif -c:v libx264 -pix_fmt yuv420p -movflags +faststart public/demos/wildlife-v2/horse/motion-study-v2/side-slow.mp4
ffmpeg -hide_banner -loglevel error -y -i public/demos/wildlife-v2/horse/motion-study-v2/travel-slow.gif -c:v libx264 -pix_fmt yuv420p -movflags +faststart public/demos/wildlife-v2/horse/motion-study-v2/travel-slow.mp4
```

After registration this revision is immutable. Reproduction is for verification;
changed pixels require a new revision and return to human review. `register.mjs`
refuses to overwrite a registered identity. The receipt pins the pending bank.
The builder and assembler also refuse a registered bank. Run the recipe in an
isolated reproduction checkout with the receipt omitted, not against this bank.

## Observations and limits

The agent inspected side poses 0/8/16/24 and actual Chromium side/travel captures.
The loaded forelegs now read much straighter than the rejected deep zigzag;
upper articulation overlaps the existing chest/haunch. The torso changes pitch
and height relative to grounded hooves. A 1.15–1.46px native torso excursion
survives the game projection. The side study remains a deliberately simple,
segmented clay horse; body appearance and tail were not reauthored. Flat rigid
hooves currently have no toe roll. Human judgement of motion is still pending.
No claim of final visual approval follows from the mathematical checks.

The independent saved-scene audit checks actual evaluated joint/mesh endpoints,
fixed lengths and geometry, sole contacts, matching travel drift, 2/3 supports,
loop closure, ground anchor and native projected torso excursion. Browser
validation compares all 96 side/travel frames and 384 native crops, exercises
controls and closes its own full Chromium process and temporary HTTP server.
