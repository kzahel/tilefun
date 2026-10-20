# Articulated dump truck v2

Retained 3,720-triangle revision with the v1 component vertices, semantic UVs and
512px palette atlas. Six independent wheels remain unchanged. The tub and top
hinged tailgate have their own pivots; two hydraulic rams extend between fixed
bases and the moving bed. The runtime GLB is 259,684 bytes. Human appearance
review is pending; runtime integration is authorized by the owner.

`recipe.json` pins every source dependency and final artifact. `car.blend` packs
its textures. `model.glb` is self-contained. `fallback.json` retains the same
triangles and UVs for the Canvas/failed-mesh software depth rasterizer. Normal
builds consume these artifacts; they never invoke Blender. Intermediate captures
and fresh replay directories belong under ignored `data/`.

Replay using Blender 5.2 in a fresh directory:

```
blender --background --python scripts/vehicle-bake/dump-truck/articulate.py -- --output data/vehicle-bake/dump-truck-v2-fresh
```

The constructor refuses an existing retained recipe. Compare exact GLB, atlas and
fallback JSON bytes; Blender saves include workspace metadata, so compare packed
scene contents rather than claiming a reproducible blend-file byte stream.

`src/rendering/DumpTruckRig.test.ts` decodes v1/v2 through the normal loader,
compares every rest vertex, and independently checks both pivots, ram endpoints,
all six wheel transforms and absolute pose reset. `TruckBedTipping.test.ts` tests
actual shared authority, discharge, incline walking/jumping, obstruction, drive
lock and save/reload. See `docs/vehicle-bed-prototype.md` for extension contracts.
