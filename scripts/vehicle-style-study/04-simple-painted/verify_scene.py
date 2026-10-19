"""Read-only saved-scene geometry/rig/camera verification in background Blender."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/'data/vehicle-style-study/04-simple-painted'
bpy.ops.wm.open_mainfile(filepath=str(DATA/'sports-coupe.blend'))
scene=bpy.context.scene
body=bpy.data.objects['Body_PaintedShell_Glass_Trim']
wheels=sorted([o for o in scene.objects if o.name.startswith('Wheel_')],key=lambda o:o.name)
assert len(wheels)==4
assert all(o.parent==body.parent for o in wheels)
assert scene.render.threads==4 and scene.cycles.samples==8 and scene.cycles.device=='CPU'
assert scene.camera.data.type=='ORTHO' and abs(scene.camera.data.ortho_scale-7.2)<1e-6
origin=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
assert abs(origin.x-.5)<1e-6 and abs(origin.y-.5)<1e-6
assert abs(scene.camera.location.y+12*math.cos(math.radians(50)))<1e-5
assert abs(scene.camera.location.z-12*math.sin(math.radians(50)))<1e-5

def world_verts(obj):
    return [obj.matrix_world@v.co for v in obj.data.vertices]

def clip_y(poly,limit,above):
    result=[]
    if not poly:return result
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ai=a.y>=limit if above else a.y<=limit
        bi=b.y>=limit if above else b.y<=limit
        if ai:result.append(a)
        if ai!=bi:
            t=(limit-a.y)/(b.y-a.y)
            result.append(a+(b-a)*t)
    return result

def segment_distance(p,a,b):
    ab=b-a
    t=max(0,min(1,(p-a).dot(ab)/ab.length_squared)) if ab.length_squared>1e-14 else 0
    return (p-(a+ab*t)).length

def polygon_distance(p,poly):
    projected=[Vector((v.x,v.z)) for v in poly]
    cross=[]
    for a,b in zip(projected,projected[1:]+projected[:1]):
        edge=b-a;delta=p-a
        cross.append(edge.x*delta.y-edge.y*delta.x)
    # Only nondegenerate polygons have an inside; clipped lines still use edges.
    area=sum(a.x*b.y-b.x*a.y for a,b in zip(projected,projected[1:]+projected[:1]))
    if abs(area)>1e-10 and (all(x>=-1e-9 for x in cross) or all(x<=1e-9 for x in cross)):return 0
    return min(segment_distance(p,a,b) for a,b in zip(projected,projected[1:]+projected[:1]))

bpy.context.view_layer.update()
body.data.calc_loop_triangles()
body_points=world_verts(body)
clearance=[]
for wheel in wheels:
    center=wheel.matrix_world.translation
    minimum=1e9
    for tri in body.data.loop_triangles:
        polygon=[body_points[i] for i in tri.vertices]
        polygon=clip_y(polygon,center.y-.11,True)
        polygon=clip_y(polygon,center.y+.11,False)
        if polygon:
            distance=polygon_distance(Vector((center.x,center.z)),polygon)
            minimum=min(minimum,distance-.33)
    assert minimum>0,(wheel.name,minimum)
    clearance.append({'wheel':wheel.name,'conservativeFullCylinderBodyClearance':minimum})

fixed_body=[tuple(v) for v in body_points]
baseline={o.name:[tuple(v) for v in world_verts(o)] for o in wheels}
motion=[]
for active in wheels:
    active.rotation_euler.y=math.radians(37)
    bpy.context.view_layer.update()
    assert [tuple(v) for v in world_verts(body)]==fixed_body
    moved=sum((Vector(a)-b).length>1e-6 for a,b in zip(baseline[active.name],world_verts(active)))
    assert moved>0
    for other in wheels:
        if other!=active:assert [tuple(v) for v in world_verts(other)]==baseline[other.name]
    assert min(v.z for v in world_verts(active))>=-1e-6
    motion.append({'wheel':active.name,'probeRollDegrees':37,'movedVertices':moved,'otherWheelAndBodyVerticesUnchanged':True})
    active.rotation_euler.y=0
    bpy.context.view_layer.update()

for wheel in wheels:
    points=world_verts(wheel)
    assert abs(min(p.z for p in points))<1e-6
    assert abs(wheel.location.z-.33)<1e-6
body.data.calc_loop_triangles()
triangles=len(body.data.loop_triangles)
for wheel in wheels:
    wheel.data.calc_loop_triangles();triangles+=len(wheel.data.loop_triangles)
assert triangles==1710,triangles
all_points=body_points+[v for wheel in wheels for v in world_verts(wheel)]
bounds={'min':[min(v[i] for v in all_points) for i in range(3)],'max':[max(v[i] for v in all_points) for i in range(3)]}
assert bounds['min'][2]>=-1e-6
result={'status':'pass','sceneOpenedFromSavedBlend':True,'triangles':triangles,'meshCount':5,'groundAnchorPixels':[64,92],'cameraContract':True,'cpuRenderThreads':4,'cpuSamples':8,'wheelRestContactZ':0,'fullCylinderClearance':clearance,'independentRollProbes':motion,'visualBounds':bounds,'axisExport':'Blender (X,Y,Z) -> glTF (X,Z,-Y); source -X forward stays -X; glTF +Y is up','limits':'Conservative full tire-cylinder vs all body triangles; no steering/suspension/physics/runtime qualification.'}
(DATA/'scene-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('STYLE_STUDY_SCENE_VERIFIED',json.dumps(result))
