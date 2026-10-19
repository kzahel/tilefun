"""Original hollow-hull boat. Blender -b --python build-explorer.py [-- --output DIR].
No car templates, wheel rigs, downloaded references or image-space repaint.
"""
import bpy, bmesh, math, json, struct, zlib, sys, shutil
from pathlib import Path
from mathutils import Vector

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'AGENTS.md').exists())
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT=Path(args[args.index('--output')+1]) if '--output' in args else ROOT/'art-source/vehicle-models/explorer-boat/v1'
OUT.mkdir(parents=True,exist_ok=True)
assert not (OUT/'receipt.json').exists(),'Frozen boat revision; choose a new output directory'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
P={'hull':'e77137','hullLight':'f5964b','hullDark':'a9402f','cream':'f1dfb6','creamShade':'c4ad86','deck':'b48b5c','deckDark':'806142','navy':'293e59','blue':'50778a','silver':'a6b8bd','white':'fff1d8','red':'cd554a','ink':'34364c'}
keys=list(P)
pixels=bytearray()
for y in range(64):
 for x in range(64):pixels.extend((*bytes.fromhex(P[keys[min(len(keys)-1,(y//16)*4+x//16)]]),255))
def chunk(k,v):return struct.pack('>I',len(v))+k+v+struct.pack('>I',zlib.crc32(k+v)&0xffffffff)
raw=b''.join(b'\0'+pixels[y*256:(y+1)*256] for y in range(64))
(OUT/'atlas.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',64,64,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
image=bpy.data.images.load(str(OUT/'atlas.png'));image.pack()
material=bpy.data.materials.new('Owned boat palette UV');material.use_nodes=True
nodes=material.node_tree.nodes;nodes.clear();tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Closest'
em=nodes.new('ShaderNodeEmission');material.node_tree.links.new(tex.outputs['Color'],em.inputs['Color'])
out=nodes.new('ShaderNodeOutputMaterial');material.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
root=bpy.data.objects.new('Boat_Root',None);bpy.context.collection.objects.link(root);root['tilefun_watercraft']=1;root['forward']='-X';root['waterline']=0
components=[]
def mesh(name,vv,ff,roles,parent=root):
 m=bpy.data.meshes.new(name);m.from_pydata(vv,[],ff);m.materials.append(material)
 bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(m);bm.free()
 uv=m.uv_layers.new(name='Owned_palette_UV')
 for i,f in enumerate(m.polygons):
  role=roles[i] if isinstance(roles,list) else roles;idx=keys.index(role)
  for li in f.loop_indices:uv.data[li].uv=((idx%4+.5)/4,1-(idx//4+.5)/4)
 o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);o.parent=parent;o['surface_owner']=name
 m.calc_loop_triangles();components.append({'name':name,'triangles':len(m.loop_triangles),'paletteRoles':sorted(set(roles if isinstance(roles,list) else [roles]))})
 return o
def cube(name,loc,size,role,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Physical edge bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 vv=[tuple(o.matrix_world@v.co) for v in o.data.vertices];ff=[list(f.vertices) for f in o.data.polygons];bpy.data.objects.remove(o,do_unlink=True)
 return mesh(name,vv,ff,role)
def tube(name,pts,r,role,sides=6):
 vv=[]
 for i,p in enumerate(pts):
  tangent=(Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(0,i-1)])).normalized();a=tangent.cross(Vector((0,0,1)))
  if a.length<.01:a=tangent.cross(Vector((0,1,0)))
  a.normalize();b=tangent.cross(a).normalized()
  for j in range(sides):vv.append(tuple(Vector(p)+r*(a*math.cos(j*2*math.pi/sides)+b*math.sin(j*2*math.pi/sides))))
 ff=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(len(pts)-1) for j in range(sides)]
 ff += [tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))]
 return mesh(name,vv,ff,role)

stations=[(-32,1.8,11),(-25,9,11),(-12,14,10),(10,15,10),(25,13,10),(28,12,10)]
vv=[]
for x,w,z in stations:
 inner=max(.5,w-2)
 vv += [(x,-w,z),(x,-w*.85,4),(x,0,0),(x,w*.85,4),(x,w,z),(x,inner,z),(x,inner*.72,3),(x,-inner*.72,3),(x,-inner,z)]
ff=[];roles=[];n=9
for i in range(len(stations)-1):
 for j in range(n):
  ff.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j));roles.append(['hull','hullDark','hullDark','hullLight','cream','creamShade','deckDark','creamShade','cream'][j])
ff.extend([tuple(range(n-1,-1,-1)),tuple((len(stations)-1)*n+j for j in range(n))]);roles+=['hull','hull']
mesh('Boat_Hull',vv,ff,roles)
# The interior is genuinely recessed; planks and benches do not cap the cockpit.
for i in range(7):cube(f'Interior floor plank {i}',(-6+i*4.4,0,3.7),(4.1,17,1),'deck' if i%2 else 'creamShade')
for side in [-1,1]:
 tube(f'Continuous cream gunwale {side}',[(x,side*w,z+.25) for x,w,z in stations],1.1,'cream')
 tube(f'Painted blue side stripe {side}',[(x,side*(w*.94),7) for x,w,z in stations[1:]],.55,'navy',4)
 for x in [-9,16]:tube(f'White side fender {side} {x}',[(x,side*15.5,4),(x,side*15.5,9)],1.6,'white',8)
cube('Bow flotation deck',(-24,0,10.4),(12,11,1.3),'cream',.6)
cube('Rear bench',(20,0,8),(5,22,2),'cream',.6)
cube('Driver bench',(1,0,7),(7,20,2),'cream',.6)
cube('Driver backrest',(4.8,0,11),(1.7,17,6),'creamShade',.5)
cube('Helm pedestal',(-9,0,8),(5,7,8),'navy',.6)
cube('Helm console',(-10,0,13),(5,10,2),'blue',.4)
ring=[(-6,3*math.sin(t*math.pi/8),14+3*math.cos(t*math.pi/8)) for t in range(17)]
tube('Steering wheel',ring,.6,'ink',5)
tube('Steering stem',[(-9,0,12),(-6,0,14)],.7,'silver')
cube('Outboard engine',(31,0,11),(9,8,10),'navy',1.5)
cube('Outboard cap',(30,0,16),(8,8,1.8),'blue',.5)
cube('Outboard leg',(33,0,3),(3,3,8),'silver',.5)
# Local shaft-axis animation is independent of hull and absolute per draw.
prop=mesh('Boat_Propeller',[(0,-3,-.6),(0,3,-.6),(0,3,.6),(0,-3,.6),(.7,-3,-.6),(.7,3,-.6),(.7,3,.6),(.7,-3,.6)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)],'navy')
prop.location=(35,0,1);prop['tilefun_role']='propeller'
for side in [-1,1]:tube(f'Bow mooring cleat {side}',[(-26,side*5,11),(-26,side*5,12),(-23,side*5,12)],.65,'silver')
# Orange/cream flotation ring on the rear port rail.
for j in range(12):
 a=j*math.pi/6;b=(j+1)*math.pi/6
 tube(f'Flotation ring segment {j}',[(16+3.4*math.cos(a),-14,11+3.4*math.sin(a)),(16+3.4*math.cos(b),-14,11+3.4*math.sin(b))],.9,'red' if j//3%2 else 'cream',5)
scene=bpy.context.scene;scene.view_settings.view_transform='Standard'
camera_data=bpy.data.cameras.new('Boat study camera');camera=bpy.data.objects.new('Boat study camera',camera_data);bpy.context.collection.objects.link(camera)
camera.location=(85,-100,110);camera.rotation_euler=(Vector((0,0,4))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=110;scene.camera=camera
scene.render.film_transparent=True;scene.render.resolution_x=scene.render.resolution_y=256
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'boat.blend'))
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT')
recipe={'revision':'explorer-boat-v1','authoring':'Original semantic geometry and palette UVs; hollow hull with actual inner walls/floor, attached gunwales, benches, console and independently rotating outboard propeller. No wheel rig or car geometry.','axes':{'forward':'Blender -X','up':'Blender +Z','waterline':0},'palette':P,'components':components,'source':'Editable packed Blender source; runtime-topology master, no high-to-low transfer claim.','reviewStatus':'pending-human-review','replay':'Blender --background --python build.py -- --output REPLAY_DIRECTORY'}
(OUT/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n',encoding='utf8');shutil.copy2(__file__,OUT/'build.py')
print('Boat source and GLB exported',OUT)
