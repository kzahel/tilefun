# Gorilla shoulder study

Owner request, 2026-10-19: adjust one gorilla and show its animation. This is a
focused upper-back/shoulder revision of `roster-v2`, independent of the expired
eight-hour run. Existing registered banks are immutable.

The silver saddle uses a closed inset shell of the actual torso surface rather
than a raised ellipsoid. Lower, flatter shoulders and quieter fur highlights
join it to the chest. The existing connected knuckle walk, body motion, planted
contacts, chest beat, camera, scale and timing are retained.

Build with Blender 5.2 using `build.py`, finish using Python/Pillow `finish.py`,
and inspect the saved source using Blender `audit.py`. Explicit replay:
`python scripts/wildlife/replay-motion-v2.py gorilla shoulder-study-v1`.
Browser verification:
`node scripts/wildlife/capture-motion-v2.mjs gorilla shoulder-study-v1`.
Register only after those checks using `node art-source/wildlife-v2/gorilla/shoulder-study-v1/register.mjs`.

This is a review candidate. Gameplay continues to use `roster-v2`; these new
pixels await the owner's review. Do not regenerate this bank after registration.
