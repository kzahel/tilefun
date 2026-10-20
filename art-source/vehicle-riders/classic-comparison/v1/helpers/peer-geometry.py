"""Read-only master component/actual GLB UV ownership across Classic revisions."""
from pathlib import Path
from collections import Counter
import bpy,json,hashlib,struct
from mathutils import Vector
from mathutils.kdtree import KDTree

R=Path.cwd();D=R/'data/vehicle-riders/classic-outline-comparison'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
snapshots={};inputs={}
for rev in ['v1','v2']:
    A=R/f'art-source/vehicle-riders/classic-upright/{rev}'
    cfg=read(A/'rider.json');scale=cfg['worldScale']
    for n in ['master.blend','rider.glb','rider.json','classic-upright-v1.json','atlas.png']:
        inputs[(A/n).relative_to(R).as_posix()]=sha(A/n)
    bpy.ops.wm.open_mainfile(filepath=str(A/'master.blend'))
    parts={};loops=[]
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        uv=ob.data.uv_layers.active.data
        points=[tuple(ob.matrix_world@v.co) for v in ob.data.vertices]
        faces=[]
        for face in ob.data.polygons:
            vertices=[]
            for li in face.loop_indices:
                p=points[ob.data.loops[li].vertex_index]
                q=tuple(uv[li].uv)
                vertices.append([p,q]);loops.append((Vector(p),q,ob.name))
            corners=tuple((tuple(p),tuple(q)) for p,q in vertices)
            faces.append(min(corners[j:]+corners[:j] for j in range(len(corners))))
        signature=json.dumps({'points':sorted(points),'faces':sorted(faces)},sort_keys=True).encode()
        parts[ob.name]={'sha256':hashlib.sha256(signature).hexdigest(),'vertices':len(points),
            'minSource':[min(p[i] for p in points) for i in range(3)],'maxSource':[max(p[i] for p in points) for i in range(3)]}
    snapshots[rev]=parts
    tree=KDTree(len(loops))
    for i,(p,uv,name) in enumerate(loops):tree.insert(p,i)
    tree.balance()
    raw=(A/'rider.glb').read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    g=json.loads(raw[20:20+size]);binary=raw[28+size:]
    primitive=g['meshes'][0]['primitives'][0]
    def accessor(index):
        a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
        fmt='<'+{5123:'H',5125:'I',5126:'f'}[a['componentType']]*{'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',struct.calcsize(fmt))
        return [struct.unpack_from(fmt,binary,off+i*stride) for i in range(a['count'])]
    positions=accessor(primitive['attributes']['POSITION']);uvs=accessor(primitive['attributes']['TEXCOORD_0'])
    indices=[v[0] for v in accessor(primitive['indices'])]
    vertex_owners=[]
    for p,q in zip(positions,uvs):
        point=Vector((p[0],-p[2],p[1]));uv=Vector((q[0],1-q[1]))
        owners={loops[i][2] for _,i,_ in tree.find_range(point,.00002) if (Vector(loops[i][1])-uv).length<.000002}
        assert owners,(rev,p,q)
        vertex_owners.append(owners)
    owners=[]
    for i in range(0,len(indices),3):
        names=set.intersection(*(vertex_owners[j] for j in indices[i:i+3]))
        assert names,(rev,i)
        owners.append(sorted(names)[0])
    out={'status':'passed','revision':rev,'riderSha256':sha(A/'rider.glb'),'actualTriangleCount':len(owners),
         'allActualGLBTrianglesMatchedToSemanticMaster':True,'triangles':owners,'ownerTriangleCounts':dict(Counter(owners)),
         'ownerSourceBounds':parts,'mapping':'Actual exported position/UV corners -> unchanged master loops; glTF [x,y,z] back to Blender [x,-z,y]. Actual canonical triangle index order retained.'}
    (D/rev/'triangle-owners.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')

old,new=snapshots['v1'],snapshots['v2']
unchanged=[n for n in old if n in new and old[n]['sha256']==new[n]['sha256']]
changed=[n for n in old if n in new and old[n]['sha256']!=new[n]['sha256']]
added=sorted(set(new)-set(old));removed=sorted(set(old)-set(new))
assert len(unchanged)==18 and len(changed)==3 and added==['RiderClassic neck collar visible skin'] and not removed
profile='classic-upright-v1.json'
assert (R/f'art-source/vehicle-riders/classic-upright/v1/{profile}').read_bytes()==(R/f'art-source/vehicle-riders/classic-upright/v2/{profile}').read_bytes()
for n,h in inputs.items():assert sha(R/n)==h
out={'status':'passed-readonly-peer-audit','inputHashes':inputs,'unchangedOwners':unchanged,'changedOwners':changed,'addedOwners':added,
     'removedOwners':removed,'profileBytesExact':True,'snapshots':snapshots,'allSourceBytesUnchanged':True,
     'limits':'Semantic source geometry/UV evidence only; no actual bike or normal/human qualification.'}
(D/'v2/peer-component-audit.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','unchangedOwners':len(unchanged),'changedOwners':changed,'addedOwners':added,'profileExact':True}))
