# dog behavior revision 1

Owner-authorized batch [155](../../../../docs/tactical/155-fetch-nests-and-caches.md).
Final pixels and behaviors remain pending human review; no approval is inferred.
Previous source and review banks are immutable.

Replay with Blender 5.2 and Python/Pillow using `scripts/wildlife/replay-behavior-155.py SPECIES behavior-v1` in an isolated checkout (omit only its receipt.json). The retained build.py, finish.py, audit.py, native .blend, projected geometry, palette masters, camera and pinned inputs contain the complete source. Dog projection JSON is gzip-compressed with a deterministic zero timestamp; finish/audit read it directly. No network or historical ignored draft is required.

New action clips retain fixed geometry and linked joints. Food/materials are separate actors; the squirrel has no painted fake nut. Projected per-frame mouth/paw sockets generate `src/wildlife/behavior-art.json` through `node scripts/wildlife/behavior-art.mjs`; the game uses that committed attachment bank. Full Chromium capture validates every facing/clip crop at 1x and 3x. `validation.json`, `source-audit.json`, `pixel-audit.json` and the receipt record evidence.
