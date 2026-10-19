"""Economical retopology of retained 141 approach 3. Blender CLI, four threads.
Creates a packed editable source, exports, reimports actual GLB and renders it.
"""
import bpy, math, json, sys, argparse
from pathlib import Path
from mathutils import Vector

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'scripts/vehicle-bake/README.md').is_file());ROUTE='b-authored-semantic'
sys.path.insert(0,str(Path(__file__).parent))
from paint import body_point, interp, WIDTH, DECK

ap=argparse.ArgumentParser();ap.add_argument('--revision',default='v1');ap.add_argument('--budget',choices=['low','high'],default='high')
args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SRC=ROOT/'art-source/vehicle-bake'/ROUTE/args.revision
OUT=ROOT/'public/demos/vehicle-bake'/ROUTE/args.revision
DATA=ROOT/'data/vehicle-bake'/ROUTE/args.revision
if (SRC/'complete.lock.json').exists():raise RuntimeError('Immutable completed candidate')
for p in (OUT,DATA):p.mkdir(parents=True,exist_ok=True)
cfg=json.loads((SRC/'recipe.json').read_text());regions=cfg['surfaceRegions'];scale=80/4.6
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
scene.cycles.use_denoising=False;scene.cycles.max_bounces=0
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.dither_intensity=0
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
root=bpy.data.objects.new('Coupe_Approach3_WorldScale',None);scene.collection.objects.link(root)
im=bpy.data.images.load(str(SRC/'atlas.png'));im.pack()
mat=bpy.data.materials.new('Coupe_semantic_atlas_UNLIT');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear()
tex=nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Closest';tex.extension='EXTEND'
uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='SemanticUV';mat.node_tree.links.new(uvnode.outputs['UV'],tex.inputs['Vector'])
# Direct colour-to-surface is Blender's explicit KHR_materials_unlit pattern.
output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(tex.outputs['Color'],output.inputs['Surface'])

def uv(name,u,v):
 x0,y0,x1,y1=regions[name];return ((x0+.5+u*(x1-x0-1))/512,1-(y0+.5+v*(y1-y0-1))/512)
def swatch(name):
 x,y=cfg['swatches'][name];return ((x+.5)/512,1-(y+.5)/512)
def mesh(name,verts,faces,coords):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();me.materials.append(mat)
 ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.parent=root
 layer=me.uv_layers.new(name='SemanticUV')
 for p,cs in zip(me.polygons,coords):
  p.use_smooth=True
  for li,co in zip(p.loop_indices,cs):layer.data[li].uv=co
 return ob
def solid_mesh(name,verts,faces,role):return mesh(name,verts,faces,[[swatch(role)]*len(f) for f in faces])
parts=[]
def rail(name,points,r,role):
 # Four-sided tube follows the original polyline and owns a palette swatch.
 pts=list(map(Vector,points));vs=[]
 for k,p in enumerate(pts):
  tangent=(pts[min(k+1,len(pts)-1)]-pts[max(k-1,0)]).normalized()
  q=tangent.cross(Vector((0,0,1)))
  if q.length<.01:q=tangent.cross(Vector((0,1,0)))
  q.normalize();w=tangent.cross(q).normalized()
  radius=r[k] if isinstance(r,(list,tuple)) else r
  vs.extend([tuple(p+radius*(q*math.cos(t)+w*math.sin(t))) for t in (0,math.pi/2,math.pi,3*math.pi/2)])
 fs=[(k*4+j,k*4+(j+1)%4,(k+1)*4+(j+1)%4,(k+1)*4+j) for k in range(len(pts)-1) for j in range(4)]
 fs.extend([(3,2,1,0),tuple((len(pts)-1)*4+j for j in range(4))])
 ob=solid_mesh(name,vs,fs,role);parts.append(ob);return ob
nr=12 if args.budget=='low' else 18
# Longitudinal stations combine source profile breaks and sampled wheel crests.
xs=sorted(set([-2.3,-2.13,-2.05,-1.98,-1.805,-1.65,-1.4,-1.2,-.995,-.82,-.6,-.3,.3,.5,.75,.995,1.2,1.4,1.65,1.805,1.98,2.08,2.3]))
if args.budget=='high':xs=sorted(set(xs+[-1.88,-1.08,-.45,.9,1.88,2.2]))
else:xs=[-2.3,-2.13,-1.805,-1.4,-.995,-.6,-.3,.3,.75,.995,1.4,1.805,2.08,2.3]
verts=[body_point(x,2*math.pi*j/nr) for x in xs for j in range(nr)]
faces=[];coords=[]
for i in range(len(xs)-1):
 for j in range(nr):
  faces.append((i*nr+j,i*nr+(j+1)%nr,(i+1)*nr+(j+1)%nr,(i+1)*nr+j))
  coords.append([uv('coachwork',(xs[q]+2.3)/4.6,t/nr) for q,t in [(i,j),(i,j+1),(i+1,j+1),(i+1,j)]])
