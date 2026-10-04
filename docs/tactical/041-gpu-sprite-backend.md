# 041 — GPU sprite backend

Status: complete, 2026-10-04. Parent: [039](039-fixed-view-gpu-parent.md).

Share existing scene drawing through a narrow raster-surface interface (native
Canvas and GPU primitives), including sprite placement, shadows, grass, elevation
and interior actors. GPU draws textured triangles using reusable buffers and
persistent, versioned image uploads. Reuse TileRenderer and room preparation;
no duplicate terrain/autotile or interior ordering implementation.

Use a separate world GPU canvas beneath the original input/HUD canvas, selected
in application composition. Optional `?renderer=gpu` selects the experimental host;
Canvas stays default. Fail construction back to Canvas. Overlay text and vector
annotations may use a bounded Canvas staging layer, explicitly measured.

Full-Chromium comparison fixtures check sprite/terrain/interior samples, clipping,
alpha and warm upload reuse. Changing prepared terrain needs an explicit surface
revision even while a partial canvas retains its identity. Track resource counts,
uploaded bytes and draw calls; release cold resources and all resources on teardown.

Delivered: paged nearest-filter texture cache, reusable vertex buffer, shared
raster preparation/drawing, optional GPU host and registered renderer comparison
lab. Full Chromium reports exact sprite-fixture pixels (including flip/alpha),
zero warm uploads and correct overlapping clip union. Native pixel-exact shadow
readback ignores Canvas clips; clip comparison therefore isolates bodies, while
unclipped shadows retain their independent test. Smooth gameplay shadows remain
shared Canvas-prepared small ellipse textures, not full-frame rasterization.

Typechecks, 1,438 unit tests, lint (unchanged warnings), catalog/manifest generation,
production build and both GPU browser tests passed. Manifest verified all 552
identities. Full browser regression remains the final integration gate.
