# King cobra draft-v1

Fresh standalone Ophiophagus cobra, 40 degrees above ground, 10 world pixels/unit.
96 square canvas, anchor48,60, ortho9.6, camera shift12/96. No scale animation or
sprite resampling. Profile idle18/17px; front23 and rear41 reflect trailing-body
foreshortening rather than squashing each facing to the same height.

Build with Blender5.2.2 isolated background/factory scene and `--python-exit-code 1
--python build.py`; run `audit-source.py` in a fresh Blender process. Pillow
`finish.py` reads compact independent projected hulls, node/contact positions and
palette-letter `masters.json`, never render colors. `audit-output.py` checks
fixed skull templates, replay, decoded outputs and actual Chromium readbacks.
`capture.mjs` launches only bundled full Chromium and closes browser/server.

Forty meshes retain full geometry in king-cobra.blend. Fifteen .24-unit tapered
links and overlapping fixed-size joints form the grounded posterior chain;
head, narrow oval raised hood and low neck are fixed volumes. The eight-pose
wave has maximum left bends at actual poses2,3,4,5,6,7,0,1 as links advance
toward the tail. Continuous sliding belly contacts replace a footfall schedule.
Logical endpoints use Python double precision; saved Blender matrices are
float32. Fresh endpoint deviation2.51e-7 world units, projected bounds within
5e-6px. Action has a fixed-length distal tail curl and retracting forked tongue,
occluded behind the rear head. The raised anterior body is held alert throughout;
this is stylized defensive slithering, not measured species gait or friction.

Primary grounding: [San Diego Zoo king cobra](https://zoo.sandiegozoo.org/animals/king-cobra)
describes spreading neck ribs/muscles into a hood. [Jayne2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7391877/)
distinguishes travelling lateral bends with sliding support from sidewinding,
static concertina anchors and rectilinear skin motion. No downloaded model or
animal image used as source. No Naja spectacle marks. Vendor roof/tree/cars and
approved Explorer establish scene perspective/density; approved elephant
pilot-v2 supplies only generic playback/capture plumbing, no cobra anatomy/art.

The initial64px construction canvas clipped profile/rear tails; enlarged to96
without camera elevation/density or model changes. Drawing01 had an invisible
rear tongue action; retained exact source/sheet in ignored campaign evidence,
then independently articulated the tail tip for drawing02. One builder assertion
revealed float32 endpoint accumulation; logical endpoints now use double
precision without changing mesh length or assertion tolerance. Earlier Blender
omitted `--python-exit-code 1`, so the failed log exited0; success is established
by subsequent explicit-exit-code build and independent audit, not that exit0.

Final observations and limitations are in the public review-observations.md.
All exact source/output bytes become immutable upon registration. Pending draft
only; neither coordinator acceptance nor human approval is implied.
