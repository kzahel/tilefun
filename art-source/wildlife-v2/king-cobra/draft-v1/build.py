"""Fresh king cobra; isolated scene. Fixed geometry, posterior travelling wave.
No pixel drawings or other species models read. Forward +Y; 10 px/world unit.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent; ROOT=S.parents[3]
O=ROOT/'public/demos/wildlife-v2/king-cobra/draft-v1'
O.mkdir(parents=True,exist_ok=True); (O/'guides').mkdir(exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene; scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=False; scene.display.shading.show_cavity=True
scene.render.film_transparent=True; scene.render.resolution_x=scene.render.resolution_y=256
scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'
scene.render.fps=6; scene.view_settings.view_transform='Standard'
def material(name,c):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);return m
olive=material('adult olive brown skin',(.34,.36,.19))
cream=material('yellow ventral scales',(.75,.66,.39)); dark=material('eye',(.13,.13,.10))
red=material('forked tongue',(.44,.23,.24)); meshes=[]
def empty(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed-ground');head=empty('HEAD-rigid',root,(0,.20,1.82))
def mesh(name,vs,fs,mat,parent=root):
    m=bpy.data.meshes.new(name+'-mesh');m.from_pydata(vs,[],fs);m.update()
    o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.parent=parent
    o.data.materials.append(mat);meshes.append(o);return o
def uv(name,loc,radii,mat,parent=root):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10)
    o=bpy.context.object;o.name=name;o.scale=radii
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.parent=parent;o.location=loc;o.data.materials.append(mat);meshes.append(o);return o
def tube(name,length,r1,r2,mat=olive):
    # +Z longitudinal frustum with a real bottom vertex for ground auditing.
    vs=[(r*math.cos(i*math.tau/16),r*math.sin(i*math.tau/16),z)
        for z,r in [(0,r1),(length,r2)] for i in range(16)]
    fs=[tuple(reversed(range(16))),tuple(range(16,32))]
    fs += [(i,(i+1)%16,(i+1)%16+16,i+16) for i in range(16)]
    return mesh(name,vs,fs,mat)
def place(o,a,b):
    a,b=Vector(a),Vector(b);o.location=a;o.rotation_mode='QUATERNION'
    o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
uv('head-skull',(0,0,0),(.22,.29,.125),olive,head)
uv('lower-jaw',(0,.05,-.075),(.19,.25,.05),cream,head)
for side in [-1,1]:uv('eye-'+str(side),(side*.195,.13,.03),(.025,.035,.025),dark,head)
# Raised neck: a fixed-volume tapered oval hood, narrow head broader than neck.
# King cobra lacks the spectacle pattern of many Naja; no painted eye-spots.
hoodrings=[(.35,.13,-.05,.13),(.75,.26,.02,.13),(1.15,.35,.09,.12),
           (1.52,.29,.15,.10),(1.75,.16,.19,.095)]
vs=[]
for z,rx,y,ry in hoodrings:
    for i in range(20):
        a=i*math.tau/20;vs.append((rx*math.cos(a),y+ry*math.sin(a),z))
fs=[tuple(reversed(range(20))),tuple(range(80,100))]
fs += [(j*20+i,j*20+(i+1)%20,(j+1)*20+(i+1)%20,(j+1)*20+i)
       for j in range(4) for i in range(20)]
mesh('hood-neck-volume',vs,fs,olive)
neck=tube('low-neck-link',.28,.145,.13);place(neck,(0,-.20,.145),(0,-.05,.381))
# Ventral panel is an independent anatomical surface, not arbitrary front pixels.
mesh('hood-ventral-panel',[(x,y+ry+.008,z) for z,rx,y,ry in hoodrings for x in [-rx*.68,rx*.68]],
     [(i*2,i*2+1,i*2+3,i*2+2) for i in range(4)],cream)
# Fixed-length ground chain. Taper is baked into mesh coordinates once.
N=15;L=.24;radii=[.145*(1-i/N)+.018*(i/N) for i in range(N+1)]
links=[tube('body-link-%02d'%i,L,radii[i],radii[i+1]) for i in range(N)]
for i,r in enumerate(radii[:-1]):uv('joint-%02d'%i,(0,0,0),(r,r,r),olive)
tongue=[tube('tongue-stem',.20,.012,.010,red),tube('tongue-fork-L',.10,.010,.006,red),tube('tongue-fork-R',.10,.010,.006,red)]
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract'
cam.data.type='ORTHO';cam.data.ortho_scale=9.6;cam.data.shift_y=12/96
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,fr):
    o.keyframe_insert('location',frame=fr)
    o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=fr)
def pose(clip,i,fr):
    p=i/8 if clip=='slither' else 0
    nodes=[(0,-.20,radii[0])];angles=[]
    for j,o in enumerate(links):
        # Maximum left bends pass link j at pose (j+2) modulo8: anterior -> posterior.
        angle=math.radians(30)*math.sin(math.tau*(p-j/8))
        if clip=='action' and j>=10:
            angle+=math.radians([0,0,14,28,14,0][i])*(j-9)/5
        dz=radii[j+1]-radii[j];span=math.sqrt(L*L-dz*dz)
        a=nodes[-1]
        # Logical endpoints use Python double precision; bpy matrices are float32.
        b=(a[0]+span*math.sin(angle),a[1]-span*math.cos(angle),a[2]+dz)
        place(o,nodes[-1],b);key(o,fr)
        joint=bpy.data.objects['joint-%02d'%j];joint.location=nodes[-1];key(joint,fr)
        assert abs(math.dist(b,nodes[-1])-L)<1e-7
        nodes.append(b);angles.append(math.degrees(angle))
    extension=[0,0,.14,.28,.14,0][i] if clip=='action' else 0
    a=Vector((0,.38,1.77));b=a+Vector((0,.20,0))
    # Tongue retracts behind opaque muzzle; no scale or length change.
    a.y-=.30-extension;b.y-=.30-extension
    ends=[(a,b),(b,b+Vector((-.045,.089,0))),(b,b+Vector((.045,.089,0)))]
    for o,(a,b) in zip(tongue,ends):place(o,a,b);key(o,fr)
    return {'clip':clip,'index':i,'frame':fr,'nodesWorld':[list(v) for v in nodes],
            'anglesDegrees':angles,'tongueWorld':[[list(a),list(b)] for a,b in ends],
            'contactDesign':'Continuous sliding ventral support, no feet, static touchdown schedule or airborne phase.'}
records=[]
for clip,start,count in [('idle',1,1),('slither',10,8),('action',30,6)]:
    for i in range(count):records.append(pose(clip,i,start+i))
pose('slither',0,18);pose('action',0,36);scene.frame_start=1;scene.frame_end=36
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
scene.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'king-cobra.blend'))
def project(p):
    q=world_to_camera_view(scene,cam,p);return [round(q.x*96,5),round((1-q.y)*96,5),round(q.z,5)]
def hull(ps):
    ps=sorted(set(tuple(p) for p in ps))
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lo=[];hi=[]
    for target,seq in [(lo,ps),(hi,ps[::-1])]:
        for p in seq:
            while len(target)>1 and cross(target[-2],target[-1],p)<=0:target.pop()
            target.append(p)
    return lo[:-1]+hi[:-1]
G={'identity':'king-cobra-draft-v1-geometry-03','cameraContract':C,'canvas':[96,96],
   'anchor':[48,60],'orthoScale':9.6,'shiftY':12/96,'linkLength':L,'radii':radii,'records':[],
   'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},
   'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for f,yaw in C['modelYawDegrees'].items():
    root.rotation_euler.z=math.radians(yaw)
    for r in records:
        scene.frame_set(r['frame']);bpy.context.view_layer.update()
        rr=json.loads(json.dumps(r));rr['facing']=f;rr['head']=project(head.matrix_world.translation)
        rr['nodes']=[project(root.matrix_world@Vector(p)) for p in r['nodesWorld']]
        rr['tongue']=[[project(root.matrix_world@Vector(p)) for p in pair] for pair in r['tongueWorld']]
        rr['volumes']={};rr['contacts']={}
        for o in meshes:
            world=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(p) for p in world]
            rr['volumes'][o.name]={'hull':hull([p[:2] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps)}
            if o.name.startswith('body-link-') or o.name.startswith('joint-'):
                v=min(world,key=lambda p:p.z)
                rr['contacts'][o.name]={'world':list(v),'screen':project(v),'minWorldZ':v.z,'state':'sliding ventral support'}
        G['records'].append(rr)
        scene.render.filepath=str(O/'guides'/f'{f}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'king-cobra.blend').read_bytes()).hexdigest()
G['projectionSource']='Actual mesh geometry from saved bpy scene, compact hulls and contact minima; no pixel source read.'
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({k:G[k] for k in ['identity','cameraContract','canvas','anchor','orthoScale','shiftY','linkLength']},indent=2)+'\n',encoding='utf-8')
print('COBRA_BUILD_OK',len(meshes),len(G['records']))
