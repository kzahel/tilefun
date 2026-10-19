"""Read-only checks on the saved Blender source. Does not save or render."""
import json
from pathlib import Path
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/"data/vehicle-style-study/01-detailed-shaded"
scene=bpy.context.scene
car=bpy.data.objects["SPORTS_COUPE_ROOT__forward_minus_X"]
assert scene.render.resolution_x==scene.render.resolution_y==512
assert scene.render.film_transparent
assert scene.render.threads==4
assert scene.render.engine=="CYCLES" and scene.cycles.device=="CPU"
assert scene.cycles.samples==16
assert abs(scene.camera.data.ortho_scale-7.2)<1e-6
anchor=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
assert abs(anchor.x-.5)<1e-6 and abs(anchor.y-.5)<1e-6
assert all(ob.parent is None for ob in scene.objects if ob.type in {"LIGHT","CAMERA"})
dg=bpy.context.evaluated_depsgraph_get()
lo=[1e9]*3; hi=[-1e9]*3; tris=0; meshes=0; tires=[]
for ob in scene.objects:
    if ob.type not in {"MESH","CURVE"}: continue
    ev=ob.evaluated_get(dg); me=ev.to_mesh(); me.calc_loop_triangles()
    tris+=len(me.loop_triangles); meshes+=1
    positions=[ob.matrix_world@v.co for v in me.vertices]
    for p in positions:
        for a in range(3):
            lo[a]=min(lo[a],p[a]); hi[a]=max(hi[a],p[a])
    if ob.name.endswith("_rubber_tire"):
        assert ob.parent.name.startswith("Wheel_")
        bottom=min(p.z for p in positions)
        assert abs(bottom)<1e-6, (ob.name,bottom)
        tires.append({"name":ob.name,"center":list(ob.parent.matrix_world.translation),"minimumZ":bottom})
    ev.to_mesh_clear()
assert len(tires)==4
assert abs((hi[0]-lo[0])-4.6)<1e-5
assert tris>=15000 and abs(lo[2])<1e-6
render=json.loads((DATA/"render.json").read_text())
assert tris==render['complexity']['evaluatedTriangles']
report={"passed":True,"evaluatedTriangles":tris,"evaluatedMeshCount":meshes,
        "visualBounds":{"min":lo,"max":hi},"visualLength":hi[0]-lo[0],
        "groundCenterRawPx":[anchor.x*128,(1-anchor.y)*128],
        "groundCenterFinalPx":[anchor.x*128,(1-anchor.y)*128+28],
        "fourTireContacts":tires,"cameraAndLightsFixed":True,
        "renderer":"Cycles CPU / 16 samples / 4 threads",
        "limitations":"No animated steering or collision clearance qualification."}
(DATA/"scene-validation.json").write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
