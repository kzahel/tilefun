# Mid fender correction replay

Run from the repository root into a fresh revision; existing revisions are refused.
Retained budget-mid is the direct source. No ignored scratch is needed.

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/a-reduced-projection/refine_fenders.py -- art-source/vehicle-bake/a-reduced-projection/mid-fenders-v3/input-recipe.json NEW_REVISION
python scripts/vehicle-bake/a-reduced-projection/finish.py NEW_REVISION
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/a-reduced-projection/audit.py -- NEW_REVISION
node scripts/vehicle-bake/a-reduced-projection/capture.mjs NEW_REVISION
python scripts/vehicle-bake/a-reduced-projection/review.py NEW_REVISION
```

Scripts are also retained in this bundle under scripts/. Geometry is fixed in Blender and the atlas; no camera/draw-order/hiding or screen-paint changes.
