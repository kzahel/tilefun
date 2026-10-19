"""Original coupe, fixed-contract rendering and actual-scene semantic guides.
Run with background Blender; no external model/texture dependencies.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[3]
ROUTE='03-guide-pixel-finish'
DATA=ROOT/'data/vehicle-style-study'/ROUTE
OUT=ROOT/'public/demos/vehicle-style-study'/ROUTE
for d in (DATA,OUT,DATA/'guides'): d.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED'; scene.render.threads=4
scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='Standard'
scene.world=bpy.data.worlds.new('Studio world'); scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.22,.26,.34,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
root=bpy.data.objects.new('Car_Root_forward_minus_X',None); scene.collection.objects.link(root)
COLORS={'body':(1,0,0),'glass':(0,1,1),'wheels':(0,0,1),'lamps':(1,1,0),'intakes':(1,0,1),'panels':(0,1,0),'rim':(1,1,1),'rear_lamps':(1,.25,0)}
def material(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 return m
paint=material('Scarlet lacquer',(.64,.025,.045),.25,.3)
glass=material('Opaque blue glass',(.085,.17,.24),.3,.22)
rubber=material('Tire charcoal',(.018,.019,.027),0,.8)
ink=material('Recess and panel ink',(.026,.023,.035),0,.75)
silver=material('Forged aluminum',(.49,.57,.66),.6,.3)
lamp=material('Ivory LED lenses',(.9,.88,.72),.1,.25)
redlamp=material('Ruby rear lenses',(.72,.018,.025),.1,.3)
def assign(o,mat,kind):
 o.data.materials.append(mat); o.parent=root; o['guide_class']=kind
 if o.type=='MESH':
  for p in o.data.polygons:p.use_smooth=True
 return o
def mesh(name,verts,faces,mat,kind):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
 o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);return assign(o,mat,kind)
def line(name,pts,radius,mat=ink,kind='panels',closed=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=radius;c.bevel_resolution=3
 s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*co,1)
 s.use_cyclic_u=closed
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);return assign(o,mat,kind)
def patch(name,corners,mat,kind,nu=32,nv=16,bulge=.0):
 a,b,c,d=map(Vector,corners);verts=[]
 for i in range(nu+1):
  u=i/nu
  for j in range(nv+1):
   v=j/nv;p=a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v;p.z+=bulge*math.sin(math.pi*u)*math.sin(math.pi*v);verts.append(p)
 faces=[(i*(nv+1)+j,(i+1)*(nv+1)+j,(i+1)*(nv+1)+j+1,i*(nv+1)+j+1) for i in range(nu) for j in range(nv)]
 return mesh(name,verts,faces,mat,kind)
def interp(x,points):
 for (a,av),(b,bv) in zip(points,points[1:]):
  if x<=b:return av+(bv-av)*(x-a)/(b-a)
 return points[-1][1]
def width(x):return interp(x,[(-2.3,.68),(-2.13,.85),(-1.5,.94),(-.6,.865),(.3,.88),(1.35,.965),(2.08,.91),(2.3,.76)])
def deck(x):return interp(x,[(-2.3,.39),(-2.05,.48),(-1.2,.57),(-.6,.63),(.5,.66),(1.25,.66),(2.1,.61),(2.3,.52)])
# Connected rounded coachwork, then true open wheel arches.
verts=[];faces=[];NX=160;NR=72
for i in range(NX+1):
 x=-2.3+4.6*i/NX;w=width(x);z=deck(x)
 for j in range(NR):
  t=2*math.pi*j/NR
  # Superellipse yields a broad hood, rolled shoulders and upright sill.
  cy=math.cos(t);si=math.sin(t)
  y=w*math.copysign(abs(cy)**.57,cy)
  zz=.19+(z-.19)*(math.copysign(abs(si)**.45,si)+1)/2
  if si>0:zz+=.08*math.exp(-((abs(x)-1.4)/.52)**2)*(abs(y)/w)**3
  verts.append((x,y,zz))
for i in range(NX):
 for j in range(NR):faces.append((i*NR+j,i*NR+(j+1)%NR,(i+1)*NR+(j+1)%NR,(i+1)*NR+j))
faces.extend([tuple(reversed(range(NR))),tuple(NX*NR+j for j in range(NR))])
body=mesh('Continuous sculpted coachwork with cut arches',verts,faces,paint,'body')
for x in (-1.4,1.4):
 for side in (-1,1):
  # Local wheel pockets leave a continuous central hood/deck. A through-body
  # cylinder would incorrectly cut the entire upper shell at the axle.
  bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.405,depth=.68,location=(x,side*1.0,.34),rotation=(math.pi/2,0,0))
  cutter=bpy.context.object;cutter.name='Wheel-local arch cutter'
  mod=body.modifiers.new('Open local circular wheel arch','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
  bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

# Compact swept greenhouse. Apertures are genuinely separate surface meshes.
patch('Front windshield',[(-.82,-.70,.65),(-.28,-.575,1.015),(-.28,.575,1.015),(-.82,.70,.65)],glass,'glass',40,24,.025)
patch('Rear glass',[(.75,-.59,1.015),(1.28,-.76,.675),(1.28,.76,.675),(.75,.59,1.015)],glass,'glass',32,24,.018)
patch('Roof', [(-.30,-.60,1.025),(.77,-.61,1.025),(.77,.61,1.025),(-.30,.60,1.025)],paint,'body',44,32,.045)
for s in (-1,1):
 pts=[(-.79,s*.715,.65),(-.26,s*.601,1.014),(.73,s*.621,1.014),(1.22,s*.764,.68)]
 patch('Side glass '+str(s),pts,glass,'glass',40,18,.008)
 line('Window gasket '+str(s),pts,.019,ink,'panels',True)
 line('A pillar '+str(s),[(-.84,s*.71,.65),(-.30,s*.60,1.035)],.035,paint,'body')
 line('Rear buttress '+str(s),[(.76,s*.62,1.026),(1.32,s*.79,.665)],.043,paint,'body')
 line('Roof drip rail '+str(s),[(-.30,s*.61,1.03),(.77,s*.62,1.03)],.022,paint,'body')
 line('Window B pillar '+str(s),[(.48,s*.643,.72),(.48,s*.625,1.017)],.015,ink,'panels')
 # Side intake ahead of rear tire, surrounded by body (no floating rectangles).
 patch('Sculpted flank intake '+str(s),[(.56,s*.898,.36),(.99,s*.946,.40),(.98,s*.948,.61),(.64,s*.903,.57)],ink,'intakes',24,12)
 line('Intake upper lip '+str(s),[(.60,s*.91,.596),(.98,s*.956,.637)],.019,paint,'body')
 # Door shut line kept thin enough for an authored one-pixel finish.
 line('Door perimeter '+str(s),[(-.72,s*.88,.60),(-.64,s*.892,.30),(.46,s*.90,.29),(.55,s*.903,.58)],.008)
 line('Door handle '+str(s),[(.29,s*.906,.59),(.45,s*.913,.59)],.011,silver,'rim')
 line('Sill crease '+str(s),[(-.93,s*.925,.245),(.88,s*.941,.245)],.018,paint,'body')
 for x in (-1.4,1.4):
  pts=[(x+.421*math.cos(a),s*(width(x)+.004),.34+.421*math.sin(a)) for a in [k*math.pi/48 for k in range(49)]]
  line('Rolled fender arch',pts,.022,paint,'body')
 # Mirror: shaped ellipsoid with stalk.
 line('Mirror stalk',[(-.64,s*.735,.74),(-.64,s*.92,.74)],.023,ink,'panels')
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(-.64,s*.958,.755));o=bpy.context.object;o.name='Aerodynamic mirror';o.scale=(.13,.075,.052);assign(o,paint,'body')

# Front hood sculpting, narrow lights and readable end fascia.
for s in (-1,1):
 line('Hood pressed crease '+str(s),[(-1.98,s*.44,.505),(-1.67,s*.46,.554),(-1.10,s*.47,.607),(-.92,s*.50,.64)],.007,ink,'panels')
 patch('Swept front LED '+str(s),[(-2.16,s*.49,.474),(-1.91,s*.54,.542),(-1.83,s*.76,.566),(-2.12,s*.70,.491)],lamp,'lamps',24,12,.008)
 patch('Front corner vent '+str(s),[(-2.289,s*.41,.245),(-2.265,s*.68,.26),(-2.275,s*.68,.36),(-2.303,s*.40,.35)],ink,'intakes',16,8)
 patch('Rear blade lamp '+str(s),[(2.301,s*.19,.47),(2.296,s*.70,.47),(2.285,s*.70,.54),(2.30,s*.19,.54)],redlamp,'rear_lamps',32,8)
 line('Tail lamp inner signature '+str(s),[(2.315,s*.22,.513),(2.312,s*.68,.513)],.011,lamp,'lamps')
 # Twin exhaust outlets.
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=12,location=(2.29,s*.49,.26),rotation=(0,math.pi/2,0),major_radius=.054,minor_radius=.015)
 assign(bpy.context.object,silver,'rim').name='Polished exhaust'
patch('Central nose grille',[(-2.307,-.35,.22),(-2.307,.35,.22),(-2.307,.33,.345),(-2.307,-.33,.345)],ink,'intakes',32,12)
line('Front splitter',[(-2.25,-.73,.196),(-2.34,-.36,.19),(-2.34,.36,.19),(-2.25,.73,.196)],.022,ink,'panels')
patch('Rear diffuser',[(2.307,-.62,.20),(2.307,.62,.20),(2.31,.58,.385),(2.31,-.58,.385)],ink,'intakes',32,12)
for y in (-.40,-.20,0,.20,.40):line('Diffuser vane',[(2.32,y,.20),(2.34,y,.35)],.012,silver,'rim')
for k in range(6):
 x=1.45+k*.075
 line('Rear deck cooling louver '+str(k),[(x,-.41,deck(x)+.018),(x,.41,deck(x)+.018)],.012,ink,'intakes')
line('Integrated rear lip',[(2.14,-.82,.637),(2.20,0,.652),(2.14,.82,.637)],.027,paint,'body')

wheel_records=[]
for x in (-1.4,1.4):
 for s in (-1,1):
  pivot=bpy.data.objects.new(('Front' if x<0 else 'Rear')+('_near' if s<0 else '_far')+'_Roll_Y',None);scene.collection.objects.link(pivot);pivot.parent=root;pivot.location=(x,s*.87,.34)
  parts=[]
  bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=24,major_radius=.258,minor_radius=.082,location=(x,s*.89,.34),rotation=(math.pi/2,0,0));o=assign(bpy.context.object,rubber,'wheels');o.name='Rounded performance tire';parts.append(o)
  bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.235,depth=.025,location=(x,s*.973,.34),rotation=(math.pi/2,0,0));o=assign(bpy.context.object,ink,'wheels');o.name='Recessed wheel barrel';parts.append(o)
  bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=12,major_radius=.219,minor_radius=.013,location=(x,s*.993,.34),rotation=(math.pi/2,0,0));parts.append(assign(bpy.context.object,silver,'rim'))
  for k in range(5):
   a=2*math.pi*k/5
   pts=[(x+.048*math.cos(a),s*.998,.34+.048*math.sin(a)),(x+.14*math.cos(a+.12),s*1.001,.34+.14*math.sin(a+.12)),(x+.211*math.cos(a+.21),s*.998,.34+.211*math.sin(a+.21))]
   parts.append(line('Swept forged spoke',pts,.018,silver,'rim'))
  bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(x,s*1.006,.34));o=assign(bpy.context.object,silver,'rim');o.scale=(.047,.019,.047);parts.append(o)
  bpy.context.view_layer.update()
  for o in parts:
   mw=o.matrix_world.copy();o.parent=pivot;o.matrix_world=mw
  wheel_records.append({'pivot':pivot.name,'center':[x,s*.87,.34],'radius':.34,'axle':[0,1,0],'groundZ':0})

bpy.ops.object.camera_add(location=(0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50))))
cam=bpy.context.object;cam.name='Contract_camera';cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.2;scene.camera=cam
def light(name,loc,power,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
light('Fixed large key',(-3,-4,7),650,5)
light('Fixed soft fill',(3,2,4),250,4)
scene['render_contract']='512 RGBA > 128 then translate (0,+28); origin (64,92); fixed light/camera; forward -X'
scene['authorship']='Original procedural sports coupe; no downloaded model; guide-driven offline pixel finish'
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();stats=[]
for o in scene.objects:
 if o.type in ('MESH','CURVE'):
  eo=o.evaluated_get(deps);me=eo.to_mesh();me.calc_loop_triangles();stats.append({'object':o.name,'triangles':len(me.loop_triangles),'vertices':len(me.vertices),'guideClass':o['guide_class']});eo.to_mesh_clear()
report={'triangles':sum(o['triangles'] for o in stats),'evaluatedMeshCount':len(stats),'sourceMeshCount':sum(o.type=='MESH' for o in scene.objects),'objects':stats,'wheels':wheel_records,'camera':{'location':list(cam.location),'target':[0,0,0],'orthoScale':7.2,'elevationDegrees':50},'guideColors':COLORS,'renderThreads':4,'rawSamples':16,'guideSamples':1,'engine':'Cycles CPU','blenderVersion':bpy.app.version_string,'angles':list(range(0,360,45))}
assert report['triangles']>=10000
report['projectedLouverLines']=[]
for i in range(8):
 root.rotation_euler.z=math.radians(i*45);bpy.context.view_layer.update();lines=[]
 for k in range(6):
  o=bpy.data.objects['Rear deck cooling louver '+str(k)];ends=[]
  for p in (o.data.splines[0].points[0],o.data.splines[0].points[-1]):
   ndc=world_to_camera_view(scene,cam,o.matrix_world@Vector(p.co[:3]));ends.append([ndc.x*128,(1-ndc.y)*128+28])
  lines.append(ends)
 report['projectedLouverLines'].append(lines)
root.rotation_euler.z=0;bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(DATA/'sports-coupe.blend'))
(DATA/'scene.json').write_text(json.dumps(report,indent=2))
only='--preview' in sys.argv
indices=[0,1,2,3] if only else range(8)
for i in indices:
 root.rotation_euler.z=math.radians(i*45);scene.cycles.samples=16;scene.cycles.use_denoising=True
 scene.render.filepath=str(OUT/f'raw-{i}.png');bpy.ops.render.render(write_still=True)
 print('RAW_COMPLETE',i,flush=True)
# Depth-correct visible semantic projection from same scene and same geometry.
originals={}
for o in scene.objects:
 if o.type in ('MESH','CURVE'):
  originals[o.name]=list(o.data.materials);kind=o['guide_class'];m=bpy.data.materials.get('Guide_'+kind)
  if m is None:
   m=bpy.data.materials.new('Guide_'+kind);m.use_nodes=True;n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');e=n.new('ShaderNodeEmission');e.inputs[0].default_value=(*COLORS[kind],1);m.node_tree.links.new(e.outputs[0],out.inputs['Surface'])
  o.data.materials.clear();o.data.materials.append(m)
scene.cycles.samples=1;scene.cycles.use_denoising=False;scene.cycles.max_bounces=0
for i in indices:
 root.rotation_euler.z=math.radians(i*45);scene.render.filepath=str(DATA/'guides'/f'ids-{i}.png');bpy.ops.render.render(write_still=True)
 print('GUIDE_COMPLETE',i,flush=True)
print(json.dumps({'evaluatedTriangles':report['triangles'],'evaluatedMeshes':report['evaluatedMeshCount']}),flush=True)
