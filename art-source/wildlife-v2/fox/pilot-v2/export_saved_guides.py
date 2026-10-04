"""Reproject the saved .blend in a fresh Blender process. No authored pixels read.

The builder's analytical joint schedule supplies contact labels only. All mesh
hulls, bounding boxes, depths and head/body/paw positions are recomputed from the
loaded source. Each analytical joint is checked against its saved rigid meshes.
"""
from pathlib import Path
import bpy, json, math, hashlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[4]
S=Path(__file__).parent
O=ROOT/'public/demos/wildlife-v2/fox/pilot-v2'
G=json.loads((S/'projected-guides.json').read_text())
scene=bpy.context.scene
camera=scene.camera
root=bpy.data.objects['ROOT-fixed-ground']
assert abs(camera.data.ortho_scale-4.8)<1e-5
assert abs(math.degrees(math.atan2(camera.location.z,-camera.location.y))-40)<1e-5

def projection(world):
    p=world_to_camera_view(scene,camera,world)
    return [round(p.x*48,5),round((1-p.y)*48,5),round(p.z,5)]

def hull(points):
    ps=sorted(set(tuple(p) for p in points))
    def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo,hi=[],[]
    for p in ps:
        while len(lo)>=2 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(hi)>=2 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
        hi.append(p)
    return lo[:-1]+hi[:-1]

for r in G['records']:
    scene.frame_set(r['frame'])
    root.rotation_euler.z=math.radians(G['facings'][r['facing']])
    bpy.context.view_layer.update()
    r['anchor']=projection(root.matrix_world.translation)
    r['head']=projection(bpy.data.objects['HEAD-fixed-orientation'].matrix_world.translation)
    r['body']=projection(bpy.data.objects['trunk-volume'].matrix_world.translation)
    r['landmarks']={n:projection(bpy.data.objects[n].matrix_world.translation) for n in ['skull-volume','cheek-left','cheek-right','nose','eye--1','eye-1','EAR--1-hinge','EAR-1-hinge']}
    tail_points=[]
    for index,length in enumerate([.35,.38,.38,.24]):
        mesh=bpy.data.objects[f'tail-{index}-volume']
        direction=(mesh.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
        a=mesh.matrix_world.translation-direction*length/2
        b=mesh.matrix_world.translation+direction*length/2
        if tail_points:assert (a-tail_points[-1]).length<1e-5
        else:tail_points.append(a)
        tail_points.append(b)
    r['tail']=[projection(p) for p in tail_points]
    for name,c in r['contacts'].items():
        paw=bpy.data.objects[name+'-paw-volume']
        assert (paw.matrix_world.translation-root.matrix_world@Vector(c['foot'])).length<1e-5,(name,r['frame'])
        for part,a,b,length in [('upper','hip','knee',.36),('lower','knee','foot',.34)]:
            mesh=bpy.data.objects[name+'-'+part+'-volume']
            wa,wb=[root.matrix_world@Vector(c[k]) for k in [a,b]]
            assert (mesh.matrix_world.translation-(wa+wb)/2).length<1e-5
            direction=mesh.matrix_world.to_3x3()@Vector((0,0,1))
            assert abs(abs(direction.normalized().dot((wb-wa).normalized()))-1)<1e-5
        c['screen']={k:projection(root.matrix_world@Vector(c[k])) for k in ['hip','knee','foot','ground']}
    r['volumes']={}
    for o in [o for o in bpy.data.objects if o.type=='MESH']:
        e=o.evaluated_get(bpy.context.evaluated_depsgraph_get())
        ps=[projection(e.matrix_world@v.co) for v in e.data.vertices]
        # One hundredth of a native pixel retains independent silhouette evidence
        # without shipping full mesh sampling. Depth keeps five decimals.
        ps=[[round(p[0],2),round(p[1],2),p[2]] for p in ps]
        r['volumes'][o.name]={'hull':hull([p[:2] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps)}
    scene.render.filepath=str(O/'guides'/f"{r['facing']}-{r['clip']}-{r['index']:02}.png")
    bpy.ops.render.render(write_still=True)
G['projectionSource']='Fresh process loaded pilot-v2/fox.blend; actual evaluated bpy mesh vertices, analytical joints checked against saved rigid mesh centers and axes.'
G['blendSha256']=hashlib.sha256((S/'fox.blend').read_bytes()).hexdigest()
G['exporterSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
for directory in [S,O]:(directory/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n')
print('SAVED_BLEND_GUIDES_OK',len(G['records']))
