"""Blender -- SOURCE_SCENE OUTPUT_SCENE: preserve the floor outline, open wheel rectangles."""
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from mathutils.geometry import barycentric_transform

source, target = [Path(v).resolve() for v in sys.argv[sys.argv.index('--')+1:]]
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
bpy.context.view_layer.update()
floor = bpy.data.objects['Underfloor']
floor.data.calc_loop_triangles()
vertices = [floor.matrix_world @ v.co for v in floor.data.vertices]
triangles = [([vertices[i] for i in t.vertices], [Vector((*floor.data.uv_layers.active.data[i].uv, 0)) for i in t.loops]) for t in floor.data.loop_triangles]
wheels = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('Tire_')]
holes=[]
for wheel in wheels:
    vs=[wheel.matrix_world @ v.co for v in wheel.data.vertices]
    holes.append([min(v[0] for v in vs)-.75,max(v[0] for v in vs)+.75,
                  min(v[1] for v in vs)-.75,max(v[1] for v in vs)+.75])
xs=sorted({min(v[0] for v in vertices),max(v[0] for v in vertices)} | {h[k] for h in holes for k in [0,1]})
ys=sorted({min(v[1] for v in vertices),max(v[1] for v in vertices)} | {h[k] for h in holes for k in [2,3]})

def clip(poly,axis,bound,direction):
    if not poly:return []
    result=[];p=poly[-1];pin=direction*(p[axis]-bound)>=-1e-7
    for q in poly:
        qin=direction*(q[axis]-bound)>=-1e-7
        if qin!=pin:result.append(p.lerp(q,(bound-p[axis])/(q[axis]-p[axis])))
        if qin:result.append(q)
        p,pin=q,qin
    return result

new_vertices=[];faces=[];face_uvs=[]
inverse=floor.matrix_world.inverted()
for xa,xb in zip(xs,xs[1:]):
    for ya,yb in zip(ys,ys[1:]):
        x,y=(xa+xb)/2,(ya+yb)/2
        if any(h[0]<x<h[1] and h[2]<y<h[3] for h in holes):continue
        for triangle, triangle_uv in triangles:
            poly=triangle
            for axis,bound,direction in [(0,xa,1),(0,xb,-1),(1,ya,1),(1,yb,-1)]:poly=clip(poly,axis,bound,direction)
            if len(poly)<3:continue
            area=sum(((poly[i]-poly[0]).cross(poly[i+1]-poly[0])).length for i in range(1,len(poly)-1))
            if area<1e-7:continue
            start=len(new_vertices);new_vertices.extend([inverse @ v for v in poly]);faces.append(list(range(start,start+len(poly))))
            face_uvs.append([barycentric_transform(v,*triangle,*triangle_uv).xy for v in poly])
old=floor.data
unchanged = {o.name: [list(v.co) for v in o.data.vertices] for o in bpy.context.scene.objects if o.type == 'MESH' and o != floor}
mesh=bpy.data.meshes.new('Underfloor with wheel openings')
mesh.from_pydata(new_vertices,[],faces);mesh.update()
layer=mesh.uv_layers.new(name='OwnedAtlas')
for polygon, coords in zip(mesh.polygons,face_uvs):
    for index, uv in zip(polygon.loop_indices,coords):layer.data[index].uv=uv
for material in old.materials:mesh.materials.append(material)
floor.data=mesh
floor['wheel_floor_clearance']='Actual exported tire bounds plus .75 model-unit openings; neutral roll only'
assert unchanged == {o.name: [list(v.co) for v in o.data.vertices] for o in bpy.context.scene.objects if o.type == 'MESH' and o != floor}
bpy.ops.wm.save_as_mainfile(filepath=str(target))
spec={'assetId':bpy.data.objects['CarRoot'].get('asset_id'),'material':mesh.materials[0].name,'objects':[]}
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    spec['objects'].append({'name':obj.name,'parent':obj.parent.name if obj.parent else None,
                            'vertices':[list(v.co) for v in obj.data.vertices],
                            'faces':[list(p.vertices) for p in obj.data.polygons],
                            'uvs':[[list(obj.data.uv_layers.active.data[i].uv) for i in p.loop_indices] for p in obj.data.polygons],
                            'extras':dict(obj.items())})
(target.parent/'mesh-spec.json').write_bytes((json.dumps(spec,indent=2)+'\n').encode())
(target.parent/'floor-revision.json').write_bytes((json.dumps({'sourceScene':source.relative_to(Path(__file__).resolve().parents[2]).as_posix(),'changedMesh':'Underfloor','wheelOpenings':holes,'margin':.75,'bodyAndWheels':'Unchanged'},indent=2)+'\n').encode())
print('Opened actual wheel bounds, preserved original floor perimeter',flush=True)
