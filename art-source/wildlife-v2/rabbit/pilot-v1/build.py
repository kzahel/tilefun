"""Rabbit rigid articulated volumes. Blender CLI isolated factory scene.
No pixel masters read; camera comes only from the accepted campaign contract.
"""
from pathlib import Path
import bpy,math,json,hashlib
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent; ROOT=S.parents[3]; O=ROOT/'public/demos/wildlife-v2/rabbit/pilot-v1'
O.mkdir(parents=True,exist_ok=True); (O/'guides').mkdir(exist_ok=True)
C=json.loads((S.parents[1]/'camera.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=192;scene.render.resolution_y=192;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.render.fps=8;scene.frame_end=46
def empty(name,parent=None):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-rigid-pitch',root);head=empty('HEAD-stable-volume',root)
def material(name,c):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);return m
fur=material('warm grey brown',(.52,.43,.34));light=material('cream',(.87,.79,.64));pink=material('ear interior',(.64,.39,.36));dark=material('eye',(.12,.10,.09))
def volume(name,center,radii,parent,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(0,0,0))
    o=bpy.context.object;o.name=name;o.parent=parent;o.location=center
    for v in o.data.vertices:v.co=Vector((v.co.x*radii[0],v.co.y*radii[1],v.co.z*radii[2]))
    o.data.materials.append(mat);return o
volume('rump', (0,-.26,.47),(.38,.44,.36),body,fur)
volume('chest',(0,.12,.45),(.27,.33,.28),body,fur)
volume('skull',(0,0,0),(.29,.29,.26),head,fur)
volume('muzzle',(0,.23,-.085),(.20,.12,.13),head,light)
volume('nose',(0,.34,-.07),(.07,.045,.055),head,pink)
for side in [-1,1]:
    volume('eye'+str(side),(side*.245,.15,.025),(.045,.07,.07),head,dark)
ears={}
for side in [-1,1]:
    e=empty('ear-hinge'+str(side),head);e.location=(side*.22,-.06,.18);ears[side]=e
    volume('ear'+str(side),(0,0,.30),(.07,.09,.36),e,fur)
    volume('inner-ear'+str(side),(0,.065,.30),(.036,.028,.28),e,pink)
tail=volume('round-tail',(0,-.69,.45),(.15,.13,.15),body,light)
legs={}
for kind in ['fore','hind']:
    for side in [-1,1]:
        name=f'{kind}{side}';a,b=(.24,.28) if kind=='fore' else (.40,.42)
        legs[name]=[volume(name+'-upper',(0,0,0),(.065 if kind=='fore' else .15,.075 if kind=='fore' else .17,a/2),root,fur),volume(name+'-lower',(0,0,0),(.055,.06,b/2),root,fur),volume(name+'-foot',(0,0,0),(.075 if kind=='fore' else .10,.10 if kind=='fore' else .18,.055),root,light)]
def segment(o,a,b):
    o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
def knee(a,b,l1,l2,sign):
    delta=b-a;dist=delta.length
    assert abs(l1-l2)<dist<l1+l2,(a,b,dist,l1+l2)
    u=delta.normalized();mid=(l1*l1-l2*l2+dist*dist)/(2*dist)
    pole=Vector((0,sign,0));v=(pole-u*pole.dot(u)).normalized()
    return a+u*mid+v*math.sqrt(max(0,l1*l1-mid*mid))
# Body/head volume stays fixed. z is rigid rise; pitch is rigid torso rotation.
# Hind ankle is paired; front feet land on separate samples. Ground anchors are
# held during stance. Root never translates; this is an in-place diagnostic hop.
HOP=[
 ('gather',-.06,0, .02,.055,.43,.055),
 ('hind push',.05,10, .02,.055,.43,.18),
 ('lift',.25,7, -.30,.22,.48,.34),
 ('apex',.40,0, -.08,.42,.48,.43),
 ('reach',.10,-8, .10,.30,.43,.055),
 ('fore landing',.02,-8, .13,.20,.43,.055),
 ('hind landing',-.04,-3, .02,.055,.43,.055),
 ('settle',-.06,0, .02,.055,.43,.055)]
def pose(clip,i):
    if clip=='hop':phase,dz,pitch,hy,hz,fy,fz=HOP[i]
    else:phase,dz,pitch,hy,hz,fy,fz='rest',0,0,.02,.055,.43,.055
    body.location=(0,0,dz);body.rotation_euler=(math.radians(pitch),0,0)
    head.location=body.matrix_basis@Vector((0,.35,.58));head.rotation_euler=(0,0,0)
    for side,e in ears.items():
        perk=[0,12,25,25,12,0][i] if clip=='action' else 0
        e.rotation_euler=(0,math.radians(side*(12+perk)),0)
    contacts={}
    for name,objects in legs.items():
        kind='fore' if name.startswith('fore') else 'hind';side=-1 if name.endswith('-1') else 1
        hip=body.matrix_basis@Vector((side*(.17 if kind=='fore' else .27),.20 if kind=='fore' else -.28,.40))
        y,z=(fy,fz) if kind=='fore' else (hy,hz)
        # Half-bound fore contact leads by one pose on anatomical left.
        if clip=='hop' and kind=='fore' and i==4 and side==1:z=.16
        foot=Vector((side*(.18 if kind=='fore' else .28),y,z))
        a,b=(.24,.28) if kind=='fore' else (.40,.42)
        k=knee(hip,foot,a,b,1 if kind=='hind' else -1)
        segment(objects[0],hip,k);segment(objects[1],k,foot);objects[2].location=foot;objects[2].rotation_euler=(0,0,0)
        planted=abs(z-.055)<1e-6
        contacts[name]={'hip':list(hip),'knee':list(k),'foot':list(foot),'ground':[foot.x,foot.y,0],'planted':planted,'lengths':[a,b]}
    for o in [body,head,*ears.values(),*[v for x in legs.values() for v in x]]:
        o.keyframe_insert('location');o.keyframe_insert('rotation_euler')
    return phase,contacts
poses=[]
for clip,count,start in [('idle',1,1),('hop',8,10),('action',6,30)]:
    for i in range(count):
        scene.frame_set(start+i);phase,contacts=pose(clip,i);poses.append({'clip':clip,'index':i,'frame':start+i,'phase':phase,'contacts':contacts})
# Constant sampled keys are deliberate pixel-pose references, not interpolated
# deforming runtime animation. Closing keys retain the complete loop endpoints.
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for k in fc.keyframe_points:k.interpolation='CONSTANT'
bpy.ops.object.camera_add(location=C['cameraLocationAtDistance10']);camera=bpy.context.object;camera.name='CAMERA-contract'
camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.2;camera.data.shift_y=.25;scene.camera=camera
def project(p):
    v=world_to_camera_view(scene,camera,p);return [round(v.x*32,4),round((1-v.y)*32,4),round(v.z,5)]
def hull(points):
    ps=sorted(set(tuple(p) for p in points))
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    low=[];high=[]
    for p in ps:
        while len(low)>1 and cross(low[-2],low[-1],p)<=0:low.pop()
        low.append(p)
    for p in reversed(ps):
        while len(high)>1 and cross(high[-2],high[-1],p)<=0:high.pop()
        high.append(p)
    return low[:-1]+high[:-1]
scene.frame_set(1);root.rotation_euler.z=math.radians(180);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(S/'rabbit.blend'))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
def geo(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
G={'identity':'rabbit-pilot-v1-guides-01','cameraContract':C,'canvas':[32,32],'anchor':[16,24],'orthoScale':3.2,'shiftY':.25,'facings':C['modelYawDegrees'],'geometryHashes':{o.name:geo(o) for o in meshes},'blendSha256':hashlib.sha256((S/'rabbit.blend').read_bytes()).hexdigest(),'records':[]}
for facing,yaw in G['facings'].items():
    for sample in poses:
        scene.frame_set(sample['frame']);root.rotation_euler.z=math.radians(yaw);bpy.context.view_layer.update()
        r={k:v for k,v in sample.items() if k!='contacts'};r['facing']=facing;r['anchor']=project(root.matrix_world.translation)
        r['landmarks']={o.name:project(o.matrix_world.translation) for o in [body,head,tail,*ears.values()]}
        for side,e in ears.items():r['landmarks']['ear-tip'+str(side)]=project(e.matrix_world@Vector((0,0,.66)))
        r['contacts']={}
        for name,c in sample['contacts'].items():
            r['contacts'][name]={**c,'screen':{key:project(root.matrix_world@Vector(c[key])) for key in ['hip','knee','foot','ground']}}
        r['volumes']={}
        for o in meshes:
            ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
            r['volumes'][o.name]={'hull':hull([p[:2] for p in ps]),'bounds':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertices':len(ps)}
        G['records'].append(r)
        scene.render.filepath=str(O/'guides'/f'{facing}-{sample["clip"]}-{sample["index"]:02}.png');bpy.ops.render.render(write_still=True)
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n')
print('RABBIT_BUILD_OK',len(G['records']),len(meshes))