for k,name in [(0,'nose'),(len(xs)-1,'tail')]:
 face=list(range(k*nr,(k+1)*nr));face=face[::-1] if k==0 else face;faces.append(face)
 coords.append([uv(name,(verts[v][1]/interp(xs[k],WIDTH)+1)/2,1-(verts[v][2]-.19)/(interp(xs[k],DECK)-.19)) for v in face])
body=mesh('Body_source_function_retopology',verts,faces,coords);parts.append(body)
cutmat=bpy.data.materials.new('Temporary_cut_face_owner');body.data.materials.append(cutmat)
# Pocket cuts stay local to each wheel, preserving the central hood/deck.
for x in (-1.4,1.4):
 for s in (-1,1):
  bpy.ops.mesh.primitive_cylinder_add(vertices=16 if args.budget=='low' else 24,radius=.405,depth=.68,location=(x,s*1.,.34),rotation=(math.pi/2,0,0))
  cutter=bpy.context.object
  if cutter.data.uv_layers:cutter.data.uv_layers.active.name='SemanticUV'
  cutter.data.materials.append(mat);cutter.data.materials.append(cutmat)
  for p in cutter.data.polygons:p.material_index=1
  mod=body.modifiers.new('Actual local open well','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
  bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
# Newly created circular interior faces explicitly own the ink swatch.
for p in body.data.polygons:
 if p.material_index==1:
  for li in p.loop_indices:body.data.uv_layers.active.data[li].uv=swatch('ink')
 p.material_index=0
body.data.materials.pop(index=1)

def patch(name,corners,region,nu=3,nv=3,bulge=0,flip=False):
 a,b,c,d=map(Vector,corners);vs=[]
 for i in range(nu+1):
  u=i/nu
  for j in range(nv+1):
   v=j/nv;p=a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v;p.z+=bulge*math.sin(math.pi*u)*math.sin(math.pi*v);vs.append(tuple(p))
 fs=[];cs=[]
 for i in range(nu):
  for j in range(nv):
   fs.append((i*(nv+1)+j,(i+1)*(nv+1)+j,(i+1)*(nv+1)+j+1,i*(nv+1)+j+1))
   cs.append([uv(region,v, u if flip else 1-u) for u,v in [(i/nu,j/nv),((i+1)/nu,j/nv),((i+1)/nu,(j+1)/nv),(i/nu,(j+1)/nv)]])
 ob=mesh(name,vs,fs,cs);parts.append(ob);return ob
n=2 if args.budget=='low' else 4
patch('Front windshield',[(-.82,-.70,.65),(-.28,-.575,1.015),(-.28,.575,1.015),(-.82,.70,.65)],'front_glass',n,n,.025)
patch('Rear glass',[(.75,-.59,1.015),(1.28,-.76,.675),(1.28,.76,.675),(.75,.59,1.015)],'rear_glass',n,n,.018,True)
patch('Roof',[(-.30,-.60,1.025),(.77,-.61,1.025),(.77,.61,1.025),(-.30,.60,1.025)],'roof',n,n,.045)
for s in (-1,1):
 patch('Side glass '+str(s),[(-.79,s*.715,.65),(-.26,s*.601,1.014),(.73,s*.621,1.014),(1.22,s*.764,.68)],'side_glass',n,2,.008)
 rail('A pillar source landmark',[(-.84,s*.71,.65),(-.30,s*.60,1.035)],.035,'red_mid')
 rail('Rear buttress source landmark',[(.76,s*.62,1.026),(1.32,s*.79,.665)],[.043,.014],'red_mid')
 rail('Roof drip rail source landmark',[(-.30,s*.61,1.03),(.77,s*.62,1.03)],.022,'red_mid')
 # Source lamps are deliberately attached to the same hood landmarks.
 lamp=patch('Swept lamp '+str(s),[(-2.16,s*.49,.480),(-1.91,s*.54,.548),(-1.83,s*.76,.572),(-2.12,s*.70,.497)],'roof',1,1,.008)
 for p in lamp.data.polygons:
  for li in p.loop_indices:lamp.data.uv_layers.active.data[li].uv=swatch('white')
 # Raised arch lip is a short semantic ribbon, not a complete second fender shell.
 for x in (-1.4,1.4):
  seg=8 if args.budget=='low' else 12;vs=[]
  for j in range(seg+1):
   t=math.pi*j/seg
   for r in (.405,.442):
    xx=x+r*math.cos(t);vs.append((xx,s*(interp(x,WIDTH)+.004),.34+r*math.sin(t)))
  fs=[(2*j,2*j+1,2*j+3,2*j+2) for j in range(seg)]
  cs=[[uv('fender',j/seg,1),uv('fender',j/seg,0),uv('fender',(j+1)/seg,0),uv('fender',(j+1)/seg,1)] for j in range(seg)]
  parts.append(mesh('Rolled fender lip',vs,fs,cs))
 # Mirrors keep source dimensions with a tiny octagonal ellipsoid.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=6 if args.budget=='low' else 8,ring_count=3 if args.budget=='low' else 4,location=(-.64,s*.958,.755))
 ob=bpy.context.object;ob.name='Aerodynamic mirror';ob.scale=(.13,.075,.052);ob.parent=root;ob.data.materials.append(mat)
 if not ob.data.uv_layers:ob.data.uv_layers.new()
 ob.data.uv_layers.active.name='SemanticUV'
 for p in ob.data.polygons:
  for li in p.loop_indices:ob.data.uv_layers.active.data[li].uv=swatch('red_mid')
 parts.append(ob)
 # A small tapered stalk joins each source-position mirror to the aperture.
 a=(-.64,s*.735,.74);b=(-.64,s*.93,.74);r=.019
 vs=[(x+dx,y,z+dz) for x,y,z in (a,b) for dx,dz in [(-r,-r),(r,-r),(r,r),(-r,r)]]
 fs=[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 parts.append(solid_mesh('Mirror stalk',vs,fs,'ink'))

rail('Front splitter source landmark',[(-2.25,-.73,.196),(-2.34,-.36,.19),(-2.34,.36,.19),(-2.25,.73,.196)],.022,'ink')
rail('Integrated rear lip source landmark',[(2.14,-.82,.637),(2.20,0,.652),(2.14,.82,.637)],.027,'red_light')
parts.append(solid_mesh('Actual recessed rear diffuser',[(2.307,-.62,.20),(2.307,.62,.20),(2.31,.58,.385),(2.31,-.58,.385)],[(0,1,2,3)],'ink'))
for s in (-1,1):
 rail('Diffuser outer vane',[(2.32,s*.40,.20),(2.34,s*.40,.35)],.012,'rim')
 tail=patch('Rear blade lamp source landmark',[(2.301,s*.19,.47),(2.296,s*.70,.47),(2.285,s*.70,.54),(2.30,s*.19,.54)],'tail',1,1)
 for p in tail.data.polygons:
  for li in p.loop_indices:tail.data.uv_layers.active.data[li].uv=swatch('ruby')

# Merge all static geometry into one body primitive, preserving atlas islands.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name='Body'
for layer in list(body.data.uv_layers):
 if layer.name!='SemanticUV':body.data.uv_layers.remove(layer)
body.data.uv_layers.active_index=0

wheels=[];wheel_segments=12 if args.budget=='low' else 16
for x in (-1.4,1.4):
 for s in (-1,1):
  tag=('F' if x<0 else 'R')+('L' if s<0 else 'R')
  steer=bpy.data.objects.new('Wheel_'+tag+'_Steer',None);scene.collection.objects.link(steer);steer.parent=root;steer.location=(x,s*.87,.34)
  steer['steering_enabled']=x<0;steer['steer_axis_gltf']=[0,1,0]
  roll=bpy.data.objects.new('Wheel_'+tag+'_Roll',None);scene.collection.objects.link(roll);roll.parent=steer
  roll['wheel_radius']=.34*scale;roll['roll_axis_gltf']=[0,0,-1]
  # Source torus envelope plus inset planar painted cap, all one rigid assembly.
  rings=[(-.062,.258),(-.038,.316),(.02,.34),(.102,.258),(.136,.232)]
  vs=[];fs=[];cs=[]
  for y,r in rings:
   for j in range(wheel_segments):
    t=2*math.pi*j/wheel_segments;vs.append((r*math.cos(t),s*y,r*math.sin(t)))
  for k in range(len(rings)-1):
   for j in range(wheel_segments):
    fs.append((k*wheel_segments+j,k*wheel_segments+(j+1)%wheel_segments,(k+1)*wheel_segments+(j+1)%wheel_segments,(k+1)*wheel_segments+j))
    cs.append([uv('tread',j/wheel_segments,k/4),uv('tread',(j+1)/wheel_segments,k/4),uv('tread',(j+1)/wheel_segments,(k+1)/4),uv('tread',j/wheel_segments,(k+1)/4)])
  for k in (0,4):
   f=[k*wheel_segments+j for j in range(wheel_segments)];fs.append(f[::-1] if k==0 else f)
   cs.append([uv('wheel_cap',.5+vs[v][0]/.516,.5-vs[v][2]/.516) for v in fs[-1]])
  wheel=mesh('Wheel_'+tag+'_tire_hub',vs,fs,cs);wheel.parent=roll
  wheels.append({'name':tag,'center':[x,s*.87,.34],'radius':.34,'exportedRadius':.34*scale})

# Recalculate normals so glTF consumers can render with ordinary backface culling.
for ob in [o for o in scene.objects if o.type=='MESH']:
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
root['source_approach']='141 approach 3';root['export_world_scale']=scale
source_stats=[]
for ob in [o for o in scene.objects if o.type=='MESH']:
 ob.data.calc_loop_triangles();source_stats.append({'name':ob.name,'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles),'modifiers':len(ob.modifiers),'uvLayers':[l.name for l in ob.data.uv_layers]})
assert len(source_stats)==5 and all(o['modifiers']==0 and o['uvLayers']==['SemanticUV'] for o in source_stats)
bpy.ops.object.camera_add(location=(0,-12*math.cos(math.radians(50)),12*math.sin(math.radians(50))))
source_cam=bpy.context.object;source_cam.name='Contract_camera_source_units';source_cam.rotation_euler=(-source_cam.location).to_track_quat('-Z','Y').to_euler();source_cam.data.type='ORTHO';source_cam.data.ortho_scale=7.2;scene.camera=source_cam
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'car.blend'))
root.scale=(scale,)*3
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for ob in root.children_recursive:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',use_selection=True,export_extras=True,export_materials='EXPORT',export_yup=True,export_cameras=False,export_lights=False)
(DATA/'build.json').write_text(json.dumps({'budget':args.budget,'wheelRecords':wheels,'sourceStations':xs,'radialSegments':nr,'cameraScale':scale,'renderedFrom':'reimported public model.glb','sourceMeshStats':source_stats,'packedAtlas':im.packed_file is not None},indent=2)+'\n')
# Discard author scene and round trip the actual export, then make all proof renders.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT/'model.glb'))
tops=[o for o in scene.objects if o.parent is None]
proof=bpy.data.objects.new('Proof_yaw',None);scene.collection.objects.link(proof)
for o in tops:o.parent=proof
bpy.ops.object.camera_add(location=(0,-12*scale*math.cos(math.radians(50)),12*scale*math.sin(math.radians(50))))
cam=bpy.context.object;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.2*scale;scene.camera=cam
for i in range(8):
 proof.rotation_euler.z=math.radians(45*i);scene.render.filepath=str(DATA/f'raw-{i}.png');bpy.ops.render.render(write_still=True)
for yaw in (22.5,67.5,157.5,292.5):
 proof.rotation_euler.z=math.radians(yaw);scene.render.filepath=str(DATA/f'novel-{yaw}.png');bpy.ops.render.render(write_still=True)
proof.rotation_euler.z=0
for i in (0,1,2,3):
 for o in scene.objects:
  if o.name.startswith('Wheel_') and '_Roll' in o.name:o.rotation_euler.y=math.pi*i/2
 scene.render.filepath=str(DATA/f'roll-{i}.png');bpy.ops.render.render(write_still=True)
# Optional proof of actual exported topology, made after the paint captures.
for o in scene.objects:
 if o.name.startswith('Wheel_') and '_Roll' in o.name:o.rotation_euler.y=0
wiremat=bpy.data.materials.new('Proof_only_wireframe');wiremat.use_nodes=True;wn=wiremat.node_tree.nodes;wn.clear()
wire=wn.new('ShaderNodeWireframe');wire.inputs['Size'].default_value=.006*scale
mix=wn.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.54,.22,.24,1);mix.inputs[2].default_value=(.035,.04,.065,1)
wo=wn.new('ShaderNodeOutputMaterial');wiremat.node_tree.links.new(wire.outputs[0],mix.inputs[0]);wiremat.node_tree.links.new(mix.outputs[0],wo.inputs[0])
for o in scene.objects:
 if o.type=='MESH':o.data.materials.clear();o.data.materials.append(wiremat)
for i,yaw in enumerate((0,45,90,135)):
 proof.rotation_euler.z=math.radians(yaw);scene.render.filepath=str(DATA/f'wire-{i}.png');bpy.ops.render.render(write_still=True)
print('ACTUAL_GLB_RENDER_COMPLETE',flush=True)
