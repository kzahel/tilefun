# White-tailed doe draft-v1

Fresh species-specific Blender geometry with 30 retained meshes and 84 actual projected poses. Run build.py only in an isolated background Blender process; deer.blend remains the editable source. audit.py independently reopens that saved file. Full vertices occur once in the blend; projected-guides.json is compact hull/bounds/contact data.

Camera: fixed wildlife-v2-camera-01, 40 degrees above ground (50 from vertical), yaws down180/up0/left100/right260. Density 10 world pixels/unit; canvas48, ortho4.8, anchor(24,36), shiftY0.25. Source fore links0.67/0.80, hind0.70/0.81; no scale keys. Twelve-pose contralateral-overlap walk and eight-pose rigid tail flag, rooted in place.

author-masters.py retains deliberate palette-letter masters, eight shared colors and native silhouettes. finish.py performs integer Pillow composition from independent source contacts/landmarks. It does not quantize guide renders, download models or resize animals. verify.py checks deterministic encoded replay, full opaque skull/ear templates, GIF decode and actual browser canvases. capture.mjs runs bundled full Chromium, with owned browser/server cleanup.

Visual findings and specific limits: public/demos/wildlife-v2/deer/draft-v1/review-observations.md. Pending human draft; no gameplay promotion. Future changed pixels require a new registered revision.
