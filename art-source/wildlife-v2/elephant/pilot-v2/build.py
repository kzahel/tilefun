"""Standalone African elephant. Isolated bpy scene; rigid fixed-volume anatomy.
Forward +Y, up +Z. All mesh scales applied once. No wildlife drawings read.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

S=Path(__file__).parent
ROOT=S.parents[3]
O=ROOT/'public/demos/wildlife-v2/elephant/pilot-v2'
O.mkdir(parents=True,exist_ok=True)
(O/'guides').mkdir(exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=False
scene.display.shading.show_cavity=True
scene.render.film_transparent=True
scene.render.resolution_x=scene.render.resolution_y=448
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.fps=5
scene.view_settings.view_transform='Standard'

def mat(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);return m
gray=mat('warm gray skin',(.47,.49,.48))
light=mat('upper skull and back',(.63,.65,.62))
dark=mat('crease and tuft',(.24,.27,.28))
ivory=mat('short ivory tusks',(.85,.82,.66))
meshes=[]
def empty(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    o.parent=parent;o.location=loc;o.empty_display_size=.2;return o
root=empty('ROOT-fixed-ground')
body=empty('BODY-weight-shift',root)
head=empty('HEAD-fixed-orientation',body,(0,1.95,3.30))
def uv(name,loc,radii,material,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12)
    o=bpy.context.object;o.name=name;o.scale=radii
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.parent=parent;o.location=loc;o.data.materials.append(material);meshes.append(o);return o
def mesh(name,verts,faces,material,parent):
    m=bpy.data.meshes.new(name+'-mesh');m.from_pydata(verts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);scene.collection.objects.link(o)
    o.parent=parent;o.data.materials.append(material);meshes.append(o);return o

# Long torso with shoulder high point and sloping African rump, independent rings.
rings=[(-2.05,.35,2.72,.55),(-1.65,.82,2.75,1.05),(-.8,1.03,2.91,1.15),(.2,1.08,3.02,1.22),(1.0,.97,3.02,1.20),(1.55,.64,2.95,.94)]
vs=[]
for y,rx,z,rz in rings:
    for i in range(20):
        a=i*math.tau/20;vs.append((rx*math.cos(a),y,z+rz*math.sin(a)))
fs=[tuple(reversed(range(20)))]
for j in range(len(rings)-1):
    for i in range(20):fs.append((j*20+i,j*20+(i+1)%20,(j+1)*20+(i+1)%20,(j+1)*20+i))
fs.append(tuple(range(100,120)))
mesh('torso-volume',vs,fs,gray,body)
uv('skull-volume',(0,0,0),(.73,.70,.84),light,head)
uv('jaw-volume',(0,.28,-.45),(.55,.53,.48),gray,head)
uv('forehead-volume',(0,.31,.21),(.55,.45,.53),light,head)
for side in [-1,1]:
    uv('eye-'+str(side),(side*.53,.54,-.03),(.045,.045,.055),dark,head)
    # Broad African fan silhouette: tall superior rim, narrowing lower lobe.
    ctl=empty('EAR-'+str(side),head,(side*.48,-.24,.10))
    outline=[(0,.40),(.30,.73),(.87,.60),(1.24,.15),(1.31,-.42),(1.08,-.93),(.67,-1.12),(.18,-.80),(-.08,-.25)]
    verts=[(side*x,-.65*x-.06,z) for x,z in outline]+[(side*x,-.65*x+.08,z) for x,z in outline]
    faces=[tuple(reversed(range(9))),tuple(range(9,18))]+[(i,(i+1)%9,(i+1)%9+9,i+9) for i in range(9)]
    mesh('ear-'+str(side)+'-volume',verts,faces,gray,ctl)

def segment(name,length,radius,material,parent,radius2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=radius,radius2=radius2 if radius2 else radius,depth=length)
    o=bpy.context.object;o.name=name;o.parent=parent;o.data.materials.append(material);meshes.append(o);return o
def place(o,a,b):
    a,b=Vector(a),Vector(b);o.location=(a+b)/2
    o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')

legs={}
for end,y in [('fore',1.04),('hind',-1.43)]:
    for side in [-1,1]:
        n=end+'-'+str(side)
        legs[n]={'hip':Vector((side*.76,y,2.25)),
                 'phase':{('hind',-1):0,('fore',-1):.75,('hind',1):.5,('fore',1):.25}[end,side],
                 'upper':segment(n+'-upper-volume',1.10,.28,gray,root,.34),
                 'lower':segment(n+'-lower-volume',.98,.24,gray,root,.28),
                 'foot':uv(n+'-foot-volume',(0,0,0),(.29,.35,.23),gray,root)}
trunk=[]
for i in range(5):trunk.append(segment('trunk-'+str(i)+'-volume',.55,.29-i*.043,gray,body,.26-i*.043))
for side in [-1,1]:
    for i,(a,b) in enumerate([((side*.39,2.41,2.91),(side*.43,2.83,2.65)),((side*.43,2.83,2.65),(side*.46,3.00,2.78))]):
        t=segment('tusk-'+str(side)+'-'+str(i), (Vector(b)-Vector(a)).length,.075 if i==0 else .05,ivory,body,.045 if i==0 else .012);place(t,a,b)
tail=segment('tail-volume',1.22,.046,gray,body)
place(tail,(0,-1.97,2.85),(.12,-2.17,1.66))
uv('tail-tuft',(.12,-2.17,1.63),(.085,.075,.16),dark,body)

bpy.ops.object.camera_add()
cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO'
cam.data.ortho_scale=11.2;cam.data.shift_y=24/112
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
scene.camera=cam

def key(o,frame):
    o.keyframe_insert('location',frame=frame)
    o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
def pose(clip,index,frame):
    p=index/12
    body.location=(.10*math.cos(math.tau*p) if clip=='walk' else 0,0,0)
    key(body,frame)
    contacts={}
    for n,l in legs.items():
        hip=l['hip']+body.location
        t=(p+l['phase'])%1
        if clip!='walk':dy=.20 if n.endswith('-1') and not n.endswith('--1') else -.20;lift=0;state='planted'
        elif t<.75:dy=.40-.80*t/.75;lift=0;state='planted'
        else:
            q=(t-.75)/.25;dy=-.4+.8*(q*q*(3-2*q));lift=.28*math.sin(math.pi*q)
            state='lift' if q<.5 else 'passing/landing'
        foot=Vector((l['hip'].x,l['hip'].y+dy,.23+lift))
        delta=foot-hip;distance=delta.length
        axis=delta.normalized();a=1.10;b=.98
        along=(a*a-b*b+distance*distance)/(2*distance)
        perpendicular=Vector((0,1,0));perpendicular=(perpendicular-axis*perpendicular.dot(axis)).normalized()
        knee=hip+axis*along+perpendicular*math.sqrt(max(0,a*a-along*along))
        assert abs((knee-hip).length-a)<1e-6 and abs((foot-knee).length-b)<1e-6
        place(l['upper'],hip,knee);place(l['lower'],knee,foot);l['foot'].location=foot
        for o in [l['upper'],l['lower'],l['foot']]:key(o,frame)
        contacts[n]={'hip':list(hip),'knee':list(knee),'foot':list(foot),'ground':[foot.x,foot.y,lift], 'planted':lift<1e-6,'state':state}
    amount=[0,.12,.48,.88,1,.75,.32,0][index] if clip=='action' else 0
    # Retained chain lengths; joint angle changes curl the distal trunk upward.
    start=Vector((0,2.59,3.23))
    points=[list(start+body.location)]
    for i,o in enumerate(trunk):
        angle=math.radians([8,12,18,26,38][i]+amount*[0,15,40,85,120][i])
        end=start+Vector((0,.55*math.sin(angle),-.55*math.cos(angle)))
        place(o,start,end);key(o,frame);start=end;points.append(list(end+body.location))
    tailbase=Vector((0,-1.97,2.85))
    swing=.22*math.sin(index/7*math.tau) if clip=='action' else .035*math.sin(math.tau*p) if clip=='walk' else 0
    tailend=tailbase+Vector((.12+swing,-.20,-1.19)).normalized()*1.22
    place(tail,tailbase,tailend);key(tail,frame)
    tuft=bpy.data.objects['tail-tuft'];tuft.location=tailend;key(tuft,frame)
    return contacts,points

records=[]
for clip,start,count in [('idle',1,1),('walk',10,12),('action',30,8)]:
    for i in range(count):
        contacts,points=pose(clip,i,start+i)
        records.append({'clip':clip,'index':i,'frame':start+i,'contacts':contacts,'trunkWorld':points})
pose('walk',0,22);pose('action',0,38)
scene.frame_start=1;scene.frame_end=38
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
# Fixed species construction scale, applied to mesh coordinates and translation
# keys once. It is never an animated transform or an exported sprite resize.
construction_scale=1.12
for o in bpy.data.objects:
    if o.type=='MESH':
        for v in o.data.vertices:v.co*=construction_scale
    if o!=cam:
        o.location*=construction_scale
        if o.animation_data and o.animation_data.action:
            for layer in o.animation_data.action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            if fc.data_path=='location':
                                for kp in fc.keyframe_points:
                                    kp.co.y*=construction_scale
                                    kp.handle_left.y*=construction_scale
                                    kp.handle_right.y*=construction_scale
for r in records:
    r['trunkWorld']=[[v*construction_scale for v in p] for p in r['trunkWorld']]
    for c in r['contacts'].values():
        for k in ['hip','knee','foot','ground']:c[k]=[v*construction_scale for v in c[k]]
scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(S/'elephant.blend'))

def project(p):
    q=world_to_camera_view(scene,cam,p);return [round(q.x*112,4),round((1-q.y)*112,4),round(q.z,5)]
def hull(ps):
    ps=sorted(set(tuple(p) for p in ps))
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lo=[];hi=[]
    for p in ps:
        while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
        lo.append(p)
    for p in ps[::-1]:
        while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
        hi.append(p)
    return lo[:-1]+hi[:-1]
G={'identity':'elephant-pilot-v2-geometry-06','constructionScale':construction_scale,'cameraContract':C,'canvas':[112,112],'anchor':[56,80],'orthoScale':11.2,'shiftY':24/112,'records':[],
   'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},
   'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for facing,yaw in C['modelYawDegrees'].items():
    root.rotation_euler.z=math.radians(yaw)
    for r in records:
        scene.frame_set(r['frame']);bpy.context.view_layer.update()
        rr=json.loads(json.dumps(r));rr['facing']=facing
        rr['head']=project(head.matrix_world.translation);rr['body']=project(body.matrix_world.translation)
        rr['trunk']=[project(root.matrix_world@Vector(p)) for p in r['trunkWorld']]
        rr['landmarks']={n:project(bpy.data.objects[n].matrix_world.translation) for n in ['skull-volume','jaw-volume','forehead-volume','tail-tuft','eye--1','eye-1']}
        for n,c in rr['contacts'].items():c['screen']={k:project(root.matrix_world@Vector(c[k])) for k in ['hip','knee','foot','ground']}
        rr['volumes']={}
        for o in meshes:
            ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
            rr['volumes'][o.name]={'hull':hull([[round(p[0],2),round(p[1],2)] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps)}
        G['records'].append(rr)
        scene.render.filepath=str(O/'guides'/f'{facing}-{r["clip"]}-{r["index"]:02}.png')
        bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'elephant.blend').read_bytes()).hexdigest()
G['projectionSource']='Actual saved construction meshes projected by bpy world_to_camera_view, compact convex hulls; no pixel drawings read.'
for directory in [S,O]:(directory/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n')
print('ELEPHANT_BUILD_OK',len(meshes),len(G['records']))
